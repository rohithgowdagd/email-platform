"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { TONES } from "@/lib/ai/prompts";

import {
  applyAiSuggestion,
  draftFromDescription,
  rewriteWithTone,
  suggestSubjectVariants,
} from "./ai-actions";

type Mode = "idle" | "variants" | "tone" | "draft";

type VariantsResult = { variants: string[] };
type RewriteResult = {
  subject: string;
  body_html: string;
  body_text: string;
};

export function AiHelper({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [tone, setTone] = useState<string>(TONES[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<string[] | null>(null);
  const [rewrite, setRewrite] = useState<RewriteResult | null>(null);
  const [applying, startApplying] = useTransition();

  function reset() {
    setError(null);
    setVariants(null);
    setRewrite(null);
  }

  function switchMode(next: Mode) {
    reset();
    setMode(next);
  }

  async function runVariants() {
    reset();
    setLoading(true);
    const result = await suggestSubjectVariants(templateId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVariants((result.data as VariantsResult).variants);
  }

  async function runTone() {
    reset();
    setLoading(true);
    const result = await rewriteWithTone(templateId, tone);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRewrite(result.data as RewriteResult);
  }

  async function runDraft() {
    reset();
    setLoading(true);
    const result = await draftFromDescription(templateId, description);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRewrite(result.data as RewriteResult);
  }

  function applyPatch(patch: {
    subject?: string;
    body_html?: string;
    body_text?: string;
  }) {
    startApplying(async () => {
      const result = await applyAiSuggestion(templateId, patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      setMode("idle");
      router.refresh();
    });
  }

  return (
    <section className="mt-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-black/8 dark:border-white/[.145]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">AI helper</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Draft copy, rewrite tone, or generate subject line variants with
            help of AI. Suggestions preview here before they touch the template.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ModeButton
          active={mode === "variants"}
          onClick={() => switchMode("variants")}
        >
          Subject variants
        </ModeButton>
        <ModeButton
          active={mode === "tone"}
          onClick={() => switchMode("tone")}
        >
          Rewrite tone
        </ModeButton>
        <ModeButton
          active={mode === "draft"}
          onClick={() => switchMode("draft")}
        >
          Draft from description
        </ModeButton>
      </div>

      {mode === "variants" && (
        <div className="mt-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generates 5 alternative subject lines for the current template.
          </p>
          <button
            type="button"
            onClick={runVariants}
            disabled={loading}
            className="mt-3 h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate 5 variants"}
          </button>
        </div>
      )}

      {mode === "tone" && (
        <div className="mt-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rewrites the subject and body in the chosen tone. Placeholders are
            preserved.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Target tone</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="h-10 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={runTone}
              disabled={loading}
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50"
            >
              {loading ? "Rewriting…" : "Rewrite"}
            </button>
          </div>
        </div>
      )}

      {mode === "draft" && (
        <div className="mt-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Drafts a fresh email from a one-line description. Replaces the
            current subject and body. Declared placeholders are used naturally.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. A friendly nudge to free-trial users whose trial ends in 3 days, with a clear CTA to upgrade."
              className="rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y"
            />
            <div>
              <button
                type="button"
                onClick={runDraft}
                disabled={loading || description.trim().length === 0}
                className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50"
              >
                {loading ? "Drafting…" : "Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {variants && (
        <div className="mt-5 flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Suggestions
          </p>
          <ul className="flex flex-col gap-2">
            {variants.map((v, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-md border border-black/8 dark:border-white/[.145] bg-zinc-50 dark:bg-zinc-950/40 px-3 py-2"
              >
                <span className="text-sm">{v}</span>
                <button
                  type="button"
                  onClick={() => applyPatch({ subject: v })}
                  disabled={applying}
                  className="shrink-0 h-7 px-3 rounded-full text-xs font-medium border border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4 transition-colors disabled:opacity-50"
                >
                  {applying ? "Applying…" : "Use as subject"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rewrite && (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Suggested rewrite
          </p>
          <div className="rounded-md border border-black/8 dark:border-white/[.145] bg-zinc-50 dark:bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-500 uppercase tracking-wide mb-1">
              Subject
            </div>
            <div className="text-sm">{rewrite.subject}</div>
          </div>
          <div className="rounded-md border border-black/8 dark:border-white/[.145] bg-zinc-50 dark:bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-500 uppercase tracking-wide mb-1">
              HTML body
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {rewrite.body_html}
            </pre>
          </div>
          <div className="rounded-md border border-black/8 dark:border-white/[.145] bg-zinc-50 dark:bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-500 uppercase tracking-wide mb-1">
              Plain-text body
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {rewrite.body_text}
            </pre>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                applyPatch({
                  subject: rewrite.subject,
                  body_html: rewrite.body_html,
                  body_text: rewrite.body_text,
                })
              }
              disabled={applying}
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply all"}
            </button>
            <button
              type="button"
              onClick={() => applyPatch({ subject: rewrite.subject })}
              disabled={applying}
              className="h-10 px-4 rounded-full text-sm border border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4 transition-colors disabled:opacity-50"
            >
              Subject only
            </button>
            <button
              type="button"
              onClick={() =>
                applyPatch({
                  body_html: rewrite.body_html,
                  body_text: rewrite.body_text,
                })
              }
              disabled={applying}
              className="h-10 px-4 rounded-full text-sm border border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4 transition-colors disabled:opacity-50"
            >
              Body only
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-4 rounded-full text-sm font-medium transition-colors border ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4"
      }`}
    >
      {children}
    </button>
  );
}
