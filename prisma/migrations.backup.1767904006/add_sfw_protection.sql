-- Migration: Add SFW Protection System
-- Description: Adds sfwProtection field to User table for content filtering
-- Date: 2026-01-08

-- Add sfwProtection field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sfwProtection" BOOLEAN NOT NULL DEFAULT true;

-- Set sfwProtection based on plan
-- FREE users: always true (forced protection)
-- PREMIUM users: false by default (they can toggle it on if they want)
UPDATE "User"
SET "sfwProtection" = false
WHERE "plan" IN ('plus', 'ultra');

-- Create index for performance
CREATE INDEX IF NOT EXISTS "User_sfwProtection_idx" ON "User"("sfwProtection");

-- Log migration results
DO $$
DECLARE
  free_users INTEGER;
  premium_users INTEGER;
  protected_users INTEGER;
  unprotected_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO free_users FROM "User" WHERE "plan" = 'free';
  SELECT COUNT(*) INTO premium_users FROM "User" WHERE "plan" IN ('plus', 'ultra');
  SELECT COUNT(*) INTO protected_users FROM "User" WHERE "sfwProtection" = true;
  SELECT COUNT(*) INTO unprotected_users FROM "User" WHERE "sfwProtection" = false;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'SFW Protection Migration Completed';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Free users (protection forced): %', free_users;
  RAISE NOTICE 'Premium users (can toggle): %', premium_users;
  RAISE NOTICE 'Total users with protection: %', protected_users;
  RAISE NOTICE 'Total users without protection: %', unprotected_users;
  RAISE NOTICE '===========================================';
END $$;
