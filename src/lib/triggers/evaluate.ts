import type { SupabaseClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/resend";
import type { Database } from "@/lib/supabase/database.types";
import {
  parsePlaceholders,
  renderTemplate,
} from "@/lib/templates/render";

import {
  evaluateConditions,
  parseConditions,
  resolvePath,
} from "./conditions";

type Client = SupabaseClient<Database>;

export type RunResultStatus = "sent" | "skipped" | "failed";

export type RunResult = {
  trigger_id: string;
  trigger_name: string;
  status: RunResultStatus;
  reason?: string;
  recipient?: string;
  provider_message_id?: string;
  send_id?: string;
};

// Run a single event through the engine: find active matching triggers,
// evaluate conditions, apply dedup/cooldown, render, send, and audit.
// Returns one RunResult per trigger that matched conditions; triggers whose
// conditions did not match are skipped silently (no `sends` row).
export async function runEvent(
  supabase: Client,
  eventId: string,
): Promise<RunResult[]> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, event_type_id, payload")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    throw new Error(`Event ${eventId} not found: ${eventError?.message ?? ""}`);
  }

  const { data: triggers, error: triggersError } = await supabase
    .from("triggers")
    .select(
      "id, name, conditions, recipient_expr, dedupe_key_expr, cooldown_seconds, template_id, templates(id, subject, body_html, body_text, placeholders)",
    )
    .eq("event_type_id", event.event_type_id)
    .eq("active", true);

  if (triggersError) {
    throw new Error(`Failed to load triggers: ${triggersError.message}`);
  }

  const payload = event.payload;
  const results: RunResult[] = [];

  for (const trigger of triggers ?? []) {
    const result = await processTrigger(supabase, event.id, payload, trigger);
    if (result) results.push(result);
  }

  return results;
}

type TriggerWithTemplate = {
  id: string;
  name: string;
  conditions: unknown;
  recipient_expr: string;
  dedupe_key_expr: string | null;
  cooldown_seconds: number | null;
  template_id: string;
  templates: {
    id: string;
    subject: string;
    body_html: string;
    body_text: string | null;
    placeholders: unknown;
  } | null;
};

async function processTrigger(
  supabase: Client,
  eventId: string,
  payload: unknown,
  trigger: TriggerWithTemplate,
): Promise<RunResult | null> {
  const conditions = parseConditions(trigger.conditions);
  if (!evaluateConditions(conditions, payload)) {
    // Conditions did not match — silent skip, no audit row.
    return null;
  }

  if (!trigger.templates) {
    // Schema has ON DELETE RESTRICT, so this shouldn't be possible, but guard.
    return await recordSkip(supabase, eventId, trigger, "", null, "template missing");
  }

  // Resolve recipient.
  const recipientRaw = resolvePath(payload, trigger.recipient_expr);
  const recipient = typeof recipientRaw === "string" ? recipientRaw.trim() : "";
  if (recipient === "") {
    return await recordSkip(
      supabase,
      eventId,
      trigger,
      "",
      null,
      "no recipient",
    );
  }

  // Dedup/cooldown check.
  let dedupeKey: string | null = null;
  if (trigger.dedupe_key_expr) {
    const dedupeRaw = resolvePath(payload, trigger.dedupe_key_expr);
    if (dedupeRaw !== undefined && dedupeRaw !== null && dedupeRaw !== "") {
      dedupeKey = String(dedupeRaw);
      let query = supabase
        .from("sends")
        .select("id, sent_at")
        .eq("trigger_id", trigger.id)
        .eq("dedupe_key", dedupeKey)
        .in("status", ["queued", "sent"])
        .order("sent_at", { ascending: false })
        .limit(1);

      if (trigger.cooldown_seconds && trigger.cooldown_seconds > 0) {
        const cutoff = new Date(
          Date.now() - trigger.cooldown_seconds * 1000,
        ).toISOString();
        query = query.gte("sent_at", cutoff);
      }

      const { data: existing } = await query.maybeSingle();
      if (existing) {
        const reason = trigger.cooldown_seconds
          ? `cooldown (${trigger.cooldown_seconds}s)`
          : "dedup";
        return await recordSkip(
          supabase,
          eventId,
          trigger,
          recipient,
          dedupeKey,
          reason,
        );
      }
    }
  }

  // Render.
  const placeholders = parsePlaceholders(trigger.templates.placeholders);
  const rendered = renderTemplate({
    subject: trigger.templates.subject,
    bodyHtml: trigger.templates.body_html,
    bodyText: trigger.templates.body_text,
    placeholders,
    values: (payload ?? {}) as Record<string, unknown>,
  });

  if (!rendered.ok) {
    const { data: inserted } = await supabase
      .from("sends")
      .insert({
        trigger_id: trigger.id,
        template_id: trigger.template_id,
        event_id: eventId,
        recipient_email: recipient,
        rendered_subject: trigger.templates.subject,
        rendered_body: trigger.templates.body_html,
        status: "failed",
        dedupe_key: dedupeKey,
        error_message: rendered.error,
      })
      .select("id")
      .single();
    return {
      trigger_id: trigger.id,
      trigger_name: trigger.name,
      status: "failed",
      reason: rendered.error,
      recipient,
      send_id: inserted?.id,
    };
  }

  // Send.
  const sendResult = await sendEmail({
    to: recipient,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text || undefined,
  });

  if (!sendResult.ok) {
    const { data: inserted } = await supabase
      .from("sends")
      .insert({
        trigger_id: trigger.id,
        template_id: trigger.template_id,
        event_id: eventId,
        recipient_email: recipient,
        rendered_subject: rendered.subject,
        rendered_body: rendered.html,
        status: "failed",
        dedupe_key: dedupeKey,
        error_message: sendResult.error,
      })
      .select("id")
      .single();
    return {
      trigger_id: trigger.id,
      trigger_name: trigger.name,
      status: "failed",
      reason: sendResult.error,
      recipient,
      send_id: inserted?.id,
    };
  }

  const { data: inserted } = await supabase
    .from("sends")
    .insert({
      trigger_id: trigger.id,
      template_id: trigger.template_id,
      event_id: eventId,
      recipient_email: recipient,
      rendered_subject: rendered.subject,
      rendered_body: rendered.html,
      status: "sent",
      dedupe_key: dedupeKey,
      provider_message_id: sendResult.messageId,
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  return {
    trigger_id: trigger.id,
    trigger_name: trigger.name,
    status: "sent",
    recipient,
    provider_message_id: sendResult.messageId,
    send_id: inserted?.id,
  };
}

async function recordSkip(
  supabase: Client,
  eventId: string,
  trigger: TriggerWithTemplate,
  recipient: string,
  dedupeKey: string | null,
  reason: string,
): Promise<RunResult> {
  const subject = trigger.templates?.subject ?? "";
  const body = trigger.templates?.body_html ?? "";
  const { data: inserted } = await supabase
    .from("sends")
    .insert({
      trigger_id: trigger.id,
      template_id: trigger.template_id,
      event_id: eventId,
      recipient_email: recipient,
      rendered_subject: subject,
      rendered_body: body,
      status: "skipped",
      dedupe_key: dedupeKey,
      error_message: reason,
    })
    .select("id")
    .single();

  return {
    trigger_id: trigger.id,
    trigger_name: trigger.name,
    status: "skipped",
    reason,
    recipient: recipient || undefined,
    send_id: inserted?.id,
  };
}
