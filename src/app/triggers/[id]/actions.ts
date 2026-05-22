"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  evaluateConditions,
  parseConditions,
  resolvePath,
} from "@/lib/triggers/conditions";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalField(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return value.length > 0 ? value : null;
}

export async function updateTrigger(id: string, formData: FormData) {
  const name = field(formData, "name");
  const eventTypeId = field(formData, "event_type_id");
  const templateId = field(formData, "template_id");
  const recipientExpr = field(formData, "recipient_expr");

  if (!name || !eventTypeId || !templateId || !recipientExpr) {
    redirect(
      `/triggers/${id}?error=${encodeURIComponent(
        "Name, event type, template, and recipient expression are required",
      )}`,
    );
  }

  let conditions: unknown = null;
  const rawConditions = field(formData, "conditions");
  if (rawConditions.length > 0 && rawConditions !== "null") {
    try {
      conditions = JSON.parse(rawConditions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      redirect(
        `/triggers/${id}?error=${encodeURIComponent(`Invalid conditions JSON: ${message}`)}`,
      );
    }
  }

  const cooldownRaw = field(formData, "cooldown_seconds");
  let cooldownSeconds: number | null = null;
  if (cooldownRaw.length > 0) {
    const n = Number(cooldownRaw);
    if (!Number.isFinite(n) || n < 0) {
      redirect(
        `/triggers/${id}?error=${encodeURIComponent(
          "Cooldown must be a non-negative integer (seconds)",
        )}`,
      );
    }
    cooldownSeconds = Math.floor(n);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("triggers")
    .update({
      name,
      description: optionalField(formData, "description"),
      event_type_id: eventTypeId,
      template_id: templateId,
      recipient_expr: recipientExpr,
      dedupe_key_expr: optionalField(formData, "dedupe_key_expr"),
      cooldown_seconds: cooldownSeconds,
      conditions: conditions as never,
      active: field(formData, "active") === "on",
    })
    .eq("id", id);

  if (error) {
    redirect(`/triggers/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/triggers");
  revalidatePath(`/triggers/${id}`);
  redirect(`/triggers/${id}?saved=1`);
}

export async function deleteTrigger(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("triggers").delete().eq("id", id);

  if (error) {
    redirect(`/triggers/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/triggers");
  redirect("/triggers");
}

// Pure dry-run: evaluate this trigger's conditions against the supplied payload
// without inserting an `events` row or actually sending. Reports match status,
// resolved recipient, and resolved dedup key. Helpful for iterating on rules.
export async function dryRunTrigger(id: string, formData: FormData) {
  const rawPayload = field(formData, "payload");
  let payload: unknown = {};
  if (rawPayload.length > 0) {
    try {
      payload = JSON.parse(rawPayload);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("payload must be a JSON object");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      redirect(
        `/triggers/${id}?dry_error=${encodeURIComponent(`Invalid payload JSON: ${message}`)}`,
      );
    }
  }

  const supabase = await createClient();
  const { data: trigger, error } = await supabase
    .from("triggers")
    .select("conditions, recipient_expr, dedupe_key_expr")
    .eq("id", id)
    .single();

  if (error || !trigger) {
    redirect(
      `/triggers/${id}?dry_error=${encodeURIComponent(error?.message ?? "Trigger not found")}`,
    );
  }

  const matched = evaluateConditions(parseConditions(trigger.conditions), payload);
  const recipientRaw = resolvePath(payload, trigger.recipient_expr);
  const recipient =
    typeof recipientRaw === "string" && recipientRaw.trim()
      ? recipientRaw.trim()
      : null;

  let dedupeKey: string | null = null;
  if (trigger.dedupe_key_expr) {
    const raw = resolvePath(payload, trigger.dedupe_key_expr);
    if (raw !== undefined && raw !== null && raw !== "") {
      dedupeKey = String(raw);
    }
  }

  const summary = {
    matched,
    recipient,
    dedupe_key: dedupeKey,
    payload: rawPayload,
  };
  redirect(
    `/triggers/${id}?dry=${encodeURIComponent(JSON.stringify(summary))}`,
  );
}
