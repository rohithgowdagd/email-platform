-- =============================================================================
-- Reset and re-seed with three clean illustrative examples that walk through
-- the whole loop end to end.
--
-- ⚠️ Destructive: deletes ALL existing templates, event types, triggers,
-- events, and sends — including anything created in the UI. The intent is
-- to start from a clean, easy-to-understand demo state.
--
-- Three event types, three templates, three triggers — paired 1:1. Each
-- trigger teaches a slightly different aspect of the engine:
--
--   1. user.signed_up → 'welcome'              (no conditions, dedup on)
--   2. user.upgraded  → 'upgrade-thanks'       (conditions: plan in [...])
--   3. order.placed   → 'order-confirmation'   (no conditions, NO dedup)
-- =============================================================================

-- 1. Wipe in FK-safe order. sends FK to triggers (set null), templates
--    (set null), events (set null) — order doesn't matter much, but
--    cascading from sends → events → triggers → templates → event_types is
--    the safe pattern.
delete from public.sends;
delete from public.events;
delete from public.triggers;
delete from public.templates;
delete from public.event_types;

-- 2. Event types — the catalog of "kinds of things that can happen"
insert into public.event_types (name, description, payload_schema) values
  ('user.signed_up', null, '{}'::jsonb),
  ('user.upgraded',  null, '{}'::jsonb),
  ('order.placed',   null, '{}'::jsonb);

-- 3. Templates — the email content. Placeholders match what each body
--    references; bodies are already wrapped in <p> tags (the UI's
--    auto-paragraph step is for hand-edits, not for SQL seeds).
insert into public.templates (slug, name, subject, body_html, body_text, description, category, placeholders) values
  (
    'welcome',
    'Welcome',
    'Welcome, {{user.name}}!',
    '<p>Hi {{user.name}},</p><p>Thanks for signing up. We''re glad to have you here.</p><p>Hit reply if you have any questions.</p>',
    null, null, null,
    jsonb_build_array(
      jsonb_build_object('name', 'user.name', 'required', false, 'sample', '')
    )
  ),
  (
    'upgrade-thanks',
    'Upgrade thank-you',
    'Thanks for upgrading to {{plan}}, {{user.name}}!',
    '<p>Hi {{user.name}},</p><p>Thanks for upgrading to the <strong>{{plan}}</strong> plan. We''ve emailed your receipt to {{user.email}}.</p><p>Let us know if you have any questions about your new plan.</p>',
    null, null, null,
    jsonb_build_array(
      jsonb_build_object('name', 'plan',       'required', false, 'sample', ''),
      jsonb_build_object('name', 'user.email', 'required', false, 'sample', ''),
      jsonb_build_object('name', 'user.name',  'required', false, 'sample', '')
    )
  ),
  (
    'order-confirmation',
    'Order confirmation',
    'Your order #{{order.number}} is confirmed',
    '<p>Hi {{user.name}},</p><p>Your order <strong>#{{order.number}}</strong> with {{order.items_count}} item(s) totalling {{order.total}} is confirmed.</p><p>We''ll let you know as soon as it ships.</p>',
    null, null, null,
    jsonb_build_array(
      jsonb_build_object('name', 'order.items_count', 'required', false, 'sample', ''),
      jsonb_build_object('name', 'order.number',      'required', false, 'sample', ''),
      jsonb_build_object('name', 'order.total',       'required', false, 'sample', ''),
      jsonb_build_object('name', 'user.name',         'required', false, 'sample', '')
    )
  );

-- 4. Triggers — wire each event type to its template
insert into public.triggers (name, description, event_type_id, template_id, recipient_expr, dedupe_key_expr, cooldown_seconds, conditions, active)
select
  'Welcome new users',
  null,
  (select id from public.event_types where name = 'user.signed_up'),
  (select id from public.templates   where slug = 'welcome'),
  '$.user.email',
  '$.user.email',          -- once per recipient (a user gets welcomed only once)
  2592000,                 -- 30-day cooldown window
  null,                    -- no conditions: fire on every user.signed_up
  true;

insert into public.triggers (name, description, event_type_id, template_id, recipient_expr, dedupe_key_expr, cooldown_seconds, conditions, active)
select
  'Thank paid upgraders',
  null,
  (select id from public.event_types where name = 'user.upgraded'),
  (select id from public.templates   where slug = 'upgrade-thanks'),
  '$.user.email',
  '$.user.email',
  2592000,
  -- Only fire if plan is one of the paid tiers (skip downgrades to free)
  jsonb_build_object(
    'op', 'in',
    'path', 'plan',
    'value', jsonb_build_array('pro', 'team', 'enterprise')
  ),
  true;

insert into public.triggers (name, description, event_type_id, template_id, recipient_expr, dedupe_key_expr, cooldown_seconds, conditions, active)
select
  'Order confirmations',
  null,
  (select id from public.event_types where name = 'order.placed'),
  (select id from public.templates   where slug = 'order-confirmation'),
  '$.user.email',
  null,                    -- NO dedup: every order gets its own confirmation
  null,
  null,
  true;
