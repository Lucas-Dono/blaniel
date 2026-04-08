/**
 * Servicio de Email - EnvíaloSimple (DonWeb)
 *
 * Documentación: https://api-transaccional.envialosimple.email/
 * Panel: https://app.envialosimple.com/
 */

import { billingLogger as log } from "@/lib/logging/loggers";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  substitutions?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string; // Base64
    disposition?: "inline" | "attachment";
    id?: string; // Para usar con cid: en HTML
  }>;
}

interface EnvíaloSimpleResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Envía un email usando la API de EnvíaloSimple
 */
export async function sendEmail(options: EmailOptions): Promise<EnvíaloSimpleResponse> {
  const apiKey = process.env.ENVIALOSIMPLE_API_KEY;
  const fromEmail = process.env.ENVIALOSIMPLE_FROM_EMAIL || "noreply@creador-ia.com";
  const fromName = process.env.ENVIALOSIMPLE_FROM_NAME || "Blaniel";

  if (!apiKey) {
    log.error("ENVIALOSIMPLE_API_KEY not configured");
    throw new Error("Email service not configured");
  }

  const body = {
    from: `${fromName} <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.substitutions && { substitutions: options.substitutions }),
    ...(options.attachments && { attachments: options.attachments }),
  };

  try {
    log.debug({
      to: options.to,
      subject: options.subject,
      hasSubstitutions: !!options.substitutions,
      hasAttachments: !!options.attachments
    }, 'Sending email via EnvíaloSimple');

    const response = await fetch("https://api.envialosimple.email/api/v1/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      log.error({
        status: response.status,
        data,
        to: options.to,
        subject: options.subject
      }, 'Failed to send email');

      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    log.info({
      to: options.to,
      subject: options.subject
    }, 'Email sent successfully');

    return {
      success: true,
      message: "Email sent successfully",
    };

  } catch (error: any) {
    log.error({
      err: error,
      to: options.to,
      subject: options.subject
    }, 'Error sending email');

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Envía un email de prueba para verificar la configuración
 */
export async function sendTestEmail(recipientEmail: string): Promise<EnvíaloSimpleResponse> {
  return await sendEmail({
    to: recipientEmail,
    subject: "Test Email - Blaniel",
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #6366f1;">¡Email de Prueba!</h1>
          <p>Este es un email de prueba enviado desde <strong>Blaniel</strong> usando EnvíaloSimple.</p>
          <p>Si ves este mensaje, la configuración es correcta. ✅</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            Powered by EnvíaloSimple | DonWeb
          </p>
        </body>
      </html>
    `,
  });
}
