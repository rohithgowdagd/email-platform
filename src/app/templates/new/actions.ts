"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  autoParagraph,
  derivePlaceholders,
  slugify,
} from "@/lib/templates/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Find an unused slug derived from a name. Appends -2, -3 etc. on collision.
async function uniqueSlug(
  supabase: SupabaseClient<Database>,
  base: string,
): Promise<string> {
  if (!base) base = "template";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase
      .from("templates")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function createTemplate(formData: FormData) {
  const name = field(formData, "name");
  const subject = field(formData, "subject");
  const bodyHtml = field(formData, "body_html");

  if (!name || !subject || !bodyHtml) {
    redirect(
      `/templates/new?error=${encodeURIComponent("Name, subject, and body are required")}`,
    );
  }

  const supabase = await createClient();
  const slug = await uniqueSlug(supabase, slugify(name));
  const wrappedBody = autoParagraph(bodyHtml);
  const placeholders = derivePlaceholders({ subject, bodyHtml: wrappedBody });

  const { data, error } = await supabase
    .from("templates")
    .insert({
      slug,
      name,
      subject,
      body_html: wrappedBody,
      body_text: null,
      description: null,
      category: null,
      placeholders: placeholders as never,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/templates/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/templates");
  redirect(`/templates/${data.id}`);
}
