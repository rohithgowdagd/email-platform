import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { logout } from "../login/actions";

// All possible send statuses from the DB enum (engine currently only writes
// 'sent' / 'skipped' / 'failed' — 'queued' is reserved for future async work).
type Status = "queued" | "sent" | "skipped" | "failed";

const FILTERABLE = ["sent", "skipped", "failed"] as const;
type Filter = (typeof FILTERABLE)[number] | "all";

function isFilter(v: string): v is Filter {
  return v === "all" || (FILTERABLE as readonly string[]).includes(v);
}

export default async function SendsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const filter: Filter = isFilter(rawStatus ?? "")
    ? (rawStatus as Filter)
    : "all";

  const supabase = await createClient();

  let query = supabase
    .from("sends")
    .select(
      "id, status, recipient_email, rendered_subject, dedupe_key, provider_message_id, error_message, created_at, sent_at, triggers(name), templates(name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data: sends, error } = await query;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/6 dark:border-white/8 bg-white dark:bg-black">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium">
            Email Platform
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/templates">Templates</Link>
            <Link href="/triggers">Triggers</Link>
            <Link href="/sends" className="text-zinc-950 dark:text-zinc-50">
              Sends
            </Link>
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

      <main className="flex-1 px-6 py-10 max-w-6xl w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Sends</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Audit log of every delivery attempt — successes, dedup/cooldown
            skips, and render or provider failures. Every fired event with an
            active trigger lands a row here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <FilterChip href="/sends" active={filter === "all"}>
            All
          </FilterChip>
          <FilterChip
            href="/sends?status=sent"
            active={filter === "sent"}
            tone="sent"
          >
            Sent
          </FilterChip>
          <FilterChip
            href="/sends?status=skipped"
            active={filter === "skipped"}
            tone="skipped"
          >
            Skipped
          </FilterChip>
          <FilterChip
            href="/sends?status=failed"
            active={filter === "failed"}
            tone="failed"
          >
            Failed
          </FilterChip>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
            Failed to load sends: {error.message}
          </div>
        ) : !sends || sends.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/12 dark:border-white/18 p-12 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {filter === "all"
                ? "No sends yet. Fire a test event from /events to see entries here."
                : `No ${filter} sends.`}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/8 dark:border-white/[.145] bg-white dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">When</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-left font-medium px-4 py-2.5">
                    Recipient
                  </th>
                  <th className="text-left font-medium px-4 py-2.5">Trigger</th>
                  <th className="text-left font-medium px-4 py-2.5">
                    Template
                  </th>
                  <th className="text-left font-medium px-4 py-2.5">Subject</th>
                  <th className="text-left font-medium px-4 py-2.5">Detail</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-black/6 dark:border-white/8 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 align-top"
                  >
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 font-mono text-xs">
                      {s.recipient_email}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {s.triggers?.name ?? (
                        <span className="text-xs text-zinc-500 italic">
                          (test send)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {s.templates?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 truncate max-w-xs">
                      {s.rendered_subject}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 max-w-sm">
                      <Detail
                        status={s.status}
                        providerMessageId={s.provider_message_id}
                        errorMessage={s.error_message}
                        dedupeKey={s.dedupe_key}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sends && sends.length === 200 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-3 text-center">
            Showing the 200 most recent sends. Older entries are in the{" "}
            <code>sends</code> table.
          </p>
        )}
      </main>
    </div>
  );
}

function FilterChip({
  href,
  active,
  tone,
  children,
}: {
  href: string;
  active: boolean;
  tone?: "sent" | "skipped" | "failed";
  children: React.ReactNode;
}) {
  const activeStyles = "bg-foreground text-background border-foreground";
  const idleStyles =
    "border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4";
  const dot =
    tone === "sent"
      ? "bg-emerald-500"
      : tone === "skipped"
        ? "bg-amber-500"
        : tone === "failed"
          ? "bg-red-500"
          : null;
  return (
    <Link
      href={href}
      className={`h-8 inline-flex items-center gap-2 px-3 rounded-full text-sm border transition-colors ${active ? activeStyles : idleStyles}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    queued: "bg-sky-500",
    sent: "bg-emerald-500",
    skipped: "bg-amber-500",
    failed: "bg-red-500",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-medium whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} />
      {status}
    </span>
  );
}

function Detail({
  status,
  providerMessageId,
  errorMessage,
  dedupeKey,
}: {
  status: Status;
  providerMessageId: string | null;
  errorMessage: string | null;
  dedupeKey: string | null;
}) {
  if (status === "sent" && providerMessageId) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-mono break-all">{providerMessageId}</span>
        {dedupeKey && (
          <span className="text-zinc-500">dedup: {dedupeKey}</span>
        )}
      </div>
    );
  }
  if (errorMessage) {
    return (
      <div className="flex flex-col gap-0.5">
        <span>{errorMessage}</span>
        {dedupeKey && (
          <span className="text-zinc-500">dedup: {dedupeKey}</span>
        )}
      </div>
    );
  }
  if (dedupeKey) {
    return <span className="text-zinc-500">dedup: {dedupeKey}</span>;
  }
  return <span className="text-zinc-500">—</span>;
}
