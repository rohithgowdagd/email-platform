import Link from "next/link";

import { createTemplate } from "./actions";

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
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Write the email content. Use{" "}
            <code className="font-mono">{`{{user.name}}`}</code>-style
            placeholders — the renderer fills them in at send time.
          </p>
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
            label="Subject"
            name="subject"
            required
            placeholder="Welcome to {{plan}}, {{user.name}}!"
          />
          <FieldArea
            label="Body"
            name="body_html"
            required
            rows={10}
            placeholder="<p>Hi {{user.name}}, thanks for upgrading to {{plan}}.</p>"
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
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
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
        className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
      />
    </label>
  );
}

function FieldArea({
  label,
  name,
  required,
  rows,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
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
        className="rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y"
      />
    </label>
  );
}
