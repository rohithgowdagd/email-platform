import Link from "next/link";

import { createTemplate } from "./actions";

const PLACEHOLDER_HINT = `[
  { "name": "user.name", "type": "string", "required": true, "sample": "Alex" },
  { "name": "plan", "type": "string", "required": true, "sample": "pro" }
]`;

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex-1 px-6 py-10 max-w-3xl w-full mx-auto">
        <div className="mb-6">
          <Link
            href="/templates"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            ← Back to templates
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">
            New template
          </h1>
        </div>

        <form
          action={createTemplate}
          className="flex flex-col gap-5 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-black/8 dark:border-white/[.145]"
        >
          <Field
            label="Name"
            name="name"
            required
            placeholder="Welcome to paid"
          />
          <Field
            label="Slug"
            name="slug"
            required
            placeholder="welcome-to-paid"
            hint="Unique, URL-safe identifier. Used by triggers to reference this template."
            mono
          />
          <Field
            label="Subject"
            name="subject"
            required
            placeholder="Welcome to {{plan}}, {{user.name}}!"
            hint="May include {{placeholders}}."
          />
          <FieldArea
            label="HTML body"
            name="body_html"
            required
            rows={8}
            placeholder="<p>Hi {{user.name}}, thanks for upgrading to {{plan}}.</p>"
          />
          <FieldArea
            label="Plain-text body"
            name="body_text"
            rows={4}
            placeholder="Hi {{user.name}}, thanks for upgrading to {{plan}}."
            hint="Optional fallback for clients that don't render HTML."
          />
          <Field
            label="Category"
            name="category"
            placeholder="lifecycle"
            hint="Free-form grouping label. Optional."
          />
          <FieldArea
            label="Description"
            name="description"
            rows={2}
            placeholder="Sent once when a user upgrades from free to any paid plan."
          />
          <FieldArea
            label="Placeholders"
            name="placeholders"
            rows={6}
            mono
            placeholder={PLACEHOLDER_HINT}
            hint="JSON array of { name, type?, required?, sample? }. Required fields are validated at render time."
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
            >
              Create template
            </button>
            <Link
              href="/templates"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
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
