-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "UserSession" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrer" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "timeOnSite" INTEGER NOT NULL DEFAULT 0,
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "demoCompleted" BOOLEAN NOT NULL DEFAULT false,
    "signupConverted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "DailyKPI" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "landingViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "demoStarts" INTEGER NOT NULL DEFAULT 0,
    "demoCompletes" INTEGER NOT NULL DEFAULT 0,
    "ctaClicks" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "signupRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "demoConversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dau" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "avgMessagesPerUser" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "avgSessionDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freeToPlus" INTEGER NOT NULL DEFAULT 0,
    "freeToPlusRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freeToUltra" INTEGER NOT NULL DEFAULT 0,
    "freeToUltraRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plusToUltra" INTEGER NOT NULL DEFAULT 0,
    "plusToUltraRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "d1Retention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "d7Retention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "d30Retention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBonds" INTEGER NOT NULL DEFAULT 0,
    "romanticBonds" INTEGER NOT NULL DEFAULT 0,
    "bestFriendBonds" INTEGER NOT NULL DEFAULT 0,
    "mentorBonds" INTEGER NOT NULL DEFAULT 0,
    "confidantBonds" INTEGER NOT NULL DEFAULT 0,
    "creativePartnerBonds" INTEGER NOT NULL DEFAULT 0,
    "adventureCompanionBonds" INTEGER NOT NULL DEFAULT 0,
    "acquaintanceBonds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyKPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnalyticsSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acquisitionSource" TEXT,
    "acquisitionMedium" TEXT,
    "acquisitionCampaign" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "avgSessionDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgMessagesPerSession" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "favoriteAgentId" TEXT,
    "favoriteAgentMessages" INTEGER NOT NULL DEFAULT 0,
    "totalAgents" INTEGER NOT NULL DEFAULT 0,
    "totalBonds" INTEGER NOT NULL DEFAULT 0,
    "highestBondTier" TEXT,
    "avgBondAffinity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "lifetimeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstPaidAt" TIMESTAMP(3),
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relationStage" TEXT NOT NULL DEFAULT 'stranger',
    "isChurnRisk" BOOLEAN NOT NULL DEFAULT false,
    "isPowerUser" BOOLEAN NOT NULL DEFAULT false,
    "isHighValue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAnalyticsSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSession_sessionId_idx" ON "UserSession"("sessionId");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_startedAt_idx" ON "UserSession"("startedAt");

-- CreateIndex
CREATE INDEX "UserSession_convertedAt_idx" ON "UserSession"("convertedAt");

-- CreateIndex
CREATE INDEX "UserSession_utmSource_idx" ON "UserSession"("utmSource");

-- CreateIndex
CREATE INDEX "UserSession_utmMedium_idx" ON "UserSession"("utmMedium");

-- CreateIndex
CREATE INDEX "UserSession_utmCampaign_idx" ON "UserSession"("utmCampaign");

-- CreateIndex
CREATE INDEX "UserSession_userId_startedAt_idx" ON "UserSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "UserSession_signupConverted_idx" ON "UserSession"("signupConverted");

-- CreateIndex
CREATE UNIQUE INDEX "DailyKPI_date_key" ON "DailyKPI"("date");

-- CreateIndex
CREATE INDEX "DailyKPI_date_idx" ON "DailyKPI"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnalyticsSummary_userId_key" ON "UserAnalyticsSummary"("userId");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_userId_idx" ON "UserAnalyticsSummary"("userId");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_lastActiveAt_idx" ON "UserAnalyticsSummary"("lastActiveAt");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_plan_idx" ON "UserAnalyticsSummary"("plan");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_isChurnRisk_idx" ON "UserAnalyticsSummary"("isChurnRisk");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_isPowerUser_idx" ON "UserAnalyticsSummary"("isPowerUser");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_isHighValue_idx" ON "UserAnalyticsSummary"("isHighValue");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_acquisitionSource_idx" ON "UserAnalyticsSummary"("acquisitionSource");

-- CreateIndex
CREATE INDEX "UserAnalyticsSummary_acquisitionCampaign_idx" ON "UserAnalyticsSummary"("acquisitionCampaign");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_eventType_idx" ON "AnalyticsEvent"("userId", "eventType");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_timestamp_idx" ON "AnalyticsEvent"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserSession"("sessionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnalyticsSummary" ADD CONSTRAINT "UserAnalyticsSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
