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

export async function createEventType(formData: FormData) {
  const name = field(formData, "name");
  if (!name) {
    redirect(
      `/event-types/new?error=${encodeURIComponent("Name is required")}`,
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
        `/event-types/new?error=${encodeURIComponent(`Invalid payload schema JSON: ${message}`)}`,
      );
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_types")
    .insert({
      name,
      description: optionalField(formData, "description"),
      payload_schema: payloadSchema as never,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/event-types/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/event-types");
  redirect(`/event-types/${data.id}`);
}
