import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { deleteEventType, updateEventType } from "./actions";

export default async function EditEventTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: eventType } = await supabase
    .from("event_types")
    .select("id, name, created_at")
    .eq("id", id)
    .single();

  if (!eventType) {
    notFound();
  }

  // Show triggers that reference this event type — reinforces the relationship.
  const { data: usingTriggers } = await supabase
    .from("triggers")
    .select("id, name, active")
    .eq("event_type_id", id)
    .order("name");

  const updateAction = updateEventType.bind(null, id);
  const deleteAction = deleteEventType.bind(null, id);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex-1 px-6 py-10 max-w-3xl w-full mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/event-types"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
            >
              ← Back to event types
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight mt-2 font-mono">
              {eventType.name}
            </h1>
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
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Name<span className="text-red-600 ml-0.5">*</span>
            </span>
            <input
              type="text"
              name="name"
              required
              defaultValue={eventType.name}
              className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100 font-mono"
            />
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
            Triggers using this event type
          </h2>
          {!usingTriggers || usingTriggers.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              No triggers reference this event type yet.{" "}
              <Link href="/triggers/new" className="underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {usingTriggers.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${t.active ? "bg-emerald-500" : "bg-zinc-400"}`}
                  />
                  <Link
                    href={`/triggers/${t.id}`}
                    className="font-medium hover:underline"
                  >
                    {t.name}
                  </Link>
                  {!t.active && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">
                      (paused)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
