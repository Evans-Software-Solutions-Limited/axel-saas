-- Align subscription_tier enum with the public pricing model.
-- Replaces legacy 4-tier enum (starter/pro/business/developer) with the 3-tier
-- model surfaced everywhere else in the product (free/premium/enterprise).
--
-- Data migration:
--   starter                    -> free
--   pro / business / developer -> premium
--
-- Postgres cannot drop enum values in place, so we create a new type, convert
-- the column with a CASE mapping, drop the old type, and rename.

BEGIN;

CREATE TYPE "subscription_tier_new" AS ENUM ('free', 'premium', 'enterprise');

ALTER TABLE "subscriptions" ALTER COLUMN "tier" DROP DEFAULT;

ALTER TABLE "subscriptions"
  ALTER COLUMN "tier" TYPE "subscription_tier_new"
  USING (
    CASE "tier"::text
      WHEN 'starter' THEN 'free'
      WHEN 'pro' THEN 'premium'
      WHEN 'business' THEN 'premium'
      WHEN 'developer' THEN 'premium'
      ELSE 'free'
    END
  )::"subscription_tier_new";

DROP TYPE "subscription_tier";
ALTER TYPE "subscription_tier_new" RENAME TO "subscription_tier";

COMMIT;
