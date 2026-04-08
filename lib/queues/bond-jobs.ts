/**
 * BACKGROUND JOBS SYSTEM FOR SYMBOLIC BONDS
 * 
 * Uses BullMQ to process heavy tasks in background:
 * - Rarity calculation (every 6 hours)
 * - Decay processing (daily)
 * - Ranking updates (every hour)
 * - Sending batch notifications
 * - Cleanup of old data
 * 
 * NOTE: Requires Redis configured. If Redis is not available, jobs will not run.
 */

import { Queue, Worker, QueueEvents } from "bullmq";

import {
  processAllBondDecay,
  updateBondRarity,
} from "@/lib/services/symbolic-bonds.service";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// Check if Redis is configured for BullMQ
const isRedisConfigured = !!(process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_PORT));

// Connection config para BullMQ (usa el mismo Redis)
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// ============================================================================
// QUEUE DEFINITIONS
// ============================================================================

// Only create queue if Redis is configured
export const bondsQueue = isRedisConfigured ? new Queue("bonds", { connection }) : null;

export const BondJobTypes = {
  CALCULATE_RARITY: "calculate-rarity",
  PROCESS_DECAY: "process-decay",
  UPDATE_RANKINGS: "update-rankings",
  SEND_NOTIFICATIONS: "send-notifications",
  CLEANUP_OLD_DATA: "cleanup-old-data",
  PROCESS_QUEUE_OFFERS: "process-queue-offers",
  RECALCULATE_ALL_RARITIES: "recalculate-all-rarities",
} as const;

// ============================================================================
// JOB SCHEDULERS - Agregar jobs a la cola
// ============================================================================

/** Calculates rarity of a specific bond */
export async function scheduleRarityCalculation(bondId: string) {
  if (!bondsQueue) {
    console.warn("[BondJobs] Redis not configured, skipping rarity calculation job");
    return;
  }

  await bondsQueue.add(
    BondJobTypes.CALCULATE_RARITY,
    { bondId },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    }
  );
}

/** Processes decay of all bonds (run daily) */
export async function scheduleDecayProcessing() {
  if (!bondsQueue) {
    console.warn("[BondJobs] Redis not configured, skipping decay processing job");
    return;
  }

  await bondsQueue.add(
    BondJobTypes.PROCESS_DECAY,
    {},
    {
      repeat: {
        pattern: "0 3 * * *", // 3 AM diario
      },
      attempts: 3,
    }
  );
}

/**
 * Actualiza rankings globales (ejecutar cada hora)
 */
export async function scheduleRankingsUpdate() {
  if (!bondsQueue) {
    console.warn("[BondJobs] Redis not configured, skipping rankings update job");
    return;
  }

  await bondsQueue.add(
    BondJobTypes.UPDATE_RANKINGS,
    {},
    {
      repeat: {
        pattern: "0 * * * *", // Cada hora en punto
      },
    }
  );
}

/**
 * Recalcula rareza de todos los bonds activos (ejecutar cada 6 horas)
 */
export async function scheduleRarityRecalculation() {
  if (!bondsQueue) {
    console.warn("[BondJobs] Redis not configured, skipping rarity recalculation job");
    return;
  }

  await bondsQueue.add(
    BondJobTypes.RECALCULATE_ALL_RARITIES,
    {},
    {
      repeat: {
        pattern: "0 */6 * * *", // Cada 6 horas
      },
      attempts: 2,
    }
  );
}

/**
 * Procesa ofertas de slots en cola (cada 15 minutos)
 */
export async function scheduleQueueProcessing() {
  if (!bondsQueue) {
    console.warn("[BondJobs] Redis not configured, skipping queue processing job");
    return;
  }

  await bondsQueue.add(
    BondJobTypes.PROCESS_QUEUE_OFFERS,
    {},
    {
      repeat: {
        pattern: "*/15 * * * *", // Cada 15 minutos
      },
    }
  );
}

/**
 * Limpieza de notificaciones antiguas y datos obsoletos (semanal)
 */
export async function scheduleDataCleanup() {
  if (!bondsQueue) {
    console.warn("[BondJobs] Redis not configured, skipping data cleanup job");
    return;
  }

  await bondsQueue.add(
    BondJobTypes.CLEANUP_OLD_DATA,
    {},
    {
      repeat: {
        pattern: "0 4 * * 0", // Domingos a las 4 AM
      },
    }
  );
}

// ============================================================================
// JOB PROCESSORS - Ejecutar los jobs
// ============================================================================

/**
 * Worker that processes jobs
 * Only initialized if Redis is configured
 */
export const bondsWorker = isRedisConfigured ? new Worker(
  "bonds",
  async (job) => {
    console.log(`[BondWorker] Processing job: ${job.name}`);

    try {
      switch (job.name) {
        case BondJobTypes.CALCULATE_RARITY:
          return await processRarityCalculation(job.data);

        case BondJobTypes.PROCESS_DECAY:
          return await processDecay();

        case BondJobTypes.UPDATE_RANKINGS:
          return await updateRankings();

        case BondJobTypes.RECALCULATE_ALL_RARITIES:
          return await recalculateAllRarities();

        case BondJobTypes.PROCESS_QUEUE_OFFERS:
          return await processQueueOffers();

        case BondJobTypes.CLEANUP_OLD_DATA:
          return await cleanupOldData();

        case BondJobTypes.SEND_NOTIFICATIONS:
          return await sendNotifications(job.data);

        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      console.error(`[BondWorker] Error processing job ${job.name}:`, error);
      throw error; // Re-throw para que BullMQ maneje retry
    }
  },
  { connection }
) : null;

// ============================================================================
// JOB IMPLEMENTATIONS
// ============================================================================

async function processRarityCalculation(data: { bondId: string }) {
  const result = await updateBondRarity(data.bondId);
  if (!result) {
    console.log(`[RarityCalc] Bond ${data.bondId} → not found or error`);
    return { rarityTier: 'Common', rarityScore: 0, globalRank: 0 };
  }
  console.log(
    `[RarityCalc] Bond ${data.bondId} → ${result.rarityTier} (score: ${result.rarityScore.toFixed(3)})`
  );
  return result;
}

async function processDecay() {
  console.log("[Decay] Starting decay processing...");
  const result = await processAllBondDecay();
  console.log(
    `[Decay] Processed ${result.processed} bonds: ${result.warned} warned, ${result.dormant} dormant, ${result.fragile} fragile, ${result.released} released`
  );
  return result;
}

async function updateRankings() {
  console.log("[Rankings] Updating global rankings...");

  // Update globalRank para cada bond activo
  const allTiers = [
    "ROMANTIC",
    "BEST_FRIEND",
    "MENTOR",
    "CONFIDANT",
    "CREATIVE_PARTNER",
    "ADVENTURE_COMPANION",
  ];

  let totalUpdated = 0;

  for (const tier of allTiers) {
    // Get all active bonds of this tier sorted by rarity
    const bonds = await prisma.symbolicBond.findMany({
      where: { tier: tier as any, status: "active" },
      orderBy: { rarityScore: "desc" },
      select: { id: true },
    });

    // Update ranking (1-indexed)
    for (let i = 0; i < bonds.length; i++) {
      await prisma.symbolicBond.update({
        where: { id: bonds[i].id },
        data: { globalRank: i + 1 },
      });
      totalUpdated++;
    }
  }

  console.log(`[Rankings] Updated ${totalUpdated} bond rankings`);
  return { totalUpdated };
}

async function recalculateAllRarities() {
  console.log("[RarityRecalc] Recalculating all active bond rarities...");

  const activeBonds = await prisma.symbolicBond.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  let updated = 0;
  let errors = 0;

  for (const bond of activeBonds) {
    try {
      await updateBondRarity(bond.id);
      updated++;
    } catch (error) {
      console.error(`[RarityRecalc] Error updating bond ${bond.id}:`, error);
      errors++;
    }
  }

  console.log(
    `[RarityRecalc] Complete. Updated: ${updated}, Errors: ${errors}`
  );
  return { updated, errors };
}

async function processQueueOffers() {
  console.log("[QueueOffers] Processing expired slot offers...");

  // Encontrar slots ofrecidos que expiraron
  const expiredOffers = await prisma.bondQueue.findMany({
    where: {
      status: "offered",
      slotExpiresAt: { lte: new Date() },
    },
  });

  for (const offer of expiredOffers) {
    // Marcar como expired y pasar al siguiente
    await prisma.bondQueue.update({
      where: { id: offer.id },
      data: { status: "expired" },
    });

    // Buscar siguiente en la cola
    const nextInLine = await prisma.bondQueue.findFirst({
      where: {
        agentId: offer.agentId,
        tier: offer.tier,
        status: "waiting",
      },
      orderBy: [
        { eligibilityScore: "desc" },
        { joinedQueueAt: "asc" },
      ],
    });

    if (nextInLine) {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await prisma.bondQueue.update({
        where: { id: nextInLine.id },
        data: {
          status: "offered",
          slotOfferedAt: new Date(),
          slotExpiresAt: expiresAt,
          notifiedOfSlot: true,
        },
      });

      // Notificar
      await prisma.bondNotification.create({
        data: {
          id: nanoid(),
          userId: nextInLine.userId,
          type: "slot_available",
          title: "¡Slot disponible!",
          message: `Un slot para ${nextInLine.tier} está disponible. Tienes 48 horas para reclamarlo.`,
          metadata: {
            tier: nextInLine.tier,
            agentId: nextInLine.agentId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    }
  }

  console.log(`[QueueOffers] Processed ${expiredOffers.length} expired offers`);
  return { processed: expiredOffers.length };
}

async function cleanupOldData() {
  console.log("[Cleanup] Starting data cleanup...");

  // Delete read notifications older than 30 days
  const oldNotifications = await prisma.bondNotification.deleteMany({
    where: {
      read: true,
      createdAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  // Delete queue entries in expired/claimed status older than 7 days
  const oldQueueEntries = await prisma.bondQueue.deleteMany({
    where: {
      status: { in: ["expired", "claimed"] },
      updatedAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  // Delete analytics older than 90 days
  const oldAnalytics = await prisma.bondAnalytics.deleteMany({
    where: {
      date: { lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });

  console.log(`[Cleanup] Removed:`);
  console.log(`  - ${oldNotifications.count} old notifications`);
  console.log(`  - ${oldQueueEntries.count} old queue entries`);
  console.log(`  - ${oldAnalytics.count} old analytics`);

  return {
    notificationsRemoved: oldNotifications.count,
    queueEntriesRemoved: oldQueueEntries.count,
    analyticsRemoved: oldAnalytics.count,
  };
}

async function sendNotifications(data: { notifications: any[] }) {
  // Implement batch notification sending
  // Por ahora, placeholder
  console.log(`[Notifications] Would send ${data.notifications.length} notifications`);
  return { sent: data.notifications.length };
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Only create event listeners if Redis is configured
const queueEvents = isRedisConfigured ? new QueueEvents("bonds", { connection }) : null;

if (queueEvents) {
  queueEvents.on("completed", ({ jobId, returnvalue }) => {
    console.log(`[BondQueue] Job ${jobId} completed:`, returnvalue);
  });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error(`[BondQueue] Job ${jobId} failed:`, failedReason);
  });

  queueEvents.on("progress", ({ jobId, data }) => {
    console.log(`[BondQueue] Job ${jobId} progress:`, data);
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Inicializar todos los jobs recurrentes
 */
export async function initializeBondJobs() {
  if (!bondsQueue) {
    console.warn("⚠️  [BondJobs] Redis not configured - background jobs disabled.");
    console.warn("   Set REDIS_URL or REDIS_HOST/REDIS_PORT to enable bond jobs.");
    return;
  }

  console.log("🚀 Initializing Bond background jobs...");

  // Delete jobs repetidos antiguos (para evitar duplicados)
  await bondsQueue.removeRepeatable(BondJobTypes.PROCESS_DECAY, {
    pattern: "0 3 * * *",
  }).catch(() => {});

  await bondsQueue.removeRepeatable(BondJobTypes.UPDATE_RANKINGS, {
    pattern: "0 * * * *",
  }).catch(() => {});

  await bondsQueue.removeRepeatable(BondJobTypes.RECALCULATE_ALL_RARITIES, {
    pattern: "0 */6 * * *",
  }).catch(() => {});

  await bondsQueue.removeRepeatable(BondJobTypes.PROCESS_QUEUE_OFFERS, {
    pattern: "*/15 * * * *",
  }).catch(() => {});

  await bondsQueue.removeRepeatable(BondJobTypes.CLEANUP_OLD_DATA, {
    pattern: "0 4 * * 0",
  }).catch(() => {});

  // Agregar nuevos jobs
  await scheduleDecayProcessing();
  await scheduleRankingsUpdate();
  await scheduleRarityRecalculation();
  await scheduleQueueProcessing();
  await scheduleDataCleanup();

  console.log("✅ Bond jobs initialized");
}

/**
 * Cerrar workers y queues
 */
export async function closeBondJobs() {
  if (bondsWorker) {
    await bondsWorker.close();
  }
  if (bondsQueue) {
    await bondsQueue.close();
  }
  if (queueEvents) {
    await queueEvents.close();
  }
  console.log("Bond jobs closed");
}

// Log warning if Redis is not configured
if (!isRedisConfigured) {
  console.warn("[BondJobs] ⚠️  Redis not configured - background jobs disabled.");
  console.warn("[BondJobs] Set REDIS_URL or REDIS_HOST/REDIS_PORT environment variables to enable.");
}

// Exportar para uso externo
export { bondsQueue as default };
