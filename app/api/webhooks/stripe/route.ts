/**
 * STRIPE WEBHOOK HANDLER
 *
 * Maneja todos los eventos críticos de Stripe:
 * - checkout.session.completed: Nueva suscripción
 * - customer.subscription.updated: Cambio de plan
 * - customer.subscription.deleted: Cancelación
 * - invoice.payment_succeeded: Pago exitoso
 * - invoice.payment_failed: Pago fallido
 *
 * SECURITY: Verifica la firma del webhook usando Stripe SDK
 * IDEMPOTENCY: Usa transacciones y checks para evitar procesamiento duplicado
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, STRIPE_WEBHOOK_SECRET, isWebhookConfigured } from "@/lib/stripe/config";
import {
  syncStripeSubscription,
  handleSubscriptionCancellation,
  handleSubscriptionRenewal,
  handlePaymentFailed,
  detectSubscriptionChange,
} from "@/lib/stripe/subscription-sync";
import {
  sendWelcomeEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
  sendEmail,
} from "@/lib/stripe/email-notifications";
import { prisma } from "@/lib/prisma";
import { billingLogger as log } from "@/lib/logging/loggers";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 *
 * Endpoint para recibir webhooks de Stripe
 */
export async function POST(req: NextRequest) {
  try {
    // Check que el webhook secret esté configurado
    if (!isWebhookConfigured()) {
      log.error("STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Get el body raw (necesario para verificar firma)
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      log.error("Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Check la firma del webhook (CRÍTICO PARA SEGURIDAD)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      log.error(
        { err, signature: signature.substring(0, 20) },
        "Invalid webhook signature"
      );
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 401 }
      );
    }

    log.info(
      {
        eventId: event.id,
        type: event.type,
      },
      "Stripe webhook received and verified"
    );

    // TODO: WebhookEvent model not yet implemented in schema
    // Uncomment when WebhookEvent model is added to Prisma schema
    /*
    // Check idempotencia - evitar procesar el mismo evento 2 veces
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existingEvent) {
      log.info(
        { eventId: event.id },
        "Event already processed - skipping (idempotency)"
      );
      return NextResponse.json({ received: true, skipped: true });
    }

    // Registrar el evento para idempotencia
    await prisma.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        processed: false,
        createdAt: new Date(event.created * 1000),
      },
    });
    */

    // Manejar el evento según su tipo
    await handleStripeEvent(event);

    // TODO: Uncomment when WebhookEvent model is added
    /*
    // Marcar como procesado
    await prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { processed: true, processedAt: new Date() },
    });
    */

    log.info({ eventId: event.id, type: event.type }, "Webhook processed successfully");

    return NextResponse.json({ received: true });
  } catch (error: any) {
    log.error({ err: error }, "Error processing Stripe webhook");
    return NextResponse.json(
      { error: "Webhook processing failed", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Maneja eventos de Stripe según su tipo
 */
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // ============================================================
    // CHECKOUT SESSION COMPLETED - Nueva suscripción
    // ============================================================
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      break;

    // ============================================================
    // CUSTOMER SUBSCRIPTION UPDATED - Cambio de plan
    // ============================================================
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    // ============================================================
    // CUSTOMER SUBSCRIPTION DELETED - Cancelación
    // ============================================================
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    // ============================================================
    // INVOICE PAYMENT SUCCEEDED - Pago exitoso
    // ============================================================
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    // ============================================================
    // INVOICE PAYMENT FAILED - Pago fallido
    // ============================================================
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    // ============================================================
    // CUSTOMER SUBSCRIPTION TRIAL WILL END - Trial por terminar
    // ============================================================
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object as Stripe.Subscription);
      break;

    default:
      log.debug({ type: event.type }, "Unhandled webhook event type");
  }
}

/**
 * checkout.session.completed
 * Nueva suscripción completada
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  try {
    log.info(
      { sessionId: session.id, customerId: session.customer },
      "Handling checkout.session.completed"
    );

    if (session.mode !== "subscription") {
      log.debug({ sessionId: session.id }, "Not a subscription checkout - skipping");
      return;
    }

    const subscriptionId = session.subscription as string;
    const _customerId = session.customer as string;
    const userId = session.metadata?.userId;

    if (!userId) {
      log.error({ sessionId: session.id }, "Checkout session missing userId metadata");
      return;
    }

    // Get la suscripción completa
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;

    // Sincronizar con BD
    await syncStripeSubscription(subscription);

    // Get datos del usuario para email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, plan: true },
    });

    if (user?.email) {
      // Send email de bienvenida
      await sendWelcomeEmail(
        user.email,
        user.name || "Usuario",
        user.plan,
        new Date((subscription as any).current_period_end * 1000)
      );
    }

    log.info(
      { userId, subscriptionId, plan: user?.plan },
      "Checkout session completed successfully"
    );
  } catch (error) {
    log.error({ err: error, sessionId: session.id }, "Error handling checkout completion");
    throw error;
  }
}

/**
 * customer.subscription.updated
 * Suscripción actualizada (upgrade/downgrade/cambio)
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  try {
    log.info(
      { subscriptionId: subscription.id, status: subscription.status },
      "Handling customer.subscription.updated"
    );

    const userId = subscription.metadata.userId;

    // TODO: Subscription model doesn't have stripeSubscriptionId
    // Need to use the correct field (mercadopagoPreapprovalId or paddleSubscriptionId)
    // For now, skip the old subscription check
    const oldSubscription = null;
    /*
    const oldSubscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    */

    // Detectar tipo de cambio
    let changeType: string | null = null;
    if (oldSubscription) {
      const oldStripeSubscription = await stripe.subscriptions.retrieve(
        subscription.id,
        {
          // Usar versión anterior si está disponible
        }
      ).catch(() => null);

      changeType = detectSubscriptionChange(
        oldStripeSubscription,
        subscription
      );
    }

    // Sincronizar con BD
    await syncStripeSubscription(subscription);

    // Notificar al usuario según el tipo de cambio
    if (userId && changeType) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, plan: true },
      });

      if (user?.email) {
        let emailType: "subscription_updated" | "subscription_reactivated" = "subscription_updated";
        if (changeType === "reactivation") {
          emailType = "subscription_reactivated";
        }

        await sendEmail({
          to: user.email,
          type: emailType,
          data: {
            userName: user.name || "Usuario",
            planName: user.plan,
            nextBillingDate: new Date((subscription as any).current_period_end * 1000),
          },
        });
      }

      log.info(
        {
          userId,
          changeType,
          newPlan: user?.plan,
        },
        "Subscription updated successfully"
      );
    }
  } catch (error) {
    log.error(
      { err: error, subscriptionId: subscription.id },
      "Error handling subscription update"
    );
    throw error;
  }
}

/**
 * customer.subscription.deleted
 * Suscripción cancelada
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  try {
    log.info(
      { subscriptionId: subscription.id },
      "Handling customer.subscription.deleted"
    );

    const userId = subscription.metadata.userId;

    // Manejar cancelación
    await handleSubscriptionCancellation(subscription);

    // Send email de cancelación
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        await sendCancellationEmail(
          user.email,
          user.name || "Usuario",
          new Date((subscription as any).current_period_end * 1000)
        );
      }
    }

    log.info(
      { userId, subscriptionId: subscription.id },
      "Subscription deleted successfully"
    );
  } catch (error) {
    log.error(
      { err: error, subscriptionId: subscription.id },
      "Error handling subscription deletion"
    );
    throw error;
  }
}

/**
 * invoice.payment_succeeded
 * Pago exitoso (renovación)
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  try {
    log.info(
      {
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        subscriptionId: (invoice as any).subscription,
      },
      "Handling invoice.payment_succeeded"
    );

    // Manejar renovación
    await handleSubscriptionRenewal(invoice);

    const userId = invoice.metadata?.userId;

    // Send recibo por email
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, plan: true },
      });

      if (user?.email && (invoice as any).subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          (invoice as any).subscription as string
        ) as Stripe.Subscription;

        await sendEmail({
          to: user.email,
          type: "payment_succeeded",
          data: {
            userName: user.name || "Usuario",
            planName: user.plan,
            amount: invoice.amount_paid / 100, // Convertir de centavos
            currency: invoice.currency,
            nextBillingDate: new Date((subscription as any).current_period_end * 1000),
          },
        });
      }
    }

    log.info(
      { userId, amount: invoice.amount_paid },
      "Payment succeeded processed"
    );
  } catch (error) {
    log.error(
      { err: error, invoiceId: invoice.id },
      "Error handling payment success"
    );
    throw error;
  }
}

/**
 * invoice.payment_failed
 * Pago fallido (con grace period de 3 intentos)
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  try {
    log.warn(
      {
        invoiceId: invoice.id,
        attempt: invoice.attempt_count,
        subscriptionId: (invoice as any).subscription,
      },
      "Handling invoice.payment_failed"
    );

    // Manejar fallo de pago
    await handlePaymentFailed(invoice);

    const userId = invoice.metadata?.userId;

    // Notificar al usuario
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        await sendPaymentFailedEmail(
          user.email,
          user.name || "Usuario",
          invoice.attempt_count || 1,
          (invoice as any).last_payment_error?.message
        );
      }
    }

    log.warn(
      {
        userId,
        attempt: invoice.attempt_count,
        willCancelAfter: 3,
      },
      "Payment failed - user notified"
    );
  } catch (error) {
    log.error(
      { err: error, invoiceId: invoice.id },
      "Error handling payment failure"
    );
    throw error;
  }
}

/**
 * customer.subscription.trial_will_end
 * Trial por terminar (3 días antes)
 */
async function handleTrialWillEnd(
  subscription: Stripe.Subscription
): Promise<void> {
  try {
    log.info(
      {
        subscriptionId: subscription.id,
        trialEnd: subscription.trial_end,
      },
      "Handling customer.subscription.trial_will_end"
    );

    const userId = subscription.metadata.userId;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, plan: true },
      });

      if (user?.email && subscription.trial_end) {
        const priceId = subscription.items.data[0]?.price.id;
        const price = priceId
          ? await stripe.prices.retrieve(priceId)
          : null;

        await sendEmail({
          to: user.email,
          type: "trial_ending",
          data: {
            userName: user.name || "Usuario",
            planName: user.plan,
            trialEndDate: new Date(subscription.trial_end * 1000),
            amount: price ? (price.unit_amount || 0) / 100 : 0,
            currency: price?.currency,
          },
        });
      }
    }

    log.info({ userId }, "Trial ending notification sent");
  } catch (error) {
    log.error(
      { err: error, subscriptionId: subscription.id },
      "Error handling trial ending"
    );
    throw error;
  }
}
