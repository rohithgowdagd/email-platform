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

export async function updateEventType(id: string, formData: FormData) {
  const name = field(formData, "name");
  if (!name) {
    redirect(
      `/event-types/${id}?error=${encodeURIComponent("Name is required")}`,
    );
  }

  const rawSchema = field(formData, "payload_schema");
  let payloadSchema: unknown = {};
  if (rawSchema.length > 0) {
    try {
      payloadSchema = JSON.parse(rawSchema);
      if (
        !payloadSchema ||
        typeof payloadSchema !== "object" ||
        Array.isArray(payloadSchema)
      ) {
        throw new Error("payload_schema must be a JSON object");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      redirect(
        `/event-types/${id}?error=${encodeURIComponent(`Invalid payload schema JSON: ${message}`)}`,
      );
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .update({
      name,
      description: optionalField(formData, "description"),
      payload_schema: payloadSchema as never,
    })
    .eq("id", id);

  if (error) {
    redirect(`/event-types/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/event-types");
  revalidatePath(`/event-types/${id}`);
  redirect(`/event-types/${id}?saved=1`);
}

export async function deleteEventType(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .delete()
    .eq("id", id);

  if (error) {
    // FK constraints (triggers / events referencing this type) will surface here.
    redirect(
      `/event-types/${id}?error=${encodeURIComponent(
        `${error.message}. Tip: delete or repoint triggers/events that reference this type first.`,
      )}`,
    );
  }

  revalidatePath("/event-types");
  redirect("/event-types");
}
