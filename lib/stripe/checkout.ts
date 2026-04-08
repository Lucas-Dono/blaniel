/**
 * STRIPE CHECKOUT CREATION
 *
 * Crea sesiones de checkout de Stripe para suscripciones
 */

import { stripe, STRIPE_PLANS } from "./config";
import { billingLogger as log } from "@/lib/logging/loggers";
import type Stripe from "stripe";

export type StripePlan = "plus" | "ultra";
export type StripeBillingInterval = "monthly" | "yearly";

interface CreateCheckoutSessionParams {
  userId: string;
  email: string;
  planId: StripePlan;
  billingInterval?: StripeBillingInterval;
  successUrl?: string;
  cancelUrl?: string;
  trialDays?: number;
}

/**
 * Crea una sesión de checkout de Stripe
 */
export async function createStripeCheckoutSession({
  userId,
  email,
  planId,
  billingInterval = "monthly",
  successUrl,
  cancelUrl,
  trialDays,
}: CreateCheckoutSessionParams): Promise<string> {
  try {
    log.info(
      { userId, planId, billingInterval },
      "Creating Stripe checkout session"
    );

    // Get Price ID according to plan and period
    const priceId = STRIPE_PLANS[planId][billingInterval];

    if (!priceId) {
      throw new Error(
        `Price ID not configured for plan: ${planId} (${billingInterval})`
      );
    }

    // URLs de redirect (con fallbacks)
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const success_url =
      successUrl || `${baseUrl}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = cancelUrl || `${baseUrl}/dashboard/billing/plans`;

    // Configurar la sesión de checkout
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url,
      cancel_url,
      metadata: {
        userId,
        planId,
        billingInterval,
      },
      subscription_data: {
        metadata: {
          userId,
          planId,
          billingInterval,
        },
      },
      // Permitir códigos promocionales
      allow_promotion_codes: true,
      // Billing address collection
      billing_address_collection: "auto",
      // Customer creation
      customer_creation: "always",
    };

    // Agregar trial si se especifica
    if (trialDays && trialDays > 0) {
      sessionConfig.subscription_data = {
        ...sessionConfig.subscription_data,
        trial_period_days: trialDays,
      };
      log.info({ trialDays }, "Trial period added to subscription");
    }

    // Create la sesión
    const session = await stripe.checkout.sessions.create(sessionConfig);

    log.info(
      {
        userId,
        sessionId: session.id,
        priceId,
      },
      "Stripe checkout session created successfully"
    );

    if (!session.url) {
      throw new Error("Checkout session created but URL is missing");
    }

    return session.url;
  } catch (error: any) {
    log.error(
      {
        err: error,
        userId,
        planId,
        billingInterval,
      },
      "Error creating Stripe checkout session"
    );
    throw new Error(
      `Failed to create Stripe checkout: ${error.message || "Unknown error"}`
    );
  }
}

/**
 * Crea un portal de gestión de suscripción
 * Permite al usuario:
 * - Cambiar método de pago
 * - Ver facturas
 * - Cancelar suscripción
 * - Actualizar información de billing
 */
export async function createStripePortalSession(
  customerId: string,
  returnUrl?: string
): Promise<string> {
  try {
    log.info({ customerId }, "Creating Stripe portal session");

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const return_url = returnUrl || `${baseUrl}/dashboard/billing`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });

    log.info(
      { customerId, sessionId: session.id },
      "Stripe portal session created"
    );

    return session.url;
  } catch (error: any) {
    log.error(
      { err: error, customerId },
      "Error creating Stripe portal session"
    );
    throw new Error(
      `Failed to create Stripe portal: ${error.message || "Unknown error"}`
    );
  }
}

/**
 * Helper para obtener información de precios
 */
export function getStripePriceInfo(planId: StripePlan, interval: StripeBillingInterval) {
  const prices = {
    plus: {
      monthly: { amount: 5, currency: "USD" },
      yearly: { amount: 48, currency: "USD" }, // 20% descuento
    },
    ultra: {
      monthly: { amount: 15, currency: "USD" },
      yearly: { amount: 144, currency: "USD" }, // 20% descuento
    },
  };

  return prices[planId][interval];
}
