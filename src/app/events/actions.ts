"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  previewEvent,
  runEvent,
  type PreviewResult,
  type RunResult,
} from "@/lib/triggers/evaluate";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function fireTestEvent(formData: FormData) {
  const eventTypeId = field(formData, "event_type_id");
  const rawPayload = field(formData, "payload");
  const idempotencyKey = field(formData, "idempotency_key");

  if (!eventTypeId) {
    redirect(`/events?error=${encodeURIComponent("Pick an event type")}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload || "{}");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("payload must be a JSON object");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(
      `/events?error=${encodeURIComponent(`Invalid payload JSON: ${message}`)}`,
    );
  }

  const supabase = await createClient();

  // Idempotency: if the same (event_type_id, idempotency_key) exists, short-circuit.
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("event_type_id", eventTypeId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      const summary = encodeSummary({
        event_id: existing.id,
        idempotent: true,
        runs: [],
      });
      revalidatePath("/events");
      redirect(`/events?fired=${summary}`);
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({
      event_type_id: eventTypeId,
      payload: payload as never,
      idempotency_key: idempotencyKey || null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    redirect(
      `/events?error=${encodeURIComponent(insertError?.message ?? "Failed to insert event")}`,
    );
  }

  let runs: RunResult[] = [];
  try {
    runs = await runEvent(supabase, inserted.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(`/events?error=${encodeURIComponent(message)}`);
  }

  const summary = encodeSummary({
    event_id: inserted.id,
    idempotent: false,
    runs,
  });
  revalidatePath("/events");
  redirect(`/events?fired=${summary}`);
}

type FiredSummary = {
  event_id: string;
  idempotent: boolean;
  runs: RunResult[];
};

function encodeSummary(s: FiredSummary): string {
  return encodeURIComponent(JSON.stringify(s));
}

// Dry-run: evaluate the engine's decision against a payload without inserting
// an event row, rendering the template, or sending an email. Demonstrates the
// "decides which template (if any) to send" step in isolation.
export async function previewTriggers(formData: FormData) {
  const eventTypeId = field(formData, "event_type_id");
  const rawPayload = field(formData, "payload");

  if (!eventTypeId) {
    redirect(`/events?error=${encodeURIComponent("Pick an event type")}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload || "{}");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("payload must be a JSON object");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(
      `/events?error=${encodeURIComponent(`Invalid payload JSON: ${message}`)}`,
    );
  }

  const supabase = await createClient();

  let preview: PreviewResult[] = [];
  try {
    preview = await previewEvent(supabase, eventTypeId, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(`/events?error=${encodeURIComponent(message)}`);
  }

  const summary = encodeURIComponent(JSON.stringify({ preview }));
  redirect(`/events?preview=${summary}`);
}
