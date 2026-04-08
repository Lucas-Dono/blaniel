/**
 * STRIPE SUBSCRIPTION SYNC SERVICE
 * 
 * Synchronizes the status of Stripe subscriptions with the local database
 */

import { prisma } from "@/lib/prisma";
import {getPlanFromPriceId} from "./config";
import { billingLogger as log } from "@/lib/logging/loggers";
import type Stripe from "stripe";
import { nanoid } from "nanoid";

/** Synchronizes a Stripe subscription with the local DB */
export async function syncStripeSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  try {
    const userId = subscription.metadata.userId;

    if (!userId) {
      log.error(
        { subscriptionId: subscription.id },
        "Subscription missing userId metadata"
      );
      return;
    }

    log.info(
      {
        subscriptionId: subscription.id,
        userId,
        status: subscription.status,
      },
      "Syncing Stripe subscription"
    );

    // Determinar el plan basado en el price_id
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId ? getPlanFromPriceId(priceId) : null;

    if (!plan) {
      log.warn(
        { subscriptionId: subscription.id, priceId },
        "Could not determine plan from price ID"
      );
      return;
    }

    // Update or create subscription in DB
    // NOTE: This code is Stripe legacy. The system now uses Paddle/MercadoPago
    // Buscar por userId en lugar de stripeSubscriptionId
    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId },
    });

    if (existingSubscription) {
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: subscription.status,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          canceledAt: (subscription as any).canceled_at
            ? new Date((subscription as any).canceled_at * 1000)
            : null,
          metadata: subscription.metadata as any,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          id: nanoid(),
          userId,
          status: subscription.status,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          trialStart: (subscription as any).trial_start
            ? new Date((subscription as any).trial_start * 1000)
            : null,
          trialEnd: (subscription as any).trial_end
            ? new Date((subscription as any).trial_end * 1000)
            : null,
          canceledAt: (subscription as any).canceled_at
            ? new Date((subscription as any).canceled_at * 1000)
            : null,
          metadata: subscription.metadata as any,
          updatedAt: new Date(),
        },
      });
    }

    // Update user plan based on subscription status
    const shouldHavePremiumAccess =
      subscription.status === "active" || subscription.status === "trialing";

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: shouldHavePremiumAccess ? plan : "free",
      },
    });

    log.info(
      {
        userId,
        plan: shouldHavePremiumAccess ? plan : "free",
        status: subscription.status,
      },
      "Subscription synced successfully"
    );
  } catch (error) {
    log.error(
      { err: error, subscriptionId: subscription.id },
      "Error syncing subscription"
    );
    throw error;
  }
}

/** Handles subscription cancellation */
export async function handleSubscriptionCancellation(
  subscription: Stripe.Subscription
): Promise<void> {
  try {
    const userId = subscription.metadata.userId;

    if (!userId) {
      log.error(
        { subscriptionId: subscription.id },
        "Cancelled subscription missing userId"
      );
      return;
    }

    log.info(
      {
        subscriptionId: subscription.id,
        userId,
      },
      "Handling subscription cancellation"
    );

    // Update subscription in DB
    // NOTE: This code is Stripe legacy. The system now uses Paddle/MercadoPago
    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId },
    });

    if (existingSubscription) {
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: "cancelled",
          canceledAt: new Date(),
        },
      });
    }

    // Downgrade a free
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "free",
      },
    });

    log.info({ userId }, "User downgraded to free plan");
  } catch (error) {
    log.error(
      { err: error, subscriptionId: subscription.id },
      "Error handling cancellation"
    );
    throw error;
  }
}

/** Handles successful subscription renewal */
export async function handleSubscriptionRenewal(
  invoice: Stripe.Invoice
): Promise<void> {
  try {
    const subscriptionId = (invoice as any).subscription as string;
    const userId = invoice.metadata?.userId;

    if (!userId) {
      log.warn({ invoiceId: invoice.id }, "Invoice missing userId metadata");
      return;
    }

    log.info(
      {
        invoiceId: invoice.id,
        subscriptionId,
        userId,
      },
      "Handling subscription renewal"
    );

    // Registrar el pago en BD
    // NOTE: This code is Stripe legacy. The system now uses Paddle/MercadoPago
    await prisma.invoice.create({
      data: {
        id: nanoid(),
        userId,
        mercadopagoPaymentId: invoice.id, // Usar el campo correcto
        amount: (invoice as any).amount_paid,
        currency: invoice.currency,
        status: "paid",
        paidAt: (invoice as any).status_transitions?.paid_at
          ? new Date((invoice as any).status_transitions.paid_at * 1000)
          : new Date(),
      },
    });

    log.info({ userId, amount: (invoice as any).amount_paid }, "Renewal invoice created");
  } catch (error) {
    log.error({ err: error, invoiceId: invoice.id }, "Error handling renewal");
    throw error;
  }
}

/**
 * Maneja fallo de pago
 */
export async function handlePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  try {
    const userId = invoice.metadata?.userId;
    const subscriptionId = (invoice as any).subscription as string;

    if (!userId) {
      log.warn({ invoiceId: invoice.id }, "Failed invoice missing userId");
      return;
    }

    log.warn(
      {
        invoiceId: invoice.id,
        subscriptionId,
        userId,
        attempt: (invoice as any).attempt_count,
      },
      "Payment failed"
    );

    // Registrar el intento fallido
    // NOTE: This code is Stripe legacy. The system now uses Paddle/MercadoPago
    await prisma.invoice.create({
      data: {
        id: nanoid(),
        userId,
        mercadopagoPaymentId: invoice.id, // Usar el campo correcto
        amount: (invoice as any).amount_due,
        currency: invoice.currency,
        status: "payment_failed",
        statusDetail: `Attempt ${(invoice as any).attempt_count}: Payment failed`,
      },
    });

    // Si ya hubo 3 intentos fallidos, considerar suspender
    if ((invoice as any).attempt_count && (invoice as any).attempt_count >= 3) {
      log.error(
        { userId, subscriptionId },
        "Payment failed 3 times - subscription will be cancelled by Stripe"
      );
      // Stripe automatically cancels after 3 failures, we only log
    }
  } catch (error) {
    log.error(
      { err: error, invoiceId: invoice.id },
      "Error handling payment failure"
    );
    throw error;
  }
}

/** Detects the type of change in a subscription (upgrade/downgrade/reactivation) */
export function detectSubscriptionChange(
  oldSubscription: Stripe.Subscription | null,
  newSubscription: Stripe.Subscription
): "upgrade" | "downgrade" | "reactivation" | "changed" | null {
  if (!oldSubscription) {
    return null; // Nueva suscripción
  }

  // Reactivation of canceled subscription
  if (
    oldSubscription.status === "canceled" &&
    newSubscription.status === "active"
  ) {
    return "reactivation";
  }

  // Cambio de precio (upgrade/downgrade)
  const oldPriceId = oldSubscription.items.data[0]?.price.id;
  const newPriceId = newSubscription.items.data[0]?.price.id;

  if (oldPriceId !== newPriceId) {
    const oldPlan = oldPriceId ? getPlanFromPriceId(oldPriceId) : null;
    const newPlan = newPriceId ? getPlanFromPriceId(newPriceId) : null;

    if (oldPlan === "plus" && newPlan === "ultra") {
      return "upgrade";
    }
    if (oldPlan === "ultra" && newPlan === "plus") {
      return "downgrade";
    }
  }

  return "changed";
}
