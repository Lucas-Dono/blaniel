/**
 * EMAIL NOTIFICATION SERVICE FOR STRIPE EVENTS
 *
 * Envía emails a usuarios basados en eventos de suscripción
 * TODO: Integrar con un servicio de email real (SendGrid, Resend, etc.)
 */

import { billingLogger as log } from "@/lib/logging/loggers";

export type EmailType =
  | "subscription_created"
  | "subscription_updated"
  | "subscription_cancelled"
  | "payment_succeeded"
  | "payment_failed"
  | "trial_ending"
  | "subscription_reactivated";

export interface EmailData {
  to: string;
  type: EmailType;
  data: {
    userName?: string;
    planName?: string;
    amount?: number;
    currency?: string;
    nextBillingDate?: Date;
    cancelDate?: Date;
    trialEndDate?: Date;
    failureReason?: string;
    attemptNumber?: number;
    [key: string]: any;
  };
}

/**
 * Envía un email de notificación
 * NOTA: Implementación placeholder - reemplazar con servicio real
 */
export async function sendEmail(emailData: EmailData): Promise<void> {
  try {
    log.info(
      {
        to: emailData.to,
        type: emailData.type,
      },
      "Sending email notification"
    );

    // TODO: Integrar con servicio de email real
    // Ejemplos de servicios populares:
    // - SendGrid: https://www.npmjs.com/package/@sendgrid/mail
    // - Resend: https://www.npmjs.com/package/resend
    // - AWS SES: https://www.npmjs.com/package/@aws-sdk/client-ses
    // - Mailgun: https://www.npmjs.com/package/mailgun-js

    const emailContent = generateEmailContent(emailData);

    // Por ahora solo logeamos el contenido
    log.debug(
      {
        to: emailData.to,
        subject: emailContent.subject,
        preview: emailContent.text.substring(0, 100),
      },
      "Email content generated"
    );

    // In production, email sending code would go here:
    // await sendgrid.send({
    //   to: emailData.to,
    //   from: 'noreply@blaniel.com',
    //   subject: emailContent.subject,
    //   text: emailContent.text,
    //   html: emailContent.html,
    // });

    log.info({ to: emailData.to, type: emailData.type }, "Email sent successfully");
  } catch (error) {
    log.error(
      { err: error, emailType: emailData.type, to: emailData.to },
      "Error sending email"
    );
    // No lanzamos error para no interrumpir el webhook
  }
}

/**
 * Genera el contenido del email según el tipo
 */
function generateEmailContent(emailData: EmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const { type, data } = emailData;

  switch (type) {
    case "subscription_created":
      return {
        subject: `¡Bienvenido al plan ${data.planName}!`,
        text: `Hola ${data.userName || ""},\n\n¡Gracias por suscribirte al plan ${data.planName}!\n\nAhora tienes acceso a todas las funcionalidades premium.\n\nTu próxima factura será el ${data.nextBillingDate?.toLocaleDateString() || "N/A"}.\n\n¡Disfruta tu suscripción!`,
        html: `<h1>¡Bienvenido al plan ${data.planName}!</h1><p>Gracias por suscribirte. Ahora tienes acceso completo a todas las funcionalidades premium.</p>`,
      };

    case "subscription_updated":
      return {
        subject: "Tu suscripción ha sido actualizada",
        text: `Hola ${data.userName || ""},\n\nTu suscripción ha sido actualizada al plan ${data.planName}.\n\nLos cambios son efectivos inmediatamente.\n\nTu próxima factura será el ${data.nextBillingDate?.toLocaleDateString() || "N/A"}.`,
        html: `<h1>Suscripción actualizada</h1><p>Tu plan ahora es: <strong>${data.planName}</strong></p>`,
      };

    case "subscription_cancelled":
      return {
        subject: "Tu suscripción ha sido cancelada",
        text: `Hola ${data.userName || ""},\n\nTu suscripción ha sido cancelada.\n\nTendrás acceso a las funcionalidades premium hasta ${data.cancelDate?.toLocaleDateString() || "el final del período actual"}.\n\nEsperamos verte pronto de vuelta. Si tienes algún problema, no dudes en contactarnos.`,
        html: `<h1>Suscripción cancelada</h1><p>Lamentamos verte partir. Tendrás acceso hasta ${data.cancelDate?.toLocaleDateString() || "el final del período"}.</p><p>¿Cambiaste de opinión? Puedes reactivar tu suscripción en cualquier momento.</p>`,
      };

    case "payment_succeeded":
      return {
        subject: "Pago recibido - Recibo de tu suscripción",
        text: `Hola ${data.userName || ""},\n\nHemos recibido tu pago de ${data.amount} ${data.currency?.toUpperCase()}.\n\nGracias por tu suscripción al plan ${data.planName}.\n\nTu próxima factura será el ${data.nextBillingDate?.toLocaleDateString() || "N/A"}.`,
        html: `<h1>Pago recibido</h1><p>Gracias por tu pago de <strong>${data.amount} ${data.currency?.toUpperCase()}</strong>.</p><p>Tu suscripción está activa.</p>`,
      };

    case "payment_failed":
      return {
        subject: "⚠️ Problema con tu pago",
        text: `Hola ${data.userName || ""},\n\nNo pudimos procesar tu pago (intento ${data.attemptNumber || 1}/3).\n\nMotivo: ${data.failureReason || "Desconocido"}\n\nPor favor actualiza tu método de pago para evitar la interrupción del servicio.\n\nDespués de 3 intentos fallidos, tu suscripción será cancelada automáticamente.`,
        html: `<h1>⚠️ Problema con tu pago</h1><p>No pudimos procesar tu pago. Por favor actualiza tu método de pago.</p><p><strong>Intento ${data.attemptNumber || 1} de 3</strong></p>`,
      };

    case "trial_ending":
      return {
        subject: "Tu período de prueba está por terminar",
        text: `Hola ${data.userName || ""},\n\nTu período de prueba termina el ${data.trialEndDate?.toLocaleDateString() || "pronto"}.\n\nDespués de esa fecha, se cobrará automáticamente el plan ${data.planName}.\n\nSi deseas cancelar, puedes hacerlo en cualquier momento desde tu cuenta.`,
        html: `<h1>Tu período de prueba está por terminar</h1><p>Termina el ${data.trialEndDate?.toLocaleDateString()}. Después comenzarás a pagar ${data.amount} ${data.currency?.toUpperCase()} ${data.planName}.</p>`,
      };

    case "subscription_reactivated":
      return {
        subject: "¡Bienvenido de vuelta!",
        text: `Hola ${data.userName || ""},\n\n¡Nos alegra tenerte de vuelta!\n\nTu suscripción al plan ${data.planName} ha sido reactivada.\n\nYa puedes disfrutar nuevamente de todas las funcionalidades premium.`,
        html: `<h1>¡Bienvenido de vuelta!</h1><p>Tu suscripción al plan <strong>${data.planName}</strong> ha sido reactivada.</p>`,
      };

    default:
      return {
        subject: "Actualización de tu suscripción",
        text: "Ha habido un cambio en tu suscripción.",
        html: "<p>Ha habido un cambio en tu suscripción.</p>",
      };
  }
}

/**
 * Helper para enviar email de bienvenida
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  planName: string,
  nextBillingDate: Date
): Promise<void> {
  await sendEmail({
    to: userEmail,
    type: "subscription_created",
    data: {
      userName,
      planName,
      nextBillingDate,
    },
  });
}

/**
 * Helper para enviar email de cancelación con incentivo
 */
export async function sendCancellationEmail(
  userEmail: string,
  userName: string,
  cancelDate: Date
): Promise<void> {
  await sendEmail({
    to: userEmail,
    type: "subscription_cancelled",
    data: {
      userName,
      cancelDate,
    },
  });
}

/**
 * Helper para enviar email de pago fallido
 */
export async function sendPaymentFailedEmail(
  userEmail: string,
  userName: string,
  attemptNumber: number,
  failureReason?: string
): Promise<void> {
  await sendEmail({
    to: userEmail,
    type: "payment_failed",
    data: {
      userName,
      attemptNumber,
      failureReason,
    },
  });
}
