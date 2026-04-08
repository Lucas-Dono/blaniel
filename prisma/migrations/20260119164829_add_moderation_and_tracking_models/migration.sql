-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "interval" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "plan" TEXT;

-- CreateTable
CREATE TABLE "SavedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "collectionName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiddenPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hideNSFW" BOOLEAN NOT NULL DEFAULT true,
    "hideSpoilers" BOOLEAN NOT NULL DEFAULT true,
    "blockedTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mutedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoModRule" (
    "id" TEXT NOT NULL,
    "communityId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoModRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLSuggestion" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "suggestionType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "mlModel" TEXT NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MLSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeArc" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "arcType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarrativeArc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),

    CONSTRAINT "EmailSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPost_userId_idx" ON "SavedPost"("userId");

-- CreateIndex
CREATE INDEX "SavedPost_postId_idx" ON "SavedPost"("postId");

-- CreateIndex
CREATE INDEX "SavedPost_collectionName_idx" ON "SavedPost"("collectionName");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPost_userId_postId_key" ON "SavedPost"("userId", "postId");

-- CreateIndex
CREATE INDEX "HiddenPost_userId_idx" ON "HiddenPost"("userId");

-- CreateIndex
CREATE INDEX "HiddenPost_postId_idx" ON "HiddenPost"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenPost_userId_postId_key" ON "HiddenPost"("userId", "postId");

-- CreateIndex
CREATE INDEX "BlockedUser_userId_idx" ON "BlockedUser"("userId");

-- CreateIndex
CREATE INDEX "BlockedUser_blockedId_idx" ON "BlockedUser"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_userId_blockedId_key" ON "BlockedUser"("userId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPreference_userId_key" ON "ContentPreference"("userId");

-- CreateIndex
CREATE INDEX "ContentPreference_userId_idx" ON "ContentPreference"("userId");

-- CreateIndex
CREATE INDEX "AutoModRule_communityId_idx" ON "AutoModRule"("communityId");

-- CreateIndex
CREATE INDEX "AutoModRule_enabled_idx" ON "AutoModRule"("enabled");

-- CreateIndex
CREATE INDEX "AutoModRule_createdBy_idx" ON "AutoModRule"("createdBy");

-- CreateIndex
CREATE INDEX "MLSuggestion_targetType_targetId_idx" ON "MLSuggestion"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "MLSuggestion_status_idx" ON "MLSuggestion"("status");

-- CreateIndex
CREATE INDEX "MLSuggestion_confidence_idx" ON "MLSuggestion"("confidence");

-- CreateIndex
CREATE INDEX "MLSuggestion_createdAt_idx" ON "MLSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "NarrativeArc_agentId_idx" ON "NarrativeArc"("agentId");

-- CreateIndex
CREATE INDEX "NarrativeArc_userId_idx" ON "NarrativeArc"("userId");

-- CreateIndex
CREATE INDEX "NarrativeArc_status_idx" ON "NarrativeArc"("status");

-- CreateIndex
CREATE INDEX "EmailSent_userId_idx" ON "EmailSent"("userId");

-- CreateIndex
CREATE INDEX "EmailSent_email_idx" ON "EmailSent"("email");

-- CreateIndex
CREATE INDEX "EmailSent_status_idx" ON "EmailSent"("status");

-- CreateIndex
CREATE INDEX "EmailSent_sentAt_idx" ON "EmailSent"("sentAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_source_eventType_idx" ON "WebhookEvent"("source", "eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_processed_idx" ON "WebhookEvent"("processed");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentClaim_userId_idx" ON "PaymentClaim"("userId");

-- CreateIndex
CREATE INDEX "PaymentClaim_subscriptionId_idx" ON "PaymentClaim"("subscriptionId");

-- CreateIndex
CREATE INDEX "PaymentClaim_provider_providerId_idx" ON "PaymentClaim"("provider", "providerId");

-- CreateIndex
CREATE INDEX "PaymentClaim_status_idx" ON "PaymentClaim"("status");

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenPost" ADD CONSTRAINT "HiddenPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenPost" ADD CONSTRAINT "HiddenPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPreference" ADD CONSTRAINT "ContentPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoModRule" ADD CONSTRAINT "AutoModRule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoModRule" ADD CONSTRAINT "AutoModRule_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLSuggestion" ADD CONSTRAINT "MLSuggestion_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeArc" ADD CONSTRAINT "NarrativeArc_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeArc" ADD CONSTRAINT "NarrativeArc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSent" ADD CONSTRAINT "EmailSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
