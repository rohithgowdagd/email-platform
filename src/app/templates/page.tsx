import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { logout } from "../login/actions";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  // Strip characters that have meaning in Supabase's .or() filter syntax.
  const q = (rawQ ?? "").trim().replace(/[%,()]/g, "");

  const supabase = await createClient();
  let query = supabase
    .from("templates")
    .select("id, name, slug, subject, category, updated_at")
    .order("updated_at", { ascending: false });

  if (q.length > 0) {
    const pattern = `%${q}%`;
    query = query.or(
      `name.ilike.${pattern},slug.ilike.${pattern},subject.ilike.${pattern},category.ilike.${pattern}`,
    );
  }

  const { data: templates, error } = await query;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/6 dark:border-white/8 bg-white dark:bg-black">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium">
            Email Platform
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/templates" className="text-zinc-950 dark:text-zinc-50">
              Templates
            </Link>
            <Link href="/event-types">Event types</Link>
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
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Email templates with placeholders. Edit content and send tests.
            </p>
          </div>
          <Link
            href="/templates/new"
            className="h-9 inline-flex items-center px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
          >
            New template
          </Link>
        </div>

        <form
          method="get"
          className="flex items-center gap-2 mb-4"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, slug, subject, or category…"
            className="flex-1 h-10 rounded-md border border-black/12 dark:border-white/18 bg-white dark:bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-md border border-black/12 dark:border-white/18 text-sm hover:bg-black/4 dark:hover:bg-white/4 transition-colors"
          >
            Search
          </button>
          {q.length > 0 && (
            <Link
              href="/templates"
              className="h-10 inline-flex items-center px-3 text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
            >
              Clear
            </Link>
          )}
        </form>

        {error ? (
          <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
            Failed to load templates: {error.message}
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/12 dark:border-white/18 p-12 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {q.length > 0
                ? `No templates match "${q}".`
                : "No templates yet."}
            </p>
            {q.length > 0 ? (
              <Link
                href="/templates"
                className="inline-block mt-3 text-sm font-medium underline"
              >
                Clear search
              </Link>
            ) : (
              <Link
                href="/templates/new"
                className="inline-block mt-3 text-sm font-medium underline"
              >
                Create your first template
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-black/8 dark:border-white/[.145] bg-white dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-4 py-2.5">Slug</th>
                  <th className="text-left font-medium px-4 py-2.5">Subject</th>
                  <th className="text-left font-medium px-4 py-2.5">Category</th>
                  <th className="text-left font-medium px-4 py-2.5">Updated</th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-black/6 dark:border-white/8 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/templates/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {t.slug}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 truncate max-w-xs">
                      {t.subject}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {t.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(t.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/templates/${t.id}`}
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
