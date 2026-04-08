/**
 * Funciones para enviar emails de suscripciones
 *
 * Usa el servicio unificado que soporta tanto SMTP como API.
 * Configurar EMAIL_PROVIDER="smtp" o "api" en .env
 */

import { sendEmail } from "./index";
import {
  getWelcomeEmail,
  getPaymentSuccessEmail,
  getPaymentFailedEmail,
  getCancellationEmail,
  getReactivationEmail,
} from "./templates/subscription";
import { PLANS } from "@/lib/mercadopago/config";
import { billingLogger as log } from "@/lib/logging/loggers";

interface UserData {
  email: string;
  name?: string | null;
}

interface SubscriptionData {
  planId: string;
  currentPeriodEnd: Date;
}

interface PaymentData {
  amount: number;
  currency: string;
  paymentMethod?: string;
  statusDetail?: string;
}

/**
 * Envía email de bienvenida cuando se activa una suscripción
 */
export async function sendSubscriptionWelcomeEmail(
  user: UserData,
  subscription: SubscriptionData
) {
  const plan = PLANS[subscription.planId as keyof typeof PLANS];
  if (!plan) {
    log.warn({ planId: subscription.planId }, 'Unknown plan for welcome email');
    return;
  }

  const html = getWelcomeEmail({
    userName: user.name || "Usuario",
    userEmail: user.email,
    planName: plan.name,
    planPrice: (plan.price / 100).toFixed(2), // Convertir centavos a pesos
    currency: plan.currency,
  });

  return await sendEmail({
    to: user.email,
    subject: `¡Bienvenido a ${plan.name}! 🎉`,
    html,
    substitutions: {
      userName: user.name || "Usuario",
      currentPeriodEnd: subscription.currentPeriodEnd.toLocaleDateString("es-AR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  });
}

/**
 * Envía email de confirmación de pago mensual
 */
export async function sendPaymentSuccessEmail(
  user: UserData,
  payment: PaymentData,
  subscription: SubscriptionData
) {
  const plan = PLANS[subscription.planId as keyof typeof PLANS];
  if (!plan) {
    log.warn({ planId: subscription.planId }, 'Unknown plan for payment success email');
    return;
  }

  const html = getPaymentSuccessEmail({
    userName: user.name || "Usuario",
    userEmail: user.email,
    planName: plan.name,
    planPrice: (plan.price / 100).toFixed(2),
    currency: payment.currency,
  });

  return await sendEmail({
    to: user.email,
    subject: "✅ Pago Confirmado - Blaniel",
    html,
    substitutions: {
      userName: user.name || "Usuario",
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod || "Tarjeta",
      date: new Date().toLocaleDateString("es-AR"),
      currentPeriodEnd: subscription.currentPeriodEnd.toLocaleDateString("es-AR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  });
}

/**
 * Envía email cuando falla un pago
 */
export async function sendPaymentFailedEmail(
  user: UserData,
  payment: PaymentData
) {
  const html = getPaymentFailedEmail({
    userName: user.name || "Usuario",
    userEmail: user.email,
    planName: "", // No necesario en el template de fallo
    planPrice: "",
    currency: payment.currency,
  });

  return await sendEmail({
    to: user.email,
    subject: "⚠️ Problema con tu Pago - Blaniel",
    html,
    substitutions: {
      userName: user.name || "Usuario",
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
    },
  });
}

/**
 * Envía email cuando se cancela una suscripción
 */
export async function sendCancellationEmail(
  user: UserData,
  subscription: SubscriptionData
) {
  const plan = PLANS[subscription.planId as keyof typeof PLANS];
  if (!plan) {
    log.warn({ planId: subscription.planId }, 'Unknown plan for cancellation email');
    return;
  }

  const html = getCancellationEmail({
    userName: user.name || "Usuario",
    userEmail: user.email,
    planName: plan.name,
    planPrice: (plan.price / 100).toFixed(2),
    currency: plan.currency,
  });

  return await sendEmail({
    to: user.email,
    subject: "Suscripción Cancelada - Blaniel",
    html,
    substitutions: {
      userName: user.name || "Usuario",
      currentPeriodEnd: subscription.currentPeriodEnd.toLocaleDateString("es-AR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  });
}

/**
 * Envía email cuando se reactiva una suscripción
 */
export async function sendReactivationEmail(
  user: UserData,
  subscription: SubscriptionData
) {
  const plan = PLANS[subscription.planId as keyof typeof PLANS];
  if (!plan) {
    log.warn({ planId: subscription.planId }, 'Unknown plan for reactivation email');
    return;
  }

  const html = getReactivationEmail({
    userName: user.name || "Usuario",
    userEmail: user.email,
    planName: plan.name,
    planPrice: (plan.price / 100).toFixed(2),
    currency: plan.currency,
  });

  return await sendEmail({
    to: user.email,
    subject: "🎊 ¡Bienvenido de Vuelta! - Blaniel",
    html,
    substitutions: {
      userName: user.name || "Usuario",
      currentPeriodEnd: subscription.currentPeriodEnd.toLocaleDateString("es-AR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  });
}
