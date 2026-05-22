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

export async function createTemplate(formData: FormData) {
  const slug = field(formData, "slug");
  const name = field(formData, "name");
  const subject = field(formData, "subject");
  const bodyHtml = field(formData, "body_html");

  if (!slug || !name || !subject || !bodyHtml) {
    redirect(
      `/templates/new?error=${encodeURIComponent("Name, slug, subject, and HTML body are required")}`,
    );
  }

  const rawPlaceholders = field(formData, "placeholders");
  let placeholders: unknown = [];
  if (rawPlaceholders.length > 0) {
    try {
      placeholders = JSON.parse(rawPlaceholders);
      if (!Array.isArray(placeholders)) {
        throw new Error("placeholders must be a JSON array");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      redirect(
        `/templates/new?error=${encodeURIComponent(`Invalid placeholders JSON: ${message}`)}`,
      );
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      slug,
      name,
      subject,
      body_html: bodyHtml,
      body_text: optionalField(formData, "body_text"),
      description: optionalField(formData, "description"),
      category: optionalField(formData, "category"),
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
