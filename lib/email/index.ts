/**
 * Servicio Unificado de Email - Soporta SMTP y API
 *
 * Permite elegir entre dos métodos de envío:
 *
 * 1. SMTP (DonWeb Mail Profesional) - RECOMENDADO PARA EMPEZAR
 *    - Costo: $20 USD/año (~$24,000 ARS)
 *    - Límite: 2,400 emails/día (100/hora)
 *    - Suficiente para hasta ~30,000 usuarios activos
 *    - Variable: EMAIL_PROVIDER="smtp"
 *
 * 2. API (EnvíaloSimple Transaccional) - PARA ESCALAR
 *    - Costo: $228 USD/año (~$274,000 ARS) - 11.5x más caro
 *    - Límite: ~24,000 emails/día (1000/hora)
 *    - Para cuando superes 2,000 emails/día
 *    - Variable: EMAIL_PROVIDER="api"
 *
 * Configuración: Establece EMAIL_PROVIDER="smtp" o "api" en .env
 */

import { sendEmail as sendViaAPI } from "./envialosimple";
import { sendEmailViaSMTP } from "./smtp";
import { emailLogger as log } from "@/lib/logging/loggers";

export interface UnifiedEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  substitutions?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    disposition?: "inline" | "attachment";
    id?: string;
  }>;
}

export interface UnifiedEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Aplica sustituciones de variables en el HTML
 * Reemplaza {{variable}} con el valor correspondiente
 */
function applySubstitutions(html: string, substitutions?: Record<string, string>): string {
  if (!substitutions) return html;

  let result = html;
  for (const [key, value] of Object.entries(substitutions)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value || "");
  }

  return result;
}

/**
 * Envía un email usando el proveedor configurado (SMTP o API)
 */
export async function sendEmail(options: UnifiedEmailOptions): Promise<UnifiedEmailResponse> {
  // Check if email system is enabled
  const emailEnabled = process.env.EMAIL_ENABLED === 'true';

  if (!emailEnabled) {
    log.info(
      {
        to: options.to,
        subject: options.subject,
      },
      "Email system disabled - skipping email send"
    );
    return {
      success: true,
      message: "Email system disabled - email not sent",
    };
  }

  const provider = process.env.EMAIL_PROVIDER || "smtp"; // Por defecto SMTP (más económico)

  log.info(
    {
      provider,
      to: options.to,
      subject: options.subject,
    },
    "Sending email via unified service"
  );

  try {
    // Aplicar sustituciones al HTML
    const htmlWithSubstitutions = applySubstitutions(options.html, options.substitutions);

    if (provider === "api") {
      // Usar API de EnvíaloSimple Transaccional
      const toEmail = Array.isArray(options.to) ? options.to[0] : options.to;

      const result = await sendViaAPI({
        to: toEmail,
        subject: options.subject,
        html: htmlWithSubstitutions,
        substitutions: options.substitutions,
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content?.toString() || "",
          disposition: att.disposition,
          id: att.id,
        })),
      });

      return result;
    } else if (provider === "smtp") {
      // Usar SMTP de DonWeb Mail Profesional
      const result = await sendEmailViaSMTP({
        to: options.to,
        subject: options.subject,
        html: htmlWithSubstitutions,
        attachments: options.attachments,
      });

      return {
        success: true,
        message: `Email sent successfully. Message ID: ${result.messageId}`,
      };
    } else {
      const errorMsg = `Invalid EMAIL_PROVIDER: ${provider}. Must be "smtp" or "api"`;
      log.error({ provider }, errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error: any) {
    log.error(
      {
        err: error,
        provider,
        to: options.to,
        subject: options.subject,
      },
      "Error sending email via unified service"
    );

    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

/**
 * Envía un email de prueba para verificar la configuración
 */
export async function sendTestEmail(recipientEmail: string): Promise<UnifiedEmailResponse> {
  const provider = process.env.EMAIL_PROVIDER || "smtp";

  return sendEmail({
    to: recipientEmail,
    subject: `Test Email - ${provider.toUpperCase()} Configuration`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Email de Prueba</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #6366f1; margin-top: 0;">✅ Configuración Correcta</h1>
            <p>Este es un email de prueba enviado desde <strong>Blaniel</strong>.</p>

            <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <strong>📋 Información de Configuración:</strong><br>
              Proveedor: <strong style="color: #6366f1;">${provider.toUpperCase()}</strong><br>
              ${
                provider === "smtp"
                  ? `
              Host: <strong>${process.env.SMTP_HOST || "smtp.envialosimple.email"}</strong><br>
              Puerto: <strong>${process.env.SMTP_PORT || "587"}</strong><br>
              Límite: <strong>2,400 emails/día</strong><br>
              Costo: <strong>$20 USD/año</strong>
              `
                  : `
              API: <strong>EnvíaloSimple Transaccional</strong><br>
              Límite: <strong>24,000 emails/día</strong><br>
              Costo: <strong>$228 USD/año</strong>
              `
              }
            </div>

            <p>Si ves este mensaje, todo está funcionando correctamente. ✅</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <em>Blaniel © 2025</em><br>
              Powered by ${provider === "smtp" ? "DonWeb Mail Profesional" : "EnvíaloSimple Transaccional"}
            </p>
          </div>
        </body>
      </html>
    `,
  });
}
