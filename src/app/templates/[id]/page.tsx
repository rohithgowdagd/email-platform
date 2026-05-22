import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  parsePlaceholders,
  type Placeholder,
} from "@/lib/templates/render";

import { deleteTemplate, sendTestEmail, updateTemplate } from "./actions";

export default async function EditTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
    test_sent?: string;
    test_error?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("templates")
    .select(
      "id, slug, name, subject, body_html, body_text, description, category, placeholders, updated_at",
    )
    .eq("id", id)
    .single();

  if (!template) {
    notFound();
  }

  const placeholders = parsePlaceholders(template.placeholders);
  const sampleValues = buildSampleValues(placeholders);
  const placeholdersText = JSON.stringify(placeholders, null, 2);

  const updateAction = updateTemplate.bind(null, id);
  const deleteAction = deleteTemplate.bind(null, id);
  const sendTestAction = sendTestEmail.bind(null, id);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex-1 px-6 py-10 max-w-3xl w-full mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/templates"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
            >
              ← Back to templates
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight mt-2">
              {template.name}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              Last updated {new Date(template.updated_at).toLocaleString()}
            </p>
          </div>
          <form action={deleteAction}>
            <button
              type="submit"
              className="h-9 px-3 rounded-full text-sm border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              Delete
            </button>
          </form>
        </div>

        {sp.saved && (
          <div className="mb-4 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            Saved.
          </div>
        )}
        {sp.error && (
          <div className="mb-4 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
            {sp.error}
          </div>
        )}

        <form
          action={updateAction}
          className="flex flex-col gap-5 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-black/8 dark:border-white/[.145]"
        >
          <Field
            label="Name"
            name="name"
            required
            defaultValue={template.name}
          />
          <Field
            label="Slug"
            name="slug"
            required
            mono
            defaultValue={template.slug}
          />
          <Field
            label="Subject"
            name="subject"
            required
            defaultValue={template.subject}
            hint="May include {{placeholders}}."
          />
          <FieldArea
            label="HTML body"
            name="body_html"
            required
            rows={10}
            defaultValue={template.body_html}
            mono
          />
          <FieldArea
            label="Plain-text body"
            name="body_text"
            rows={4}
            defaultValue={template.body_text ?? ""}
            hint="Optional fallback for clients that don't render HTML."
          />
          <Field
            label="Category"
            name="category"
            defaultValue={template.category ?? ""}
          />
          <FieldArea
            label="Description"
            name="description"
            rows={2}
            defaultValue={template.description ?? ""}
          />
          <FieldArea
            label="Placeholders"
            name="placeholders"
            rows={8}
            mono
            defaultValue={placeholdersText}
            hint="JSON array of { name, type?, required?, sample? }. Required fields are validated at render time."
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
            >
              Save changes
            </button>
          </div>
        </form>

        <section className="mt-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-black/8 dark:border-white/[.145]">
          <h2 className="text-lg font-semibold tracking-tight">Send test</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Renders the template with the sample values below and sends through
            Resend. Every attempt is logged in the <code>sends</code> table.
          </p>

          {sp.test_sent && (
            <div className="mt-4 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              Sent to {sp.test_sent}.
            </div>
          )}
          {sp.test_error && (
            <div className="mt-4 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
              {sp.test_error}
            </div>
          )}

          <form action={sendTestAction} className="flex flex-col gap-4 mt-4">
            <Field
              label="Recipient email"
              name="recipient"
              required
              placeholder="you@example.com"
            />
            <FieldArea
              label="Sample values"
              name="values"
              rows={6}
              mono
              defaultValue={JSON.stringify(sampleValues, null, 2)}
              hint="JSON object. Use nested keys to match dot-notation placeholders (e.g. {{user.name}} resolves user.name)."
            />
            <div>
              <button
                type="submit"
                className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
              >
                Send test
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function buildSampleValues(
  placeholders: Placeholder[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const p of placeholders) {
    if (p.sample === undefined) continue;
    setByPath(result, p.name, p.sample);
  }
  return result;
}

function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

function Field({
  label,
  name,
  required,
  placeholder,
  hint,
  mono,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      <input
        type="text"
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100 ${
          mono ? "font-mono" : ""
        }`}
      />
      {hint && (
        <span className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</span>
      )}
    </label>
  );
}

function FieldArea({
  label,
  name,
  required,
  rows,
  placeholder,
  hint,
  mono,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      <textarea
        name={name}
        required={required}
        rows={rows ?? 4}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y ${
          mono ? "font-mono" : ""
        }`}
      />
      {hint && (
        <span className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</span>
      )}
    </label>
  );
}
