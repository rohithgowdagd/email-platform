import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { logout } from "../login/actions";

export default async function EventTypesPage() {
  const supabase = await createClient();
  const { data: eventTypes, error } = await supabase
    .from("event_types")
    .select("id, name, description, created_at")
    .order("name");

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/6 dark:border-white/8 bg-white dark:bg-black">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium">
            Email Platform
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/templates">Templates</Link>
            <Link href="/event-types" className="text-zinc-950 dark:text-zinc-50">
              Event types
            </Link>
            <Link href="/triggers">Triggers</Link>
            <Link href="/events">Events</Link>
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Event types
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Categories of things that can happen in your product. Triggers
              fire on a specific event type.
            </p>
          </div>
          <Link
            href="/event-types/new"
            className="h-9 inline-flex items-center px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
          >
            New event type
          </Link>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
            Failed to load event types: {error.message}
          </div>
        ) : !eventTypes || eventTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/12 dark:border-white/18 p-12 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No event types yet.
            </p>
            <Link
              href="/event-types/new"
              className="inline-block mt-3 text-sm font-medium underline"
            >
              Create your first event type
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/8 dark:border-white/[.145] bg-white dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-4 py-2.5">
                    Description
                  </th>
                  <th className="text-left font-medium px-4 py-2.5">Created</th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {eventTypes.map((et) => (
                  <tr
                    key={et.id}
                    className="border-t border-black/6 dark:border-white/8 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/event-types/${et.id}`}
                        className="font-mono text-xs font-medium hover:underline"
                      >
                        {et.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 truncate max-w-xl">
                      {et.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(et.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/event-types/${et.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-md border border-black/12 dark:border-white/18 text-xs font-medium hover:bg-black/4 dark:hover:bg-white/4 transition-colors"
                      >
                        Edit
                      </Link>
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
