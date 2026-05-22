import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ConditionsEditor } from "../conditions-editor";

import { deleteTrigger, dryRunTrigger, updateTrigger } from "./actions";

type DrySummary = {
  matched: boolean;
  recipient: string | null;
  dedupe_key: string | null;
  payload: string;
};

export default async function EditTriggerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
    dry?: string;
    dry_error?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const [
    { data: trigger },
    { data: eventTypes },
    { data: templates },
  ] = await Promise.all([
    supabase
      .from("triggers")
      .select(
        "id, name, description, event_type_id, template_id, conditions, recipient_expr, dedupe_key_expr, cooldown_seconds, active, updated_at",
      )
      .eq("id", id)
      .single(),
    supabase.from("event_types").select("id, name").order("name"),
    supabase.from("templates").select("id, name, slug").order("name"),
  ]);

  if (!trigger) {
    notFound();
  }

  const updateAction = updateTrigger.bind(null, id);
  const deleteAction = deleteTrigger.bind(null, id);
  const dryRunAction = dryRunTrigger.bind(null, id);

  const conditionsJson = trigger.conditions
    ? JSON.stringify(trigger.conditions)
    : "";

  let drySummary: DrySummary | null = null;
  if (sp.dry) {
    try {
      drySummary = JSON.parse(sp.dry) as DrySummary;
    } catch {
      drySummary = null;
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex-1 px-6 py-10 max-w-3xl w-full mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/triggers"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
            >
              ← Back to triggers
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight mt-2">
              {trigger.name}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              Last updated {new Date(trigger.updated_at).toLocaleString()}
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
            defaultValue={trigger.name}
          />
          <FieldArea
            label="Description"
            name="description"
            rows={2}
            defaultValue={trigger.description ?? ""}
          />
          <SelectField
            label="Event type"
            name="event_type_id"
            required
            options={(eventTypes ?? []).map((e) => ({
              value: e.id,
              label: e.name,
            }))}
            defaultValue={trigger.event_type_id}
          />
          <SelectField
            label="Template"
            name="template_id"
            required
            options={(templates ?? []).map((t) => ({
              value: t.id,
              label: `${t.name} (${t.slug})`,
            }))}
            defaultValue={trigger.template_id}
          />
          <Field
            label="Recipient expression"
            name="recipient_expr"
            required
            mono
            defaultValue={trigger.recipient_expr}
            hint="Dot-notation path into the event payload that resolves to the recipient email."
          />

          <div>
            <span className="text-sm font-medium">Conditions</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 mb-3">
              Empty means the trigger fires on every event of this type.
            </p>
            <ConditionsEditor initialJson={conditionsJson} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Dedupe key expression"
              name="dedupe_key_expr"
              mono
              defaultValue={trigger.dedupe_key_expr ?? ""}
              placeholder="$.user.id"
              hint="Optional. If set, the trigger sends at most once per resolved key value."
            />
            <Field
              label="Cooldown (seconds)"
              name="cooldown_seconds"
              type="number"
              defaultValue={
                trigger.cooldown_seconds !== null
                  ? String(trigger.cooldown_seconds)
                  : ""
              }
              hint="With dedupe set: minimum seconds between sends per key. Blank = strict once-ever."
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={trigger.active}
              className="h-4 w-4"
            />
            <span>Active (fire on incoming events)</span>
          </label>

          <div>
            <button
              type="submit"
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
            >
              Save changes
            </button>
          </div>
        </form>

        <section className="mt-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-black/8 dark:border-white/[.145]">
          <h2 className="text-lg font-semibold tracking-tight">
            Dry-run against a payload
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Evaluates this trigger&apos;s conditions against the payload below
            without inserting an event or sending email. Useful for iterating
            on rules.
          </p>

          {drySummary && (
            <div className="mt-4 rounded-md border border-black/8 dark:border-white/[.145] bg-zinc-50 dark:bg-zinc-950/40 p-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${drySummary.matched ? "bg-emerald-500" : "bg-zinc-400"}`}
                />
                <span className="font-medium">
                  {drySummary.matched ? "Conditions matched" : "Conditions did not match"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-zinc-600 dark:text-zinc-400">Recipient</dt>
                <dd className="font-mono">
                  {drySummary.recipient ?? "(unresolved)"}
                </dd>
                <dt className="text-zinc-600 dark:text-zinc-400">Dedupe key</dt>
                <dd className="font-mono">
                  {drySummary.dedupe_key ?? "(none)"}
                </dd>
              </dl>
            </div>
          )}

          {sp.dry_error && (
            <div className="mt-4 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
              {sp.dry_error}
            </div>
          )}

          <form action={dryRunAction} className="flex flex-col gap-3 mt-4">
            <textarea
              name="payload"
              rows={8}
              spellCheck={false}
              defaultValue={
                drySummary?.payload ??
                JSON.stringify(
                  {
                    user: { id: "u1", email: "alex@example.com", name: "Alex" },
                    plan: "pro",
                  },
                  null,
                  2,
                )
              }
              className="rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y"
            />
            <div>
              <button
                type="submit"
                className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
              >
                Test
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  type,
  placeholder,
  hint,
  mono,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
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
        type={type ?? "text"}
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
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
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
        className="rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y"
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
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <span className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</span>
      )}
    </label>
  );
}
