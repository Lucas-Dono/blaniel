import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserSubscription, cancelSubscription, reactivateSubscription } from "@/lib/mercadopago/subscription";
import { prisma } from "@/lib/prisma";
import { billingLogger as log } from "@/lib/logging/loggers";
import { sendCancellationEmail, sendReactivationEmail } from "@/lib/email/subscription-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);

    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;
    const body = await req.json();
    const { reason, feedback } = body;

    log.info({ userId }, 'User requested subscription cancellation');

    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      log.warn({ userId }, 'No active subscription found for cancellation');
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    if (!subscription.mercadopagoPreapprovalId) {
      log.warn({ userId }, 'No mercadopago preapproval ID found');
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    // Cancelar en Mercado Pago usando la función centralizada
    await cancelSubscription(subscription.mercadopagoPreapprovalId);

    // Save razón y feedback en metadata
    if (reason || feedback) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          metadata: {
            ...(subscription.metadata as any || {}),
            cancelReason: reason || null,
            cancelFeedback: feedback || null,
            canceledByUser: true,
            canceledAt: new Date().toISOString(),
          },
        },
      });
    }

    // Send email de confirmación de cancelación
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, plan: true },
    });

    if (user && user.email) {
      await sendCancellationEmail(
        { email: user.email, name: user.name },
        {
          planId: user.plan,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      );
    }

    log.info({
      userId,
      subscriptionId: subscription.id,
      preapprovalId: subscription.mercadopagoPreapprovalId,
      reason: reason || 'not provided'
    }, 'Subscription cancelled successfully');

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled. You will keep access until the end of your current billing period.",
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  } catch (error: any) {
    log.error({ err: error }, 'Error canceling subscription');
    return NextResponse.json(
      { error: "Failed to cancel subscription", details: error.message },
      { status: 500 }
    );
  }
}

// Endpoint para reactivar suscripción cancelada
export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);

    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;

    log.info({ userId }, 'User requested subscription reactivation');

    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      log.warn({ userId }, 'No subscription found for reactivation');
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    if (!subscription.cancelAtPeriodEnd && subscription.status !== "cancelled") {
      log.warn({ userId, status: subscription.status }, 'Subscription is not cancelled');
      return NextResponse.json(
        { error: "Subscription is not cancelled" },
        { status: 400 }
      );
    }

    if (!subscription.mercadopagoPreapprovalId) {
      log.warn({ userId }, 'No mercadopago preapproval ID found');
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    // Reactivar en MercadoPago usando la función centralizada
    await reactivateSubscription(subscription.mercadopagoPreapprovalId);

    // Send email de confirmación de reactivación
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, plan: true },
    });

    if (user && user.email) {
      await sendReactivationEmail(
        { email: user.email, name: user.name },
        {
          planId: user.plan,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      );
    }

    log.info({
      userId,
      subscriptionId: subscription.id,
      preapprovalId: subscription.mercadopagoPreapprovalId
    }, 'Subscription reactivated successfully');

    return NextResponse.json({
      success: true,
      message: "Subscription reactivated successfully",
    });
  } catch (error: any) {
    log.error({ err: error }, 'Error reactivating subscription');
    return NextResponse.json(
      { error: "Failed to reactivate subscription", details: error.message },
      { status: 500 }
    );
  }
}
