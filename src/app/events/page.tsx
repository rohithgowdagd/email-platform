import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import type { PreviewResult, RunResult } from "@/lib/triggers/evaluate";

import { logout } from "../login/actions";

import { fireTestEvent, previewTriggers } from "./actions";

type FiredSummary = {
  event_id: string;
  idempotent: boolean;
  runs: RunResult[];
};

type PreviewSummary = {
  preview: PreviewResult[];
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    fired?: string;
    preview?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data: events }, { data: eventTypes }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, received_at, idempotency_key, payload, event_types(name)",
      )
      .order("received_at", { ascending: false })
      .limit(50),
    supabase
      .from("event_types")
      .select("id, name, payload_schema")
      .order("name"),
  ]);

  const fired = parseFired(sp.fired);
  const preview = parsePreview(sp.preview);
  const samplePayload = buildSamplePayload(eventTypes?.[0]?.payload_schema);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/6 dark:border-white/8 bg-white dark:bg-black">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium">
            Email Platform
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/templates">Templates</Link>
            <Link href="/event-types">Event types</Link>
            <Link href="/triggers">Triggers</Link>
            <Link href="/events" className="text-zinc-950 dark:text-zinc-50">
              Events
            </Link>
            <Link href="/sends">Sends</Link>
          </nav>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="h-8 px-3 rounded-full text-sm border border-black/8 dark:border-white/[.145] hover:bg-black/4 dark:hover:bg-[#1a1a1a] transition-colors"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 px-6 py-10 max-w-5xl w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Incoming events run through the trigger engine. Use the form below
            to fire a test event.
          </p>
        </div>

        {fired && (
          <div className="mb-6 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Event {fired.idempotent ? "replayed" : "fired"}: {fired.event_id}
            </p>
            {fired.runs.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                {fired.idempotent
                  ? "Existing event row — re-processing skipped."
                  : "No active triggers matched this event."}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {fired.runs.map((r) => (
                  <li
                    key={r.trigger_id}
                    className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300"
                  >
                    <StatusBadge status={r.status} />
                    <span className="font-medium">{r.trigger_name}</span>
                    {r.recipient && (
                      <span className="text-emerald-700/80 dark:text-emerald-400/70 text-xs">
                        → {r.recipient}
                      </span>
                    )}
                    {r.reason && (
                      <span className="text-emerald-700/80 dark:text-emerald-400/70 text-xs">
                        ({r.reason})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {preview && (
          <div className="mb-6 rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/30 p-4">
            <p className="text-sm font-medium text-sky-800 dark:text-sky-300">
              Engine decision preview (no event inserted, nothing sent)
            </p>
            {preview.preview.length === 0 ? (
              <p className="text-sm text-sky-700 dark:text-sky-400 mt-1">
                No active triggers exist for this event type.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {preview.preview.map((p) => (
                  <li
                    key={p.trigger_id}
                    className="flex items-center gap-2 text-sky-800 dark:text-sky-300"
                  >
                    <DecisionBadge decision={p.decision} />
                    <span className="font-medium">{p.trigger_name}</span>
                    {p.recipient && (
                      <span className="text-sky-700/80 dark:text-sky-400/70 text-xs">
                        → {p.recipient}
                      </span>
                    )}
                    {p.reason && (
                      <span className="text-sky-700/80 dark:text-sky-400/70 text-xs">
                        ({p.reason})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {sp.error && (
          <div className="mb-6 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
            {sp.error}
          </div>
        )}

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-black/8 dark:border-white/[.145] mb-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Fire test event
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            <strong>Preview</strong> evaluates the engine against your payload
            without inserting an event or sending email — useful for testing
            rules. <strong>Fire event</strong> runs the full loop and delivers
            via Resend.
          </p>

          <form action={fireTestEvent} className="flex flex-col gap-4 mt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Event type<span className="text-red-600 ml-0.5">*</span>
              </span>
              <select
                name="event_type_id"
                required
                defaultValue={eventTypes?.[0]?.id}
                className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              >
                {(eventTypes ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Payload (JSON)</span>
              <textarea
                name="payload"
                rows={8}
                spellCheck={false}
                defaultValue={samplePayload}
                className="rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Idempotency key</span>
              <input
                type="text"
                name="idempotency_key"
                placeholder="optional"
                className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                If provided, a second fire with the same key short-circuits
                instead of re-processing.
              </span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                formAction={previewTriggers}
                className="h-10 px-5 rounded-full text-sm font-medium border border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4 transition-colors"
              >
                Preview
              </button>
              <button
                type="submit"
                className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
              >
                Fire event
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3">
            Recent events
          </h2>
          {!events || events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-black/12 dark:border-white/18 p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
              No events yet. Fire one above.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-black/8 dark:border-white/[.145] bg-white dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">
                      Received
                    </th>
                    <th className="text-left font-medium px-4 py-2.5">Type</th>
                    <th className="text-left font-medium px-4 py-2.5">
                      Idempotency
                    </th>
                    <th className="text-left font-medium px-4 py-2.5">
                      Payload
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-black/6 dark:border-white/8"
                    >
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {new Date(e.received_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        {e.event_types?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {e.idempotency_key ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-zinc-600 dark:text-zinc-400 truncate block max-w-xl">
                          {JSON.stringify(e.payload)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function DecisionBadge({
  decision,
}: {
  decision: "would_send" | "would_skip" | "no_match";
}) {
  const colors = {
    would_send: "bg-emerald-500",
    would_skip: "bg-amber-500",
    no_match: "bg-zinc-400",
  };
  const labels = {
    would_send: "would send",
    would_skip: "would skip",
    no_match: "no match",
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wide font-medium">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[decision]}`} />
      {labels[decision]}
    </span>
  );
}

function StatusBadge({ status }: { status: "sent" | "skipped" | "failed" }) {
  const colors = {
    sent: "bg-emerald-500",
    skipped: "bg-amber-500",
    failed: "bg-red-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs uppercase tracking-wide font-medium`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} />
      {status}
    </span>
  );
}

function parsePreview(raw: string | undefined): PreviewSummary | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as PreviewSummary;
  } catch {
    try {
      return JSON.parse(raw) as PreviewSummary;
    } catch {
      return null;
    }
  }
}

function parseFired(raw: string | undefined): FiredSummary | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as FiredSummary;
  } catch {
    try {
      return JSON.parse(raw) as FiredSummary;
    } catch {
      return null;
    }
  }
}

function buildSamplePayload(schema: unknown): string {
  // Best-effort: build a minimal example from a JSON-schema-shaped object.
  // Falls back to a generic example.
  try {
    const sample = sampleFromSchema(schema);
    return JSON.stringify(sample, null, 2);
  } catch {
    return JSON.stringify(
      {
        user: { id: "u1", email: "alex@example.com", name: "Alex" },
        plan: "pro",
      },
      null,
      2,
    );
  }
}

function sampleFromSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return {};
  const s = schema as Record<string, unknown>;
  const type = s.type;
  if (type === "object" && s.properties && typeof s.properties === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(s.properties)) {
      out[key] = sampleFromSchema(prop);
    }
    return out;
  }
  if (type === "string") {
    if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
    if (s.format === "email") return "alex@example.com";
    return "example";
  }
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  if (type === "array") return [];
  return null;
}
