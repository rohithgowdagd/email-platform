"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  parsePlaceholders,
  validatePlaceholders,
} from "@/lib/templates/render";

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

  const bodyText = optionalField(formData, "body_text");
  const parsedPlaceholders = parsePlaceholders(placeholders);
  const { undeclared, unused } = validatePlaceholders({
    subject,
    bodyHtml,
    bodyText,
    placeholders: parsedPlaceholders,
  });

  if (undeclared.length > 0) {
    redirect(
      `/templates/new?error=${encodeURIComponent(
        `Body references undeclared placeholders: ${undeclared.join(", ")}`,
      )}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      slug,
      name,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
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
  const params = new URLSearchParams({ saved: "1" });
  if (unused.length > 0) {
    params.set("warning", `Declared but unused: ${unused.join(", ")}`);
  }
  redirect(`/templates/${data.id}?${params.toString()}`);
}
