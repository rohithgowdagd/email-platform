-- =============================================================================
-- Seed a sample trigger wiring the user.upgraded event type to the
-- welcome-to-paid template. This makes the end-to-end demo work out of the
-- box: fire a user.upgraded event with plan in ['pro', 'team', 'enterprise']
-- and a recipient email, and the welcome-to-paid template renders and sends.
-- Idempotent by trigger name.
-- =============================================================================

insert into public.triggers (
  name,
  description,
  event_type_id,
  template_id,
  conditions,
  recipient_expr,
  dedupe_key_expr,
  cooldown_seconds,
  active
)
select
  'Welcome to Pro',
  'Fires the welcome-to-paid email when a user upgrades to any paid plan. Throttled to once per user per 60 seconds during demos.',
  et.id,
  t.id,
  jsonb_build_object(
    'op', 'in',
    'path', 'plan',
    'value', jsonb_build_array('pro', 'team', 'enterprise')
  ),
  '$.user.email',
  '$.user.id',
  60,
  true
from public.event_types et, public.templates t
where et.name = 'user.upgraded'
  and t.slug = 'welcome-to-paid'
  and not exists (
    select 1 from public.triggers tr where tr.name = 'Welcome to Pro'
  );
