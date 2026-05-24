import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ConditionsEditor } from "../conditions-editor";

import { createTrigger } from "./actions";

export default async function NewTriggerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: eventTypes }, { data: templates }] = await Promise.all([
    supabase.from("event_types").select("id, name").order("name"),
    supabase.from("templates").select("id, name, slug").order("name"),
  ]);

  if (!eventTypes || eventTypes.length === 0) {
    notFound();
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex-1 px-6 py-10 max-w-3xl w-full mx-auto">
        <div className="mb-6">
          <Link
            href="/triggers"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            ← Back to triggers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">
            New trigger
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Rule: when this event arrives and conditions match, send this
            template.
          </p>
        </div>

        <form
          action={createTrigger}
          className="flex flex-col gap-5 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-black/8 dark:border-white/[.145]"
        >
          <Field
            label="Name"
            name="name"
            required
            placeholder="Welcome to Pro"
          />

          <SelectField
            label="Event type"
            name="event_type_id"
            required
            options={eventTypes.map((e) => ({ value: e.id, label: e.name }))}
            hintLink={{ href: "/event-types", text: "Manage event types" }}
          />

          <SelectField
            label="Template"
            name="template_id"
            required
            options={
              templates?.map((t) => ({ value: t.id, label: t.name })) ?? []
            }
            hintLink={
              !templates?.length
                ? { href: "/templates/new", text: "Create one first" }
                : undefined
            }
          />

          <Field
            label="Send to"
            name="recipient_expr"
            mono
            defaultValue="$.user.email"
            hint="Path into the event payload that holds the recipient email."
          />

          <div>
            <span className="text-sm font-medium">Conditions</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 mb-3">
              Optional. If empty, fires on every event of this type.
            </p>
            <ConditionsEditor initialJson="" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="once_per_recipient"
              defaultChecked
              className="h-4 w-4"
            />
            <span>Send at most once per recipient (30-day cooldown)</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked
              className="h-4 w-4"
            />
            <span>Live (fire on incoming events)</span>
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
            >
              Create trigger
            </button>
            <Link
              href="/triggers"
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

function SelectField({
  label,
  name,
  required,
  options,
  hintLink,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: { value: string; label: string }[];
  hintLink?: { href: string; text: string };
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </span>
        {hintLink && (
          <Link
            href={hintLink.href}
            className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            {hintLink.text}
          </Link>
        )}
      </div>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
