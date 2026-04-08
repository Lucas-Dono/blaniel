/**
 * Configuración de Paddle
 *
 * Paddle es un Merchant of Record que maneja:
 * - Procesamiento de pagos global (245 territorios)
 * - Compliance y taxes automáticos
 * - Retiros a Argentina: Wire transfer, PayPal, Payoneer
 * - Confirmado funcionamiento en Argentina por usuarios reales
 *
 * Documentación: https://developer.paddle.com/
 */

import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { billingLogger as log } from "@/lib/logging/loggers";

let paddleClient: Paddle | null = null;

/**
 * Obtiene o crea la instancia de Paddle
 */
export function getPaddleClient(): Paddle {
  if (paddleClient) {
    return paddleClient;
  }

  const apiKey = process.env.PADDLE_API_KEY;

  if (!apiKey) {
    log.error("PADDLE_API_KEY not configured");
    throw new Error("Paddle not configured");
  }

  // Usar sandbox en desarrollo, production en producción
  const environment =
    process.env.NODE_ENV === "production" ? Environment.production : Environment.sandbox;

  paddleClient = new Paddle(apiKey, {
    environment,
  });

  log.info({ environment }, "Paddle client configured");

  return paddleClient;
}

/**
 * IDs de productos y precios en Paddle
 * Obtener de: https://vendors.paddle.com/products
 */
export const PADDLE_CONFIG = {
  // IDs de precios para cada plan (obtener de Paddle dashboard)
  prices: {
    plus_monthly: process.env.PADDLE_PLUS_MONTHLY_PRICE_ID || "",
    plus_yearly: process.env.PADDLE_PLUS_YEARLY_PRICE_ID || "",
    ultra_monthly: process.env.PADDLE_ULTRA_MONTHLY_PRICE_ID || "",
    ultra_yearly: process.env.PADDLE_ULTRA_YEARLY_PRICE_ID || "",
  },
} as const;

/**
 * Mapeo de planes internos a precios de Paddle
 */
export function getPaddlePriceId(
  planId: string,
  interval: "month" | "year" = "month"
): string {
  const key = `${planId}_${interval}ly` as keyof typeof PADDLE_CONFIG.prices;
  const priceId = PADDLE_CONFIG.prices[key];

  if (!priceId) {
    throw new Error(`Invalid plan: ${planId}_${interval}ly`);
  }

  return priceId;
}

/**
 * Información de precios base (antes de ajustes regionales)
 */
export const PADDLE_PRICES = {
  plus: {
    monthly: 1000, // $10 USD en centavos
    yearly: 10000, // $100 USD en centavos
  },
  ultra: {
    monthly: 1500, // $15 USD en centavos
    yearly: 15000, // $150 USD en centavos
  },
} as const;

/**
 * Obtener precio base de un plan
 */
export function getBasePriceCents(planId: string, interval: "month" | "year"): number {
  const plan = PADDLE_PRICES[planId as keyof typeof PADDLE_PRICES];
  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  return interval === "month" ? plan.monthly : plan.yearly;
}
