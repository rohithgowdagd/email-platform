import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { logout } from "../login/actions";

export default async function TriggersPage() {
  const supabase = await createClient();
  const { data: triggers, error } = await supabase
    .from("triggers")
    .select(
      "id, name, active, dedupe_key_expr, cooldown_seconds, updated_at, event_types(name), templates(name, slug)",
    )
    .order("updated_at", { ascending: false });

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
            <Link href="/triggers" className="text-zinc-950 dark:text-zinc-50">
              Triggers
            </Link>
            <Link href="/events">Events</Link>
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Triggers</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Rules that decide which template fires for which event.
            </p>
          </div>
          <Link
            href="/triggers/new"
            className="h-9 inline-flex items-center px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
          >
            New trigger
          </Link>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
            Failed to load triggers: {error.message}
          </div>
        ) : !triggers || triggers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/12 dark:border-white/18 p-12 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No triggers yet.
            </p>
            <Link
              href="/triggers/new"
              className="inline-block mt-3 text-sm font-medium underline"
            >
              Create your first trigger
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/8 dark:border-white/[.145] bg-white dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-4 py-2.5">Event</th>
                  <th className="text-left font-medium px-4 py-2.5">Template</th>
                  <th className="text-left font-medium px-4 py-2.5">Dedupe</th>
                  <th className="text-left font-medium px-4 py-2.5">Active</th>
                  <th className="text-left font-medium px-4 py-2.5">Updated</th>
                </tr>
              </thead>
              <tbody>
                {triggers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-black/6 dark:border-white/8 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/triggers/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {t.event_types?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {t.templates?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                      {t.dedupe_key_expr
                        ? `${t.dedupe_key_expr}${
                            t.cooldown_seconds ? ` / ${t.cooldown_seconds}s` : ""
                          }`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.active ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-500 text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          Paused
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(t.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
