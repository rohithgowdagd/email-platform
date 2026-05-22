"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalField(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return value.length > 0 ? value : null;
}

export async function createTrigger(formData: FormData) {
  const name = field(formData, "name");
  const eventTypeId = field(formData, "event_type_id");
  const templateId = field(formData, "template_id");
  const recipientExpr = field(formData, "recipient_expr");

  if (!name || !eventTypeId || !templateId || !recipientExpr) {
    redirect(
      `/triggers/new?error=${encodeURIComponent(
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
        `/triggers/new?error=${encodeURIComponent(`Invalid conditions JSON: ${message}`)}`,
      );
    }
  }

  const cooldownRaw = field(formData, "cooldown_seconds");
  let cooldownSeconds: number | null = null;
  if (cooldownRaw.length > 0) {
    const n = Number(cooldownRaw);
    if (!Number.isFinite(n) || n < 0) {
      redirect(
        `/triggers/new?error=${encodeURIComponent(
          "Cooldown must be a non-negative integer (seconds)",
        )}`,
      );
    }
    cooldownSeconds = Math.floor(n);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("triggers")
    .insert({
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
    .select("id")
    .single();

  if (error) {
    redirect(`/triggers/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/triggers");
  redirect(`/triggers/${data.id}`);
}
