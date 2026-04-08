/**
 * BOND NOTIFICATIONS SERVICE
 * 
 * Centralized service to create and send notifications related to bonds.
 * Integrates with:
 * - Existing notification system (DB + WebSocket)
 * - Email (optional)
 * - Push notifications (Web Push API)
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import {emitSlotAvailable, emitRankChanged, emitMilestoneReached, emitBondAtRisk} from "@/lib/websocket/bonds-events";

export enum BondNotificationType {
  SLOT_AVAILABLE = "bond_slot_available",
  SLOT_EXPIRING = "bond_slot_expiring",
  BOND_ESTABLISHED = "bond_established",
  BOND_AT_RISK = "bond_at_risk",
  BOND_CRITICAL = "bond_critical",
  RANK_CHANGED = "bond_rank_changed",
  RANK_TOP_10 = "bond_rank_top_10",
  MILESTONE_REACHED = "bond_milestone_reached",
  NARRATIVE_UNLOCKED = "bond_narrative_unlocked",
  QUEUE_POSITION_IMPROVED = "bond_queue_improved",
  AFFINITY_MILESTONE = "bond_affinity_milestone",
  RARITY_UPGRADED = "bond_rarity_upgraded",
}

interface NotificationData {
  userId: string;
  type: BondNotificationType;
  title: string;
  message: string;
  metadata?: any;
  link?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

/** Create bond notification in database */
export async function createBondNotification(data: NotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        id: nanoid(),
        recipientId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });

    console.log(`[BondNotifications] Created notification for user ${data.userId}: ${data.type}`);

    // Emit real-time notification via WebSocket
    // In production, this would use the server socket system
    // For now, we emit the corresponding event

    return notification;
  } catch (error) {
    console.error("[BondNotifications] Error creating notification:", error);
    throw error;
  }
}

/** Notify slot available (when user is in queue) */
export async function notifySlotAvailable(
  userId: string,
  agentId: string,
  agentName: string,
  tier: string,
  offerId: string,
  expiresAt: Date
) {
  const hoursToExpire = Math.floor(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
  );

  await createBondNotification({
    userId,
    type: BondNotificationType.SLOT_AVAILABLE,
    title: "🎉 Slot Available!",
    message: `A ${tier.replace(/_/g, " ")} slot with ${agentName} is available. You have ${hoursToExpire}h to claim it.`,
    metadata: {
      agentId,
      agentName,
      tier,
      offerId,
      expiresAt: expiresAt.toISOString(),
    },
    link: `/bonds/queue`,
    priority: "urgent",
  });

  // Emit WebSocket event
  emitSlotAvailable(userId, agentId, tier, {});
}

/**
 * Notify slot expiring (6 hours before)
 */
export async function notifySlotExpiring(
  userId: string,
  agentName: string,
  tier: string,
  hoursLeft: number
) {
  await createBondNotification({
    userId,
    type: BondNotificationType.SLOT_EXPIRING,
    title: "⏰ Slot Expiring",
    message: `Your slot for ${agentName} expires in ${hoursLeft} hours. Don't miss it!`,
    link: `/bonds/queue`,
    priority: "high",
  });
}

/**
 * Notify bond established
 */
export async function notifyBondEstablished(
  userId: string,
  bondId: string,
  agentName: string,
  tier: string
) {
  await createBondNotification({
    userId,
    type: BondNotificationType.BOND_ESTABLISHED,
    title: "💝 New Bond",
    message: `You've established a ${tier.replace(/_/g, " ")} bond with ${agentName}`,
    metadata: { bondId },
    link: `/bonds/${bondId}`,
    priority: "medium",
  });
}

/**
 * Notify bond at risk
 */
export async function notifyBondAtRisk(
  userId: string,
  bondId: string,
  agentName: string,
  daysInactive: number,
  status: string
) {
  const isUrgent = status === "at_risk";

  await createBondNotification({
    userId,
    type: isUrgent ? BondNotificationType.BOND_CRITICAL : BondNotificationType.BOND_AT_RISK,
    title: isUrgent ? "🚨 Bond in Critical Risk" : "⚠️ Bond Needs Attention",
    message: `Your bond with ${agentName} has been inactive for ${daysInactive} days. ${
      isUrgent ? "Interact urgently to save it!" : "Chat soon to keep it healthy."
    }`,
    metadata: { bondId, daysInactive, status },
    link: `/agentes/${bondId}`, // Link directo al chat
    priority: isUrgent ? "urgent" : "high",
  });

  // Emit WebSocket event
  emitBondAtRisk(bondId, userId, status, daysInactive);
}

/**
 * Notificar cambio de ranking
 */
export async function notifyRankChanged(
  userId: string,
  bondId: string,
  agentName: string,
  newRank: number,
  oldRank: number,
  tier: string
) {
  const improved = newRank < oldRank;
  const change = Math.abs(newRank - oldRank);

  await createBondNotification({
    userId,
    type: newRank <= 10 ? BondNotificationType.RANK_TOP_10 : BondNotificationType.RANK_CHANGED,
    title: improved ? "📈 ¡Ranking Mejorado!" : "📉 Cambio en Ranking",
    message: `Tu vínculo con ${agentName} ${improved ? "subió" : "bajó"} ${change} posiciones. Ahora estás en #${newRank}`,
    metadata: { bondId, newRank, oldRank, tier },
    link: `/bonds/${bondId}`,
    priority: newRank <= 10 ? "high" : "medium",
  });

  // Emit WebSocket event
  emitRankChanged(bondId, userId, oldRank, newRank);
}

/**
 * Notificar milestone alcanzado
 */
export async function notifyMilestoneReached(
  userId: string,
  bondId: string,
  agentName: string,
  milestoneName: string,
  milestoneDescription: string,
  reward?: string
) {
  await createBondNotification({
    userId,
    type: BondNotificationType.MILESTONE_REACHED,
    title: "🏆 Logro Desbloqueado",
    message: `${milestoneName}: ${milestoneDescription}${reward ? ` Recompensa: ${reward}` : ""}`,
    metadata: { bondId, milestoneName, reward },
    link: `/bonds/${bondId}`,
    priority: "medium",
  });

  // Emit WebSocket event
  emitMilestoneReached(bondId, userId, milestoneName, { reward });
}

/**
 * Notificar narrativa desbloqueada
 */
export async function notifyNarrativeUnlocked(
  userId: string,
  bondId: string,
  agentName: string,
  narrativeName: string,
  narrativeDescription: string
) {
  await createBondNotification({
    userId,
    type: BondNotificationType.NARRATIVE_UNLOCKED,
    title: "📖 Nueva Historia",
    message: `Desbloqueaste "${narrativeName}" con ${agentName}: ${narrativeDescription}`,
    metadata: { bondId, narrativeName },
    link: `/bonds/${bondId}`,
    priority: "medium",
  });
}

/** Notify queue position improvement */
export async function notifyQueuePositionImproved(
  userId: string,
  agentName: string,
  tier: string,
  newPosition: number,
  totalInQueue: number
) {
  await createBondNotification({
    userId,
    type: BondNotificationType.QUEUE_POSITION_IMPROVED,
    title: "🔼 Posición en Cola",
    message: `Avanzaste a la posición #${newPosition} de ${totalInQueue} para ${tier.replace(/_/g, " ")} con ${agentName}`,
    link: `/bonds/queue`,
    priority: newPosition === 1 ? "high" : "low",
  });
}

/**
 * Notificar milestone de afinidad (50, 75, 90, 100)
 */
export async function notifyAffinityMilestone(
  userId: string,
  bondId: string,
  agentName: string,
  affinityLevel: number
) {
  const milestones: Record<number, string> = {
    25: "¡Primera Conexión! 🌱",
    50: "¡Conexión Fuerte! 💪",
    75: "¡Vínculo Profundo! 💝",
    90: "¡Casi Perfecto! ✨",
    100: "¡Conexión Máxima! 🌟",
  };

  const title = milestones[affinityLevel];
  if (!title) return; // Solo notificar en milestones específicos

  await createBondNotification({
    userId,
    type: BondNotificationType.AFFINITY_MILESTONE,
    title,
    message: `Alcanzaste ${affinityLevel}% de afinidad con ${agentName}`,
    metadata: { bondId, affinityLevel },
    link: `/bonds/${bondId}`,
    priority: affinityLevel === 100 ? "high" : "medium",
  });
}

/**
 * Notificar upgrade de rareza
 */
export async function notifyRarityUpgraded(
  userId: string,
  bondId: string,
  agentName: string,
  oldRarity: string,
  newRarity: string
) {
  await createBondNotification({
    userId,
    type: BondNotificationType.RARITY_UPGRADED,
    title: "✨ Rareza Mejorada",
    message: `Tu vínculo con ${agentName} subió de ${oldRarity} a ${newRarity}`,
    metadata: { bondId, oldRarity, newRarity },
    link: `/bonds/${bondId}`,
    priority: newRarity === "Mythic" || newRarity === "Legendary" ? "high" : "medium",
  });
}

/** Get user bond notifications */
export async function getUserBondNotifications(
  userId: string,
  limit: number = 20,
  unreadOnly: boolean = false
) {
  const where: any = {
    user: { id: userId },
    type: {
      startsWith: "bond_",
    },
  };

  if (unreadOnly) {
    where.isRead = false;
  }

  return await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Mark notification as read */
export async function markBondNotificationAsRead(notificationId: string) {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/** Mark all bond notifications as read */
export async function markAllBondNotificationsAsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: {
      recipientId: userId,
      type: { startsWith: "bond_" },
      isRead: false,
    },
    data: { isRead: true },
  });
}

/** Get count of unread notifications */
export async function getUnreadBondNotificationsCount(userId: string): Promise<number> {
  return await prisma.notification.count({
    where: {
      recipientId: userId,
      type: { startsWith: "bond_" },
      isRead: false,
    },
  });
}

export default {
  notifySlotAvailable,
  notifySlotExpiring,
  notifyBondEstablished,
  notifyBondAtRisk,
  notifyRankChanged,
  notifyMilestoneReached,
  notifyNarrativeUnlocked,
  notifyQueuePositionImproved,
  notifyAffinityMilestone,
  notifyRarityUpgraded,
  getUserBondNotifications,
  markBondNotificationAsRead,
  markAllBondNotificationsAsRead,
  getUnreadBondNotificationsCount,
};
