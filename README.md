# Email Platform — SSE Coding Assignment

This is my submission for the **Senior Software Engineer coding assignment** for
AppCrafters. The brief asked for the foundations of a small Email Platform that
lets a non-engineering team member own both the **content** of email templates
*and* the **logic of when they get sent.**


---

## TL;DR

A working Next.js 16 app that wires together:

- A library of email **templates** (browseable, searchable, editable, with
  auto-detected placeholders and real test-sends through Resend)
- An **event stream** + a **conditional rule layer** that decides when each
  template fires
- A simple **engine** that, on an incoming event, evaluates the rules and
  decides which template (if any) to render and send
- An **AI helper** (OpenAI `gpt-4o`) inside each template's editor that drafts
  copy, rewrites tone, and generates subject-line variants
- A **Sends audit log** capturing every send attempt — success, dedup/cooldown
  skip, or failure

The end-to-end loop runs against real infrastructure: events land at
`POST /api/events`, the engine evaluates triggers, the matched template is
rendered with the event payload, the email is sent via **Resend**
(`onboarding@resend.dev` for the demo), and the attempt is recorded in
the `sends` table.

---

## How each assessment requirement maps to the code

The brief's "minimum useful version" bullets, in order:

| Bullet from the brief | Where it lives in the repo |
|---|---|
| *"A library where templates can be browsed, searched, and edited (content + dynamic placeholders), with … the ability to send a test through a real delivery provider"* | [`src/app/templates/`](src/app/templates/) — list (with search), editor with auto-detected placeholders, send-test panel that goes through Resend |
| *"A way to define a trigger — when does this template fire — built on top of an event stream and some kind of conditional rule layer"* | [`src/app/triggers/`](src/app/triggers/) — CRUD UI with a form-based conditions editor. Schema lives in [`supabase/migrations/20260522114628_init_schema.sql`](supabase/migrations/20260522114628_init_schema.sql) |
| *"A simple engine that, given an incoming event, evaluates the rules and decides which template (if any) to send"* | [`src/lib/triggers/evaluate.ts`](src/lib/triggers/evaluate.ts) (`runEvent` + `previewEvent`), [`src/lib/triggers/conditions.ts`](src/lib/triggers/conditions.ts) (the DSL evaluator) |
| *"An AI-assisted content helper somewhere inside the admin that is genuinely useful for a non-technical user"* | [`src/app/templates/[id]/ai-helper.tsx`](src/app/templates/[id]/ai-helper.tsx) (UI) + [`src/app/templates/[id]/ai-actions.ts`](src/app/templates/[id]/ai-actions.ts) (server actions) + [`src/lib/ai/`](src/lib/ai/) (client + prompts) |
| *"Enough plumbing to demonstrate the loop end to end: an event comes in → a rule matches → the right template is rendered → an email is actually sent through your chosen provider"* | [`src/app/api/events/route.ts`](src/app/api/events/route.ts) + [`src/lib/triggers/evaluate.ts`](src/lib/triggers/evaluate.ts) + [`src/lib/templates/render.ts`](src/lib/templates/render.ts) + [`src/lib/resend.ts`](src/lib/resend.ts). The `/events` page exposes a UI to fire test events. |

The doc's concrete worked example — *"Whenever a user upgrades their plan, send
the 'welcome to paid' email — but only once per user, and only if they have not
unsubscribed from product notifications"* — is wired up in the seeded data.
The video walkthrough demonstrates it firing, with one fire skipped due to
cooldown and another skipped because the conditions don't match.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Required by the brief. Latest major version — uses `proxy.ts` not `middleware.ts`, async `cookies()`, React 19 server components throughout. |
| Database + Auth | **Supabase** (Postgres + Auth) | Required by the brief. Using the new `sb_publishable_*` API key format (replaces the legacy `anon` JWT). Auth via cookie sessions, gated in [`src/proxy.ts`](src/proxy.ts). |
| Email delivery | **Resend** | Standout DX for a single-developer project; `onboarding@resend.dev` sender works without a verified domain so the demo is reproducible. |
| LLM provider | **OpenAI `gpt-4o`** | I tried Claude Opus 4.7 first ([git history](#)), then switched to OpenAI for cost during development. Both behind a thin wrapper in [`src/lib/ai/client.ts`](src/lib/ai/client.ts) so swapping is a single-file change. |
| Styling | **Tailwind 4** | Default of Next 16 starter; keeps the surface small. |
| Validation | **Hand-rolled FormData parsing** | Surface is small enough that schemas would be noise — every server action has a small `field(formData, name)` helper at the top. If the surface grows, swap to Zod (already in `package.json`). |
| Migrations | **Supabase CLI** | All schema in `supabase/migrations/` — applied via `npx supabase db push`. Generated types via `gen types typescript --linked`. |

---

## Architecture

```
                                                 ┌──────────────────────────┐
   Your SaaS app  ─── POST /api/events ────────► │  events table            │
   (or the UI's                                  │  (the stream + idem key) │
    "Fire test                                   └────────────┬─────────────┘
    event" button)                                            │
                                                              ▼
                                                 ┌──────────────────────────┐
                                                 │  Engine (evaluate.ts)    │
                                                 │   • find active triggers │
                                                 │   • evaluate conditions  │
                                                 │   • resolve recipient    │
                                                 │   • check dedup / cool   │
                                                 │   • render template      │
                                                 │   • send via Resend      │
                                                 │   • record in `sends`    │
                                                 └────────────┬─────────────┘
                                                              │
                                          ┌───────────────────┴────────────┐
                                          ▼                                ▼
                                  Inbox (Resend)                    sends table
                                                                    (audit log)


   Marketer UI  ──── Templates / Triggers / Sends (3 dashboard cards)
                     + AI helper inside each template
```

### Data model — 5 tables

All in `public` schema, RLS-on with "authenticated full access" (single-tenant scope).

| Table | Purpose |
|---|---|
| `templates` | Email content + auto-detected placeholders |
| `event_types` | Catalog of `user.upgraded`-style event names |
| `triggers` | Rules: `event_type_id → template_id`, with conditions + recipient + dedup |
| `events` | Incoming event occurrences (the stream), with idempotency_key unique index |
| `sends` | Audit log of every delivery attempt |

Indexes worth calling out (would matter at 1000+ templates):

- `triggers_event_type_idx` — partial index `WHERE active`, so the hot path
  (find triggers for an arriving event type) is single-key
- `sends_trigger_dedupe_idx` — partial `WHERE status in ('queued','sent')` so
  the dedup-check query is cheap
- `events_idempotency_idx` — unique index used to short-circuit duplicate
  POSTs at ingest time
- `templates_updated_at_idx` — for the `ORDER BY updated_at DESC` list view

### The trigger engine

The "decide which template fires" step is the piece the brief explicitly calls
out as evaluator-scrutinized. The decision flow ([`runEvent`](src/lib/triggers/evaluate.ts)):

```
1. Load the event row
2. Query active triggers WHERE event_type_id = event.event_type_id
3. For each trigger:
   a. evaluateConditions(trigger.conditions, event.payload)
      → no match: continue silently (no audit row — we only log triggers
        that matched conditions but were then blocked)
   b. resolve recipient via trigger.recipient_expr against payload
      → null/empty: log a `skipped` sends row with reason "no recipient"
   c. if trigger.dedupe_key_expr: query sends for prior dedup within cooldown
      → found: log a `skipped` row with reason "dedup" or "cooldown (Ns)"
   d. parsePlaceholders + renderTemplate
      → not ok (missing required): log a `failed` row
   e. sendEmail via Resend
      → failed: log a `failed` row
      → ok: log a `sent` row with provider_message_id
4. Return RunResult[] for the route handler
```

There's also a [`previewEvent`](src/lib/triggers/evaluate.ts) variant that runs
the decision step (1 + 2 + 3a + 3b + 3c) without inserting an event row,
rendering, or sending. The /events page surfaces it as a **Preview** button —
useful for testing rules without spamming inboxes.

### The conditions DSL

A small recursive JSON tree stored in `triggers.conditions` (nullable; `null`
means "always fire"):

```ts
type ConditionNode =
  | { op: "and";  args: ConditionNode[] }
  | { op: "or";   args: ConditionNode[] }
  | { op: "not";  arg: ConditionNode }
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains"; path: string; value: unknown }
  | { op: "in";     path: string; value: unknown[] }
  | { op: "exists"; path: string };
```

`path` is dot-notation against the event payload (`user.email`, with optional
`$.` prefix). The form-based editor in
[`src/app/triggers/conditions-editor.tsx`](src/app/triggers/conditions-editor.tsx)
produces a flat AND/OR of leaf conditions; the schema itself supports
arbitrary nesting (a power user could edit `triggers.conditions` directly to
build nested expressions, but the UI doesn't expose it).

### Failure modes the brief named

| Failure mode | How it's handled |
|---|---|
| **Duplicate sends** | `dedupe_key_expr` + `cooldown_seconds` on each trigger. UI exposes this as a single "Send at most once per recipient" checkbox that auto-sets dedup-by-recipient + 30-day cooldown. Engine queries `sends` for prior matches before sending. |
| **Event arriving twice** | `events.idempotency_key` with a unique partial index on `(event_type_id, idempotency_key)`. The `/api/events` handler checks for a prior row with the same key and short-circuits. |
| **Template referencing a placeholder that does not exist** | Placeholders are **auto-derived** from the template's body on every save (via [`derivePlaceholders`](src/lib/templates/render.ts) — a body can't reference an undeclared placeholder because there is no declaration step. At render time, missing values render as empty strings (graceful degradation, not a crash). |
| **Retries** | *Intentionally omitted* — see "What I'd do differently" below. Failed sends land as `failed` rows in the audit log with the error message; manual re-fire works. |

### AI helper

Three actions exposed inside the template editor, each backed by a server
action that calls OpenAI `gpt-4o` with `response_format: { type: "json_schema", strict: true }`
so the response is guaranteed-parseable JSON:

- **Generate subject variants** — returns 5 alternative subject lines, each preserving the template's declared placeholders. Click a variant to apply it as the new subject.
- **Rewrite tone** — pick a tone (Friendlier, More urgent, More formal, Warmer, Direct, More concise). Returns a rewritten subject + HTML body + plain-text body that preserves placeholders and structure. Apply all, subject only, or body only.
- **Draft from description** — give a one-line description, get a full subject + body draft using the template's declared placeholders naturally.

Prompts are versioned in [`src/lib/ai/prompts.ts`](src/lib/ai/prompts.ts) so
they can be reviewed and tuned without touching the orchestration code.

---

## Running locally

### 0. Prerequisites

- Node.js 22 or newer (Next 16 requires it)
- npm
- A Supabase project (free tier is fine)
- A Resend API key (free tier is fine)
- An OpenAI API key

### 1. Clone + install

```bash
git clone <repo-url>
cd email-platform
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Fields to populate (every one is required to fully run the demo):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
OPENAI_API_KEY=sk-proj-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up the database

Link the Supabase CLI to your project, then push the migrations:

```bash
npx supabase login              # opens browser; paste token back
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push            # applies all migrations in supabase/migrations/
```

This creates the 5 tables, indexes, RLS policies, and seeds three illustrative
event types + templates + triggers.

### 4. Create the shared login

In the Supabase dashboard → **Authentication → Providers → Email**: enable Email
and turn off "Confirm email" (so you can log in immediately).

Then **Authentication → Users → Add user** → create one user with any email +
password. This is the single shared credential the app uses (it's a
single-tenant assessment app — see "Scope decisions" below).

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in with the
credentials you just created, and you should see the three-card dashboard.

### Quick smoke test

After login, go to `/events`, pick `user.upgraded`, fill in your real email
for `user.email`, set `plan=pro`, click **Fire event**. An email lands in your
inbox in ~10 seconds. Open `/sends` to see the audit row.

---

## Scope decisions — "what I chose to leave out, and why"

The brief explicitly asks for this section. Here are the deliberate omissions
and the reasoning:

### Single shared login, no signup
A single shared credential created via the Supabase dashboard. No public
signup, no email confirmation, no multi-tenancy. The brief is a per-developer
take-home, so a marketing-ops surface usable by one principal is the right
scope. Multi-tenancy would have required `org_id` on every table + far more
involved RLS, with no concrete user-facing payoff for evaluation.

### No async queue in front of the engine
The engine runs synchronously inside the `POST /api/events` request thread. If
Resend is slow, the caller waits. For the demo and for fewer than a few
hundred events per minute, this is fine — and it makes the loop crisp to
explain. For production you'd put the engine behind a queue (Inngest,
Trigger.dev, or pg-boss) so the ingest endpoint returns immediately and
delivery is retryable. Discussed in the video walkthrough.

### No retries on failed sends
A failed Resend call logs a `failed` row in `sends` with the error message,
but the engine doesn't auto-retry. Re-firing the event manually works.
Coupling this to the queue point above: retries belong at the queue layer,
not in the inline engine.

### No aggregation conditions
The conditions DSL evaluates against the **current event's payload only**. It
can express the brief's example *"send the upgrade nudge … only if they have
not unsubscribed"* (a check on the payload), but it cannot express *"hit the
storage cap twice in the last week"* (an aggregation across the `events`
table). The cleaner architectural answer is for the producer to emit an
enriched event like `{user, plan, storage_cap_hits_last_week: 2}` and let the
DSL filter on that pre-computed field. A `count_events` condition op that
queries the `events` table directly would be a focused extension —
straightforward to add, deliberately deferred.

### No rich-text editor for template body
The body field is a textarea that accepts plain text (auto-wrapped in `<p>`
tags on save via [`autoParagraph`](src/lib/templates/render.ts)) or hand-written
HTML. A non-technical marketer who needs links, bold, and lists at scale
would want a TipTap or Lexical editor here. Closing this gap was the single
biggest non-engineer barrier; I left it out to keep the dep tree small for an
assessment.

### No template versioning or preview pane
- Versioning: every save overwrites in place. A real platform would keep
  immutable snapshots in a `template_versions` table to allow rollback after
  a bad edit. Real risk for marketers, low evaluation payoff for the demo.
- Preview pane: the brief explicitly says "with a preview." We have the
  send-test panel (renders + delivers to your real inbox in ~10s) which is
  arguably a *better* preview than an in-page mock, but a side-by-side live
  HTML preview alongside the editor would be the polished answer.

### `/api/events` is auth-gated
The brief talks about events "coming in" from external producers, which
implies a public endpoint. Right now `/api/events` is behind the same cookie
session as the rest of the app — the UI's "Fire test event" button hits it
with the user's session. For a real external producer (a backend webhook), a
parallel route that authenticates with a service secret would be the answer.
Deliberately left out — single secret rotation pattern, no engineering value
to demonstrate.

---

## What I'd do differently

In rough priority order:

1. **Rich-text editor for the template body.** Single biggest non-engineer
   barrier today. TipTap or Lexical, ~half a day of work.
2. **Async queue between ingest and send.** Move the engine onto pg-boss or
   Inngest. Adds retries, decouples ingest from Resend, makes the request
   thread return in <50ms.
3. **`count_events` condition op.** Closes the brief's worst-case example
   ("hit the storage cap twice in the last week"). A new condition type that
   runs a parameterized query against `events` with an index on
   `(event_type_id, received_at)`.
4. **Template versioning.** Append-only `template_versions` table, "view
   history" on the editor, ability to pin a trigger to a specific template
   version for stable rules during in-progress edits.
5. **Per-event-type ingestion secrets.** A separate `/api/events/ingest`
   route that authenticates with a service secret (rotatable per event-type
   in a settings UI) so external producers can post events without a user
   session.
6. **Cursor-paginated list pages.** The `/templates` and `/triggers` lists
   fetch all rows; fine at ≤100, will need pagination at 1000+. The data
   model is already indexed for `(updated_at DESC)` queries.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                              # Dashboard (3 cards)
│   ├── proxy.ts                              # Auth gate (Next 16's middleware)
│   ├── login/                                # Login form + actions
│   ├── templates/                            # CRUD + AI helper + send-test
│   │   ├── page.tsx                          # List (search)
│   │   ├── new/                              # Create
│   │   └── [id]/                             # Edit + AI helper + send-test
│   ├── event-types/                          # CRUD
│   ├── triggers/                             # CRUD + conditions editor + dry-run
│   ├── events/                               # Stream view + Fire test event
│   ├── sends/                                # Audit log with status filter
│   └── api/events/route.ts                   # External ingestion endpoint
│
└── lib/
    ├── ai/                                   # OpenAI client + prompts
    ├── resend.ts                             # Email provider wrapper
    ├── supabase/                             # Client + server + proxy (with Database type)
    ├── templates/render.ts                   # Renderer + placeholder helpers
    └── triggers/
        ├── conditions.ts                     # DSL evaluator
        └── evaluate.ts                       # runEvent + previewEvent

supabase/
└── migrations/                               # All schema changes (db push to apply)
```

---
