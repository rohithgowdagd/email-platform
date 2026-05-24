-- =============================================================================
-- Seed data so the UI has something to render on first load.
-- Idempotent: re-running won't duplicate rows.
-- =============================================================================

-- One example event type to anchor the demo.
insert into public.event_types (name, description, payload_schema)
values (
  'user.upgraded',
  'Fired when a user upgrades from free to a paid plan.',
  jsonb_build_object(
    'type', 'object',
    'required', jsonb_build_array('user'),
    'properties', jsonb_build_object(
      'user', jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('id', 'email'),
        'properties', jsonb_build_object(
          'id',    jsonb_build_object('type', 'string'),
          'email', jsonb_build_object('type', 'string', 'format', 'email'),
          'name',  jsonb_build_object('type', 'string')
        )
      ),
      'plan', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('pro', 'team', 'enterprise'))
    )
  )
)
on conflict (name) do nothing;

-- One example template — the "welcome to paid" email from the assessment brief.
insert into public.templates (slug, name, subject, body_html, body_text, description, category, placeholders)
values (
  'welcome-to-paid',
  'Welcome to paid',
  'Welcome to {{plan}}, {{user.name}}!',
  '<p>Hi {{user.name}},</p><p>Thanks for upgrading to <strong>{{plan}}</strong>. Here is what unlocks for you.</p>',
  'Hi {{user.name}}, thanks for upgrading to {{plan}}. Here is what unlocks for you.',
  'Sent once when a user upgrades from free to any paid plan.',
  'lifecycle',
  jsonb_build_array(
    jsonb_build_object('name', 'user.name', 'type', 'string', 'required', true,  'sample', 'Alex'),
    jsonb_build_object('name', 'plan',      'type', 'string', 'required', true,  'sample', 'pro'),
    jsonb_build_object('name', 'user.email','type', 'string', 'required', false, 'sample', 'alex@example.com')
  )
)
on conflict (slug) do nothing;
