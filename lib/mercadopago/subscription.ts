import {preApprovalClient, customerClient, PLANS} from "./config";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// Create or retrieve MercadoPago customer
export async function getOrCreateMercadoPagoCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  // Buscar usuario en DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mercadopagoCustomerId: true },
  });

  // Si ya tiene customer ID, retornarlo
  if (user?.mercadopagoCustomerId) {
    return user.mercadopagoCustomerId;
  }

  // Create nuevo customer en Mercado Pago
  const customer = await customerClient.create({
    body: {
      email,
      first_name: name || "Usuario",
      description: `Cliente ${email}`,
    },
  });

  // Guardar customer ID en DB
  await prisma.user.update({
    where: { id: userId },
    data: { mercadopagoCustomerId: customer.id },
  });

  return customer.id!;
}

// Create payment preference for subscription
export async function createSubscriptionPreference(
  userId: string,
  email: string,
  planId: "plus" | "ultra",
  name?: string
): Promise<string> {
  try {
    const plan = PLANS[planId];

    console.log("📝 Creando PreApproval con:");
    console.log(`   payer_email: ${email}`);
    console.log(`   transaction_amount: ${plan.price}`);
    console.log(`   currency_id: ${plan.currency}`);
    console.log(`   external_reference: ${userId}`);

    // Validate que tengamos el ACCESS_TOKEN
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado en variables de entorno");
    }

    // Configure back_urls according to the platform
    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "";
    const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    const body: any = {
      payer_email: email,
      reason: `Suscripción ${plan.name} - Blaniel`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.price,
        currency_id: plan.currency,
      },
      external_reference: userId,
    };

    // Configure back_urls for mobile app (deep links) or web
    // The mobile app can send a header indicating it is mobile
    if (!isLocalhost) {
      // URLs for mobile app (deep links)
      body.back_urls = {
        success: "blaniel://payment/success",
        failure: "blaniel://payment/failure",
        pending: "blaniel://payment/pending",
      };

      // We also added auto_return so it redirects automatically
      body.auto_return = "approved";

      console.log(`   back_urls (mobile deep links): ${JSON.stringify(body.back_urls)}`);
      console.log(`   auto_return: ${body.auto_return}`);
    } else {
      console.log(`   back_urls: (omitido - localhost no es válido)`);
    }

    console.log("📤 Enviando request a MercadoPago PreApproval API...");
    const preapproval = await preApprovalClient.create({ body });

    if (!preapproval.init_point) {
      console.error("❌ PreApproval creado pero sin init_point:", preapproval);
      throw new Error("MercadoPago no devolvió init_point");
    }

    console.log("✅ PreApproval creado exitosamente:", preapproval.id);
    console.log(`   init_point: ${preapproval.init_point}`);

    return preapproval.init_point;
  } catch (error: any) {
    console.error("❌ Error al crear PreApproval de MercadoPago:");
    console.error("   Mensaje:", error.message);
    console.error("   Stack:", error.stack);

    if (error.cause) {
      console.error("   Causa:", JSON.stringify(error.cause, null, 2));
    }

    // Si es un error de MercadoPago, extraer detalles
    if (error.response) {
      console.error("   Response status:", error.response.status);
      console.error("   Response data:", JSON.stringify(error.response.data, null, 2));
    }

    throw error;
  }
}

// Cancel subscription
export async function cancelSubscription(
  preapprovalId: string
): Promise<void> {
  await preApprovalClient.update({
    id: preapprovalId,
    body: {
      status: "cancelled",
    },
  });

  // Update en DB
  await prisma.subscription.update({
    where: { mercadopagoPreapprovalId: preapprovalId },
    data: {
      status: "cancelled",
      canceledAt: new Date(),
    },
  });
}

// Pause subscription
export async function pauseSubscription(
  preapprovalId: string
): Promise<void> {
  await preApprovalClient.update({
    id: preapprovalId,
    body: {
      status: "paused",
    },
  });

  await prisma.subscription.update({
    where: { mercadopagoPreapprovalId: preapprovalId },
    data: {
      status: "paused",
    },
  });
}

// Reactivar suscripción
export async function reactivateSubscription(
  preapprovalId: string
): Promise<void> {
  await preApprovalClient.update({
    id: preapprovalId,
    body: {
      status: "authorized",
    },
  });

  await prisma.subscription.update({
    where: { mercadopagoPreapprovalId: preapprovalId },
    data: {
      status: "active",
      canceledAt: null,
    },
  });
}

// Synchronize subscription from Mercado Pago to DB
export async function syncSubscription(
  preapprovalData: any
): Promise<void> {
  const userId = preapprovalData.external_reference;
  if (!userId) {
    console.error("No userId in preapproval external_reference");
    return;
  }

  // Determinar el plan basado en el monto
  let planId = "plus";
  if (preapprovalData.auto_recurring?.transaction_amount >= PLANS.ultra.price) {
    planId = "ultra";
  }

  // Update user plan
  await prisma.user.update({
    where: { id: userId },
    data: { plan: planId },
  });

  // Create or update subscription in DB
  await prisma.subscription.upsert({
    where: { mercadopagoPreapprovalId: preapprovalData.id },
    create: {
      id: nanoid(),
      updatedAt: new Date(),
      userId,
      mercadopagoPreapprovalId: preapprovalData.id,
      status: preapprovalData.status,
      currentPeriodStart: new Date(preapprovalData.date_created),
      currentPeriodEnd: new Date(preapprovalData.auto_recurring?.end_date || Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
    update: {
      status: preapprovalData.status,
      currentPeriodEnd: new Date(preapprovalData.auto_recurring?.end_date || Date.now() + 30 * 24 * 60 * 60 * 1000),
      canceledAt: preapprovalData.status === "cancelled" ? new Date() : null,
    },
  });
}

// Get user's active subscription
export async function getUserSubscription(userId: string) {
  return await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "authorized"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Check if user has active subscription
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return !!subscription;
}

// Get subscription details from Mercado Pago
export async function getSubscriptionDetails(preapprovalId: string) {
  try {
    const preapproval = await preApprovalClient.get({ id: preapprovalId });
    return preapproval;
  } catch (error) {
    console.error("Error fetching subscription details:", error);
    return null;
  }
}
