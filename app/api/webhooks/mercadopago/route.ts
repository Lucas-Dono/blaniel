import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { preApprovalClient, paymentClient } from "@/lib/mercadopago/config";
import { syncSubscription } from "@/lib/mercadopago/subscription";
import { prisma } from "@/lib/prisma";
import { billingLogger as log } from "@/lib/logging/loggers";
import crypto from "crypto";
import {
  sendSubscriptionWelcomeEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendCancellationEmail,
} from "@/lib/email/subscription-emails";
import { trackEvent, EventType } from "@/lib/analytics/kpi-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SECURITY FIX #2: Verificar firma x-signature de MercadoPago
 * Previene webhooks falsos y ataques de replay
 */
function verifyMercadoPagoSignature(req: NextRequest, body: string): boolean {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    log.error('Missing x-signature or x-request-id headers in webhook');
    return false;
  }

  // MercadoPago sends: ts=timestamp,v1=hash
  const parts = xSignature.split(",");
  const tsMatch = parts.find(p => p.startsWith("ts="));
  const v1Match = parts.find(p => p.startsWith("v1="));

  if (!tsMatch || !v1Match) {
    log.error({ xSignature }, 'Invalid x-signature format');
    return false;
  }

  const timestamp = tsMatch.replace("ts=", "");
  const receivedHash = v1Match.replace("v1=", "");

  // Check que el timestamp no sea muy antiguo (5 minutos)
  const requestTime = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - requestTime > 300) {
    log.warn({
      timestamp: requestTime,
      age: currentTime - requestTime
    }, 'Webhook signature timestamp too old');
    return false;
  }

  // Build the manifest according to the MercadoPago specification
  // Format: id;request-id;ts;
  const dataId = JSON.parse(body).data?.id || "";
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;

  // Calcular HMAC-SHA256
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    log.error('MERCADOPAGO_WEBHOOK_SECRET not configured');
    return false;
  }

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const isValid = computedHash === receivedHash;

  if (!isValid) {
    log.error({
      expected: computedHash.substring(0, 20) + '...',
      received: receivedHash.substring(0, 20) + '...',
      manifest
    }, 'Webhook signature verification failed');
  }

  return isValid;
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    log.info('MercadoPago webhook received');

    // SECURITY FIX #2: Verificar firma antes de procesar
    if (!verifyMercadoPagoSignature(req, bodyText)) {
      log.warn('Invalid signature - rejecting webhook');
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const body = JSON.parse(bodyText);
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    log.info({ type, dataId: data.id }, 'Processing webhook event');

    switch (type) {
      case "preapproval":
        await handlePreApprovalEvent(data.id);
        break;

      case "payment":
        await handlePaymentEvent(data.id);
        break;

      case "subscription_preapproval":
        await handleSubscriptionEvent(data.id);
        break;

      case "topic_claims_integration_wh":
        await handleClaimEvent(data.id);
        break;

      default:
        log.warn({ type }, 'Unhandled webhook type');
    }

    log.info({ type, dataId: data.id }, 'Webhook processed successfully');
    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ err: error }, 'Error processing MercadoPago webhook');
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handlePreApprovalEvent(preapprovalId: string) {
  try {
    log.debug({ preapprovalId }, 'Fetching pre-approval details');
    const preapproval = await preApprovalClient.get({ id: preapprovalId });

    log.info({
      preapprovalId,
      status: preapproval.status,
      userId: preapproval.external_reference
    }, 'PreApproval event received');

    // Synchronize subscription with the database
    await syncSubscription(preapproval);

    const userId = preapproval.external_reference;
    if (!userId) {
      log.warn({ preapprovalId }, 'PreApproval missing external_reference (userId)');
      return;
    }

    // Get user and subscription information for notifications
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, plan: true },
    });

    if (!user) {
      log.warn({ userId }, 'User not found for preapproval event');
      return;
    }

    const subscription = await prisma.subscription.findUnique({
      where: { mercadopagoPreapprovalId: preapprovalId },
    });

    // Handle different subscription states
    switch (preapproval.status) {
      case "authorized":
        // Active and paid subscription
        log.info({ userId, preapprovalId }, 'Subscription authorized - user upgraded');

        // TRACKING: Subscription Started (Fase 6 - Monetization)
        try {
          // Check if this is a new subscription (not a renewal)
          const previousSubscriptions = await prisma.subscription.count({
            where: {
              userId,
              createdAt: {
                lt: subscription?.createdAt || new Date(),
              },
            },
          });

          if (previousSubscriptions === 0) {
            // This is the first subscription for this user
            await trackEvent(EventType.SUBSCRIPTION_STARTED, {
              userId,
              plan: user.plan || "unknown",
              previousPlan: "free",
              amount: preapproval.auto_recurring?.transaction_amount || 0,
              currency: preapproval.auto_recurring?.currency_id || "ARS",
            });
            log.info({ userId, plan: user.plan }, 'TRACKING: First subscription started event tracked');
          }
        } catch (trackError) {
          log.warn({ trackError }, 'Failed to track subscription started event');
        }

        // Send email de bienvenida
        if (subscription && user.email) {
          await sendSubscriptionWelcomeEmail(
            { email: user.email, name: user.name },
            {
              planId: user.plan,
              currentPeriodEnd: subscription.currentPeriodEnd,
            }
          );
        }
        break;

      case "paused":
        // Subscription paused by the user or due to lack of payment
        log.info({ userId, preapprovalId }, 'Subscription paused - keeping current plan');
        // TODO: Create email template for paused subscription
        break;

      case "cancelled":
        // Subscription cancelled - downgrade to free
        log.info({ userId, preapprovalId }, 'Subscription cancelled - downgrading to free plan');

        await prisma.user.update({
          where: { id: userId },
          data: { plan: "free" },
        });

        // Send cancellation email
        if (subscription && user.email) {
          await sendCancellationEmail(
            { email: user.email, name: user.name },
            {
              planId: user.plan,
              currentPeriodEnd: subscription.currentPeriodEnd,
            }
          );
        }
        break;

      default:
        log.warn({ status: preapproval.status, preapprovalId }, 'Unknown preapproval status');
    }
  } catch (error) {
    log.error({ err: error, preapprovalId }, 'Error handling preapproval event');
  }
}

async function handlePaymentEvent(paymentId: string) {
  try {
    log.debug({ paymentId }, 'Fetching payment details');
    const payment = await paymentClient.get({ id: paymentId });

    log.info({
      paymentId,
      status: payment.status,
      statusDetail: payment.status_detail,
      amount: payment.transaction_amount,
      userId: payment.external_reference
    }, 'Payment event received');

    if (!payment.external_reference) {
      log.warn({ paymentId }, 'Payment missing external_reference');
      return;
    }

    const userId = payment.external_reference;

    // Save o actualizar el pago en la base de datos
    await prisma.payment.upsert({
      where: { mercadopagoPaymentId: String(payment.id) },
      create: {
        id: nanoid(),
        userId,
        mercadopagoPaymentId: String(payment.id),
        amount: payment.transaction_amount || 0,
        currency: payment.currency_id || "ARS",
        status: payment.status || "pending",
        statusDetail: payment.status_detail || null,
        paymentMethod: payment.payment_type_id || null,
      },
      update: {
        status: payment.status || "pending",
        statusDetail: payment.status_detail || null,
      },
    });

    // Get user information for notifications
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, plan: true },
    });

    // Manejar diferentes estados del pago
    switch (payment.status) {
      case "approved":
        // Pago aprobado exitosamente
        log.info({
          userId,
          paymentId,
          amount: payment.transaction_amount
        }, 'Payment approved - creating invoice');

        if (payment.transaction_amount) {
          await prisma.invoice.create({
            data: {
              id: nanoid(),
              userId,
              mercadopagoPaymentId: String(payment.id),
              amount: payment.transaction_amount,
              currency: payment.currency_id || "ARS",
              status: "approved",
              paidAt: new Date(),
            },
          });
        }

        // TRACKING: Payment Succeeded (Fase 6 - Monetization)
        try {
          await trackEvent(EventType.PAYMENT_SUCCEEDED, {
            userId,
            amount: payment.transaction_amount || 0,
            currency: payment.currency_id || "ARS",
            paymentMethod: payment.payment_type_id || "unknown",
            plan: user?.plan || "free",
          });
          log.info({ userId, amount: payment.transaction_amount }, 'TRACKING: Payment succeeded event tracked');
        } catch (trackError) {
          log.warn({ trackError }, 'Failed to track payment succeeded event');
        }

        // Send payment confirmation email
        if (user && user.email && payment.transaction_amount) {
          const subscription = await prisma.subscription.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
          });

          if (subscription) {
            await sendPaymentSuccessEmail(
              { email: user.email, name: user.name },
              {
                amount: payment.transaction_amount,
                currency: payment.currency_id || "ARS",
                paymentMethod: payment.payment_type_id || "Tarjeta",
              },
              {
                planId: user.plan || "free",
                currentPeriodEnd: subscription.currentPeriodEnd,
              }
            );
          }
        }
        break;

      case "rejected":
        // Pago rechazado
        log.warn({
          userId,
          paymentId,
          statusDetail: payment.status_detail
        }, 'Payment rejected');

        // MercadoPago performs automatic retries based on configuration
        // Razones comunes: cc_rejected_insufficient_amount, cc_rejected_bad_filled_card_number, etc.

        // Send email notificando el rechazo
        if (user && user.email && payment.transaction_amount) {
          await sendPaymentFailedEmail(
            { email: user.email, name: user.name },
            {
              amount: payment.transaction_amount,
              currency: payment.currency_id || "ARS",
              statusDetail: payment.status_detail || undefined,
            }
          );
        }
        break;

      case "in_process":
        // Payment in process (common with methods like bank slip)
        log.info({ userId, paymentId }, 'Payment in process');
        // TODO: Crear template de email para pago en proceso
        break;

      case "pending":
        // Pago pendiente
        log.info({ userId, paymentId }, 'Payment pending');
        break;

      case "refunded":
        // Pago reembolsado
        log.info({ userId, paymentId }, 'Payment refunded');
        // TODO: Enviar email notificando el reembolso
        // await sendPaymentRefundedEmail(user.email, payment);
        break;

      case "charged_back":
        // Contracargo (chargeback)
        log.warn({ userId, paymentId }, 'Payment charged back');
        // TODO: Alertar al equipo de soporte
        // await notifySupportTeamChargeback(payment);
        break;

      default:
        log.warn({ status: payment.status, paymentId }, 'Unknown payment status');
    }
  } catch (error) {
    log.error({ err: error, paymentId }, 'Error handling payment event');
  }
}

async function handleSubscriptionEvent(subscriptionId: string) {
  try {
    log.debug({ subscriptionId }, 'Fetching subscription details');
    const preapproval = await preApprovalClient.get({ id: subscriptionId });

    log.info({
      subscriptionId,
      status: preapproval.status,
      userId: preapproval.external_reference
    }, 'Subscription event received');

    await syncSubscription(preapproval);
  } catch (error) {
    log.error({ err: error, subscriptionId }, 'Error handling subscription event');
  }
}

async function handleClaimEvent(claimId: string) {
  try {
    log.debug({ claimId }, 'Fetching claim details');

    // Consultar detalles del reclamo usando la API de MercadoPago
    const response = await fetch(
      `https://api.mercadopago.com/v1/claims/${claimId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch claim: ${response.statusText}`);
    }

    const claim = await response.json();

    log.info({
      claimId,
      type: claim.type,
      status: claim.status,
      amount: claim.amount,
    }, 'Claim event received');

    // Find the related payment to get the userId
    let userId: string | null = null;
    if (claim.payment_id) {
      const payment = await prisma.payment.findUnique({
        where: { mercadopagoPaymentId: String(claim.payment_id) },
        select: { userId: true },
      });
      userId = payment?.userId || null;
    }

    if (!userId) {
      log.warn({ claimId, paymentId: claim.payment_id }, 'Cannot find userId for claim');
      return;
    }

    // TODO: Implementar modelo Claim en Prisma schema si se necesita
    // Save o actualizar el reclamo en la base de datos
    // await prisma.claim.upsert({
    //   where: { mercadopagoClaimId: claimId },
    //   create: {
    //     mercadopagoClaimId: claimId,
    //     mercadopagoPaymentId: claim.payment_id ? String(claim.payment_id) : null,
    //     userId,
    //     type: claim.type || 'unknown',
    //     status: claim.status || 'opened',
    //     stage: claim.stage || null,
    //     amount: claim.amount || 0,
    //     currency: claim.currency_id || 'ARS',
    //     reason: claim.reason || null,
    //     claimDate: claim.date_created ? new Date(claim.date_created) : new Date(),
    //     resolutionDate: claim.resolution_date ? new Date(claim.resolution_date) : null,
    //     expirationDate: claim.expiration_date ? new Date(claim.expiration_date) : null,
    //     metadata: claim,
    //   },
    //   update: {
    //     status: claim.status || 'opened',
    //     stage: claim.stage || null,
    //     resolutionDate: claim.resolution_date ? new Date(claim.resolution_date) : null,
    //     metadata: claim,
    //   },
    // });

    log.info({ claimId, userId, status: claim.status }, 'Claim event received (not saved - Claim model not implemented)');

    // TODO: Send notification to the user about the claim
    // TODO: Enviar email al equipo de soporte
    // TODO: Crear alerta en el dashboard de admin

  } catch (error) {
    log.error({ err: error, claimId }, 'Error handling claim event');
  }
}
