/**
 * API Route: Checkout Unificado
 *
 * Detecta automáticamente el país del usuario y crea un checkout
 * con el proveedor de pago apropiado:
 * - LATAM → MercadoPago
 * - Global → Lemon Squeezy
 *
 * POST /api/billing/checkout-unified
 * Body: { planId: "plus" | "ultra", interval: "month" | "year" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { detectCountryAndPricing } from "@/lib/payment/geo-detection";
import { createPaddleCheckout } from "@/lib/paddle/checkout";
import { createSubscriptionPreference } from "@/lib/mercadopago/subscription";
import { billingLogger as log } from "@/lib/logging/loggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const userEmail = user.email;

    const body = await req.json();
    const { planId, interval = "month" } = body;

    if (!planId || !["plus", "ultra"].includes(planId)) {
      return NextResponse.json(
        { error: "Invalid planId. Must be 'plus' or 'ultra'" },
        { status: 400 }
      );
    }

    if (!["month", "year"].includes(interval)) {
      return NextResponse.json(
        { error: "Invalid interval. Must be 'month' or 'year'" },
        { status: 400 }
      );
    }

    log.info(
      {
        userId,
        planId,
        interval,
      },
      "Creating unified checkout"
    );

    // Detectar país y calcular pricing
    const { countryCode, provider, amount, currency, displayPrice } =
      await detectCountryAndPricing(req, planId, interval);

    log.info(
      {
        userId,
        countryCode,
        provider,
        planId,
        amount,
        currency,
      },
      `Selected ${provider} provider for ${countryCode}`
    );

    // Create checkout según el proveedor
    if (provider === "paddle") {
      // Checkout global con Paddle
      const { checkoutUrl, transactionId } = await createPaddleCheckout({
        userId,
        userEmail,
        planId,
        interval,
        successUrl: `${process.env.APP_URL}/dashboard/billing?success=true&provider=paddle`,
        cancelUrl: `${process.env.APP_URL}/dashboard/billing?canceled=true`,
      });

      return NextResponse.json({
        provider: "paddle",
        checkoutUrl,
        initPoint: checkoutUrl, // Alias para compatibilidad
        transactionId,
        countryCode,
        pricing: {
          amount,
          currency,
          displayPrice,
        },
      });
    } else {
      // Checkout LATAM con MercadoPago
      const initPoint = await createSubscriptionPreference(
        userId,
        userEmail,
        planId
      );

      return NextResponse.json({
        provider: "mercadopago",
        checkoutUrl: initPoint, // Normalizado
        initPoint, // Mantener para compatibilidad
        countryCode,
        pricing: {
          amount,
          currency,
          displayPrice,
        },
      });
    }
  } catch (error: any) {
    log.error({ err: error }, "Error creating unified checkout");
    return NextResponse.json(
      {
        error: "Failed to create checkout",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint para obtener información de pricing sin crear checkout
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("planId") as "plus" | "ultra" | null;
    const interval = (searchParams.get("interval") || "month") as "month" | "year";

    if (!planId || !["plus", "ultra"].includes(planId)) {
      return NextResponse.json(
        { error: "Invalid planId parameter" },
        { status: 400 }
      );
    }

    // Detectar país y calcular pricing
    const pricingInfo = await detectCountryAndPricing(req, planId, interval);

    return NextResponse.json({
      countryCode: pricingInfo.countryCode,
      provider: pricingInfo.provider,
      planId,
      interval,
      pricing: {
        amount: pricingInfo.amount,
        currency: pricingInfo.currency,
        displayPrice: pricingInfo.displayPrice,
        basePrice: pricingInfo.basePrice,
      },
    });
  } catch (error: any) {
    log.error({ err: error }, "Error getting pricing info");
    return NextResponse.json(
      {
        error: "Failed to get pricing info",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
