-- =============================================================================
-- Trigger: sync auth.users → public.users
-- =============================================================================
-- Supabase manages auth.users internally. This trigger mirrors a new user into
-- our public.users table as soon as their account is confirmed.
--
-- Two cases are handled:
--   1. Email confirmation DISABLED — Supabase sets email_confirmed_at at INSERT
--      time, so the INSERT trigger fires immediately on sign-up.
--   2. Email confirmation ENABLED  — email_confirmed_at is NULL at sign-up and
--      set when the user clicks the confirmation link (UPDATE trigger).
--
-- Run this once against the Supabase database via:
--   Supabase Dashboard → SQL Editor → paste and run
-- or:
--   DATABASE_URL=<direct-connection-url> bun run db:migrate  (from packages/db)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT path: auto-confirm is on, email_confirmed_at already set at sign-up.
  -- UPDATE path: user just clicked the confirmation link.
  IF (
    (TG_OP = 'INSERT' AND new.email_confirmed_at IS NOT NULL)
    OR
    (TG_OP = 'UPDATE' AND new.email_confirmed_at IS NOT NULL AND old.email_confirmed_at IS NULL)
  ) THEN
    INSERT INTO public.users (supabase_user_id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (supabase_user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- Fires when auto-confirm is enabled (email_confirmed_at set at sign-up).
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_confirmed();

-- Fires when the user clicks their confirmation email.
CREATE OR REPLACE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_confirmed();
