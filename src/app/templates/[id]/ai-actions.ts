"use server";

import { revalidatePath } from "next/cache";

import { AI_MODEL, getOpenAi } from "@/lib/ai/client";
import {
  DRAFT_FROM_DESCRIPTION_SCHEMA,
  DRAFT_FROM_DESCRIPTION_SYSTEM,
  REWRITE_TONE_SCHEMA,
  REWRITE_TONE_SYSTEM,
  SUBJECT_VARIANTS_SCHEMA,
  SUBJECT_VARIANTS_SYSTEM,
} from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import {
  derivePlaceholders,
  parsePlaceholders,
} from "@/lib/templates/render";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function callOpenAi<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
}): Promise<ActionResult<T>> {
  try {
    const client = getOpenAi();
    const response = await client.chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: opts.schemaName,
          schema: opts.schema,
          strict: true,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "OpenAI returned no content" };
    }

    try {
      const data = JSON.parse(content) as T;
      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Failed to parse OpenAI's response: ${message}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function suggestSubjectVariants(
  templateId: string,
): Promise<ActionResult<{ variants: string[] }>> {
  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("templates")
    .select("subject, body_html, placeholders")
    .eq("id", templateId)
    .single();

  if (error || !template) {
    return { ok: false, error: error?.message ?? "Template not found" };
  }

  const placeholders = parsePlaceholders(template.placeholders);
  const placeholderList =
    placeholders.length > 0
      ? `Declared placeholders: ${placeholders.map((p) => p.name).join(", ")}`
      : "Declared placeholders: (none)";

  const user = [
    "Existing template:",
    `Subject: ${template.subject}`,
    `HTML body: ${template.body_html}`,
    placeholderList,
    "",
    "Generate 5 alternative subject lines.",
  ].join("\n");

  return callOpenAi<{ variants: string[] }>({
    system: SUBJECT_VARIANTS_SYSTEM,
    user,
    schema: SUBJECT_VARIANTS_SCHEMA,
    schemaName: "subject_variants",
    maxTokens: 1024,
  });
}

export async function rewriteWithTone(
  templateId: string,
  tone: string,
): Promise<
  ActionResult<{ subject: string; body_html: string; body_text: string }>
> {
  if (!tone.trim()) {
    return { ok: false, error: "Pick a target tone" };
  }

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("templates")
    .select("subject, body_html, body_text, placeholders")
    .eq("id", templateId)
    .single();

  if (error || !template) {
    return { ok: false, error: error?.message ?? "Template not found" };
  }

  const placeholders = parsePlaceholders(template.placeholders);
  const placeholderList =
    placeholders.length > 0
      ? `Declared placeholders: ${placeholders.map((p) => p.name).join(", ")}`
      : "Declared placeholders: (none)";

  const user = [
    `Target tone: ${tone}`,
    "",
    "Existing template:",
    `Subject: ${template.subject}`,
    `HTML body: ${template.body_html}`,
    `Plain-text body: ${template.body_text ?? "(none — generate one)"}`,
    placeholderList,
    "",
    `Rewrite the subject, HTML body, and plain-text body in a ${tone} tone.`,
  ].join("\n");

  return callOpenAi<{
    subject: string;
    body_html: string;
    body_text: string;
  }>({
    system: REWRITE_TONE_SYSTEM,
    user,
    schema: REWRITE_TONE_SCHEMA,
    schemaName: "rewrite_tone",
    maxTokens: 4096,
  });
}

export async function draftFromDescription(
  templateId: string,
  description: string,
): Promise<
  ActionResult<{ subject: string; body_html: string; body_text: string }>
> {
  if (!description.trim()) {
    return { ok: false, error: "Describe what the email should say" };
  }

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("templates")
    .select("placeholders")
    .eq("id", templateId)
    .single();

  if (error || !template) {
    return { ok: false, error: error?.message ?? "Template not found" };
  }

  const placeholders = parsePlaceholders(template.placeholders);
  const placeholderList =
    placeholders.length > 0
      ? placeholders
          .map(
            (p) =>
              `- ${p.name}${p.sample ? ` (e.g. "${p.sample}")` : ""}${p.required ? " [required]" : ""}`,
          )
          .join("\n")
      : "(none declared yet — invent reasonable placeholders if needed and we'll note them)";

  const user = [
    `Description: ${description}`,
    "",
    "Declared placeholders to use in the draft:",
    placeholderList,
  ].join("\n");

  return callOpenAi<{
    subject: string;
    body_html: string;
    body_text: string;
  }>({
    system: DRAFT_FROM_DESCRIPTION_SYSTEM,
    user,
    schema: DRAFT_FROM_DESCRIPTION_SCHEMA,
    schemaName: "draft_from_description",
    maxTokens: 4096,
  });
}

export async function applyAiSuggestion(
  templateId: string,
  patch: { subject?: string; body_html?: string; body_text?: string },
): Promise<ActionResult<{ applied: true }>> {
  if (
    typeof patch.subject !== "string" &&
    typeof patch.body_html !== "string"
  ) {
    return { ok: false, error: "Nothing to apply" };
  }

  // Load current values so we can re-derive placeholders against the merged
  // (post-patch) content — otherwise a body_html-only patch would leave
  // placeholders stale relative to the subject (or vice versa).
  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("templates")
    .select("subject, body_html")
    .eq("id", templateId)
    .single();

  if (loadError || !existing) {
    return { ok: false, error: loadError?.message ?? "Template not found" };
  }

  const merged = {
    subject: typeof patch.subject === "string" ? patch.subject : existing.subject,
    bodyHtml:
      typeof patch.body_html === "string" ? patch.body_html : existing.body_html,
  };

  const { error } = await supabase
    .from("templates")
    .update({
      ...(typeof patch.subject === "string" ? { subject: patch.subject } : {}),
      ...(typeof patch.body_html === "string"
        ? { body_html: patch.body_html }
        : {}),
      ...(typeof patch.body_text === "string"
        ? { body_text: patch.body_text }
        : {}),
      placeholders: derivePlaceholders(merged) as never,
    })
    .eq("id", templateId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  return { ok: true, data: { applied: true } };
}
