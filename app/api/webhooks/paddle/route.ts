/**
 * Webhook Handler para Paddle
 *
 * Maneja eventos de suscripciones y transacciones desde Paddle:
 * - subscription.created: Nueva suscripción creada
 * - subscription.updated: Suscripción actualizada
 * - subscription.canceled: Suscripción cancelada
 * - subscription.resumed: Suscripción reactivada
 * - subscription.past_due: Pago vencido
 * - subscription.paused: Suscripción pausada
 * - transaction.completed: Transacción completada
 * - transaction.payment_failed: Pago fallido
 *
 * Documentación: https://developer.paddle.com/webhooks/overview
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { billingLogger as log } from "@/lib/logging/loggers";
import crypto from "crypto";
import {
  sendSubscriptionWelcomeEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendCancellationEmail,
  sendReactivationEmail,
} from "@/lib/email/subscription-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifica la firma del webhook de Paddle
 * Documentación: https://developer.paddle.com/webhooks/signature-verification
 */
function verifyPaddleSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get("Paddle-Signature");

  if (!signature) {
    log.error("Missing Paddle-Signature header in webhook");
    return false;
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    log.error("PADDLE_WEBHOOK_SECRET not configured");
    return false;
  }

  try {
    // Paddle envía: ts=timestamp;h1=signature
    const parts = signature.split(";");
    const tsMatch = parts.find((p) => p.startsWith("ts="));
    const h1Match = parts.find((p) => p.startsWith("h1="));

    if (!tsMatch || !h1Match) {
      log.error({ signature }, "Invalid Paddle signature format");
      return false;
    }

    const timestamp = tsMatch.replace("ts=", "");
    const receivedSignature = h1Match.replace("h1=", "");

    // Check que el timestamp no sea muy antiguo (5 minutos)
    const requestTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - requestTime > 300) {
      log.warn(
        {
          timestamp: requestTime,
          age: currentTime - requestTime,
        },
        "Webhook signature timestamp too old"
      );
      return false;
    }

    // Construir el payload firmado: timestamp:body
    const signedPayload = `${timestamp}:${body}`;

    // Calcular HMAC-SHA256
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(computedSignature)
    );

    if (!isValid) {
      log.error(
        {
          expected: computedSignature.substring(0, 20) + "...",
          received: receivedSignature.substring(0, 20) + "...",
        },
        "Paddle webhook signature verification failed"
      );
    }

    return isValid;
  } catch (error) {
    log.error({ err: error }, "Error verifying Paddle signature");
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    log.info("Paddle webhook received");

    // Check firma
    if (!verifyPaddleSignature(req, bodyText)) {
      log.warn("Invalid signature - rejecting Paddle webhook");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
    const { event_type, data } = body;

    if (!event_type || !data) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    log.info(
      {
        event: event_type,
        id: data.id,
      },
      "Processing Paddle webhook event"
    );

    // Get userId del customData
    const userId = data.custom_data?.userId || data.custom_data?.user_id;
    if (!userId) {
      log.warn({ event: event_type }, "Missing userId in webhook data");
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Manejar eventos
    switch (event_type) {
      case "subscription.created":
        await handleSubscriptionCreated(userId, data);
        break;

      case "subscription.updated":
        await handleSubscriptionUpdated(userId, data);
        break;

      case "subscription.canceled":
        await handleSubscriptionCanceled(userId, data);
        break;

      case "subscription.resumed":
        await handleSubscriptionResumed(userId, data);
        break;

      case "subscription.past_due":
        await handleSubscriptionPastDue(userId, data);
        break;

      case "subscription.paused":
        await handleSubscriptionPaused(userId, data);
        break;

      case "transaction.completed":
        await handleTransactionCompleted(userId, data);
        break;

      case "transaction.payment_failed":
        await handleTransactionPaymentFailed(userId, data);
        break;

      default:
        log.warn({ event: event_type }, "Unhandled Paddle webhook event");
    }

    log.info(
      {
        event: event_type,
        id: data.id,
      },
      "Paddle webhook processed successfully"
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ err: error }, "Error processing Paddle webhook");
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCreated(userId: string, data: any) {
  const subscriptionId = data.id;
  const status = data.status; // "active", "trialing", "past_due", "paused", "canceled"
  const currentPeriodEnd = data.current_billing_period?.ends_at
    ? new Date(data.current_billing_period.ends_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 días

  log.info(
    {
      userId,
      subscriptionId,
      status,
    },
    "Subscription created"
  );

  // Determinar planId desde custom_data
  const planId = data.custom_data?.planId || "plus";

  // Create suscripción en la base de datos
  await prisma.subscription.upsert({
    where: { paddleSubscriptionId: subscriptionId },
    create: {
      id: nanoid(),
      updatedAt: new Date(),
      userId,
      paddleSubscriptionId: subscriptionId,
      status: mapPaddleStatus(status),
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
    update: {
      status: mapPaddleStatus(status),
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
  });

  // Update plan del usuario
  await prisma.user.update({
    where: { id: userId },
    data: { plan: planId },
  });

  // Send email de bienvenida
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email && (status === "active" || status === "trialing")) {
    await sendSubscriptionWelcomeEmail(
      { email: user.email, name: user.name },
      {
        planId,
        currentPeriodEnd,
      }
    );
  }
}

async function handleSubscriptionUpdated(userId: string, data: any) {
  const subscriptionId = data.id;
  const status = data.status;
  const currentPeriodEnd = data.current_billing_period?.ends_at
    ? new Date(data.current_billing_period.ends_at)
    : new Date();

  log.info(
    {
      userId,
      subscriptionId,
      status,
    },
    "Subscription updated"
  );

  await prisma.subscription.update({
    where: { paddleSubscriptionId: subscriptionId },
    data: {
      status: mapPaddleStatus(status),
      currentPeriodEnd,
      cancelAtPeriodEnd: data.scheduled_change?.action === "cancel",
    },
  });
}

async function handleSubscriptionCanceled(userId: string, data: any) {
  const subscriptionId = data.id;
  const currentPeriodEnd = data.current_billing_period?.ends_at
    ? new Date(data.current_billing_period.ends_at)
    : new Date();

  log.info(
    {
      userId,
      subscriptionId,
    },
    "Subscription canceled"
  );

  await prisma.subscription.update({
    where: { paddleSubscriptionId: subscriptionId },
    data: {
      status: "cancelled",
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    },
  });

  // Send email de cancelación
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true },
  });

  if (user?.email) {
    await sendCancellationEmail(
      { email: user.email, name: user.name },
      {
        planId: user.plan,
        currentPeriodEnd,
      }
    );
  }
}

async function handleSubscriptionResumed(userId: string, data: any) {
  const subscriptionId = data.id;
  const currentPeriodEnd = data.current_billing_period?.ends_at
    ? new Date(data.current_billing_period.ends_at)
    : new Date();

  log.info(
    {
      userId,
      subscriptionId,
    },
    "Subscription resumed"
  );

  await prisma.subscription.update({
    where: { paddleSubscriptionId: subscriptionId },
    data: {
      status: "active",
      cancelAtPeriodEnd: false,
    },
  });

  // Send email de reactivación
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true },
  });

  if (user?.email) {
    await sendReactivationEmail(
      { email: user.email, name: user.name },
      {
        planId: user.plan,
        currentPeriodEnd,
      }
    );
  }
}

async function handleSubscriptionPastDue(userId: string, data: any) {
  const subscriptionId = data.id;

  log.warn(
    {
      userId,
      subscriptionId,
    },
    "Subscription past due"
  );

  await prisma.subscription.update({
    where: { paddleSubscriptionId: subscriptionId },
    data: {
      status: "past_due",
    },
  });

  // TODO: Enviar email notificando pago vencido
}

async function handleSubscriptionPaused(userId: string, data: any) {
  const subscriptionId = data.id;

  log.info(
    {
      userId,
      subscriptionId,
    },
    "Subscription paused"
  );

  await prisma.subscription.update({
    where: { paddleSubscriptionId: subscriptionId },
    data: {
      status: "past_due", // Usamos past_due para pausadas también
    },
  });
}

async function handleTransactionCompleted(userId: string, data: any) {
  const transactionId = data.id;
  const subscriptionId = data.subscription_id;

  log.info(
    {
      userId,
      transactionId,
      subscriptionId,
      amount: data.details?.totals?.total,
    },
    "Transaction completed"
  );

  // Send email de confirmación de pago
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true },
  });

  if (user?.email && subscriptionId) {
    const subscription = await prisma.subscription.findUnique({
      where: { paddleSubscriptionId: subscriptionId },
    });

    if (subscription) {
      await sendPaymentSuccessEmail(
        { email: user.email, name: user.name },
        {
          amount: parseInt(data.details?.totals?.total || "0") / 100, // Convertir centavos a dólares
          currency: data.currency_code || "USD",
          paymentMethod: "Card",
        },
        {
          planId: user.plan,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      );
    }
  }
}

async function handleTransactionPaymentFailed(userId: string, data: any) {
  const transactionId = data.id;

  log.warn(
    {
      userId,
      transactionId,
      amount: data.details?.totals?.total,
    },
    "Transaction payment failed"
  );

  // Send email de fallo de pago
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email) {
    await sendPaymentFailedEmail(
      { email: user.email, name: user.name },
      {
        amount: parseInt(data.details?.totals?.total || "0") / 100,
        currency: data.currency_code || "USD",
      }
    );
  }
}

/**
 * Mapea estados de Paddle a nuestro sistema
 */
function mapPaddleStatus(
  paddleStatus: string
): "active" | "cancelled" | "past_due" | "expired" {
  switch (paddleStatus) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
      return "cancelled";
    case "past_due":
    case "paused":
      return "past_due";
    default:
      return "active";
  }
}
