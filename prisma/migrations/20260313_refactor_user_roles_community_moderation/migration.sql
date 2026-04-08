-- Update User role field to use subscription tiers
-- Change default from 'user' to 'free'
-- Migrate existing roles to subscription tiers
UPDATE "User" SET role = CASE
  WHEN role = 'user' THEN 'free'
  WHEN role = 'vip' THEN 'plus'
  WHEN role = 'admin' THEN 'sponsor'
  WHEN role = 'moderator' THEN 'plus'
  ELSE role
END
WHERE role IN ('user', 'vip', 'admin', 'moderator');

-- Update CommunityMember table for enhanced moderation system
ALTER TABLE "CommunityMember" ADD COLUMN IF NOT EXISTS "moderationActions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityMember" ADD COLUMN IF NOT EXISTS "promotedAt" TIMESTAMP(3);

-- Create CommunityModerationLog table
CREATE TABLE IF NOT EXISTS "CommunityModerationLog" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT,
    "moderatorRole" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityModerationLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for CommunityModerationLog
CREATE INDEX IF NOT EXISTS "CommunityModerationLog_communityId_idx" ON "CommunityModerationLog"("communityId");
CREATE INDEX IF NOT EXISTS "CommunityModerationLog_targetType_targetId_idx" ON "CommunityModerationLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "CommunityModerationLog_action_idx" ON "CommunityModerationLog"("action");
CREATE INDEX IF NOT EXISTS "CommunityModerationLog_performedBy_idx" ON "CommunityModerationLog"("performedBy");
CREATE INDEX IF NOT EXISTS "CommunityModerationLog_createdAt_idx" ON "CommunityModerationLog"("createdAt");
