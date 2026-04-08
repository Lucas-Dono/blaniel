import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

/**
 * Group Notification Service
 *
 * Maneja notificaciones para eventos de grupos:
 * - In-app notifications
 * - Push notifications móvil
 * - NO email (siguiendo el patrón de WhatsApp/Discord)
 */

/**
 * Send notifications when a new message is posted in a group
 */
export async function sendGroupMessageNotifications(
  group: any,
  message: any,
  senderUserId: string
): Promise<void> {
  try {
    // 1. Obtener miembros a notificar (todos excepto el remitente)
    const membersToNotify = await prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        memberType: "user",
        userId: { not: senderUserId },
        isActive: true,
        isMuted: false, // No notificar a miembros silenciados
      },
      include: {
        User: {
          include: {
            NotificationPreferences: true,
          },
        },
      },
    });

    if (membersToNotify.length === 0) {
      return;
    }

    // 2. Crear notificaciones in-app
    await createInAppNotifications(group, message, membersToNotify, senderUserId);

    // 3. Enviar push notifications (solo a usuarios con push habilitado)
    await sendPushNotifications(group, message, membersToNotify);
  } catch (error) {
    console.error("Error sending group message notifications:", error);
    // No lanzar error para no afectar el flujo principal
  }
}

/**
 * Create in-app notifications
 */
async function createInAppNotifications(
  group: any,
  message: any,
  members: any[],
  senderUserId: string
): Promise<void> {
  try {
    const senderName = message.user?.name || "Alguien";
    const messagePreview = message.content.substring(0, 100);

    await prisma.notification.createMany({
      data: members.map((member) => ({
        id: nanoid(),
        recipientId: member.userId!,
        type: "group_message",
        title: `Nuevo mensaje en ${group.name}`,
        message: `${senderName}: ${messagePreview}${message.content.length > 100 ? "..." : ""}`,
        actionUrl: `/dashboard/grupos/${group.id}`,
        relatedId: message.id,
        relatedType: "group_message",
        actorId: senderUserId,
        isRead: false,
      })),
    });
  } catch (error) {
    console.error("Error creating in-app notifications:", error);
  }
}

/**
 * Send push notifications
 */
async function sendPushNotifications(
  group: any,
  message: any,
  members: any[]
): Promise<void> {
  const pushTasks = members
    .filter((member) => {
      const prefs = (member as any).User?.NotificationPreferences;
      return prefs?.pushNotificationsEnabled ?? true; // Default: enabled
    })
    .map(async (member) => {
      try {
        // Get push subscription from user metadata
        const pushSubscription = (member as any).User?.metadata?.pushSubscription;
        if (!pushSubscription) {
          return;
        }

        const senderName = message.user?.name || "Alguien";
        const messagePreview = message.content.substring(0, 100);

        // Send push notification (web push API)
        await sendWebPushNotification(pushSubscription, {
          title: group.name,
          body: `${senderName}: ${messagePreview}`,
          icon: message.user?.image || "/default-avatar.png",
          badge: member.unreadCount + 1,
          tag: `group-${group.id}`, // Permite agrupar notificaciones
          data: {
            url: `/dashboard/grupos/${group.id}`,
            type: "group_message",
            groupId: group.id,
            messageId: message.id,
          },
        });
      } catch (error) {
        console.error(`Push notification failed for user ${member.userId}:`, error);
        // Continue with other notifications even if one fails
      }
    });

  await Promise.allSettled(pushTasks);
}

/**
 * Send web push notification
 */
async function sendWebPushNotification(
  subscription: any,
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: number;
    tag?: string;
    data?: any;
  }
): Promise<void> {
  try {
    // Import web-push library dynamically
    const webpush = await import("web-push");

    // Configure VAPID keys (should be in environment variables)
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.default.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:support@yourdomain.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        tag: notification.tag,
        data: notification.data,
      });

      await webpush.default.sendNotification(subscription, payload);
    } else {
      console.warn("VAPID keys not configured, push notifications disabled");
    }
  } catch (error) {
    console.error("Error sending web push notification:", error);
    throw error;
  }
}

/**
 * Send notifications when a member joins a group
 */
export async function sendMemberJoinedNotifications(
  group: any,
  newMember: any,
  addedByUserId: string
): Promise<void> {
  try {
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        memberType: "user",
        userId: { not: newMember.userId },
        isActive: true,
      },
      select: { userId: true },
    });

    if (members.length === 0) {
      return;
    }

    const memberName = newMember.user?.name || newMember.agent?.name || "Alguien";

    await prisma.notification.createMany({
      data: members.map((member) => ({
        id: nanoid(),
        recipientId: member.userId!,
        type: "group_member_added",
        title: `Nuevo miembro en ${group.name}`,
        message: `${memberName} se unió al grupo`,
        actionUrl: `/dashboard/grupos/${group.id}`,
        relatedId: group.id,
        relatedType: "group",
        actorId: addedByUserId,
        isRead: false,
      })),
    });
  } catch (error) {
    console.error("Error sending member joined notifications:", error);
  }
}

/**
 * Send notifications when a member leaves a group
 */
export async function sendMemberLeftNotifications(
  group: any,
  leftMember: any
): Promise<void> {
  try {
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        memberType: "user",
        userId: { not: leftMember.userId },
        isActive: true,
      },
      select: { userId: true },
    });

    if (members.length === 0) {
      return;
    }

    const memberName = leftMember.user?.name || "Alguien";

    await prisma.notification.createMany({
      data: members.map((member) => ({
        id: nanoid(),
        recipientId: member.userId!,
        type: "group_member_removed",
        title: `Cambio en ${group.name}`,
        message: `${memberName} salió del grupo`,
        actionUrl: `/dashboard/grupos/${group.id}`,
        relatedId: group.id,
        relatedType: "group",
        isRead: false,
      })),
    });
  } catch (error) {
    console.error("Error sending member left notifications:", error);
  }
}

/**
 * Send notification when user is invited to a group
 */
export async function sendGroupInvitationNotification(
  group: any,
  inviteeUserId: string,
  inviterUserId: string,
  invitationCode: string
): Promise<void> {
  try {
    const inviter = await prisma.user.findUnique({
      where: { id: inviterUserId },
      select: { name: true },
    });

    await prisma.notification.create({
      data: {
        id: nanoid(),
        recipientId: inviteeUserId,
        type: "group_invitation",
        title: "Nueva invitación a grupo",
        message: `${inviter?.name || "Alguien"} te invitó a unirte a ${group.name}`,
        actionUrl: `/dashboard/grupos/invitaciones/${invitationCode}`,
        relatedId: group.id,
        relatedType: "group",
        actorId: inviterUserId,
        isRead: false,
      },
    });

    // Also send push notification if enabled
    const invitee = await prisma.user.findUnique({
      where: { id: inviteeUserId },
      include: { NotificationPreferences: true },
    });

    if (invitee?.NotificationPreferences?.pushNotifications) {
      const pushSubscription = (invitee.NotificationPreferences as any)?.pushSubscription;
      if (pushSubscription) {
        await sendWebPushNotification(pushSubscription, {
          title: "Invitación a grupo",
          body: `${inviter?.name || "Alguien"} te invitó a ${group.name}`,
          icon: "/group-icon.png",
          data: {
            url: `/dashboard/grupos/invitaciones/${invitationCode}`,
            type: "group_invitation",
            groupId: group.id,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error sending group invitation notification:", error);
  }
}

/**
 * Send notification when group settings are changed
 */
export async function sendGroupSettingsChangedNotification(
  group: any,
  changedByUserId: string,
  changes: string
): Promise<void> {
  try {
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        memberType: "user",
        userId: { not: changedByUserId },
        isActive: true,
        role: { in: ["owner", "moderator"] }, // Solo notificar a owners y moderators
      },
      select: { userId: true },
    });

    if (members.length === 0) {
      return;
    }

    const changer = await prisma.user.findUnique({
      where: { id: changedByUserId },
      select: { name: true },
    });

    await prisma.notification.createMany({
      data: members.map((member) => ({
        id: nanoid(),
        recipientId: member.userId!,
        type: "group_settings_changed",
        title: `Configuración actualizada en ${group.name}`,
        message: `${changer?.name || "Alguien"} actualizó ${changes}`,
        actionUrl: `/dashboard/grupos/${group.id}/configuracion`,
        relatedId: group.id,
        relatedType: "group",
        actorId: changedByUserId,
        isRead: false,
      })),
    });
  } catch (error) {
    console.error("Error sending group settings changed notification:", error);
  }
}

/**
 * Batch mark notifications as read
 */
export async function markGroupNotificationsAsRead(
  userId: string,
  groupId: string
): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        relatedId: groupId,
        relatedType: { in: ["group", "group_message"] },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error marking group notifications as read:", error);
  }
}
