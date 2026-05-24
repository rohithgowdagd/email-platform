// Prompts + JSON Schemas for AI helper actions. Kept separate from the action
// orchestration so the prompts can be reviewed and tuned without touching the
// Supabase / Resend plumbing.

export const SUBJECT_VARIANTS_SYSTEM = `You are an expert email marketing copywriter helping a non-technical user craft email subject lines.

You will be given an existing email template (subject + body) and asked to generate 5 alternative subject lines.

Rules:
- Each variant should preserve any placeholders ({{path}}) that appear in the original subject. Do not invent new placeholders.
- Variants should be concise (typically 5-10 words) and ready to use as-is.
- Vary the angle: try urgency, curiosity, benefit-led, question-format, and a more direct/literal phrasing.
- Match the implied tone of the body — do not introduce a tone the body would not deliver on.

Respond with JSON only, matching the provided schema.`;

export const SUBJECT_VARIANTS_SCHEMA = {
  type: "object" as const,
  properties: {
    variants: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["variants"],
  additionalProperties: false,
};

export const REWRITE_TONE_SYSTEM = `You are an expert email marketing copywriter helping a non-technical user adjust the tone of an email template.

You will be given an existing email template (subject, HTML body, plain-text body) and a target tone. Rewrite all three to match the target tone.

Rules:
- Preserve every placeholder ({{path}}) exactly as it appears in the original. Do not invent new placeholders. Do not remove placeholders.
- Preserve the overall structure and length of the original — paragraphs, links, and lists should map 1:1.
- Keep the HTML semantically equivalent: same tags in the same order, just different copy inside them.
- The plain-text body should mirror the HTML body's content but without HTML tags.
- The subject should also be rewritten in the new tone but may be shorter.

Respond with JSON only, matching the provided schema.`;

export const REWRITE_TONE_SCHEMA = {
  type: "object" as const,
  properties: {
    subject: { type: "string" as const },
    body_html: { type: "string" as const },
    body_text: { type: "string" as const },
  },
  required: ["subject", "body_html", "body_text"],
  additionalProperties: false,
};

export const DRAFT_FROM_DESCRIPTION_SYSTEM = `You are an expert email marketing copywriter helping a non-technical user draft a brand-new email template from a short description.

You will be given:
- A description of what the email should say
- A list of declared placeholders (variables the renderer will substitute at send time)

Write the email's subject, HTML body, and plain-text body.

Rules:
- Use the declared placeholders naturally in the copy. Wrap them as {{name}} exactly as listed.
- Do not invent new placeholders. If a placeholder is not in the declared list, do not reference it.
- The HTML body should use simple tags (p, strong, a, ul, li, br) — no inline styles, no <html>/<body>/<head> wrappers.
- The plain-text body should mirror the HTML body's content but without HTML tags. Render <a href="X">Y</a> as "Y (X)".
- Keep it concise and direct.

Respond with JSON only, matching the provided schema.`;

export const DRAFT_FROM_DESCRIPTION_SCHEMA = {
  type: "object" as const,
  properties: {
    subject: { type: "string" as const },
    body_html: { type: "string" as const },
    body_text: { type: "string" as const },
  },
  required: ["subject", "body_html", "body_text"],
  additionalProperties: false,
};

export const TONES = [
  "Friendlier",
  "More formal",
  "More concise",
  "More urgent",
  "Warmer and more empathetic",
  "Direct and confident",
] as const;
export type Tone = (typeof TONES)[number];
