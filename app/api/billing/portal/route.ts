import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserSubscription } from "@/lib/mercadopago/subscription";
import { billingLogger as log } from "@/lib/logging/loggers";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user subscription
    const subscription = await getUserSubscription(user.id);

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    log.info({ userId: user.id }, "Opening billing portal");

    // Determinar el proveedor y redirigir al portal apropiado
    if (subscription.paddleSubscriptionId) {
      // PADDLE PORTAL - Portal completo de gestión
      log.info({ userId: user.id, provider: "paddle" }, "Redirecting to Paddle portal");

      const portalUrl = `${process.env.NEXTAUTH_URL}/dashboard/billing/manage`;

      return NextResponse.json({
        url: portalUrl,
        provider: "paddle",
        message: "Manage your subscription through Paddle"
      });
    } else if (subscription.mercadopagoPreapprovalId) {
      // MERCADOPAGO - Redirigir a dashboard interno
      // MercadoPago no tiene portal de cliente como Stripe, usamos nuestra página de gestión
      log.info({ userId: user.id, provider: "mercadopago" }, "Redirecting to internal management");

      const portalUrl = `${process.env.NEXTAUTH_URL}/dashboard/billing/manage`;

      return NextResponse.json({
        url: portalUrl,
        provider: "mercadopago",
        message: "Manage your subscription"
      });
    }

    log.error({ userId: user.id }, "Unknown subscription provider");
    return NextResponse.json(
      { error: "Unknown subscription provider" },
      { status: 400 }
    );
  } catch (error: any) {
    log.error({ err: error }, "Error getting subscription portal");
    return NextResponse.json(
      { error: "Failed to get subscription portal", message: error.message },
      { status: 500 }
    );
  }
}
