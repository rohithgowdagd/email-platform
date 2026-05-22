"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import {
  parsePlaceholders,
  renderTemplate,
  type Placeholder,
} from "@/lib/templates/render";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalField(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return value.length > 0 ? value : null;
}

export async function updateTemplate(id: string, formData: FormData) {
  const slug = field(formData, "slug");
  const name = field(formData, "name");
  const subject = field(formData, "subject");
  const bodyHtml = field(formData, "body_html");

  if (!slug || !name || !subject || !bodyHtml) {
    redirect(
      `/templates/${id}?error=${encodeURIComponent("Name, slug, subject, and HTML body are required")}`,
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
        `/templates/${id}?error=${encodeURIComponent(`Invalid placeholders JSON: ${message}`)}`,
      );
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("templates")
    .update({
      slug,
      name,
      subject,
      body_html: bodyHtml,
      body_text: optionalField(formData, "body_text"),
      description: optionalField(formData, "description"),
      category: optionalField(formData, "category"),
      placeholders: placeholders as never,
    })
    .eq("id", id);

  if (error) {
    redirect(`/templates/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  redirect(`/templates/${id}?saved=1`);
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("templates").delete().eq("id", id);

  if (error) {
    redirect(`/templates/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/templates");
  redirect("/templates");
}

export async function sendTestEmail(id: string, formData: FormData) {
  const recipient = field(formData, "recipient");
  const rawValues = field(formData, "values");

  if (!recipient) {
    redirect(
      `/templates/${id}?test_error=${encodeURIComponent("Recipient email is required")}`,
    );
  }

  let values: Record<string, unknown> = {};
  if (rawValues.length > 0) {
    try {
      const parsed: unknown = JSON.parse(rawValues);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("values must be a JSON object");
      }
      values = parsed as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      redirect(
        `/templates/${id}?test_error=${encodeURIComponent(`Invalid values JSON: ${message}`)}`,
      );
    }
  }

  const supabase = await createClient();
  const { data: template, error: loadError } = await supabase
    .from("templates")
    .select("subject, body_html, body_text, placeholders")
    .eq("id", id)
    .single();

  if (loadError || !template) {
    redirect(
      `/templates/${id}?test_error=${encodeURIComponent(loadError?.message ?? "Template not found")}`,
    );
  }

  const placeholders: Placeholder[] = parsePlaceholders(template.placeholders);
  const rendered = renderTemplate({
    subject: template.subject,
    bodyHtml: template.body_html,
    bodyText: template.body_text,
    placeholders,
    values,
  });

  if (!rendered.ok) {
    await supabase.from("sends").insert({
      template_id: id,
      recipient_email: recipient,
      rendered_subject: template.subject,
      rendered_body: template.body_html,
      status: "failed",
      error_message: rendered.error,
    });
    redirect(
      `/templates/${id}?test_error=${encodeURIComponent(rendered.error)}`,
    );
  }

  const result = await sendEmail({
    to: recipient,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text || undefined,
  });

  if (!result.ok) {
    await supabase.from("sends").insert({
      template_id: id,
      recipient_email: recipient,
      rendered_subject: rendered.subject,
      rendered_body: rendered.html,
      status: "failed",
      error_message: result.error,
    });
    redirect(`/templates/${id}?test_error=${encodeURIComponent(result.error)}`);
  }

  await supabase.from("sends").insert({
    template_id: id,
    recipient_email: recipient,
    rendered_subject: rendered.subject,
    rendered_body: rendered.html,
    status: "sent",
    provider_message_id: result.messageId,
    sent_at: new Date().toISOString(),
  });

  redirect(`/templates/${id}?test_sent=${encodeURIComponent(recipient)}`);
}
