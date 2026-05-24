-- =============================================================================
-- Additional seed templates covering the email kinds named in the assessment:
-- welcome (already seeded), password resets, reminders, marketing nudges,
-- billing notifications, milestone celebrations, re-engagement campaigns.
-- Idempotent via on conflict (slug) do nothing.
-- =============================================================================

insert into public.templates (slug, name, subject, body_html, body_text, description, category, placeholders)
values
  (
    'password-reset',
    'Password reset',
    'Reset your password',
    '<p>Hi {{user.name}},</p><p>We received a request to reset your password. Click the link below to choose a new one. This link expires in {{expiry_minutes}} minutes.</p><p><a href="{{reset_url}}">Reset password</a></p><p>If you didn''t request this, you can safely ignore this email.</p>',
    'Hi {{user.name}}, we received a request to reset your password. Open {{reset_url}} to choose a new one. This link expires in {{expiry_minutes}} minutes. If you didn''t request this, ignore this email.',
    'Sent when a user requests a password reset. Single-use link with short expiry.',
    'auth',
    jsonb_build_array(
      jsonb_build_object('name', 'user.name',       'type', 'string', 'required', true,  'sample', 'Sam'),
      jsonb_build_object('name', 'reset_url',       'type', 'string', 'required', true,  'sample', 'https://app.example.com/reset?token=abc123'),
      jsonb_build_object('name', 'expiry_minutes',  'type', 'number', 'required', true,  'sample', '30')
    )
  ),
  (
    'trial-ending-soon',
    'Trial ending soon',
    'Your trial ends in {{days_remaining}} days',
    '<p>Hi {{user.name}},</p><p>Your free trial of {{product_name}} ends in <strong>{{days_remaining}} days</strong>. To keep your projects active, upgrade any time before then.</p><p><a href="{{upgrade_url}}">Upgrade your plan</a></p><p>Questions? Reply to this email — we''ll help.</p>',
    'Hi {{user.name}}, your free trial of {{product_name}} ends in {{days_remaining}} days. To keep your projects active, upgrade at {{upgrade_url}} before then.',
    'Reminder fired 3 days before a free trial expires. Skip if the account is already on a paid plan.',
    'lifecycle',
    jsonb_build_array(
      jsonb_build_object('name', 'user.name',        'type', 'string', 'required', true,  'sample', 'Sam'),
      jsonb_build_object('name', 'product_name',     'type', 'string', 'required', true,  'sample', 'Inkwell'),
      jsonb_build_object('name', 'days_remaining',   'type', 'number', 'required', true,  'sample', '3'),
      jsonb_build_object('name', 'upgrade_url',      'type', 'string', 'required', true,  'sample', 'https://app.example.com/billing/upgrade')
    )
  ),
  (
    'invoice-paid',
    'Invoice paid',
    'Payment received — invoice {{invoice.number}}',
    '<p>Hi {{user.name}},</p><p>Thanks — we received your payment of <strong>{{invoice.amount}}</strong> for invoice <code>{{invoice.number}}</code> on {{invoice.date}}.</p><p>Your receipt is available at <a href="{{invoice.url}}">{{invoice.url}}</a>.</p>',
    'Hi {{user.name}}, thanks — we received your payment of {{invoice.amount}} for invoice {{invoice.number}} on {{invoice.date}}. Your receipt is at {{invoice.url}}.',
    'Sent after a successful invoice payment. Doubles as the customer-facing receipt.',
    'billing',
    jsonb_build_array(
      jsonb_build_object('name', 'user.name',       'type', 'string', 'required', true,  'sample', 'Sam'),
      jsonb_build_object('name', 'invoice.number',  'type', 'string', 'required', true,  'sample', 'INV-002817'),
      jsonb_build_object('name', 'invoice.amount',  'type', 'string', 'required', true,  'sample', '$49.00'),
      jsonb_build_object('name', 'invoice.date',    'type', 'string', 'required', true,  'sample', '2026-05-22'),
      jsonb_build_object('name', 'invoice.url',     'type', 'string', 'required', true,  'sample', 'https://app.example.com/billing/invoices/INV-002817')
    )
  ),
  (
    'first-milestone-reached',
    'First milestone reached',
    'You hit your first milestone, {{user.name}}!',
    '<p>Hi {{user.name}},</p><p>You just reached <strong>{{milestone}}</strong>. That puts you ahead of {{percentile}}% of teams in their first month — nicely done.</p><p>Here''s what unlocks next: <a href="{{next_url}}">{{next_label}}</a>.</p>',
    'Hi {{user.name}}, you just reached {{milestone}}. That puts you ahead of {{percentile}}% of teams in their first month. What unlocks next: {{next_label}} ({{next_url}}).',
    'Celebrates a user-level milestone such as first 10 projects or 1,000 active customers.',
    'engagement',
    jsonb_build_array(
      jsonb_build_object('name', 'user.name',  'type', 'string', 'required', true,  'sample', 'Sam'),
      jsonb_build_object('name', 'milestone',  'type', 'string', 'required', true,  'sample', '10 published projects'),
      jsonb_build_object('name', 'percentile', 'type', 'number', 'required', true,  'sample', '85'),
      jsonb_build_object('name', 'next_url',   'type', 'string', 'required', true,  'sample', 'https://app.example.com/share'),
      jsonb_build_object('name', 'next_label', 'type', 'string', 'required', true,  'sample', 'Custom team page')
    )
  ),
  (
    'comeback-discount',
    'Come back — discount inside',
    'We miss you, {{user.name}} — here''s {{discount.percent}}% off',
    '<p>Hi {{user.name}},</p><p>It''s been a minute. To make it easier to get back in, here''s a one-time <strong>{{discount.percent}}%</strong> off — use code <code>{{discount.code}}</code> at checkout. Valid until {{discount.expires_at}}.</p><p><a href="{{return_url}}">Pick up where you left off</a></p>',
    'Hi {{user.name}}, it''s been a minute. Here''s {{discount.percent}}% off — use code {{discount.code}} at checkout. Valid until {{discount.expires_at}}. Pick up where you left off: {{return_url}}.',
    'Re-engagement nudge for accounts inactive for more than 30 days.',
    'marketing',
    jsonb_build_array(
      jsonb_build_object('name', 'user.name',           'type', 'string', 'required', true,  'sample', 'Sam'),
      jsonb_build_object('name', 'discount.percent',    'type', 'number', 'required', true,  'sample', '20'),
      jsonb_build_object('name', 'discount.code',       'type', 'string', 'required', true,  'sample', 'COMEBACK20'),
      jsonb_build_object('name', 'discount.expires_at', 'type', 'string', 'required', true,  'sample', '2026-06-15'),
      jsonb_build_object('name', 'return_url',          'type', 'string', 'required', true,  'sample', 'https://app.example.com/dashboard')
    )
  )
on conflict (slug) do nothing;
