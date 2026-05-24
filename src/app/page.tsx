import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/6 dark:border-white/8 bg-white dark:bg-black">
        <div className="text-sm font-medium">Email Platform</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="h-8 px-3 rounded-full text-sm border border-black/8 dark:border-white/[.145] hover:bg-black/4 dark:hover:bg-[#1a1a1a] transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-6 py-10 max-w-5xl w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Build templates, define triggers, and watch the loop fire.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardCard
            href="/templates"
            title="Templates"
            description="Browse, edit, and test email templates with placeholders."
            status="ready"
          />
          <DashboardCard
            href="/event-types"
            title="Event types"
            description="Define categories of things that can happen (e.g. user.upgraded)."
            status="ready"
          />
          <DashboardCard
            href="/triggers"
            title="Triggers"
            description="Define rules that decide which template fires for which event."
            status="ready"
          />
          <DashboardCard
            href="/events"
            title="Events"
            description="Inspect the event stream. Fire test events through the engine."
            status="ready"
          />
          <DashboardCard
            href="/sends"
            title="Sends"
            description="Audit log of every delivery attempt with status and provider IDs."
            status="ready"
          />
          <DashboardCard
            href="/templates"
            title="AI helper"
            description="Draft new copy, rewrite tone, and generate subject line variants. Lives inside each template's editor."
            status="ready"
          />
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  href,
  title,
  description,
  status,
}: {
  href: string;
  title: string;
  description: string;
  status: "ready" | "coming-soon";
}) {
  const isReady = status === "ready";
  const content = (
    <div
      className={`h-full p-5 rounded-2xl border bg-white dark:bg-zinc-900 transition-colors ${
        isReady
          ? "border-black/8 dark:border-white/[.145] hover:border-zinc-900 dark:hover:border-zinc-100"
          : "border-black/6 dark:border-white/8 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-medium">{title}</h2>
        {!isReady && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            Coming soon
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  );

  if (!isReady) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
