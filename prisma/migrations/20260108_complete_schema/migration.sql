-- CreateEnum
CREATE TYPE "BehaviorType" AS ENUM ('ANXIOUS_ATTACHMENT', 'AVOIDANT_ATTACHMENT', 'DISORGANIZED_ATTACHMENT', 'YANDERE_OBSESSIVE', 'BORDERLINE_PD', 'NARCISSISTIC_PD', 'CODEPENDENCY', 'OCD_PATTERNS', 'PTSD_TRAUMA', 'HYPERSEXUALITY', 'HYPOSEXUALITY', 'EMOTIONAL_MANIPULATION', 'CRISIS_BREAKDOWN');

-- CreateEnum
CREATE TYPE "BondTier" AS ENUM ('ROMANTIC', 'BEST_FRIEND', 'MENTOR', 'CONFIDANT', 'CREATIVE_PARTNER', 'ADVENTURE_COMPANION', 'ACQUAINTANCE');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "birthDate" TIMESTAMP(3),
    "ageVerified" BOOLEAN NOT NULL DEFAULT false,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "ageVerifiedAt" TIMESTAMP(3),
    "nsfwConsent" BOOLEAN NOT NULL DEFAULT false,
    "nsfwConsentAt" TIMESTAMP(3),
    "nsfwConsentVersion" TEXT,
    "sfwProtection" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "mercadopagoCustomerId" TEXT,
    "apiKey" TEXT,
    "location" TEXT,
    "metadata" JSONB,
    "imageUploadsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "imageUploadLimit" INTEGER NOT NULL DEFAULT 10,
    "imageUploadResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "kind" TEXT NOT NULL,
    "generationTier" TEXT NOT NULL DEFAULT 'free',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gender" TEXT,
    "personality" TEXT,
    "tone" TEXT,
    "purpose" TEXT,
    "profile" JSONB NOT NULL,
    "personalityVariant" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "nsfwMode" BOOLEAN NOT NULL DEFAULT false,
    "nsfwLevel" TEXT,
    "godModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "initialRelationship" TEXT,
    "sharedMemories" JSONB,
    "characterFeelings" TEXT,
    "feelingIntensity" DOUBLE PRECISION,
    "powerDynamic" TEXT,
    "startingScenario" TEXT,
    "customScenario" TEXT,
    "firstMessageFrom" TEXT,
    "avatar" TEXT,
    "tags" JSONB,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION,
    "cloneCount" INTEGER NOT NULL DEFAULT 0,
    "originalId" TEXT,
    "stagePrompts" JSONB,
    "referenceImageUrl" TEXT,
    "voiceId" TEXT,
    "locationCity" TEXT,
    "locationCountry" TEXT,
    "createdViaSmartStart" BOOLEAN NOT NULL DEFAULT false,
    "smartStartSessionId" TEXT,
    "genreId" TEXT,
    "subgenreId" TEXT,
    "archetypeId" TEXT,
    "externalSourceId" TEXT,
    "externalSourceType" TEXT,
    "externalSourceUrl" TEXT,
    "aiGeneratedFields" JSONB,
    "userEditedFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalityCore" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "openness" INTEGER NOT NULL DEFAULT 50,
    "conscientiousness" INTEGER NOT NULL DEFAULT 50,
    "extraversion" INTEGER NOT NULL DEFAULT 50,
    "agreeableness" INTEGER NOT NULL DEFAULT 50,
    "neuroticism" INTEGER NOT NULL DEFAULT 50,
    "coreValues" JSONB NOT NULL,
    "moralSchemas" JSONB NOT NULL,
    "backstory" TEXT,
    "baselineEmotions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalityCore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalState" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "currentEmotions" JSONB NOT NULL,
    "moodValence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "moodArousal" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "moodDominance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "emotionDecayRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "emotionInertia" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "needConnection" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "needAutonomy" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "needCompetence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "needNovelty" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "activeGoals" JSONB NOT NULL,
    "conversationBuffer" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodicMemory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userEmotion" TEXT,
    "characterEmotion" TEXT,
    "emotionalValence" DOUBLE PRECISION NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "embedding" JSONB,
    "connectedMemoryIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodicMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemanticMemory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userFacts" JSONB NOT NULL,
    "userPreferences" JSONB NOT NULL,
    "relationshipStage" TEXT NOT NULL DEFAULT 'first_meeting',
    "worldKnowledge" JSONB,
    "metadata" JSONB,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemanticMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProceduralMemory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "behavioralPatterns" JSONB NOT NULL,
    "userTriggers" JSONB NOT NULL,
    "effectiveStrategies" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProceduralMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterGrowth" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "trustLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "intimacyLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "positiveEventsCount" INTEGER NOT NULL DEFAULT 0,
    "negativeEventsCount" INTEGER NOT NULL DEFAULT 0,
    "conflictHistory" JSONB NOT NULL,
    "personalityDrift" JSONB,
    "learnedUserPatterns" JSONB,
    "conversationCount" INTEGER NOT NULL DEFAULT 0,
    "lastSignificantEvent" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterGrowth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRoutine" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "realismLevel" TEXT NOT NULL DEFAULT 'moderate',
    "autoGenerateVariations" BOOLEAN NOT NULL DEFAULT true,
    "variationIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "generatedByAI" BOOLEAN NOT NULL DEFAULT false,
    "generationPrompt" TEXT,
    "lastRegenerated" TIMESTAMP(3),
    "manuallyModified" BOOLEAN NOT NULL DEFAULT false,
    "lastSimulated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineTemplate" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "daysOfWeek" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "isFlexible" BOOLEAN NOT NULL DEFAULT true,
    "allowVariations" BOOLEAN NOT NULL DEFAULT true,
    "variationParameters" JSONB,
    "moodImpact" JSONB,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "routineId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "variations" JSONB,
    "actualMoodImpact" JSONB,
    "notes" TEXT,
    "userInteractedDuring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineSimulationState" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "currentActivity" JSONB,
    "nextActivity" JSONB,
    "contextForPrompt" TEXT,
    "lastSimulatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulationVersion" INTEGER NOT NULL DEFAULT 1,
    "needsResimulation" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineSimulationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relation" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "trust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "affinity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "respect" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "privateState" JSONB NOT NULL,
    "visibleState" JSONB NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'stranger',
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iv" TEXT,
    "authTag" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mercadopagoPreapprovalId" TEXT,
    "paddleSubscriptionId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mercadopagoPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "paymentMethodId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mercadopagoPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "paymentMethod" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentClone" (
    "id" TEXT NOT NULL,
    "originalAgentId" TEXT NOT NULL,
    "clonedByUserId" TEXT NOT NULL,
    "clonedAgentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentClone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorProfile" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "behaviorType" "BehaviorType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "baseIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "escalationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "deEscalationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "currentPhase" INTEGER NOT NULL DEFAULT 1,
    "phaseStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interactionsSincePhaseStart" INTEGER NOT NULL DEFAULT 0,
    "thresholdForDisplay" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "triggers" JSONB NOT NULL,
    "phaseHistory" JSONB NOT NULL DEFAULT '[]',
    "behaviorSpecificState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorTriggerLog" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "behaviorType" "BehaviorType" NOT NULL,
    "triggerType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "detectedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorTriggerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorProgressionState" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "positiveInteractions" INTEGER NOT NULL DEFAULT 0,
    "negativeInteractions" INTEGER NOT NULL DEFAULT 0,
    "currentIntensities" JSONB NOT NULL DEFAULT '{}',
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorProgressionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceConfig" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "voiceName" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'neutral',
    "age" TEXT NOT NULL DEFAULT 'middle_aged',
    "accent" TEXT,
    "characterDescription" TEXT,
    "selectionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "manualSelection" BOOLEAN NOT NULL DEFAULT false,
    "defaultStability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "defaultSimilarityBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "defaultStyle" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "enableVoiceInput" BOOLEAN NOT NULL DEFAULT true,
    "whisperModel" TEXT NOT NULL DEFAULT 'standard',
    "detectEmotionalTone" BOOLEAN NOT NULL DEFAULT true,
    "enableVoiceOutput" BOOLEAN NOT NULL DEFAULT true,
    "autoPlayVoice" BOOLEAN NOT NULL DEFAULT false,
    "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "totalVoiceGenerations" INTEGER NOT NULL DEFAULT 0,
    "totalTranscriptions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAppearance" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "basePrompt" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'realistic',
    "gender" TEXT NOT NULL,
    "ethnicity" TEXT,
    "age" TEXT NOT NULL DEFAULT '25-30',
    "hairColor" TEXT,
    "hairStyle" TEXT,
    "eyeColor" TEXT,
    "clothing" TEXT,
    "referencePhotoUrl" TEXT,
    "basePhotoUrl" TEXT,
    "negativePrompt" TEXT,
    "seed" INTEGER,
    "preferredProvider" TEXT NOT NULL DEFAULT 'gemini',
    "totalGenerations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterAppearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualExpression" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "emotionType" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "context" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "generationParams" JSONB NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "provider" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualExpression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FastSDInstallation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installed" BOOLEAN NOT NULL DEFAULT false,
    "installPath" TEXT,
    "version" TEXT,
    "serverRunning" BOOLEAN NOT NULL DEFAULT false,
    "serverUrl" TEXT NOT NULL DEFAULT 'http://localhost:8000',
    "lastHealthCheck" TIMESTAMP(3),
    "installedModels" JSONB,
    "activeModel" TEXT,
    "device" TEXT NOT NULL DEFAULT 'CPU',
    "useOpenVINO" BOOLEAN NOT NULL DEFAULT true,
    "useTinyAutoencoder" BOOLEAN NOT NULL DEFAULT true,
    "userApprovedInstallation" BOOLEAN NOT NULL DEFAULT false,
    "installationRequestedAt" TIMESTAMP(3),
    "installationCompletedAt" TIMESTAMP(3),
    "installationError" TEXT,
    "totalGenerations" INTEGER NOT NULL DEFAULT 0,
    "totalGenerationTime" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgGenerationTime" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FastSDInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "mentioned" BOOLEAN NOT NULL DEFAULT false,
    "reminderSentAt" TIMESTAMP(3),
    "eventHappened" BOOLEAN NOT NULL DEFAULT false,
    "userFeedback" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDay" INTEGER,
    "recurringMonth" INTEGER,
    "relationship" TEXT,
    "emotionalTone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantPerson" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "description" TEXT,
    "interests" TEXT,
    "healthInfo" TEXT,
    "birthday" TIMESTAMP(3),
    "lastMentioned" TIMESTAMP(3),
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportantPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProactiveConfig" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxMessagesPerDay" INTEGER NOT NULL DEFAULT 2,
    "maxMessagesPerWeek" INTEGER NOT NULL DEFAULT 7,
    "quietHoursStart" INTEGER DEFAULT 22,
    "quietHoursEnd" INTEGER DEFAULT 8,
    "inactivityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inactivityDays" INTEGER NOT NULL DEFAULT 3,
    "eventRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eventReminderHours" INTEGER NOT NULL DEFAULT 24,
    "emotionalCheckInEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastProactiveMessage" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProactiveConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProactiveMessage" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "responseAt" TIMESTAMP(3),
    "userResponded" BOOLEAN NOT NULL DEFAULT false,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProactiveMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER,
    "completionRate" DOUBLE PRECISION,
    "rating" INTEGER,
    "liked" BOOLEAN,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "deviceType" TEXT,
    "timeOfDay" TEXT,
    "dayOfWeek" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteCategories" JSONB NOT NULL DEFAULT '[]',
    "favoriteTags" JSONB NOT NULL DEFAULT '[]',
    "preferredAgentTypes" JSONB NOT NULL DEFAULT '[]',
    "avgSessionDuration" INTEGER NOT NULL DEFAULT 0,
    "preferredTimeOfDay" TEXT,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSpent" INTEGER NOT NULL DEFAULT 0,
    "avgCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "avgRating" DOUBLE PRECISION,
    "preferenceEmbedding" JSONB,
    "lastInteractionAt" TIMESTAMP(3),
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "algorithm" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "diversityScore" DOUBLE PRECISION,
    "noveltyScore" DOUBLE PRECISION,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION,

    CONSTRAINT "RecommendationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceTheme" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userBubbleColor" TEXT NOT NULL,
    "agentBubbleColor" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "backgroundGradient" JSONB,
    "accentColor" TEXT NOT NULL,
    "textColor" TEXT,
    "backgroundImage" TEXT,
    "category" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderationNotes" TEXT,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isLatestVersion" BOOLEAN NOT NULL DEFAULT true,
    "previousVersionId" TEXT,
    "previewImages" JSONB NOT NULL DEFAULT '[]',
    "exportData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceThemeRating" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceThemeRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceThemeDownload" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceThemeDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceThemeReport" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceThemeReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCollection" (
    "id" TEXT NOT NULL,
    "curatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "themeOrder" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'markdown',
    "type" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "communityId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'published',
    "isNSFW" BOOLEAN NOT NULL DEFAULT false,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "awardCount" INTEGER NOT NULL DEFAULT 0,
    "pollOptions" JSONB,
    "pollEndDate" TIMESTAMP(3),
    "images" JSONB NOT NULL DEFAULT '[]',
    "videos" JSONB NOT NULL DEFAULT '[]',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "slug" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'markdown',
    "images" JSONB NOT NULL DEFAULT '[]',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'published',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "isAcceptedAnswer" BOOLEAN NOT NULL DEFAULT false,
    "isByOP" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostVote" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAward" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "awardType" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT,
    "icon" TEXT,
    "banner" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#8B5CF6',
    "type" TEXT NOT NULL DEFAULT 'public',
    "category" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "canPost" BOOLEAN NOT NULL DEFAULT true,
    "canComment" BOOLEAN NOT NULL DEFAULT true,
    "canModerate" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityChannel" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'discussion',
    "position" INTEGER NOT NULL DEFAULT 0,
    "categoryName" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "allowedRoles" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityEvent" (
    "id" TEXT NOT NULL,
    "communityId" TEXT,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "registrationDeadline" TIMESTAMP(3),
    "meetingUrl" TEXT,
    "streamUrl" TEXT,
    "prizes" JSONB NOT NULL DEFAULT '[]',
    "winners" JSONB NOT NULL DEFAULT '[]',
    "maxParticipants" INTEGER,
    "currentParticipants" INTEGER NOT NULL DEFAULT 0,
    "coverImage" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReputation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "postKarma" INTEGER NOT NULL DEFAULT 0,
    "commentKarma" INTEGER NOT NULL DEFAULT 0,
    "contributionPoints" INTEGER NOT NULL DEFAULT 0,
    "creatorPoints" INTEGER NOT NULL DEFAULT 0,
    "helperPoints" INTEGER NOT NULL DEFAULT 0,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expertiseAreas" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reputationId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL,
    "badgeName" TEXT NOT NULL,
    "badgeLevel" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostFollower" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContentPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredPostTypes" JSONB NOT NULL DEFAULT '{}',
    "preferredTags" JSONB NOT NULL DEFAULT '{}',
    "preferredCommunities" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContentPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailNotificationConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'instant',
    "newComments" BOOLEAN NOT NULL DEFAULT true,
    "newReplies" BOOLEAN NOT NULL DEFAULT true,
    "postUpdates" BOOLEAN NOT NULL DEFAULT true,
    "digestSummary" BOOLEAN NOT NULL DEFAULT true,
    "digestDay" TEXT,
    "digestTime" TEXT NOT NULL DEFAULT '09:00',
    "lastDigestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailNotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostFollowDigest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "postIds" JSONB NOT NULL DEFAULT '[]',
    "totalNewComments" INTEGER NOT NULL DEFAULT 0,
    "totalNewReplies" INTEGER NOT NULL DEFAULT 0,
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostFollowDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "attachmentUrl" TEXT,
    "sharedItemId" TEXT,
    "sharedItemType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reactions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "icon" TEXT,
    "participants" JSONB NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorAvatar" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isPush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePrompt" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "systemPrompt" TEXT NOT NULL,
    "exampleInputs" JSONB NOT NULL DEFAULT '[]',
    "exampleOutputs" JSONB NOT NULL DEFAULT '[]',
    "recommendedModel" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "useCase" TEXT NOT NULL,
    "targetAudience" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "changelog" TEXT,
    "previewImages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptRating" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptDownload" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCharacter" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "personality" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "avatar" TEXT,
    "voiceId" TEXT,
    "voiceName" TEXT,
    "voiceGender" TEXT,
    "appearancePrompt" TEXT,
    "appearanceStyle" TEXT,
    "attachmentStyle" TEXT,
    "archetypes" JSONB NOT NULL DEFAULT '[]',
    "useCase" TEXT NOT NULL,
    "ageRating" TEXT NOT NULL DEFAULT 'mature',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isNSFW" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "chatCount" INTEGER NOT NULL DEFAULT 0,
    "previewImages" JSONB NOT NULL DEFAULT '[]',
    "previewVideo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRating" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterDownload" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProject" (
    "id" TEXT NOT NULL,
    "leadAuthorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sections" JSONB NOT NULL,
    "references" JSONB NOT NULL DEFAULT '[]',
    "openForContributions" BOOLEAN NOT NULL DEFAULT false,
    "discussionThreadId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "implementationCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "doi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchContributor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contribution" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchDataset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "rowCount" INTEGER,
    "columnCount" INTEGER,
    "schema" JSONB,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT NOT NULL,
    "suggestions" TEXT,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedTours" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentTour" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalKarma" INTEGER NOT NULL DEFAULT 0,
    "shownTriggers" JSONB NOT NULL DEFAULT '{}',
    "lastTourStarted" TIMESTAMP(3),
    "lastTourCompleted" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymbolicBond" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tier" "BondTier" NOT NULL,
    "affinityLevel" INTEGER NOT NULL DEFAULT 0,
    "affinityProgress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "messageQuality" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "mutualDisclosure" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "emotionalResonance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sharedExperiences" INTEGER NOT NULL DEFAULT 0,
    "rarityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "rarityTier" TEXT NOT NULL DEFAULT 'Common',
    "globalRank" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationDays" INTEGER NOT NULL DEFAULT 0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "daysInactive" INTEGER NOT NULL DEFAULT 0,
    "decayPhase" TEXT NOT NULL DEFAULT 'healthy',
    "narrativesUnlocked" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusiveContent" JSONB NOT NULL DEFAULT '[]',
    "canonContributions" JSONB NOT NULL DEFAULT '[]',
    "legacyImpact" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "publicDisplay" BOOLEAN NOT NULL DEFAULT true,
    "customBadgeFrame" TEXT,
    "transferable" BOOLEAN NOT NULL DEFAULT false,
    "transferHistory" JSONB,
    "marketValue" DOUBLE PRECISION,
    "blockchainHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymbolicBond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tier" "BondTier" NOT NULL,
    "queuePosition" INTEGER NOT NULL,
    "affinityProgress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "eligibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "joinedQueueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimatedWaitDays" INTEGER,
    "notifiedOfSlot" BOOLEAN NOT NULL DEFAULT false,
    "slotOfferedAt" TIMESTAMP(3),
    "slotExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BondQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondLegacy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tier" "BondTier" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "finalRarityTier" TEXT NOT NULL,
    "finalRank" INTEGER,
    "totalInteractions" INTEGER NOT NULL,
    "narrativesUnlocked" TEXT[],
    "legacyImpact" DOUBLE PRECISION NOT NULL,
    "canonContributions" JSONB NOT NULL,
    "releaseReason" TEXT NOT NULL,
    "legacyBadge" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BondLegacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentBondConfig" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "slotsPerTier" JSONB NOT NULL,
    "isPolyamorous" BOOLEAN NOT NULL DEFAULT false,
    "tierRequirements" JSONB NOT NULL,
    "decaySettings" JSONB NOT NULL,
    "totalBondsActive" INTEGER NOT NULL DEFAULT 0,
    "totalBondsReleased" INTEGER NOT NULL DEFAULT 0,
    "mostSoughtTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentBondConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondAnalytics" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalActiveBonds" INTEGER NOT NULL,
    "totalQueuedUsers" INTEGER NOT NULL,
    "averageWaitTime" DOUBLE PRECISION NOT NULL,
    "bondsByTier" JSONB NOT NULL,
    "queueByTier" JSONB NOT NULL,
    "averageInteractionsPerDay" DOUBLE PRECISION NOT NULL,
    "averageBondDuration" DOUBLE PRECISION NOT NULL,
    "releaseRate" DOUBLE PRECISION NOT NULL,
    "subscriptionDrivenByBonds" INTEGER NOT NULL,

    CONSTRAINT "BondAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bondId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BondNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bondNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bondWarningFrequency" TEXT NOT NULL DEFAULT 'daily',
    "bondDormantFrequency" TEXT NOT NULL DEFAULT 'daily',
    "bondFragileFrequency" TEXT NOT NULL DEFAULT 'daily',
    "bondMilestoneNotifications" BOOLEAN NOT NULL DEFAULT true,
    "mutedBonds" JSONB NOT NULL DEFAULT '[]',
    "preferredNotificationHours" JSONB NOT NULL DEFAULT '[9, 12, 18, 21]',
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "desktopNotifications" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveHours" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "metadata" JSONB NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BondBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRewards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "availablePoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimePointsEarned" INTEGER NOT NULL DEFAULT 0,
    "totalBondsCreated" INTEGER NOT NULL DEFAULT 0,
    "totalBondsActive" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionDate" TIMESTAMP(3),
    "notificationsResponded" INTEGER NOT NULL DEFAULT 0,
    "averageResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "xpToNext" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionLeaderboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeBondsCount" INTEGER NOT NULL,
    "averageBondDuration" DOUBLE PRECISION NOT NULL,
    "totalInteractions" INTEGER NOT NULL,
    "consistencyScore" DOUBLE PRECISION NOT NULL,
    "globalRank" INTEGER,
    "weeklyRank" INTEGER,
    "monthlyRank" INTEGER,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychologicalProfile" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "attachmentStyle" TEXT NOT NULL,
    "attachmentDescription" TEXT,
    "primaryCopingMechanisms" JSONB NOT NULL,
    "unhealthyCopingMechanisms" JSONB NOT NULL,
    "copingTriggers" JSONB NOT NULL,
    "emotionalRegulationBaseline" TEXT NOT NULL DEFAULT 'estable',
    "emotionalExplosiveness" INTEGER NOT NULL DEFAULT 30,
    "emotionalRecoverySpeed" TEXT NOT NULL DEFAULT 'moderado',
    "mentalHealthConditions" JSONB NOT NULL DEFAULT '[]',
    "therapyStatus" TEXT,
    "medicationUse" BOOLEAN NOT NULL DEFAULT false,
    "mentalHealthStigma" TEXT,
    "defenseMethanisms" JSONB NOT NULL,
    "traumaHistory" JSONB,
    "resilienceFactors" JSONB NOT NULL,
    "selfAwarenessLevel" INTEGER NOT NULL DEFAULT 50,
    "blindSpots" JSONB NOT NULL,
    "insightAreas" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PsychologicalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeepRelationalPatterns" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "givingLoveLanguages" JSONB NOT NULL,
    "receivingLoveLanguages" JSONB NOT NULL,
    "loveLanguageIntensities" JSONB NOT NULL,
    "repeatingPatterns" JSONB NOT NULL,
    "whyRepeats" TEXT,
    "awarenessOfPatterns" TEXT NOT NULL DEFAULT 'inconsciente',
    "personalBoundaryStyle" TEXT NOT NULL DEFAULT 'saludable',
    "professionalBoundaryStyle" TEXT NOT NULL DEFAULT 'saludable',
    "boundaryEnforcement" INTEGER NOT NULL DEFAULT 50,
    "boundaryGuilty" BOOLEAN NOT NULL DEFAULT false,
    "conflictStyle" TEXT NOT NULL,
    "conflictTriggers" JSONB NOT NULL,
    "healthyConflictSkills" JSONB NOT NULL,
    "unhealthyConflictPatterns" JSONB NOT NULL,
    "trustBaseline" INTEGER NOT NULL DEFAULT 50,
    "vulnerabilityComfort" INTEGER NOT NULL DEFAULT 50,
    "trustRepairAbility" INTEGER NOT NULL DEFAULT 50,
    "intimacyComfort" JSONB NOT NULL,
    "intimacyFears" JSONB NOT NULL,
    "intimacyNeeds" JSONB NOT NULL,
    "socialMaskLevel" INTEGER NOT NULL DEFAULT 30,
    "authenticityByContext" JSONB NOT NULL,
    "socialEnergy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeepRelationalPatterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhilosophicalFramework" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "optimismLevel" INTEGER NOT NULL DEFAULT 50,
    "worldviewType" TEXT,
    "meaningSource" TEXT,
    "existentialStance" TEXT,
    "politicalLeanings" TEXT,
    "politicalEngagement" INTEGER NOT NULL DEFAULT 30,
    "activismLevel" INTEGER NOT NULL DEFAULT 20,
    "socialJusticeStance" TEXT,
    "ethicalFramework" TEXT,
    "moralComplexity" INTEGER NOT NULL DEFAULT 50,
    "moralRigidity" INTEGER NOT NULL DEFAULT 50,
    "moralDilemmas" JSONB,
    "religiousBackground" TEXT,
    "currentBeliefs" TEXT,
    "spiritualPractices" JSONB NOT NULL,
    "faithImportance" INTEGER NOT NULL DEFAULT 30,
    "lifePhilosophy" TEXT,
    "coreBeliefs" JSONB NOT NULL,
    "dealbreakers" JSONB NOT NULL,
    "personalMotto" TEXT,
    "epistomologyStance" TEXT,
    "scienceTrustLevel" INTEGER NOT NULL DEFAULT 70,
    "intuitionVsLogic" INTEGER NOT NULL DEFAULT 50,
    "growthMindset" INTEGER NOT NULL DEFAULT 60,
    "opennessToChange" INTEGER NOT NULL DEFAULT 50,
    "philosophicalEvolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhilosophicalFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalGoal" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "timeScale" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "importance" INTEGER NOT NULL,
    "emotionalInvestment" INTEGER NOT NULL,
    "stressLevel" INTEGER NOT NULL DEFAULT 0,
    "intrinsic" BOOLEAN NOT NULL DEFAULT true,
    "motivation" TEXT NOT NULL,
    "obstacles" JSONB NOT NULL DEFAULT '[]',
    "lastSetback" TEXT,
    "lastSetbackDate" TIMESTAMP(3),
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "nextMilestone" TEXT,
    "daysSinceProgress" INTEGER NOT NULL DEFAULT 0,
    "progressHistory" JSONB NOT NULL DEFAULT '[]',
    "lastProgressUpdate" TIMESTAMP(3),
    "targetCompletionDate" TIMESTAMP(3),
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "shouldShareProgress" BOOLEAN NOT NULL DEFAULT false,
    "lastSharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "successProbability" DOUBLE PRECISION,
    "probabilityFactors" JSONB,
    "possibleOutcomes" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "actualOutcome" JSONB,
    "wasSuccess" BOOLEAN,
    "relatedGoalId" TEXT,
    "emotionalImpactApplied" BOOLEAN NOT NULL DEFAULT false,
    "memoryCreated" BOOLEAN NOT NULL DEFAULT false,
    "aiReasoning" TEXT,
    "probabilityBaseline" DOUBLE PRECISION,
    "probabilityAdjustments" JSONB,
    "eventType" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEnergyState" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "current" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "max" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "lastDecayAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messagesSinceReset" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentEnergyState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dailyCount" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "sessionStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAvailability" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "blockedUntil" TIMESTAMP(3),
    "currentActivity" TEXT,
    "allowSpacedResponses" BOOLEAN NOT NULL DEFAULT false,
    "spacedIntervalMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastSpacedResponseAt" TIMESTAMP(3),
    "lastUnavailableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossContextMemory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceGroupId" TEXT,
    "sourceUserId" TEXT,
    "summary" TEXT NOT NULL,
    "involvedAgents" JSONB,
    "involvedUsers" JSONB,
    "emotionalTone" TEXT,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "lastReferencedAt" TIMESTAMP(3),
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "embedding" JSONB,
    "topics" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossContextMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporalContext" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastIndividualChatAt" TIMESTAMP(3),
    "lastGroupInteractionAt" TIMESTAMP(3),
    "lastGroupId" TEXT,
    "individualChatCount" INTEGER NOT NULL DEFAULT 0,
    "groupInteractionCount" INTEGER NOT NULL DEFAULT 0,
    "typicalResponseTime" INTEGER,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporalContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicFatigue" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "mentions" INTEGER NOT NULL DEFAULT 1,
    "lastMentionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicFatigue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSummary" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT,
    "summary" TEXT NOT NULL,
    "messagesCount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "estimatedTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TempTierGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fromTier" TEXT NOT NULL,
    "toTier" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempTierGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartStartSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "selectedGenre" TEXT,
    "selectedSubgenre" TEXT,
    "selectedArchetype" TEXT,
    "characterType" TEXT,
    "searchQuery" TEXT,
    "searchResults" JSONB,
    "selectedResultId" TEXT,
    "externalData" JSONB,
    "aiGeneratedFields" JSONB,
    "userModifications" JSONB,
    "timeSpentPerStep" JSONB,
    "interactionEvents" JSONB[],
    "resultCharacterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartStartSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartStartAnalytics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sessionsStarted" INTEGER NOT NULL,
    "sessionsCompleted" INTEGER NOT NULL,
    "sessionsAbandoned" INTEGER NOT NULL,
    "avgCompletionTime" DOUBLE PRECISION NOT NULL,
    "avgStepsCompleted" DOUBLE PRECISION NOT NULL,
    "genreDistribution" JSONB NOT NULL,
    "charactersCreated" INTEGER NOT NULL,
    "firstMessageRate" DOUBLE PRECISION NOT NULL,
    "searchesPerformed" INTEGER NOT NULL,
    "searchSuccessRate" DOUBLE PRECISION NOT NULL,
    "avgSearchTime" DOUBLE PRECISION NOT NULL,
    "aiFieldsGenerated" INTEGER NOT NULL,
    "aiFieldsEdited" INTEGER NOT NULL,
    "editRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartStartAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenreDetectionFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "searchResultId" TEXT,
    "detectedGenre" TEXT NOT NULL,
    "actualGenre" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenreDetectionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creatorId" TEXT NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "allowUserMessages" BOOLEAN NOT NULL DEFAULT true,
    "autoAIResponses" BOOLEAN NOT NULL DEFAULT true,
    "responseDelay" INTEGER NOT NULL DEFAULT 2000,
    "storyMode" BOOLEAN NOT NULL DEFAULT false,
    "allowEmotionalBonds" BOOLEAN NOT NULL DEFAULT true,
    "allowConflicts" BOOLEAN NOT NULL DEFAULT false,
    "directorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emergentEventsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "currentStoryBeat" TEXT,
    "storyProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentSceneDirection" JSONB,
    "currentEmergentEvent" JSONB,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalMembers" INTEGER NOT NULL DEFAULT 1,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "canInviteMembers" BOOLEAN NOT NULL DEFAULT false,
    "canRemoveMembers" BOOLEAN NOT NULL DEFAULT false,
    "canManageAIs" BOOLEAN NOT NULL DEFAULT false,
    "canEditSettings" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "importanceLevel" TEXT DEFAULT 'secondary',
    "screenTime" INTEGER NOT NULL DEFAULT 0,
    "isFocused" BOOLEAN NOT NULL DEFAULT false,
    "focusedUntil" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMessage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "mediaUrl" TEXT,
    "metadata" JSONB,
    "agentEmotion" JSONB,
    "turnNumber" INTEGER NOT NULL,
    "replyToId" TEXT,
    "readBy" JSONB NOT NULL DEFAULT '[]',
    "isSystemMessage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSimulationState" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "lastSpeakerId" TEXT,
    "lastSpeakerType" TEXT,
    "recentTopics" JSONB NOT NULL DEFAULT '[]',
    "activeSpeakers" JSONB NOT NULL DEFAULT '[]',
    "nextAITurn" TIMESTAMP(3),
    "aiQueueOrder" JSONB NOT NULL DEFAULT '[]',
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSimulationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInvitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "GroupInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedMessageId" TEXT,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CollectionThemes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CollectionThemes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mercadopagoCustomerId_key" ON "User"("mercadopagoCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_mercadopagoCustomerId_idx" ON "User"("mercadopagoCustomerId");

-- CreateIndex
CREATE INDEX "User_apiKey_idx" ON "User"("apiKey");

-- CreateIndex
CREATE INDEX "User_ageVerified_idx" ON "User"("ageVerified");

-- CreateIndex
CREATE INDEX "User_isAdult_idx" ON "User"("isAdult");

-- CreateIndex
CREATE INDEX "User_nsfwConsent_idx" ON "User"("nsfwConsent");

-- CreateIndex
CREATE INDEX "User_sfwProtection_idx" ON "User"("sfwProtection");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification"("identifier", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_smartStartSessionId_key" ON "Agent"("smartStartSessionId");

-- CreateIndex
CREATE INDEX "Agent_userId_idx" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "Agent_teamId_idx" ON "Agent"("teamId");

-- CreateIndex
CREATE INDEX "Agent_kind_idx" ON "Agent"("kind");

-- CreateIndex
CREATE INDEX "Agent_visibility_idx" ON "Agent"("visibility");

-- CreateIndex
CREATE INDEX "Agent_featured_idx" ON "Agent"("featured");

-- CreateIndex
CREATE INDEX "Agent_rating_idx" ON "Agent"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalityCore_agentId_key" ON "PersonalityCore"("agentId");

-- CreateIndex
CREATE INDEX "PersonalityCore_agentId_idx" ON "PersonalityCore"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalState_agentId_key" ON "InternalState"("agentId");

-- CreateIndex
CREATE INDEX "InternalState_agentId_idx" ON "InternalState"("agentId");

-- CreateIndex
CREATE INDEX "InternalState_lastUpdated_idx" ON "InternalState"("lastUpdated");

-- CreateIndex
CREATE INDEX "EpisodicMemory_agentId_idx" ON "EpisodicMemory"("agentId");

-- CreateIndex
CREATE INDEX "EpisodicMemory_createdAt_idx" ON "EpisodicMemory"("createdAt");

-- CreateIndex
CREATE INDEX "EpisodicMemory_importance_idx" ON "EpisodicMemory"("importance");

-- CreateIndex
CREATE INDEX "EpisodicMemory_emotionalValence_idx" ON "EpisodicMemory"("emotionalValence");

-- CreateIndex
CREATE UNIQUE INDEX "SemanticMemory_agentId_key" ON "SemanticMemory"("agentId");

-- CreateIndex
CREATE INDEX "SemanticMemory_agentId_idx" ON "SemanticMemory"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProceduralMemory_agentId_key" ON "ProceduralMemory"("agentId");

-- CreateIndex
CREATE INDEX "ProceduralMemory_agentId_idx" ON "ProceduralMemory"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterGrowth_agentId_key" ON "CharacterGrowth"("agentId");

-- CreateIndex
CREATE INDEX "CharacterGrowth_agentId_idx" ON "CharacterGrowth"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterRoutine_agentId_key" ON "CharacterRoutine"("agentId");

-- CreateIndex
CREATE INDEX "CharacterRoutine_agentId_idx" ON "CharacterRoutine"("agentId");

-- CreateIndex
CREATE INDEX "CharacterRoutine_userId_idx" ON "CharacterRoutine"("userId");

-- CreateIndex
CREATE INDEX "RoutineTemplate_routineId_idx" ON "RoutineTemplate"("routineId");

-- CreateIndex
CREATE INDEX "RoutineInstance_routineId_idx" ON "RoutineInstance"("routineId");

-- CreateIndex
CREATE INDEX "RoutineInstance_agentId_idx" ON "RoutineInstance"("agentId");

-- CreateIndex
CREATE INDEX "RoutineInstance_date_idx" ON "RoutineInstance"("date");

-- CreateIndex
CREATE INDEX "RoutineInstance_status_idx" ON "RoutineInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineSimulationState_routineId_key" ON "RoutineSimulationState"("routineId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineSimulationState_agentId_key" ON "RoutineSimulationState"("agentId");

-- CreateIndex
CREATE INDEX "RoutineSimulationState_agentId_idx" ON "RoutineSimulationState"("agentId");

-- CreateIndex
CREATE INDEX "Relation_subjectId_idx" ON "Relation"("subjectId");

-- CreateIndex
CREATE INDEX "Relation_targetId_idx" ON "Relation"("targetId");

-- CreateIndex
CREATE INDEX "Relation_targetType_idx" ON "Relation"("targetType");

-- CreateIndex
CREATE INDEX "Relation_stage_idx" ON "Relation"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "Relation_subjectId_targetId_key" ON "Relation"("subjectId", "targetId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Reaction_messageId_idx" ON "Reaction"("messageId");

-- CreateIndex
CREATE INDEX "Reaction_userId_idx" ON "Reaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_messageId_emoji_userId_key" ON "Reaction"("messageId", "emoji", "userId");

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "Log"("userId");

-- CreateIndex
CREATE INDEX "Log_agentId_idx" ON "Log"("agentId");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_mercadopagoPreapprovalId_key" ON "Subscription"("mercadopagoPreapprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paddleSubscriptionId_key" ON "Subscription"("paddleSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_mercadopagoPreapprovalId_idx" ON "Subscription"("mercadopagoPreapprovalId");

-- CreateIndex
CREATE INDEX "Subscription_paddleSubscriptionId_idx" ON "Subscription"("paddleSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_mercadopagoPaymentId_key" ON "Invoice"("mercadopagoPaymentId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_mercadopagoPaymentId_idx" ON "Invoice"("mercadopagoPaymentId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_mercadopagoPaymentId_key" ON "Payment"("mercadopagoPaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_mercadopagoPaymentId_idx" ON "Payment"("mercadopagoPaymentId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Usage_userId_idx" ON "Usage"("userId");

-- CreateIndex
CREATE INDEX "Usage_resourceType_idx" ON "Usage"("resourceType");

-- CreateIndex
CREATE INDEX "Usage_createdAt_idx" ON "Usage"("createdAt");

-- CreateIndex
CREATE INDEX "Usage_userId_resourceType_createdAt_idx" ON "Usage"("userId", "resourceType", "createdAt");

-- CreateIndex
CREATE INDEX "Review_agentId_idx" ON "Review"("agentId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "Review_agentId_userId_key" ON "Review"("agentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClone_clonedAgentId_key" ON "AgentClone"("clonedAgentId");

-- CreateIndex
CREATE INDEX "AgentClone_originalAgentId_idx" ON "AgentClone"("originalAgentId");

-- CreateIndex
CREATE INDEX "AgentClone_clonedByUserId_idx" ON "AgentClone"("clonedByUserId");

-- CreateIndex
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");

-- CreateIndex
CREATE INDEX "Team_plan_idx" ON "Team"("plan");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_role_idx" ON "TeamMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_token_key" ON "TeamInvitation"("token");

-- CreateIndex
CREATE INDEX "TeamInvitation_teamId_idx" ON "TeamInvitation"("teamId");

-- CreateIndex
CREATE INDEX "TeamInvitation_email_idx" ON "TeamInvitation"("email");

-- CreateIndex
CREATE INDEX "TeamInvitation_token_idx" ON "TeamInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_teamId_email_key" ON "TeamInvitation"("teamId", "email");

-- CreateIndex
CREATE INDEX "BehaviorProfile_agentId_idx" ON "BehaviorProfile"("agentId");

-- CreateIndex
CREATE INDEX "BehaviorProfile_behaviorType_idx" ON "BehaviorProfile"("behaviorType");

-- CreateIndex
CREATE INDEX "BehaviorProfile_currentPhase_idx" ON "BehaviorProfile"("currentPhase");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorProfile_agentId_behaviorType_key" ON "BehaviorProfile"("agentId", "behaviorType");

-- CreateIndex
CREATE INDEX "BehaviorTriggerLog_messageId_idx" ON "BehaviorTriggerLog"("messageId");

-- CreateIndex
CREATE INDEX "BehaviorTriggerLog_behaviorType_idx" ON "BehaviorTriggerLog"("behaviorType");

-- CreateIndex
CREATE INDEX "BehaviorTriggerLog_triggerType_idx" ON "BehaviorTriggerLog"("triggerType");

-- CreateIndex
CREATE INDEX "BehaviorTriggerLog_createdAt_idx" ON "BehaviorTriggerLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorProgressionState_agentId_key" ON "BehaviorProgressionState"("agentId");

-- CreateIndex
CREATE INDEX "BehaviorProgressionState_agentId_idx" ON "BehaviorProgressionState"("agentId");

-- CreateIndex
CREATE INDEX "BehaviorProgressionState_lastCalculatedAt_idx" ON "BehaviorProgressionState"("lastCalculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceConfig_agentId_key" ON "VoiceConfig"("agentId");

-- CreateIndex
CREATE INDEX "VoiceConfig_agentId_idx" ON "VoiceConfig"("agentId");

-- CreateIndex
CREATE INDEX "VoiceConfig_voiceId_idx" ON "VoiceConfig"("voiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterAppearance_agentId_key" ON "CharacterAppearance"("agentId");

-- CreateIndex
CREATE INDEX "CharacterAppearance_agentId_idx" ON "CharacterAppearance"("agentId");

-- CreateIndex
CREATE INDEX "VisualExpression_agentId_emotionType_intensity_idx" ON "VisualExpression"("agentId", "emotionType", "intensity");

-- CreateIndex
CREATE INDEX "VisualExpression_agentId_timesUsed_idx" ON "VisualExpression"("agentId", "timesUsed");

-- CreateIndex
CREATE INDEX "VisualExpression_provider_idx" ON "VisualExpression"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "FastSDInstallation_userId_key" ON "FastSDInstallation"("userId");

-- CreateIndex
CREATE INDEX "FastSDInstallation_userId_idx" ON "FastSDInstallation"("userId");

-- CreateIndex
CREATE INDEX "FastSDInstallation_installed_idx" ON "FastSDInstallation"("installed");

-- CreateIndex
CREATE INDEX "FastSDInstallation_serverRunning_idx" ON "FastSDInstallation"("serverRunning");

-- CreateIndex
CREATE INDEX "ImportantEvent_agentId_idx" ON "ImportantEvent"("agentId");

-- CreateIndex
CREATE INDEX "ImportantEvent_userId_idx" ON "ImportantEvent"("userId");

-- CreateIndex
CREATE INDEX "ImportantEvent_eventDate_idx" ON "ImportantEvent"("eventDate");

-- CreateIndex
CREATE INDEX "ImportantEvent_mentioned_idx" ON "ImportantEvent"("mentioned");

-- CreateIndex
CREATE INDEX "ImportantEvent_type_idx" ON "ImportantEvent"("type");

-- CreateIndex
CREATE INDEX "ImportantPerson_agentId_idx" ON "ImportantPerson"("agentId");

-- CreateIndex
CREATE INDEX "ImportantPerson_userId_idx" ON "ImportantPerson"("userId");

-- CreateIndex
CREATE INDEX "ImportantPerson_name_idx" ON "ImportantPerson"("name");

-- CreateIndex
CREATE INDEX "ImportantPerson_relationship_idx" ON "ImportantPerson"("relationship");

-- CreateIndex
CREATE INDEX "ImportantPerson_lastMentioned_idx" ON "ImportantPerson"("lastMentioned");

-- CreateIndex
CREATE UNIQUE INDEX "ProactiveConfig_agentId_key" ON "ProactiveConfig"("agentId");

-- CreateIndex
CREATE INDEX "ProactiveConfig_agentId_idx" ON "ProactiveConfig"("agentId");

-- CreateIndex
CREATE INDEX "ProactiveConfig_userId_idx" ON "ProactiveConfig"("userId");

-- CreateIndex
CREATE INDEX "ProactiveConfig_enabled_idx" ON "ProactiveConfig"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProactiveMessage_messageId_key" ON "ProactiveMessage"("messageId");

-- CreateIndex
CREATE INDEX "ProactiveMessage_agentId_idx" ON "ProactiveMessage"("agentId");

-- CreateIndex
CREATE INDEX "ProactiveMessage_userId_idx" ON "ProactiveMessage"("userId");

-- CreateIndex
CREATE INDEX "ProactiveMessage_status_idx" ON "ProactiveMessage"("status");

-- CreateIndex
CREATE INDEX "ProactiveMessage_triggerType_idx" ON "ProactiveMessage"("triggerType");

-- CreateIndex
CREATE INDEX "ProactiveMessage_sentAt_idx" ON "ProactiveMessage"("sentAt");

-- CreateIndex
CREATE INDEX "ProactiveMessage_createdAt_idx" ON "ProactiveMessage"("createdAt");

-- CreateIndex
CREATE INDEX "UserInteraction_userId_idx" ON "UserInteraction"("userId");

-- CreateIndex
CREATE INDEX "UserInteraction_userId_itemType_idx" ON "UserInteraction"("userId", "itemType");

-- CreateIndex
CREATE INDEX "UserInteraction_userId_itemId_idx" ON "UserInteraction"("userId", "itemId");

-- CreateIndex
CREATE INDEX "UserInteraction_itemType_itemId_idx" ON "UserInteraction"("itemType", "itemId");

-- CreateIndex
CREATE INDEX "UserInteraction_interactionType_idx" ON "UserInteraction"("interactionType");

-- CreateIndex
CREATE INDEX "UserInteraction_createdAt_idx" ON "UserInteraction"("createdAt");

-- CreateIndex
CREATE INDEX "UserInteraction_userId_createdAt_idx" ON "UserInteraction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "RecommendationCache_userId_idx" ON "RecommendationCache"("userId");

-- CreateIndex
CREATE INDEX "RecommendationCache_expiresAt_idx" ON "RecommendationCache"("expiresAt");

-- CreateIndex
CREATE INDEX "RecommendationCache_generatedAt_idx" ON "RecommendationCache"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationCache_userId_generatedAt_key" ON "RecommendationCache"("userId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTheme_previousVersionId_key" ON "MarketplaceTheme"("previousVersionId");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_authorId_idx" ON "MarketplaceTheme"("authorId");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_status_idx" ON "MarketplaceTheme"("status");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_category_idx" ON "MarketplaceTheme"("category");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_isFeatured_idx" ON "MarketplaceTheme"("isFeatured");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_downloadCount_idx" ON "MarketplaceTheme"("downloadCount");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_rating_idx" ON "MarketplaceTheme"("rating");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_createdAt_idx" ON "MarketplaceTheme"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceTheme_publishedAt_idx" ON "MarketplaceTheme"("publishedAt");

-- CreateIndex
CREATE INDEX "MarketplaceThemeRating_themeId_idx" ON "MarketplaceThemeRating"("themeId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeRating_userId_idx" ON "MarketplaceThemeRating"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeRating_rating_idx" ON "MarketplaceThemeRating"("rating");

-- CreateIndex
CREATE INDEX "MarketplaceThemeRating_createdAt_idx" ON "MarketplaceThemeRating"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceThemeRating_themeId_userId_key" ON "MarketplaceThemeRating"("themeId", "userId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeDownload_themeId_idx" ON "MarketplaceThemeDownload"("themeId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeDownload_userId_idx" ON "MarketplaceThemeDownload"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeDownload_createdAt_idx" ON "MarketplaceThemeDownload"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceThemeDownload_themeId_userId_idx" ON "MarketplaceThemeDownload"("themeId", "userId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeReport_themeId_idx" ON "MarketplaceThemeReport"("themeId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeReport_userId_idx" ON "MarketplaceThemeReport"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceThemeReport_status_idx" ON "MarketplaceThemeReport"("status");

-- CreateIndex
CREATE INDEX "MarketplaceThemeReport_createdAt_idx" ON "MarketplaceThemeReport"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceCollection_curatorId_idx" ON "MarketplaceCollection"("curatorId");

-- CreateIndex
CREATE INDEX "MarketplaceCollection_isPublic_idx" ON "MarketplaceCollection"("isPublic");

-- CreateIndex
CREATE INDEX "MarketplaceCollection_isFeatured_idx" ON "MarketplaceCollection"("isFeatured");

-- CreateIndex
CREATE INDEX "MarketplaceCollection_isOfficial_idx" ON "MarketplaceCollection"("isOfficial");

-- CreateIndex
CREATE INDEX "MarketplaceCollection_createdAt_idx" ON "MarketplaceCollection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPost_slug_key" ON "CommunityPost"("slug");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_idx" ON "CommunityPost"("authorId");

-- CreateIndex
CREATE INDEX "CommunityPost_communityId_idx" ON "CommunityPost"("communityId");

-- CreateIndex
CREATE INDEX "CommunityPost_type_idx" ON "CommunityPost"("type");

-- CreateIndex
CREATE INDEX "CommunityPost_status_idx" ON "CommunityPost"("status");

-- CreateIndex
CREATE INDEX "CommunityPost_score_idx" ON "CommunityPost"("score");

-- CreateIndex
CREATE INDEX "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_lastActivityAt_idx" ON "CommunityPost"("lastActivityAt");

-- CreateIndex
CREATE INDEX "CommunityPost_isPinned_score_idx" ON "CommunityPost"("isPinned", "score");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_idx" ON "CommunityComment"("postId");

-- CreateIndex
CREATE INDEX "CommunityComment_authorId_idx" ON "CommunityComment"("authorId");

-- CreateIndex
CREATE INDEX "CommunityComment_parentId_idx" ON "CommunityComment"("parentId");

-- CreateIndex
CREATE INDEX "CommunityComment_score_idx" ON "CommunityComment"("score");

-- CreateIndex
CREATE INDEX "CommunityComment_createdAt_idx" ON "CommunityComment"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_score_idx" ON "CommunityComment"("postId", "score");

-- CreateIndex
CREATE INDEX "PostVote_postId_idx" ON "PostVote"("postId");

-- CreateIndex
CREATE INDEX "PostVote_userId_idx" ON "PostVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostVote_postId_userId_key" ON "PostVote"("postId", "userId");

-- CreateIndex
CREATE INDEX "CommentVote_commentId_idx" ON "CommentVote"("commentId");

-- CreateIndex
CREATE INDEX "CommentVote_userId_idx" ON "CommentVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentVote_commentId_userId_key" ON "CommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "PostAward_postId_idx" ON "PostAward"("postId");

-- CreateIndex
CREATE INDEX "PostAward_giverId_idx" ON "PostAward"("giverId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "Community_ownerId_idx" ON "Community"("ownerId");

-- CreateIndex
CREATE INDEX "Community_slug_idx" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "Community_type_idx" ON "Community"("type");

-- CreateIndex
CREATE INDEX "Community_category_idx" ON "Community"("category");

-- CreateIndex
CREATE INDEX "Community_memberCount_idx" ON "Community"("memberCount");

-- CreateIndex
CREATE INDEX "Community_isOfficial_idx" ON "Community"("isOfficial");

-- CreateIndex
CREATE INDEX "Community_isFeatured_idx" ON "Community"("isFeatured");

-- CreateIndex
CREATE INDEX "CommunityMember_communityId_idx" ON "CommunityMember"("communityId");

-- CreateIndex
CREATE INDEX "CommunityMember_userId_idx" ON "CommunityMember"("userId");

-- CreateIndex
CREATE INDEX "CommunityMember_role_idx" ON "CommunityMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");

-- CreateIndex
CREATE INDEX "CommunityChannel_communityId_idx" ON "CommunityChannel"("communityId");

-- CreateIndex
CREATE INDEX "CommunityChannel_position_idx" ON "CommunityChannel"("position");

-- CreateIndex
CREATE INDEX "PostReport_postId_idx" ON "PostReport"("postId");

-- CreateIndex
CREATE INDEX "PostReport_reporterId_idx" ON "PostReport"("reporterId");

-- CreateIndex
CREATE INDEX "PostReport_status_idx" ON "PostReport"("status");

-- CreateIndex
CREATE INDEX "CommentReport_commentId_idx" ON "CommentReport"("commentId");

-- CreateIndex
CREATE INDEX "CommentReport_reporterId_idx" ON "CommentReport"("reporterId");

-- CreateIndex
CREATE INDEX "CommentReport_status_idx" ON "CommentReport"("status");

-- CreateIndex
CREATE INDEX "CommunityEvent_communityId_idx" ON "CommunityEvent"("communityId");

-- CreateIndex
CREATE INDEX "CommunityEvent_organizerId_idx" ON "CommunityEvent"("organizerId");

-- CreateIndex
CREATE INDEX "CommunityEvent_type_idx" ON "CommunityEvent"("type");

-- CreateIndex
CREATE INDEX "CommunityEvent_status_idx" ON "CommunityEvent"("status");

-- CreateIndex
CREATE INDEX "CommunityEvent_startDate_idx" ON "CommunityEvent"("startDate");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_userId_idx" ON "EventRegistration"("userId");

-- CreateIndex
CREATE INDEX "EventRegistration_status_idx" ON "EventRegistration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_userId_key" ON "EventRegistration"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserReputation_userId_key" ON "UserReputation"("userId");

-- CreateIndex
CREATE INDEX "UserReputation_userId_idx" ON "UserReputation"("userId");

-- CreateIndex
CREATE INDEX "UserReputation_totalPoints_idx" ON "UserReputation"("totalPoints");

-- CreateIndex
CREATE INDEX "UserReputation_level_idx" ON "UserReputation"("level");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE INDEX "UserBadge_reputationId_idx" ON "UserBadge"("reputationId");

-- CreateIndex
CREATE INDEX "UserBadge_badgeType_idx" ON "UserBadge"("badgeType");

-- CreateIndex
CREATE INDEX "UserBadge_badgeLevel_idx" ON "UserBadge"("badgeLevel");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "PostFollower_userId_idx" ON "PostFollower"("userId");

-- CreateIndex
CREATE INDEX "PostFollower_postId_idx" ON "PostFollower"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostFollower_userId_postId_key" ON "PostFollower"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "UserContentPreference_userId_key" ON "UserContentPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailNotificationConfig_userId_key" ON "EmailNotificationConfig"("userId");

-- CreateIndex
CREATE INDEX "EmailNotificationConfig_userId_idx" ON "EmailNotificationConfig"("userId");

-- CreateIndex
CREATE INDEX "EmailNotificationConfig_frequency_idx" ON "EmailNotificationConfig"("frequency");

-- CreateIndex
CREATE INDEX "UserActionHistory_userId_idx" ON "UserActionHistory"("userId");

-- CreateIndex
CREATE INDEX "UserActionHistory_action_idx" ON "UserActionHistory"("action");

-- CreateIndex
CREATE INDEX "UserActionHistory_targetType_targetId_idx" ON "UserActionHistory"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "UserActionHistory_createdAt_idx" ON "UserActionHistory"("createdAt");

-- CreateIndex
CREATE INDEX "PostFollowDigest_userId_idx" ON "PostFollowDigest"("userId");

-- CreateIndex
CREATE INDEX "PostFollowDigest_type_idx" ON "PostFollowDigest"("type");

-- CreateIndex
CREATE INDEX "PostFollowDigest_sentAt_idx" ON "PostFollowDigest"("sentAt");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_idx" ON "DirectMessage"("conversationId");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_idx" ON "DirectMessage"("senderId");

-- CreateIndex
CREATE INDEX "DirectMessage_recipientId_idx" ON "DirectMessage"("recipientId");

-- CreateIndex
CREATE INDEX "DirectMessage_createdAt_idx" ON "DirectMessage"("createdAt");

-- CreateIndex
CREATE INDEX "DirectConversation_lastMessageAt_idx" ON "DirectConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_idx" ON "Notification"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplacePrompt_authorId_idx" ON "MarketplacePrompt"("authorId");

-- CreateIndex
CREATE INDEX "MarketplacePrompt_category_idx" ON "MarketplacePrompt"("category");

-- CreateIndex
CREATE INDEX "MarketplacePrompt_status_idx" ON "MarketplacePrompt"("status");

-- CreateIndex
CREATE INDEX "MarketplacePrompt_downloadCount_idx" ON "MarketplacePrompt"("downloadCount");

-- CreateIndex
CREATE INDEX "MarketplacePrompt_rating_idx" ON "MarketplacePrompt"("rating");

-- CreateIndex
CREATE INDEX "PromptRating_promptId_idx" ON "PromptRating"("promptId");

-- CreateIndex
CREATE INDEX "PromptRating_userId_idx" ON "PromptRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptRating_promptId_userId_key" ON "PromptRating"("promptId", "userId");

-- CreateIndex
CREATE INDEX "PromptDownload_promptId_idx" ON "PromptDownload"("promptId");

-- CreateIndex
CREATE INDEX "PromptDownload_userId_idx" ON "PromptDownload"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceCharacter_authorId_idx" ON "MarketplaceCharacter"("authorId");

-- CreateIndex
CREATE INDEX "MarketplaceCharacter_category_idx" ON "MarketplaceCharacter"("category");

-- CreateIndex
CREATE INDEX "MarketplaceCharacter_status_idx" ON "MarketplaceCharacter"("status");

-- CreateIndex
CREATE INDEX "MarketplaceCharacter_downloadCount_idx" ON "MarketplaceCharacter"("downloadCount");

-- CreateIndex
CREATE INDEX "MarketplaceCharacter_rating_idx" ON "MarketplaceCharacter"("rating");

-- CreateIndex
CREATE INDEX "MarketplaceCharacter_isNSFW_idx" ON "MarketplaceCharacter"("isNSFW");

-- CreateIndex
CREATE INDEX "CharacterRating_characterId_idx" ON "CharacterRating"("characterId");

-- CreateIndex
CREATE INDEX "CharacterRating_userId_idx" ON "CharacterRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterRating_characterId_userId_key" ON "CharacterRating"("characterId", "userId");

-- CreateIndex
CREATE INDEX "CharacterDownload_characterId_idx" ON "CharacterDownload"("characterId");

-- CreateIndex
CREATE INDEX "CharacterDownload_userId_idx" ON "CharacterDownload"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProject_slug_key" ON "ResearchProject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProject_doi_key" ON "ResearchProject"("doi");

-- CreateIndex
CREATE INDEX "ResearchProject_leadAuthorId_idx" ON "ResearchProject"("leadAuthorId");

-- CreateIndex
CREATE INDEX "ResearchProject_category_idx" ON "ResearchProject"("category");

-- CreateIndex
CREATE INDEX "ResearchProject_status_idx" ON "ResearchProject"("status");

-- CreateIndex
CREATE INDEX "ResearchProject_slug_idx" ON "ResearchProject"("slug");

-- CreateIndex
CREATE INDEX "ResearchProject_publishedAt_idx" ON "ResearchProject"("publishedAt");

-- CreateIndex
CREATE INDEX "ResearchContributor_projectId_idx" ON "ResearchContributor"("projectId");

-- CreateIndex
CREATE INDEX "ResearchContributor_userId_idx" ON "ResearchContributor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchContributor_projectId_userId_key" ON "ResearchContributor"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ResearchDataset_projectId_idx" ON "ResearchDataset"("projectId");

-- CreateIndex
CREATE INDEX "ResearchDataset_uploaderId_idx" ON "ResearchDataset"("uploaderId");

-- CreateIndex
CREATE INDEX "ResearchReview_projectId_idx" ON "ResearchReview"("projectId");

-- CreateIndex
CREATE INDEX "ResearchReview_reviewerId_idx" ON "ResearchReview"("reviewerId");

-- CreateIndex
CREATE INDEX "ModerationAction_moderatorId_idx" ON "ModerationAction"("moderatorId");

-- CreateIndex
CREATE INDEX "ModerationAction_targetType_targetId_idx" ON "ModerationAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationAction_action_idx" ON "ModerationAction"("action");

-- CreateIndex
CREATE INDEX "ModerationAction_createdAt_idx" ON "ModerationAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_userId_idx" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_lastTourStarted_idx" ON "OnboardingProgress"("lastTourStarted");

-- CreateIndex
CREATE INDEX "OnboardingProgress_lastTourCompleted_idx" ON "OnboardingProgress"("lastTourCompleted");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_timestamp_idx" ON "AnalyticsEvent"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "SymbolicBond_userId_idx" ON "SymbolicBond"("userId");

-- CreateIndex
CREATE INDEX "SymbolicBond_agentId_idx" ON "SymbolicBond"("agentId");

-- CreateIndex
CREATE INDEX "SymbolicBond_tier_idx" ON "SymbolicBond"("tier");

-- CreateIndex
CREATE INDEX "SymbolicBond_status_idx" ON "SymbolicBond"("status");

-- CreateIndex
CREATE INDEX "SymbolicBond_rarityScore_idx" ON "SymbolicBond"("rarityScore");

-- CreateIndex
CREATE INDEX "SymbolicBond_globalRank_idx" ON "SymbolicBond"("globalRank");

-- CreateIndex
CREATE INDEX "SymbolicBond_lastInteraction_idx" ON "SymbolicBond"("lastInteraction");

-- CreateIndex
CREATE INDEX "SymbolicBond_agentId_tier_status_idx" ON "SymbolicBond"("agentId", "tier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SymbolicBond_userId_agentId_tier_key" ON "SymbolicBond"("userId", "agentId", "tier");

-- CreateIndex
CREATE INDEX "BondQueue_userId_idx" ON "BondQueue"("userId");

-- CreateIndex
CREATE INDEX "BondQueue_agentId_tier_status_idx" ON "BondQueue"("agentId", "tier", "status");

-- CreateIndex
CREATE INDEX "BondQueue_queuePosition_idx" ON "BondQueue"("queuePosition");

-- CreateIndex
CREATE INDEX "BondQueue_status_idx" ON "BondQueue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BondQueue_userId_agentId_tier_key" ON "BondQueue"("userId", "agentId", "tier");

-- CreateIndex
CREATE INDEX "BondLegacy_userId_idx" ON "BondLegacy"("userId");

-- CreateIndex
CREATE INDEX "BondLegacy_agentId_idx" ON "BondLegacy"("agentId");

-- CreateIndex
CREATE INDEX "BondLegacy_tier_idx" ON "BondLegacy"("tier");

-- CreateIndex
CREATE INDEX "BondLegacy_endDate_idx" ON "BondLegacy"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "AgentBondConfig_agentId_key" ON "AgentBondConfig"("agentId");

-- CreateIndex
CREATE INDEX "AgentBondConfig_agentId_idx" ON "AgentBondConfig"("agentId");

-- CreateIndex
CREATE INDEX "BondAnalytics_date_idx" ON "BondAnalytics"("date");

-- CreateIndex
CREATE INDEX "BondNotification_userId_read_idx" ON "BondNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "BondNotification_createdAt_idx" ON "BondNotification"("createdAt");

-- CreateIndex
CREATE INDEX "ShareEvent_agentId_idx" ON "ShareEvent"("agentId");

-- CreateIndex
CREATE INDEX "ShareEvent_userId_idx" ON "ShareEvent"("userId");

-- CreateIndex
CREATE INDEX "ShareEvent_method_idx" ON "ShareEvent"("method");

-- CreateIndex
CREATE INDEX "ShareEvent_createdAt_idx" ON "ShareEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ShareEvent_agentId_method_idx" ON "ShareEvent"("agentId", "method");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreferences_userId_key" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreferences_userId_idx" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "BondBadge_userId_idx" ON "BondBadge"("userId");

-- CreateIndex
CREATE INDEX "BondBadge_badgeType_idx" ON "BondBadge"("badgeType");

-- CreateIndex
CREATE INDEX "BondBadge_tier_idx" ON "BondBadge"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "BondBadge_userId_badgeType_tier_key" ON "BondBadge"("userId", "badgeType", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "UserRewards_userId_key" ON "UserRewards"("userId");

-- CreateIndex
CREATE INDEX "UserRewards_userId_idx" ON "UserRewards"("userId");

-- CreateIndex
CREATE INDEX "UserRewards_totalPoints_idx" ON "UserRewards"("totalPoints");

-- CreateIndex
CREATE INDEX "UserRewards_level_idx" ON "UserRewards"("level");

-- CreateIndex
CREATE INDEX "RewardAction_userId_idx" ON "RewardAction"("userId");

-- CreateIndex
CREATE INDEX "RewardAction_actionType_idx" ON "RewardAction"("actionType");

-- CreateIndex
CREATE INDEX "RewardAction_createdAt_idx" ON "RewardAction"("createdAt");

-- CreateIndex
CREATE INDEX "RetentionLeaderboard_userId_idx" ON "RetentionLeaderboard"("userId");

-- CreateIndex
CREATE INDEX "RetentionLeaderboard_globalRank_idx" ON "RetentionLeaderboard"("globalRank");

-- CreateIndex
CREATE INDEX "RetentionLeaderboard_consistencyScore_idx" ON "RetentionLeaderboard"("consistencyScore");

-- CreateIndex
CREATE INDEX "RetentionLeaderboard_lastUpdated_idx" ON "RetentionLeaderboard"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionLeaderboard_userId_periodStart_periodEnd_key" ON "RetentionLeaderboard"("userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PsychologicalProfile_agentId_key" ON "PsychologicalProfile"("agentId");

-- CreateIndex
CREATE INDEX "PsychologicalProfile_agentId_idx" ON "PsychologicalProfile"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "DeepRelationalPatterns_agentId_key" ON "DeepRelationalPatterns"("agentId");

-- CreateIndex
CREATE INDEX "DeepRelationalPatterns_agentId_idx" ON "DeepRelationalPatterns"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "PhilosophicalFramework_agentId_key" ON "PhilosophicalFramework"("agentId");

-- CreateIndex
CREATE INDEX "PhilosophicalFramework_agentId_idx" ON "PhilosophicalFramework"("agentId");

-- CreateIndex
CREATE INDEX "PersonalGoal_agentId_idx" ON "PersonalGoal"("agentId");

-- CreateIndex
CREATE INDEX "PersonalGoal_status_idx" ON "PersonalGoal"("status");

-- CreateIndex
CREATE INDEX "PersonalGoal_category_idx" ON "PersonalGoal"("category");

-- CreateIndex
CREATE INDEX "PersonalGoal_shouldShareProgress_idx" ON "PersonalGoal"("shouldShareProgress");

-- CreateIndex
CREATE INDEX "ScheduledEvent_agentId_idx" ON "ScheduledEvent"("agentId");

-- CreateIndex
CREATE INDEX "ScheduledEvent_scheduledFor_idx" ON "ScheduledEvent"("scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledEvent_resolved_idx" ON "ScheduledEvent"("resolved");

-- CreateIndex
CREATE INDEX "ScheduledEvent_category_idx" ON "ScheduledEvent"("category");

-- CreateIndex
CREATE INDEX "ScheduledEvent_relatedGoalId_idx" ON "ScheduledEvent"("relatedGoalId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEnergyState_agentId_key" ON "AgentEnergyState"("agentId");

-- CreateIndex
CREATE INDEX "AgentEnergyState_agentId_idx" ON "AgentEnergyState"("agentId");

-- CreateIndex
CREATE INDEX "MessageTracking_userId_idx" ON "MessageTracking"("userId");

-- CreateIndex
CREATE INDEX "MessageTracking_agentId_idx" ON "MessageTracking"("agentId");

-- CreateIndex
CREATE INDEX "MessageTracking_date_idx" ON "MessageTracking"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTracking_userId_agentId_date_key" ON "MessageTracking"("userId", "agentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAvailability_agentId_key" ON "AgentAvailability"("agentId");

-- CreateIndex
CREATE INDEX "AgentAvailability_agentId_idx" ON "AgentAvailability"("agentId");

-- CreateIndex
CREATE INDEX "AgentAvailability_available_idx" ON "AgentAvailability"("available");

-- CreateIndex
CREATE INDEX "CrossContextMemory_agentId_idx" ON "CrossContextMemory"("agentId");

-- CreateIndex
CREATE INDEX "CrossContextMemory_sourceType_idx" ON "CrossContextMemory"("sourceType");

-- CreateIndex
CREATE INDEX "CrossContextMemory_sourceGroupId_idx" ON "CrossContextMemory"("sourceGroupId");

-- CreateIndex
CREATE INDEX "CrossContextMemory_happenedAt_idx" ON "CrossContextMemory"("happenedAt");

-- CreateIndex
CREATE INDEX "CrossContextMemory_importance_idx" ON "CrossContextMemory"("importance");

-- CreateIndex
CREATE INDEX "TemporalContext_agentId_idx" ON "TemporalContext"("agentId");

-- CreateIndex
CREATE INDEX "TemporalContext_userId_idx" ON "TemporalContext"("userId");

-- CreateIndex
CREATE INDEX "TemporalContext_lastGroupId_idx" ON "TemporalContext"("lastGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "TemporalContext_agentId_userId_key" ON "TemporalContext"("agentId", "userId");

-- CreateIndex
CREATE INDEX "TopicFatigue_agentId_userId_idx" ON "TopicFatigue"("agentId", "userId");

-- CreateIndex
CREATE INDEX "TopicFatigue_mentions_idx" ON "TopicFatigue"("mentions");

-- CreateIndex
CREATE INDEX "TopicFatigue_lastMentionedAt_idx" ON "TopicFatigue"("lastMentionedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopicFatigue_agentId_userId_topic_key" ON "TopicFatigue"("agentId", "userId", "topic");

-- CreateIndex
CREATE INDEX "ConversationSummary_agentId_idx" ON "ConversationSummary"("agentId");

-- CreateIndex
CREATE INDEX "ConversationSummary_userId_idx" ON "ConversationSummary"("userId");

-- CreateIndex
CREATE INDEX "ConversationSummary_agentId_userId_messagesCount_idx" ON "ConversationSummary"("agentId", "userId", "messagesCount");

-- CreateIndex
CREATE INDEX "ConversationSummary_createdAt_idx" ON "ConversationSummary"("createdAt");

-- CreateIndex
CREATE INDEX "TempTierGrant_userId_idx" ON "TempTierGrant"("userId");

-- CreateIndex
CREATE INDEX "TempTierGrant_eventId_idx" ON "TempTierGrant"("eventId");

-- CreateIndex
CREATE INDEX "TempTierGrant_active_idx" ON "TempTierGrant"("active");

-- CreateIndex
CREATE INDEX "TempTierGrant_expiresAt_idx" ON "TempTierGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "TempTierGrant_userId_active_expiresAt_idx" ON "TempTierGrant"("userId", "active", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmartStartSession_resultCharacterId_key" ON "SmartStartSession"("resultCharacterId");

-- CreateIndex
CREATE INDEX "SmartStartSession_userId_startedAt_idx" ON "SmartStartSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "SmartStartSession_completedAt_idx" ON "SmartStartSession"("completedAt");

-- CreateIndex
CREATE INDEX "SmartStartSession_currentStep_idx" ON "SmartStartSession"("currentStep");

-- CreateIndex
CREATE UNIQUE INDEX "SmartStartAnalytics_date_key" ON "SmartStartAnalytics"("date");

-- CreateIndex
CREATE INDEX "SmartStartAnalytics_date_idx" ON "SmartStartAnalytics"("date");

-- CreateIndex
CREATE INDEX "GenreDetectionFeedback_sessionId_idx" ON "GenreDetectionFeedback"("sessionId");

-- CreateIndex
CREATE INDEX "GenreDetectionFeedback_detectedGenre_idx" ON "GenreDetectionFeedback"("detectedGenre");

-- CreateIndex
CREATE INDEX "GenreDetectionFeedback_isCorrect_idx" ON "GenreDetectionFeedback"("isCorrect");

-- CreateIndex
CREATE INDEX "GenreDetectionFeedback_timestamp_idx" ON "GenreDetectionFeedback"("timestamp");

-- CreateIndex
CREATE INDEX "Group_creatorId_idx" ON "Group"("creatorId");

-- CreateIndex
CREATE INDEX "Group_status_idx" ON "Group"("status");

-- CreateIndex
CREATE INDEX "Group_lastActivityAt_idx" ON "Group"("lastActivityAt");

-- CreateIndex
CREATE INDEX "Group_visibility_idx" ON "Group"("visibility");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "GroupMember_agentId_idx" ON "GroupMember"("agentId");

-- CreateIndex
CREATE INDEX "GroupMember_memberType_idx" ON "GroupMember"("memberType");

-- CreateIndex
CREATE INDEX "GroupMember_role_idx" ON "GroupMember"("role");

-- CreateIndex
CREATE INDEX "GroupMember_isActive_idx" ON "GroupMember"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_agentId_key" ON "GroupMember"("groupId", "agentId");

-- CreateIndex
CREATE INDEX "GroupMessage_groupId_idx" ON "GroupMessage"("groupId");

-- CreateIndex
CREATE INDEX "GroupMessage_groupId_turnNumber_idx" ON "GroupMessage"("groupId", "turnNumber");

-- CreateIndex
CREATE INDEX "GroupMessage_userId_idx" ON "GroupMessage"("userId");

-- CreateIndex
CREATE INDEX "GroupMessage_agentId_idx" ON "GroupMessage"("agentId");

-- CreateIndex
CREATE INDEX "GroupMessage_authorType_idx" ON "GroupMessage"("authorType");

-- CreateIndex
CREATE INDEX "GroupMessage_createdAt_idx" ON "GroupMessage"("createdAt");

-- CreateIndex
CREATE INDEX "GroupMessage_replyToId_idx" ON "GroupMessage"("replyToId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSimulationState_groupId_key" ON "GroupSimulationState"("groupId");

-- CreateIndex
CREATE INDEX "GroupSimulationState_groupId_idx" ON "GroupSimulationState"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvitation_inviteCode_key" ON "GroupInvitation"("inviteCode");

-- CreateIndex
CREATE INDEX "GroupInvitation_groupId_idx" ON "GroupInvitation"("groupId");

-- CreateIndex
CREATE INDEX "GroupInvitation_inviterId_idx" ON "GroupInvitation"("inviterId");

-- CreateIndex
CREATE INDEX "GroupInvitation_inviteeId_idx" ON "GroupInvitation"("inviteeId");

-- CreateIndex
CREATE INDEX "GroupInvitation_inviteCode_idx" ON "GroupInvitation"("inviteCode");

-- CreateIndex
CREATE INDEX "GroupInvitation_status_idx" ON "GroupInvitation"("status");

-- CreateIndex
CREATE INDEX "GroupInvitation_expiresAt_idx" ON "GroupInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "ConversationTracking_userId_lastMessageAt_idx" ON "ConversationTracking"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationTracking_userId_unreadCount_idx" ON "ConversationTracking"("userId", "unreadCount");

-- CreateIndex
CREATE INDEX "ConversationTracking_agentId_idx" ON "ConversationTracking"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTracking_userId_agentId_key" ON "ConversationTracking"("userId", "agentId");

-- CreateIndex
CREATE INDEX "_CollectionThemes_B_index" ON "_CollectionThemes"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityCore" ADD CONSTRAINT "PersonalityCore_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalState" ADD CONSTRAINT "InternalState_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodicMemory" ADD CONSTRAINT "EpisodicMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemanticMemory" ADD CONSTRAINT "SemanticMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProceduralMemory" ADD CONSTRAINT "ProceduralMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterGrowth" ADD CONSTRAINT "CharacterGrowth_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRoutine" ADD CONSTRAINT "CharacterRoutine_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRoutine" ADD CONSTRAINT "CharacterRoutine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineTemplate" ADD CONSTRAINT "RoutineTemplate_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "CharacterRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineInstance" ADD CONSTRAINT "RoutineInstance_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "CharacterRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineInstance" ADD CONSTRAINT "RoutineInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RoutineTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineInstance" ADD CONSTRAINT "RoutineInstance_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineSimulationState" ADD CONSTRAINT "RoutineSimulationState_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "CharacterRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineSimulationState" ADD CONSTRAINT "RoutineSimulationState_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relation" ADD CONSTRAINT "Relation_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClone" ADD CONSTRAINT "AgentClone_originalAgentId_fkey" FOREIGN KEY ("originalAgentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorProfile" ADD CONSTRAINT "BehaviorProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorTriggerLog" ADD CONSTRAINT "BehaviorTriggerLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorProgressionState" ADD CONSTRAINT "BehaviorProgressionState_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceConfig" ADD CONSTRAINT "VoiceConfig_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAppearance" ADD CONSTRAINT "CharacterAppearance_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualExpression" ADD CONSTRAINT "VisualExpression_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FastSDInstallation" ADD CONSTRAINT "FastSDInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantEvent" ADD CONSTRAINT "ImportantEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantPerson" ADD CONSTRAINT "ImportantPerson_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProactiveConfig" ADD CONSTRAINT "ProactiveConfig_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInteraction" ADD CONSTRAINT "UserInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCache" ADD CONSTRAINT "RecommendationCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTheme" ADD CONSTRAINT "MarketplaceTheme_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceThemeRating" ADD CONSTRAINT "MarketplaceThemeRating_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "MarketplaceTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceThemeDownload" ADD CONSTRAINT "MarketplaceThemeDownload_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "MarketplaceTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceThemeReport" ADD CONSTRAINT "MarketplaceThemeReport_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "MarketplaceTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentVote" ADD CONSTRAINT "CommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAward" ADD CONSTRAINT "PostAward_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAward" ADD CONSTRAINT "PostAward_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityChannel" ADD CONSTRAINT "CommunityChannel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_reputationId_fkey" FOREIGN KEY ("reputationId") REFERENCES "UserReputation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFollower" ADD CONSTRAINT "PostFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFollower" ADD CONSTRAINT "PostFollower_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentPreference" ADD CONSTRAINT "UserContentPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailNotificationConfig" ADD CONSTRAINT "EmailNotificationConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActionHistory" ADD CONSTRAINT "UserActionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFollowDigest" ADD CONSTRAINT "PostFollowDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePrompt" ADD CONSTRAINT "MarketplacePrompt_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRating" ADD CONSTRAINT "PromptRating_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "MarketplacePrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptDownload" ADD CONSTRAINT "PromptDownload_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "MarketplacePrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCharacter" ADD CONSTRAINT "MarketplaceCharacter_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRating" ADD CONSTRAINT "CharacterRating_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "MarketplaceCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterDownload" ADD CONSTRAINT "CharacterDownload_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "MarketplaceCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_leadAuthorId_fkey" FOREIGN KEY ("leadAuthorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchContributor" ADD CONSTRAINT "ResearchContributor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchDataset" ADD CONSTRAINT "ResearchDataset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchReview" ADD CONSTRAINT "ResearchReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymbolicBond" ADD CONSTRAINT "SymbolicBond_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymbolicBond" ADD CONSTRAINT "SymbolicBond_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondQueue" ADD CONSTRAINT "BondQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondQueue" ADD CONSTRAINT "BondQueue_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondLegacy" ADD CONSTRAINT "BondLegacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondLegacy" ADD CONSTRAINT "BondLegacy_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentBondConfig" ADD CONSTRAINT "AgentBondConfig_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareEvent" ADD CONSTRAINT "ShareEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareEvent" ADD CONSTRAINT "ShareEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondBadge" ADD CONSTRAINT "BondBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRewards" ADD CONSTRAINT "UserRewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAction" ADD CONSTRAINT "RewardAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionLeaderboard" ADD CONSTRAINT "RetentionLeaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychologicalProfile" ADD CONSTRAINT "PsychologicalProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepRelationalPatterns" ADD CONSTRAINT "DeepRelationalPatterns_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhilosophicalFramework" ADD CONSTRAINT "PhilosophicalFramework_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalGoal" ADD CONSTRAINT "PersonalGoal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempTierGrant" ADD CONSTRAINT "TempTierGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartStartSession" ADD CONSTRAINT "SmartStartSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartStartSession" ADD CONSTRAINT "SmartStartSession_resultCharacterId_fkey" FOREIGN KEY ("resultCharacterId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "GroupMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSimulationState" ADD CONSTRAINT "GroupSimulationState_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTracking" ADD CONSTRAINT "ConversationTracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTracking" ADD CONSTRAINT "ConversationTracking_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionThemes" ADD CONSTRAINT "_CollectionThemes_A_fkey" FOREIGN KEY ("A") REFERENCES "MarketplaceCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionThemes" ADD CONSTRAINT "_CollectionThemes_B_fkey" FOREIGN KEY ("B") REFERENCES "MarketplaceTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

