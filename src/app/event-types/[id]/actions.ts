"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateEventType(id: string, formData: FormData) {
  const name = field(formData, "name");
  if (!name) {
    redirect(
      `/event-types/${id}?error=${encodeURIComponent("Name is required")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .update({ name })
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
    redirect(
      `/event-types/${id}?error=${encodeURIComponent(
        `${error.message}. Tip: delete or repoint triggers/events that reference this type first.`,
      )}`,
    );
  }

  revalidatePath("/event-types");
  redirect("/event-types");
}
