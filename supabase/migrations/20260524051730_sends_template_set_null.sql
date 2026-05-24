-- =============================================================================
-- Allow templates to be deleted without losing the sends audit log.
--
-- Before: sends.template_id was NOT NULL with ON DELETE RESTRICT, which meant
-- once a template had ever been used (even for a one-off test send), it could
-- never be deleted without first wiping the audit history. That's the wrong
-- trade-off: the rendered subject/body/recipient are already captured at send
-- time, so the link to the template row is metadata, not load-bearing data.
--
-- After: nullable + ON DELETE SET NULL. Deleting a template leaves the sends
-- rows intact with template_id = NULL. The audit history is preserved; only
-- the back-reference is lost.
--
-- Triggers keep their stricter ON DELETE RESTRICT behavior — losing a trigger
-- silently because someone deleted a template would destroy configured rules.
-- =============================================================================

alter table public.sends
  alter column template_id drop not null;

alter table public.sends
  drop constraint sends_template_id_fkey;

alter table public.sends
  add constraint sends_template_id_fkey
    foreign key (template_id)
    references public.templates(id)
    on delete set null;
