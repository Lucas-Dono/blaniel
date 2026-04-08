/**
 * Detección Geográfica para Selección de Proveedor de Pago
 *
 * Determina el mejor proveedor de pago según el país del usuario:
 * - LATAM → MercadoPago (mejor conversión, métodos locales)
 * - Global → Lemon Squeezy (pagos internacionales)
 */

import { billingLogger as log } from "@/lib/logging/loggers";

/**
 * Países de LATAM soportados por MercadoPago
 */
export const LATAM_COUNTRIES = [
  "AR", // Argentina
  "BR", // Brasil
  "MX", // México
  "CL", // Chile
  "CO", // Colombia
  "PE", // Perú
  "UY", // Uruguay
] as const;

/**
 * Pricing regional por país (Beta -25%)
 * Precios base: Plus $10 USD, Ultra $15 USD
 * Con descuento beta: Plus $7.50 USD, Ultra $11.25 USD
 */
export const REGIONAL_PRICING = {
  // LATAM - Pricing local con descuento beta 25%
  AR: { currency: "ARS", plusPrice: 11250, ultraPrice: 16875, symbol: "$" }, // Beta -25%
  BR: { currency: "BRL", plusPrice: 38, ultraPrice: 57, symbol: "R$" }, // ~R$50/$75 con descuento
  MX: { currency: "MXN", plusPrice: 150, ultraPrice: 225, symbol: "$" }, // ~$200/$300 con descuento
  CL: { currency: "CLP", plusPrice: 7500, ultraPrice: 11250, symbol: "$" }, // ~$10k/$15k con descuento
  CO: { currency: "COP", plusPrice: 30000, ultraPrice: 45000, symbol: "$" }, // ~$40k/$60k con descuento
  PE: { currency: "PEN", plusPrice: 28, ultraPrice: 42, symbol: "S/" }, // ~S/38/$57 con descuento
  UY: { currency: "UYU", plusPrice: 300, ultraPrice: 450, symbol: "$" }, // ~$400/$600 con descuento

  // Global - Pricing en USD (sin descuento beta por ahora)
  US: { currency: "USD", plusPrice: 10, ultraPrice: 15, symbol: "$" },
  CA: { currency: "USD", plusPrice: 10, ultraPrice: 15, symbol: "$" },
  GB: { currency: "USD", plusPrice: 11, ultraPrice: 16, symbol: "$" },
  EU: { currency: "USD", plusPrice: 11, ultraPrice: 16, symbol: "$" },
  AU: { currency: "USD", plusPrice: 11, ultraPrice: 17, symbol: "$" },
  DEFAULT: { currency: "USD", plusPrice: 10, ultraPrice: 15, symbol: "$" },
} as const;

export type PaymentProvider = "mercadopago" | "paddle";
export type CountryCode = string;

/**
 * Detecta el país del usuario desde el request
 */
export async function detectCountryFromRequest(request: Request): Promise<CountryCode> {
  try {
    // 1. Intentar desde header CF-IPCountry (Cloudflare)
    const cfCountry = request.headers.get("CF-IPCountry");
    if (cfCountry && cfCountry !== "XX") {
      log.debug({ country: cfCountry, source: "cloudflare" }, "Country detected");
      return cfCountry;
    }

    // 2. Intentar desde header X-Vercel-IP-Country (Vercel)
    const vercelCountry = request.headers.get("X-Vercel-IP-Country");
    if (vercelCountry && vercelCountry !== "XX") {
      log.debug({ country: vercelCountry, source: "vercel" }, "Country detected");
      return vercelCountry;
    }

    // 3. Intentar desde Accept-Language (menos confiable)
    const acceptLanguage = request.headers.get("Accept-Language");
    if (acceptLanguage) {
      // Ejemplo: "es-AR,es;q=0.9,en;q=0.8"
      const match = acceptLanguage.match(/[-_]([A-Z]{2})/);
      if (match) {
        const country = match[1];
        log.debug({ country, source: "accept-language" }, "Country detected");
        return country;
      }
    }

    // 4. Fallback: Detectar por IP usando servicio externo (opcional)
    // const ip = request.headers.get("X-Forwarded-For") || request.headers.get("X-Real-IP");
    // if (ip) {
    //   const country = await detectCountryByIP(ip);
    //   if (country) return country;
    // }

    // 5. Default: USA (most web traffic)
    log.debug({ source: "default" }, "Country detection fallback to US");
    return "US";
  } catch (error) {
    log.error({ err: error }, "Error detecting country");
    return "US"; // Default fallback
  }
}

/**
 * Selecciona el proveedor de pago según el país
 */
export function selectPaymentProvider(countryCode: CountryCode): {
  provider: PaymentProvider;
  reason: string;
} {
  const isLATAM = LATAM_COUNTRIES.includes(countryCode as any);

  if (isLATAM) {
    return {
      provider: "mercadopago",
      reason: "local_payment_methods",
    };
  }

  return {
    provider: "paddle",
    reason: "international",
  };
}

/**
 * Obtiene el pricing regional para un país y plan
 */
export function getRegionalPricing(countryCode: CountryCode, planId: "plus" | "ultra") {
  const pricing = REGIONAL_PRICING[countryCode as keyof typeof REGIONAL_PRICING] || REGIONAL_PRICING.DEFAULT;
  const amount = planId === "plus" ? pricing.plusPrice : pricing.ultraPrice;

  return {
    currency: pricing.currency,
    symbol: pricing.symbol,
    amount,
    displayPrice: `${pricing.symbol}${amount.toLocaleString()}`,
  };
}

/**
 * Calcula el precio ajustado por región
 * Beta: 25% de descuento en LATAM
 */
export function calculateRegionalPrice(
  countryCode: CountryCode,
  planId: "plus" | "ultra",
  interval: "month" | "year" = "month"
): {
  provider: PaymentProvider;
  currency: string;
  amount: number;
  displayPrice: string;
  basePrice: number;
} {
  const { provider } = selectPaymentProvider(countryCode);
  const pricing = getRegionalPricing(countryCode, planId);

  // Multiplicador para plan anual (10 meses = 2 meses gratis)
  const yearlyMultiplier = interval === "year" ? 10 : 1;
  const amount = pricing.amount * yearlyMultiplier;

  return {
    provider,
    currency: pricing.currency,
    amount,
    displayPrice: `${pricing.symbol}${amount.toLocaleString()}`,
    basePrice: pricing.amount,
  };
}

/**
 * Detecta país y calcula pricing automáticamente
 */
export async function detectCountryAndPricing(
  request: Request,
  planId: "plus" | "ultra",
  interval: "month" | "year" = "month"
) {
  const countryCode = await detectCountryFromRequest(request);
  const pricing = calculateRegionalPrice(countryCode, planId, interval);

  log.info(
    {
      countryCode,
      provider: pricing.provider,
      planId,
      interval,
      amount: pricing.amount,
      currency: pricing.currency,
    },
    "Country detected and pricing calculated"
  );

  return {
    countryCode,
    ...pricing,
  };
}
