-- Per-user notification preferences.
--
-- A single jsonb column rather than separate boolean columns so new
-- categories can be added without a migration. Keys default to `true`
-- when absent — the column itself defaults to `{}` so an old row that
-- has never been touched still opts the user into transactional mail.
-- Reading the value should always go through the application layer
-- (which fills in defaults), never SQL boolean comparisons against
-- raw jsonb keys.

ALTER TABLE "users"
  ADD COLUMN "notification_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb;
