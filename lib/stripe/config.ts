/**
 * STRIPE CONFIGURATION
 *
 * Configures Stripe client and defines plan prices
 */

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not found in environment variables. Stripe features will be disabled.");
}

// Lazy-initialize Stripe client to avoid build errors when API key is missing
let _stripe: Stripe | null = null;
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    if (!_stripe && process.env.STRIPE_SECRET_KEY) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-10-29.clover", // Latest stable version
        typescript: true,
        appInfo: {
          name: "Blaniel",
          version: "1.0.0",
        },
      });
    }
    if (!_stripe) {
      throw new Error('Stripe client not initialized - STRIPE_SECRET_KEY is missing');
    }
    return Reflect.get(_stripe, prop);
  }
});

// Webhook signing secret (critical for security)
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// Stripe price IDs (configurable via environment)
export const STRIPE_PLANS = {
  plus: {
    monthly: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID || "",
    yearly: process.env.STRIPE_PLUS_YEARLY_PRICE_ID || "",
  },
  ultra: {
    monthly: process.env.STRIPE_ULTRA_MONTHLY_PRICE_ID || "",
    yearly: process.env.STRIPE_ULTRA_YEARLY_PRICE_ID || "",
  },
} as const;

// Mapping of Price ID to Plan
export function getPlanFromPriceId(priceId: string): "plus" | "ultra" | null {
  if (
    priceId === STRIPE_PLANS.plus.monthly ||
    priceId === STRIPE_PLANS.plus.yearly
  ) {
    return "plus";
  }
  if (
    priceId === STRIPE_PLANS.ultra.monthly ||
    priceId === STRIPE_PLANS.ultra.yearly
  ) {
    return "ultra";
  }
  return null;
}

// Helper to check if webhook secret is configured
export function isWebhookConfigured(): boolean {
  return STRIPE_WEBHOOK_SECRET !== "";
}

// Useful types
export type StripePlan = keyof typeof STRIPE_PLANS;
export type StripeBillingInterval = "monthly" | "yearly";
