"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const ONCE_PER_RECIPIENT_COOLDOWN_SECONDS = 30 * 24 * 60 * 60; // 30 days

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createTrigger(formData: FormData) {
  const name = field(formData, "name");
  const eventTypeId = field(formData, "event_type_id");
  const templateId = field(formData, "template_id");
  const recipientExpr = field(formData, "recipient_expr") || "$.user.email";

  if (!name || !eventTypeId || !templateId) {
    redirect(
      `/triggers/new?error=${encodeURIComponent(
        "Name, event type, and template are required",
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
        `/triggers/new?error=${encodeURIComponent(`Invalid conditions: ${message}`)}`,
      );
    }
  }

  // "Send at most once per recipient": dedup by the same expression that
  // resolves the recipient. Cooldown = 30 days.
  const oncePerRecipient = field(formData, "once_per_recipient") === "on";
  const dedupeKeyExpr = oncePerRecipient ? recipientExpr : null;
  const cooldownSeconds = oncePerRecipient
    ? ONCE_PER_RECIPIENT_COOLDOWN_SECONDS
    : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("triggers")
    .insert({
      name,
      description: null,
      event_type_id: eventTypeId,
      template_id: templateId,
      recipient_expr: recipientExpr,
      dedupe_key_expr: dedupeKeyExpr,
      cooldown_seconds: cooldownSeconds,
      conditions: conditions as never,
      active: field(formData, "active") === "on",
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/triggers/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/triggers");
  redirect(`/triggers/${data.id}`);
}
