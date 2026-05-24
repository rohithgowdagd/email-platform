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

// Collect every `{{path}}` reference in a piece of text, deduped.
export function extractReferences(text: string): Set<string> {
  const refs = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    refs.add(m[1]);
  }
  return refs;
}

// Derive the placeholders array from template content. With the simplified
// UI, the marketer doesn't declare placeholders explicitly — every `{{path}}`
// in the subject or body is auto-registered, with no required/sample metadata.
// Missing values render as empty strings.
export function derivePlaceholders(input: {
  subject: string;
  bodyHtml: string;
}): Placeholder[] {
  const refs = new Set<string>([
    ...extractReferences(input.subject),
    ...extractReferences(input.bodyHtml),
  ]);
  return Array.from(refs)
    .sort()
    .map((name) => ({ name, required: false, sample: "" }));
}

// Convert a human name into a URL-safe slug. Used to auto-generate the
// template slug from the name so the marketer never sees the "slug" concept.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type PlaceholderValidationInput = {
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  placeholders: Placeholder[];
};

// Diff between paths referenced in the template body and paths declared in the
// placeholders array. Undeclared = referenced but not declared (a typo, almost
// always — guard against it at save time). Unused = declared but not referenced
// (often intentional, but worth surfacing as a soft warning).
export function validatePlaceholders(input: PlaceholderValidationInput): {
  undeclared: string[];
  unused: string[];
} {
  const referenced = new Set<string>([
    ...extractReferences(input.subject),
    ...extractReferences(input.bodyHtml),
    ...extractReferences(input.bodyText ?? ""),
  ]);
  const declared = new Set(input.placeholders.map((p) => p.name));

  const undeclared = [...referenced].filter((r) => !declared.has(r)).sort();
  const unused = [...declared].filter((d) => !referenced.has(d)).sort();

  return { undeclared, unused };
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
