import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import log from "@/lib/logging/logger";
import { notifyBondAtRisk } from "@/lib/notifications/push";
import { PushNotificationServerService } from "@/lib/services/push-notification-server.service";
import {
  shouldSendNotificationNow,
  isBondMuted,
} from "@/lib/notifications/smart-timing";
import { nanoid } from "nanoid";

/**
 * GET /api/cron/check-bonds-at-risk
 * Cron job that checks bonds at risk and sends notifications
 * 
 * Query params:
 * - secret: Secret key to authenticate the call (must match CRON_SECRET env var)
 * 
 * This endpoint must be called by an external cron job (e.g., cron-job.org, GitHub Actions, etc.)
 * Recommended: run once a day
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authentication
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      log.warn("Unauthorized cron job attempt");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    log.info("Starting bonds at risk check");

    // Get all active bonds
    const bonds = await prisma.symbolicBond.findMany({
      where: {
        status: "active",
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    log.info({ totalBonds: bonds.length }, "Checking bonds");

    // Calculate days since last interaction
    const now = new Date();
    const bondsAtRisk = bonds
      .map((bond) => {
        const lastInteractionDate = bond.lastInteraction || bond.createdAt;
        const daysSinceInteraction = Math.floor(
          (now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        let riskStatus: "warned" | "dormant" | "fragile" | null = null;

        if (daysSinceInteraction >= 90) {
          riskStatus = "fragile";
        } else if (daysSinceInteraction >= 60) {
          riskStatus = "dormant";
        } else if (daysSinceInteraction >= 30) {
          riskStatus = "warned";
        }

        return {
          bond,
          daysSinceInteraction,
          riskStatus,
        };
      })
      .filter((item) => item.riskStatus !== null);

    log.info(
      {
        bondsAtRisk: bondsAtRisk.length,
        warned: bondsAtRisk.filter((b) => b.riskStatus === "warned").length,
        dormant: bondsAtRisk.filter((b) => b.riskStatus === "dormant").length,
        fragile: bondsAtRisk.filter((b) => b.riskStatus === "fragile").length,
      },
      "Bonds at risk found"
    );

    // Send notificaciones
    const notificationResults = {
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const { bond, daysSinceInteraction, riskStatus } of bondsAtRisk) {
      if (!riskStatus) continue;

      try {
        // Check if the bond is silenced
        const isMuted = await isBondMuted(bond.userId, bond.id);
        if (isMuted) {
          log.info(
            { bondId: bond.id, userId: bond.userId },
            "Bond is muted, skipping notification"
          );
          notificationResults.skipped++;
          continue;
        }

        // Check smart timing y preferencias
        const notificationTypeMap = {
          warned: "bond_warning" as const,
          dormant: "bond_dormant" as const,
          fragile: "bond_fragile" as const,
        };

        const timing = await shouldSendNotificationNow(
          bond.userId,
          notificationTypeMap[riskStatus]
        );

        if (!timing.shouldSendNow) {
          log.info(
            {
              bondId: bond.id,
              userId: bond.userId,
              riskStatus,
              reason: timing.reason,
              suggestedTime: timing.suggestedTime,
            },
            "Smart timing suggests waiting"
          );
          notificationResults.skipped++;
          continue;
        }

        // Check if a notification was already sent recently for this bond and state
        const recentNotification = await prisma.bondNotification.findFirst({
          where: {
            userId: bond.userId,
            bondId: bond.id,
            type: "bond_at_risk",
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // últimas 24 horas
            },
            message: {
              contains: riskStatus, // Contiene el estado actual
            },
          },
        });

        if (recentNotification) {
          log.info(
            {
              bondId: bond.id,
              userId: bond.userId,
              riskStatus,
            },
            "Notification already sent recently, skipping"
          );
          notificationResults.skipped++;
          continue;
        }

        // Intentar enviar push notification (web)
        try {
          await notifyBondAtRisk(
            bond.userId,
            bond.Agent.name,
            riskStatus,
            daysSinceInteraction
          );
          log.info(
            { userId: bond.userId, agentName: bond.Agent.name, riskStatus },
            "Web push notification sent"
          );
        } catch (error) {
          log.warn(
            { error, userId: bond.userId },
            "Failed to send web push notification"
          );
        }

        // Intentar enviar push notification (mobile)
        try {
          await PushNotificationServerService.sendBondAtRiskNotification(
            bond.userId,
            bond.Agent.name,
            riskStatus,
            daysSinceInteraction
          );
          log.info(
            { userId: bond.userId, agentName: bond.Agent.name, riskStatus },
            "Mobile push notification sent"
          );
        } catch (error) {
          log.warn(
            { error, userId: bond.userId },
            "Failed to send mobile push notification"
          );
        }

        // Create notification in database
        await prisma.bondNotification.create({
          data: {
            id: nanoid(),
            userId: bond.userId,
            bondId: bond.id,
            type: "bond_at_risk",
            title: `Vínculo en estado: ${riskStatus}`,
            message: `Tu vínculo con ${bond.Agent.name} necesita atención. ${daysSinceInteraction} días sin interactuar.`,
            metadata: {
              riskStatus,
              daysSinceInteraction,
              agentId: bond.Agent.id,
              agentName: bond.Agent.name,
            },
          },
        });

        notificationResults.sent++;
      } catch (error) {
        log.error(
          {
            error,
            bondId: bond.id,
            userId: bond.userId,
          },
          "Error sending bond at risk notification"
        );
        notificationResults.failed++;
      }
    }

    log.info(
      {
        totalChecked: bonds.length,
        bondsAtRisk: bondsAtRisk.length,
        notificationsSent: notificationResults.sent,
        notificationsFailed: notificationResults.failed,
        notificationsSkipped: notificationResults.skipped,
      },
      "Bonds at risk check completed"
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalBonds: bonds.length,
        bondsAtRisk: bondsAtRisk.length,
        notifications: notificationResults,
        breakdown: {
          warned: bondsAtRisk.filter((b) => b.riskStatus === "warned").length,
          dormant: bondsAtRisk.filter((b) => b.riskStatus === "dormant").length,
          fragile: bondsAtRisk.filter((b) => b.riskStatus === "fragile").length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ error }, "Error in check bonds at risk cron job");
    return NextResponse.json(
      { error: "Error al verificar bonds en riesgo" },
      { status: 500 }
    );
  }
}
