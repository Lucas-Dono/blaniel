/**
 * Servicio de Email SMTP para DonWeb Mail Profesional
 * Usa nodemailer para enviar emails via SMTP
 *
 * LÍMITES:
 * - 100 emails/hora por casilla (2,400/día)
 * - 200 emails/hora por dominio
 * - Suficiente para hasta ~30,000 usuarios activos
 *
 * COSTO: $20 USD/año (~$24,000 ARS) - 11.5x más barato que EnvíaloSimple Transaccional
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { emailLogger as log } from "@/lib/logging/loggers";

export interface SMTPEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
}

export interface SMTPResponse {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

let transporter: Transporter | null = null;

/**
 * Crea y configura el transporter de nodemailer
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.envialosimple.email";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === "true";

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP_USER and SMTP_PASS are required for SMTP email service");
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true para 465, false para otros puertos (587 usa STARTTLS)
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    // Opciones adicionales para mejorar entrega
    pool: true, // Usar pooling de conexiones
    maxConnections: 5, // Máximo 5 conexiones simultáneas
    maxMessages: 100, // Máximo 100 mensajes por conexión
    rateDelta: 1000, // 1 segundo
    rateLimit: 5, // 5 emails por segundo (300/minuto, bajo el límite de 100/hora)
  });

  // Verificar la conexión al iniciar
  transporter.verify((error) => {
    if (error) {
      log.error({ err: error }, "SMTP connection verification failed");
    } else {
      log.info({ host: smtpHost, port: smtpPort }, "SMTP connection verified successfully");
    }
  });

  return transporter;
}

/**
 * Envía un email usando SMTP
 */
export async function sendEmailViaSMTP(options: SMTPEmailOptions): Promise<SMTPResponse> {
  const fromEmail = options.from || process.env.ENVIALOSIMPLE_FROM_EMAIL || "noreply@creador-ia.com";
  const fromName = process.env.ENVIALOSIMPLE_FROM_NAME || "Blaniel";

  log.info({ to: options.to, subject: options.subject }, "Sending email via SMTP");

  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    log.info(
      {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      },
      "Email sent successfully via SMTP"
    );

    return {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    log.error(
      {
        err: error,
        to: options.to,
        subject: options.subject,
      },
      "Error sending email via SMTP"
    );
    throw error;
  }
}

/**
 * Envía un email de prueba para verificar la configuración SMTP
 */
export async function sendTestEmailSMTP(to: string): Promise<SMTPResponse> {
  return sendEmailViaSMTP({
    to,
    subject: "Test Email - DonWeb SMTP",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Email de Prueba</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #6366f1;">✅ SMTP Configurado Correctamente</h1>
          <p>Este es un email de prueba enviado desde tu aplicación usando DonWeb Mail Profesional via SMTP.</p>
          <p><strong>Configuración:</strong></p>
          <ul>
            <li>Host: ${process.env.SMTP_HOST || "smtp.envialosimple.email"}</li>
            <li>Puerto: ${process.env.SMTP_PORT || "587"}</li>
            <li>Usuario: ${process.env.SMTP_USER || "No configurado"}</li>
          </ul>
          <p><em>Blaniel © 2025</em></p>
        </body>
      </html>
    `,
  });
}

/**
 * Cierra el transporter y libera recursos
 */
export async function closeSMTPConnection(): Promise<void> {
  if (transporter) {
    transporter.close();
    transporter = null;
    log.info("SMTP connection closed");
  }
}
