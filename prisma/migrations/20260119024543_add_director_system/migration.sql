-- CreateEnum
CREATE TYPE "SceneCategory" AS ENUM ('COTIDIANO', 'HUMOR', 'DEBATE', 'TENSION', 'ROMANCE', 'VULNERABILIDAD', 'DESCUBRIMIENTO', 'RECONCILIACION', 'PROACTIVIDAD', 'META');

-- CreateEnum
CREATE TYPE "SeedStatus" AS ENUM ('LATENT', 'ACTIVE', 'ESCALATING', 'RESOLVING', 'RESOLVED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "directorSettings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "directorVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SceneCategory" NOT NULL,
    "subcategory" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerPattern" TEXT,
    "triggerMinEnergy" DOUBLE PRECISION,
    "triggerMaxEnergy" DOUBLE PRECISION,
    "triggerMinTension" DOUBLE PRECISION,
    "triggerMaxTension" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "objectives" TEXT[],
    "participantRoles" TEXT[],
    "interventionSequence" JSONB NOT NULL,
    "consequences" JSONB NOT NULL,
    "variations" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "avgEngagement" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minAIs" INTEGER NOT NULL DEFAULT 2,
    "maxAIs" INTEGER NOT NULL DEFAULT 5,
    "duration" TEXT NOT NULL DEFAULT 'short',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TensionSeed" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "involvedAgents" TEXT[],
    "originAgentId" TEXT,
    "status" "SeedStatus" NOT NULL DEFAULT 'LATENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReference" TIMESTAMP(3),
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "latencyTurns" INTEGER NOT NULL DEFAULT 5,
    "maxTurns" INTEGER NOT NULL DEFAULT 20,
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalationNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolutionType" TEXT,

    CONSTRAINT "TensionSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRelation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "agentAId" TEXT NOT NULL,
    "agentBId" TEXT NOT NULL,
    "affinity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relationType" TEXT NOT NULL DEFAULT 'neutral',
    "dynamics" TEXT[],
    "lastInteraction" TIMESTAMP(3),
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "tensionLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharedMoments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSceneState" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "currentSceneId" TEXT,
    "currentSceneCode" TEXT,
    "sceneStartedAt" TIMESTAMP(3),
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "roleAssignments" JSONB,
    "recentScenes" TEXT[],
    "scenesExecuted" INTEGER NOT NULL DEFAULT 0,
    "lastDramaticScene" TIMESTAMP(3),
    "activeSeedCount" INTEGER NOT NULL DEFAULT 0,
    "loopDetection" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSceneState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneExecution" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sceneCode" TEXT NOT NULL,
    "triggerMessageId" TEXT,
    "triggerUserId" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL,
    "participantAgents" TEXT[],
    "userMessages" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION,
    "seedsCreated" INTEGER NOT NULL DEFAULT 0,
    "relationsUpdated" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SceneExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scene_code_key" ON "Scene"("code");

-- CreateIndex
CREATE INDEX "Scene_category_isActive_idx" ON "Scene"("category", "isActive");

-- CreateIndex
CREATE INDEX "Scene_triggerType_idx" ON "Scene"("triggerType");

-- CreateIndex
CREATE INDEX "Scene_code_idx" ON "Scene"("code");

-- CreateIndex
CREATE INDEX "Scene_isActive_idx" ON "Scene"("isActive");

-- CreateIndex
CREATE INDEX "TensionSeed_groupId_status_idx" ON "TensionSeed"("groupId", "status");

-- CreateIndex
CREATE INDEX "TensionSeed_status_currentTurn_idx" ON "TensionSeed"("status", "currentTurn");

-- CreateIndex
CREATE INDEX "TensionSeed_groupId_idx" ON "TensionSeed"("groupId");

-- CreateIndex
CREATE INDEX "AIRelation_groupId_idx" ON "AIRelation"("groupId");

-- CreateIndex
CREATE INDEX "AIRelation_agentAId_idx" ON "AIRelation"("agentAId");

-- CreateIndex
CREATE INDEX "AIRelation_agentBId_idx" ON "AIRelation"("agentBId");

-- CreateIndex
CREATE UNIQUE INDEX "AIRelation_groupId_agentAId_agentBId_key" ON "AIRelation"("groupId", "agentAId", "agentBId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSceneState_groupId_key" ON "GroupSceneState"("groupId");

-- CreateIndex
CREATE INDEX "GroupSceneState_groupId_idx" ON "GroupSceneState"("groupId");

-- CreateIndex
CREATE INDEX "SceneExecution_groupId_startedAt_idx" ON "SceneExecution"("groupId", "startedAt");

-- CreateIndex
CREATE INDEX "SceneExecution_sceneCode_idx" ON "SceneExecution"("sceneCode");

-- CreateIndex
CREATE INDEX "SceneExecution_groupId_idx" ON "SceneExecution"("groupId");

-- AddForeignKey
ALTER TABLE "TensionSeed" ADD CONSTRAINT "TensionSeed_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRelation" ADD CONSTRAINT "AIRelation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSceneState" ADD CONSTRAINT "GroupSceneState_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
