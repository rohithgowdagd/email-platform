// Minimal Handlebars-lite renderer: substitutes `{{path}}` (dot-notation supported)
// against a values object. Used by both the test-send action and the future
// trigger evaluator, so the substitution semantics stay consistent.

export type Placeholder = {
  name: string;
  type?: string;
  required?: boolean;
  sample?: string;
};

export type RenderInput = {
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  placeholders: Placeholder[];
  values: Record<string, unknown>;
};

export type RenderResult =
  | { ok: true; subject: string; html: string; text: string }
  | { ok: false; error: string; missing?: string[] };

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(values: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, values);
}

function substitute(input: string, values: Record<string, unknown>): string {
  return input.replace(PLACEHOLDER_RE, (_match, path: string) => {
    const value = lookup(values, path);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

export function parsePlaceholders(raw: unknown): Placeholder[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): Placeholder[] => {
    if (!entry || typeof entry !== "object") return [];
    const obj = entry as Record<string, unknown>;
    if (typeof obj.name !== "string") return [];
    return [
      {
        name: obj.name,
        type: typeof obj.type === "string" ? obj.type : undefined,
        required: typeof obj.required === "boolean" ? obj.required : false,
        sample: typeof obj.sample === "string" ? obj.sample : undefined,
      },
    ];
  });
}

export function renderTemplate(input: RenderInput): RenderResult {
  const missing = input.placeholders
    .filter((p) => p.required)
    .filter((p) => {
      const value = lookup(input.values, p.name);
      return value === undefined || value === null || value === "";
    })
    .map((p) => p.name);

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required placeholders: ${missing.join(", ")}`,
      missing,
    };
  }

  return {
    ok: true,
    subject: substitute(input.subject, input.values),
    html: substitute(input.bodyHtml, input.values),
    text: input.bodyText ? substitute(input.bodyText, input.values) : "",
  };
}
