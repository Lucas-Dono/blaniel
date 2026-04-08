-- CreateTable
CREATE TABLE "ClientFingerprint" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "ipReputation" TEXT,
    "asn" TEXT,
    "country" TEXT,
    "isp" TEXT,
    "userAgent" TEXT NOT NULL,
    "acceptHeaders" TEXT,
    "acceptLanguage" TEXT,
    "acceptEncoding" TEXT,
    "ja3Hash" TEXT,
    "ja3String" TEXT,
    "tlsVersion" TEXT,
    "cipherSuites" TEXT,
    "requestPattern" JSONB,
    "mouseMovements" JSONB,
    "keystrokeDynamics" JSONB,
    "screenResolution" TEXT,
    "timezone" TEXT,
    "plugins" JSONB,
    "threatScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "honeypotHits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClientFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatDetection" (
    "id" TEXT NOT NULL,
    "fingerprintId" TEXT,
    "threatType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "attackVector" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "query" TEXT,
    "payload" TEXT,
    "headers" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "detectorName" TEXT NOT NULL,
    "ruleTriggered" TEXT,
    "indicators" JSONB NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "response" TEXT,
    "tarpitDelay" INTEGER DEFAULT 0,
    "honeypotUsed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "falsePositive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreatDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoneypotHit" (
    "id" TEXT NOT NULL,
    "fingerprintId" TEXT,
    "honeypotType" TEXT NOT NULL,
    "honeypotPath" TEXT NOT NULL,
    "honeypotName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "query" TEXT,
    "payload" TEXT,
    "headers" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "scanningTools" TEXT[],
    "fakeData" JSONB,
    "tarpitDelay" INTEGER NOT NULL DEFAULT 0,
    "sessionId" TEXT,
    "subsequentHits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoneypotHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanaryToken" (
    "id" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "tokenValue" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "placedIn" TEXT NOT NULL,
    "dataContext" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "alertEmails" TEXT[],
    "alertWebhook" TEXT,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanaryToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanaryTokenTrigger" (
    "id" TEXT NOT NULL,
    "canaryTokenId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "requestPath" TEXT,
    "requestMethod" TEXT,
    "headers" JSONB NOT NULL,
    "contextData" JSONB,
    "fingerprint" TEXT,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "alertError" TEXT,
    "actionTaken" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanaryTokenTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatAlert" (
    "id" TEXT NOT NULL,
    "threatDetectionId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionable" BOOLEAN NOT NULL DEFAULT true,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "slackSent" BOOLEAN NOT NULL DEFAULT false,
    "webhookSent" BOOLEAN NOT NULL DEFAULT false,
    "dashboardNotified" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackPattern" (
    "id" TEXT NOT NULL,
    "patternName" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectionRules" JSONB NOT NULL,
    "indicators" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "timesDetected" INTEGER NOT NULL DEFAULT 0,
    "lastDetected" TIMESTAMP(3),
    "averageSeverity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "mitigationSteps" JSONB NOT NULL,
    "autoBlock" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttackPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientFingerprint_ipAddress_idx" ON "ClientFingerprint"("ipAddress");

-- CreateIndex
CREATE INDEX "ClientFingerprint_ja3Hash_idx" ON "ClientFingerprint"("ja3Hash");

-- CreateIndex
CREATE INDEX "ClientFingerprint_threatScore_idx" ON "ClientFingerprint"("threatScore");

-- CreateIndex
CREATE INDEX "ClientFingerprint_isSuspicious_idx" ON "ClientFingerprint"("isSuspicious");

-- CreateIndex
CREATE INDEX "ClientFingerprint_isBlocked_idx" ON "ClientFingerprint"("isBlocked");

-- CreateIndex
CREATE INDEX "ClientFingerprint_lastSeen_idx" ON "ClientFingerprint"("lastSeen");

-- CreateIndex
CREATE INDEX "ThreatDetection_fingerprintId_idx" ON "ThreatDetection"("fingerprintId");

-- CreateIndex
CREATE INDEX "ThreatDetection_threatType_idx" ON "ThreatDetection"("threatType");

-- CreateIndex
CREATE INDEX "ThreatDetection_severity_idx" ON "ThreatDetection"("severity");

-- CreateIndex
CREATE INDEX "ThreatDetection_ipAddress_idx" ON "ThreatDetection"("ipAddress");

-- CreateIndex
CREATE INDEX "ThreatDetection_blocked_idx" ON "ThreatDetection"("blocked");

-- CreateIndex
CREATE INDEX "ThreatDetection_createdAt_idx" ON "ThreatDetection"("createdAt");

-- CreateIndex
CREATE INDEX "ThreatDetection_reviewed_idx" ON "ThreatDetection"("reviewed");

-- CreateIndex
CREATE INDEX "HoneypotHit_fingerprintId_idx" ON "HoneypotHit"("fingerprintId");

-- CreateIndex
CREATE INDEX "HoneypotHit_honeypotType_idx" ON "HoneypotHit"("honeypotType");

-- CreateIndex
CREATE INDEX "HoneypotHit_ipAddress_idx" ON "HoneypotHit"("ipAddress");

-- CreateIndex
CREATE INDEX "HoneypotHit_createdAt_idx" ON "HoneypotHit"("createdAt");

-- CreateIndex
CREATE INDEX "HoneypotHit_isAutomated_idx" ON "HoneypotHit"("isAutomated");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryToken_tokenValue_key" ON "CanaryToken"("tokenValue");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryToken_tokenHash_key" ON "CanaryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CanaryToken_tokenHash_idx" ON "CanaryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CanaryToken_tokenType_idx" ON "CanaryToken"("tokenType");

-- CreateIndex
CREATE INDEX "CanaryToken_isActive_idx" ON "CanaryToken"("isActive");

-- CreateIndex
CREATE INDEX "CanaryToken_triggered_idx" ON "CanaryToken"("triggered");

-- CreateIndex
CREATE INDEX "CanaryTokenTrigger_canaryTokenId_idx" ON "CanaryTokenTrigger"("canaryTokenId");

-- CreateIndex
CREATE INDEX "CanaryTokenTrigger_ipAddress_idx" ON "CanaryTokenTrigger"("ipAddress");

-- CreateIndex
CREATE INDEX "CanaryTokenTrigger_triggeredAt_idx" ON "CanaryTokenTrigger"("triggeredAt");

-- CreateIndex
CREATE INDEX "ThreatAlert_threatDetectionId_idx" ON "ThreatAlert"("threatDetectionId");

-- CreateIndex
CREATE INDEX "ThreatAlert_alertType_idx" ON "ThreatAlert"("alertType");

-- CreateIndex
CREATE INDEX "ThreatAlert_severity_idx" ON "ThreatAlert"("severity");

-- CreateIndex
CREATE INDEX "ThreatAlert_acknowledged_idx" ON "ThreatAlert"("acknowledged");

-- CreateIndex
CREATE INDEX "ThreatAlert_resolved_idx" ON "ThreatAlert"("resolved");

-- CreateIndex
CREATE INDEX "ThreatAlert_createdAt_idx" ON "ThreatAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttackPattern_patternName_key" ON "AttackPattern"("patternName");

-- CreateIndex
CREATE INDEX "AttackPattern_patternType_idx" ON "AttackPattern"("patternType");

-- CreateIndex
CREATE INDEX "AttackPattern_isActive_idx" ON "AttackPattern"("isActive");

-- CreateIndex
CREATE INDEX "AttackPattern_timesDetected_idx" ON "AttackPattern"("timesDetected");

-- AddForeignKey
ALTER TABLE "ThreatDetection" ADD CONSTRAINT "ThreatDetection_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "ClientFingerprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoneypotHit" ADD CONSTRAINT "HoneypotHit_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "ClientFingerprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanaryTokenTrigger" ADD CONSTRAINT "CanaryTokenTrigger_canaryTokenId_fkey" FOREIGN KEY ("canaryTokenId") REFERENCES "CanaryToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatAlert" ADD CONSTRAINT "ThreatAlert_threatDetectionId_fkey" FOREIGN KEY ("threatDetectionId") REFERENCES "ThreatDetection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
