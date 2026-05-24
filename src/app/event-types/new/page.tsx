import Link from "next/link";

import { createEventType } from "./actions";

export default async function NewEventTypePage({
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
            href="/event-types"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            ← Back to event types
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">
            New event type
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            A category of thing that can happen in your product (e.g.{" "}
            <code className="font-mono">user.upgraded</code>). Triggers fire on
            specific event types.
          </p>
        </div>

        <form
          action={createEventType}
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
              placeholder="user.upgraded"
              className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100 font-mono"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              Convention: dot-separated lowercase, like{" "}
              <code>user.upgraded</code> or <code>order.placed</code>. Must be
              unique.
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
            >
              Create event type
            </button>
            <Link
              href="/event-types"
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
