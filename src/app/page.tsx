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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardCard
            href="/templates"
            title="Templates"
            description="Write the email content. AI helper inside each template for drafting, rewriting tone, and subject variants."
          />
          <DashboardCard
            href="/triggers"
            title="Triggers"
            description="Rules that decide when to send what, to whom. Test by firing events from inside."
          />
          <DashboardCard
            href="/sends"
            title="Sends"
            description="Audit log of every delivery attempt — sent, skipped (dedup), or failed."
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
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="h-full p-5 rounded-2xl border bg-white dark:bg-zinc-900 border-black/8 dark:border-white/[.145] hover:border-zinc-900 dark:hover:border-zinc-100 transition-colors">
        <h2 className="text-base font-medium mb-2">{title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </Link>
  );
}
