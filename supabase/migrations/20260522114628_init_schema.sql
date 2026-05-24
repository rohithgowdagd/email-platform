-- =============================================================================
-- Email Platform — initial schema
-- =============================================================================
-- Five tables form the foundation:
--   templates    — email content + declared placeholders
--   event_types  — catalog of known event types (e.g. 'user.upgraded')
--   triggers     — rules: when this event fires + conditions match, send template
--   events       — incoming event occurrences (the stream)
--   sends        — audit log of every send attempt (success or failure)
--
-- Single-tenant. RLS: any authenticated user has full access; anon is denied.
-- (Public event ingestion will use the service-role key on the server, not RLS.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- templates
-- -----------------------------------------------------------------------------
create table public.templates (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  subject       text not null,
  body_html     text not null,
  body_text     text,
  description   text,
  category      text,
  -- Declared placeholders: array of { name, type, required, sample }.
  -- Used by the renderer to validate substitutions and by the AI helper.
  placeholders  jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index templates_category_idx on public.templates (category);
create index templates_updated_at_idx on public.templates (updated_at desc);

-- -----------------------------------------------------------------------------
-- event_types
-- -----------------------------------------------------------------------------
create table public.event_types (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  description     text,
  -- Optional JSON Schema describing the expected payload shape.
  payload_schema  jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- triggers
-- -----------------------------------------------------------------------------
create table public.triggers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text,
  event_type_id      uuid not null references public.event_types(id) on delete restrict,
  template_id        uuid not null references public.templates(id) on delete restrict,
  -- Recursive rule tree: { op, args } | { op, path, value }.
  -- null means "always fire when the event arrives".
  conditions         jsonb,
  -- JSONPath-like expression resolving the recipient email from the event payload.
  -- e.g. '$.user.email'
  recipient_expr     text not null,
  active             boolean not null default true,
  -- Optional dedup: only send once per resolved key value.
  -- e.g. '$.user.id' — every distinct user.id can receive this template once.
  dedupe_key_expr    text,
  -- Cooldown: if dedupe_key_expr is set, require this many seconds between sends
  -- for the same key. NULL with dedupe set = strict once-ever.
  cooldown_seconds   integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index triggers_event_type_idx on public.triggers (event_type_id) where active;
create index triggers_template_idx on public.triggers (template_id);

-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  event_type_id     uuid not null references public.event_types(id) on delete restrict,
  payload           jsonb not null,
  -- Caller-supplied key to dedupe at ingestion time (idempotent POSTs).
  idempotency_key   text,
  received_at       timestamptz not null default now()
);

create unique index events_idempotency_idx
  on public.events (event_type_id, idempotency_key)
  where idempotency_key is not null;

create index events_received_at_idx on public.events (received_at desc);

-- -----------------------------------------------------------------------------
-- sends
-- -----------------------------------------------------------------------------
create type public.send_status as enum ('queued', 'sent', 'failed', 'skipped');

create table public.sends (
  id                    uuid primary key default gen_random_uuid(),
  -- trigger_id null = manual test-send from the template editor
  trigger_id            uuid references public.triggers(id) on delete set null,
  template_id           uuid not null references public.templates(id) on delete restrict,
  -- event_id null = manual test-send (no originating event)
  event_id              uuid references public.events(id) on delete set null,
  recipient_email       text not null,
  rendered_subject      text not null,
  rendered_body         text not null,
  status                public.send_status not null,
  provider_message_id   text,
  error_message         text,
  -- Resolved value of trigger.dedupe_key_expr against the event payload.
  -- Used to enforce send-once / cooldown semantics in the evaluator.
  dedupe_key            text,
  created_at            timestamptz not null default now(),
  sent_at               timestamptz
);

-- Cheap "has this trigger already sent to this dedupe_key recently?" check.
create index sends_trigger_dedupe_idx
  on public.sends (trigger_id, dedupe_key, sent_at desc)
  where status in ('queued', 'sent');

create index sends_template_idx on public.sends (template_id);
create index sends_created_at_idx on public.sends (created_at desc);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger templates_touch_updated_at
  before update on public.templates
  for each row execute function public.touch_updated_at();

create trigger triggers_touch_updated_at
  before update on public.triggers
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Single-tenant policy: any authenticated user gets full access.
-- Server-side privileged operations (event ingestion from external systems)
-- use the service-role key, which bypasses RLS entirely.

alter table public.templates    enable row level security;
alter table public.event_types  enable row level security;
alter table public.triggers     enable row level security;
alter table public.events       enable row level security;
alter table public.sends        enable row level security;

create policy "authenticated full access" on public.templates
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.event_types
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.triggers
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.events
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.sends
  for all to authenticated using (true) with check (true);
