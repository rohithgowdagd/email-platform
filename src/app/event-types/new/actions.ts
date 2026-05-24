"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createEventType(formData: FormData) {
  const name = field(formData, "name");
  if (!name) {
    redirect(
      `/event-types/new?error=${encodeURIComponent("Name is required")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_types")
    .insert({
      name,
      description: null,
      payload_schema: {} as never,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/event-types/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/event-types");
  redirect(`/event-types/${data.id}`);
}
