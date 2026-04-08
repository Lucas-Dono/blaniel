-- Add moderation fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedBy" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedBy" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "warningCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastWarningAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastWarningReason" TEXT;

-- Create UserModerationLog table
CREATE TABLE IF NOT EXISTS "UserModerationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModerationLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for User moderation fields
CREATE INDEX IF NOT EXISTS "User_isBanned_idx" ON "User"("isBanned");
CREATE INDEX IF NOT EXISTS "User_isSuspended_idx" ON "User"("isSuspended");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- Create indexes for UserModerationLog
CREATE INDEX IF NOT EXISTS "UserModerationLog_userId_idx" ON "UserModerationLog"("userId");
CREATE INDEX IF NOT EXISTS "UserModerationLog_action_idx" ON "UserModerationLog"("action");
CREATE INDEX IF NOT EXISTS "UserModerationLog_performedBy_idx" ON "UserModerationLog"("performedBy");
CREATE INDEX IF NOT EXISTS "UserModerationLog_createdAt_idx" ON "UserModerationLog"("createdAt");

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserModerationLog_userId_fkey'
    ) THEN
        ALTER TABLE "UserModerationLog" ADD CONSTRAINT "UserModerationLog_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
