-- CreateTable
CREATE TABLE "SharedKnowledge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "sourceMessageId" TEXT,
    "contextType" TEXT NOT NULL DEFAULT 'group',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "validationCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "learnedFrom" TEXT,
    "embedding" JSONB,

    CONSTRAINT "SharedKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedKnowledge_groupId_agentId_idx" ON "SharedKnowledge"("groupId", "agentId");

-- CreateIndex
CREATE INDEX "SharedKnowledge_agentId_userId_idx" ON "SharedKnowledge"("agentId", "userId");

-- CreateIndex
CREATE INDEX "SharedKnowledge_knowledgeType_isActive_idx" ON "SharedKnowledge"("knowledgeType", "isActive");

-- CreateIndex
CREATE INDEX "SharedKnowledge_topic_idx" ON "SharedKnowledge"("topic");

-- CreateIndex
CREATE INDEX "SharedKnowledge_importance_idx" ON "SharedKnowledge"("importance");
