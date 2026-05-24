"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import {
  autoParagraph,
  derivePlaceholders,
  parsePlaceholders,
  renderTemplate,
  setByPath,
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
  const name = field(formData, "name");
  const subject = field(formData, "subject");
  const bodyHtml = field(formData, "body_html");

  if (!name || !subject || !bodyHtml) {
    redirect(
      `/templates/${id}?error=${encodeURIComponent("Name, subject, and body are required")}`,
    );
  }

  const wrappedBody = autoParagraph(bodyHtml);
  const placeholders = derivePlaceholders({ subject, bodyHtml: wrappedBody });

  const supabase = await createClient();
  const { error } = await supabase
    .from("templates")
    .update({
      name,
      subject,
      body_html: wrappedBody,
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

  // Triggers reference templates with ON DELETE RESTRICT — surface a
  // human-readable error before attempting the delete, so the user knows
  // exactly which triggers to clean up first.
  const { data: triggers, error: triggersError } = await supabase
    .from("triggers")
    .select("name")
    .eq("template_id", id);

  if (triggersError) {
    redirect(
      `/templates/${id}?error=${encodeURIComponent(triggersError.message)}`,
    );
  }

  if (triggers && triggers.length > 0) {
    const names = triggers.map((t) => `"${t.name}"`).join(", ");
    redirect(
      `/templates/${id}?error=${encodeURIComponent(
        `Cannot delete: ${triggers.length} trigger(s) still reference this template (${names}). Delete or repoint them first.`,
      )}`,
    );
  }

  const { error } = await supabase.from("templates").delete().eq("id", id);

  if (error) {
    redirect(`/templates/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/templates");
  revalidatePath("/triggers");
  revalidatePath("/sends");
  redirect("/templates");
}

export async function sendTestEmail(id: string, formData: FormData) {
  const recipient = field(formData, "recipient");

  if (!recipient) {
    redirect(
      `/templates/${id}?test_error=${encodeURIComponent("Recipient email is required")}`,
    );
  }

  // Read per-placeholder inputs (name="val_user.name", etc.) and rebuild the
  // nested values object the renderer expects via dot-notation lookup.
  const values: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("val_") && typeof value === "string") {
      const path = key.slice(4);
      if (path) setByPath(values, path, value);
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
