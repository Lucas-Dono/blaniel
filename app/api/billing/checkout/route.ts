import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { createSubscriptionPreference } from "@/lib/mercadopago/subscription";
import { createStripeCheckoutSession } from "@/lib/stripe/checkout";
import { billingLogger as log } from "@/lib/logging/loggers";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, provider = "mercadopago", billingInterval = "monthly" } = body;

    // Validate planId
    if (!planId || (planId !== "plus" && planId !== "ultra")) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Validate provider
    if (provider !== "mercadopago" && provider !== "stripe") {
      return NextResponse.json({ error: "Invalid payment provider" }, { status: 400 });
    }

    log.info(
      { userId: user.id, planId, provider, billingInterval },
      "Creating checkout session"
    );

    let checkoutUrl: string;

    // Create checkout según el proveedor seleccionado
    if (provider === "stripe") {
      // STRIPE CHECKOUT
      checkoutUrl = await createStripeCheckoutSession({
        userId: user.id,
        email: user.email!,
        planId: planId as "plus" | "ultra",
        billingInterval: billingInterval as "monthly" | "yearly",
      });

      log.info({ userId: user.id, provider: "stripe" }, "Stripe checkout created");
    } else {
      // MERCADOPAGO CHECKOUT
      checkoutUrl = await createSubscriptionPreference(
        user.id,
        user.email!,
        planId,
        user.name || undefined
      );

      log.info({ userId: user.id, provider: "mercadopago" }, "MercadoPago checkout created");
    }

    return NextResponse.json({
      url: checkoutUrl,
      provider
    });
  } catch (error: any) {
    log.error({ err: error }, "Error creating checkout session");
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        message: error.message
      },
      { status: 500 }
    );
  }
}
