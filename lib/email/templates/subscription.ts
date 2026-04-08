/**
 * Email Templates for Subscriptions
 * 
 * All templates use substitution variables {{variable}}
 * that are replaced by EnvíaloSimple
 */

interface SubscriptionEmailData {
  userName: string;
  userEmail: string;
  planName: string;
  planPrice: string;
  currency: string;
  currentPeriodEnd?: string;
  amount?: string;
  paymentMethod?: string;
  reason?: string;
}

// Base styles for all emails
const baseStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 40px 20px;
      text-align: center;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #6366f1;
      font-size: 24px;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      background-color: #6366f1;
      color: white !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-weight: 500;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #4f46e5;
    }
    .info-box {
      background-color: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #6366f1;
      text-decoration: none;
    }
  </style>
`;

/** Welcome email when the subscription is activated */
export function getWelcomeEmail(data: SubscriptionEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a ${data.planName}!</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Bienvenido a ${data.planName}!</h1>
          </div>
          <div class="content">
            <h2>Hola {{userName}},</h2>
            <p>¡Gracias por suscribirte al plan <strong>${data.planName}</strong>! Tu pago se ha procesado exitosamente y tu cuenta ya está activa.</p>

            <div class="info-box">
              <strong>📋 Detalles de tu suscripción:</strong><br>
              Plan: <strong>${data.planName}</strong><br>
              Precio: <strong>${data.planPrice} ${data.currency}/mes</strong><br>
              Próximo cobro: <strong>{{currentPeriodEnd}}</strong>
            </div>

            <p><strong>¿Qué puedes hacer ahora?</strong></p>
            <ul>
              <li>✨ Crear tus compañeros IA personalizados</li>
              <li>🌍 Explorar mundos virtuales interactivos</li>
              <li>💬 Disfrutar de mensajes ilimitados</li>
              <li>🎨 Generar imágenes con IA</li>
            </ul>

            <center>
              <a href="https://creador-ia.com/dashboard" class="button">Ir a tu Dashboard</a>
            </center>

            <p>Si tienes alguna pregunta, no dudes en contactarnos. ¡Estamos aquí para ayudarte!</p>
          </div>
          <div class="footer">
            <p>Blaniel © 2025</p>
            <p>
              <a href="https://creador-ia.com/dashboard/billing">Gestionar Suscripción</a> |
              <a href="mailto:soporte@creador-ia.com">Soporte</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/** Monthly payment confirmation email */
export function getPaymentSuccessEmail(data: SubscriptionEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pago Confirmado</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Pago Confirmado</h1>
          </div>
          <div class="content">
            <h2>Hola {{userName}},</h2>
            <p>Te confirmamos que hemos recibido tu pago mensual correctamente.</p>

            <div class="info-box">
              <strong>💳 Detalles del pago:</strong><br>
              Monto: <strong>{{amount}} {{currency}}</strong><br>
              Método de pago: <strong>{{paymentMethod}}</strong><br>
              Fecha: <strong>{{date}}</strong><br>
              Próximo cobro: <strong>{{currentPeriodEnd}}</strong>
            </div>

            <p>Tu suscripción al plan <strong>${data.planName}</strong> continúa activa. ¡Gracias por confiar en nosotros!</p>

            <center>
              <a href="https://creador-ia.com/dashboard/billing/history" class="button">Ver Historial de Pagos</a>
            </center>
          </div>
          <div class="footer">
            <p>Blaniel © 2025</p>
            <p><a href="https://creador-ia.com/dashboard/billing">Gestionar Suscripción</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Email cuando falla un pago
 */
export function getPaymentFailedEmail(_data: SubscriptionEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Problema con tu Pago</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Problema con tu Pago</h1>
          </div>
          <div class="content">
            <h2>Hola {{userName}},</h2>
            <p>Intentamos procesar tu pago mensual de <strong>{{amount}} {{currency}}</strong> pero no pudimos completarlo.</p>

            <div class="warning-box">
              <strong>📌 ¿Qué significa esto?</strong><br>
              Intentaremos cobrar nuevamente en los próximos días. Si el pago sigue fallando, tu suscripción podría ser cancelada.
            </div>

            <p><strong>Posibles causas:</strong></p>
            <ul>
              <li>Fondos insuficientes en tu tarjeta</li>
              <li>Tarjeta vencida o deshabilitada</li>
              <li>Límite de crédito alcanzado</li>
            </ul>

            <p><strong>¿Qué puedes hacer?</strong></p>
            <ol>
              <li>Verifica que tu tarjeta tenga fondos disponibles</li>
              <li>Actualiza tu método de pago si es necesario</li>
              <li>Contacta a tu banco si el problema persiste</li>
            </ol>

            <center>
              <a href="https://creador-ia.com/dashboard/billing" class="button">Actualizar Método de Pago</a>
            </center>

            <p>Si necesitas ayuda, contáctanos en <a href="mailto:soporte@creador-ia.com">soporte@creador-ia.com</a></p>
          </div>
          <div class="footer">
            <p>Blaniel © 2025</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/** Email when the subscription is cancelled */
export function getCancellationEmail(data: SubscriptionEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Suscripción Cancelada</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>😢 Suscripción Cancelada</h1>
          </div>
          <div class="content">
            <h2>Hola {{userName}},</h2>
            <p>Hemos procesado la cancelación de tu suscripción al plan <strong>${data.planName}</strong>.</p>

            <div class="info-box">
              <strong>📅 ¿Cuándo pierdo acceso?</strong><br>
              Mantendrás acceso a todas las funciones premium hasta el <strong>{{currentPeriodEnd}}</strong>. Después de esa fecha, tu cuenta pasará al plan gratuito.
            </div>

            <p><strong>¿Cambio de planes? ¡Estamos aquí para ayudarte!</strong></p>
            <p>Si cancelaste por algún problema o tienes feedback para nosotros, nos encantaría escucharte. Tu opinión nos ayuda a mejorar.</p>

            <center>
              <a href="https://creador-ia.com/dashboard/billing" class="button">Ver Planes Disponibles</a>
            </center>

            <p>Esperamos verte pronto de vuelta. ¡Gracias por haber sido parte de Blaniel!</p>
          </div>
          <div class="footer">
            <p>Blaniel © 2025</p>
            <p>
              <a href="https://creador-ia.com/feedback">Déjanos tu Feedback</a> |
              <a href="mailto:soporte@creador-ia.com">Contactar Soporte</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/** Email when a subscription is reactivated */
export function getReactivationEmail(data: SubscriptionEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido de Vuelta!</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎊 ¡Bienvenido de Vuelta!</h1>
          </div>
          <div class="content">
            <h2>Hola {{userName}},</h2>
            <p>¡Nos alegra que hayas decidido continuar con nosotros! Tu suscripción al plan <strong>${data.planName}</strong> ha sido reactivada exitosamente.</p>

            <div class="info-box">
              <strong>✨ Tu plan está activo:</strong><br>
              Plan: <strong>${data.planName}</strong><br>
              Próximo cobro: <strong>{{currentPeriodEnd}}</strong>
            </div>

            <p>Puedes continuar disfrutando de todas las funciones premium sin interrupciones.</p>

            <center>
              <a href="https://creador-ia.com/dashboard" class="button">Ir a tu Dashboard</a>
            </center>

            <p>¡Gracias por confiar en Blaniel!</p>
          </div>
          <div class="footer">
            <p>Blaniel © 2025</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
