import { MercadoPagoConfig, Payment, PreApproval, Customer } from "mercadopago";

// Inicializar Mercado Pago
export const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  options: {
    timeout: 5000,
  },
});

// Clientes de API
export const paymentClient = new Payment(mercadopago);
export const preApprovalClient = new PreApproval(mercadopago);
export const customerClient = new Customer(mercadopago);

// Subscription plans (prices in local currency - adjust by country)
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    description: "Perfecto para probar la plataforma",
    price: 0,
    currency: "ARS",
    interval: "month" as const,
    features: [
      "3 compañeros IA",
      "20 mensajes por día",
      "Sistema emocional básico",
      "1 mundo predefinido (Academia Sakura)",
      "5 análisis de imágenes por mes",
      "❌ Sin voz (usa tu API key de ElevenLabs)",
      "❌ Sin contenido NSFW",
      "❌ Sin comportamientos avanzados",
      "✨ Gana más mensajes e imágenes viendo anuncios",
      "Soporte comunitario",
    ],
    limits: {
      agents: 3,
      messages: -1, // Ilimitado mensualmente pero con límite diario
      messagesPerDay: 20, // 20 mensajes por día
      rewardedMessagesPerVideo: 10, // +10 mensajes por video ad
      worlds: 1,
      worldsAllowed: ["academia-sakura"], // Solo Academia Sakura
      tokensPerMessage: 1000,

      // Voz
      voiceEnabled: false, // Sin voz incluida
      canUseBYOK: true, // Puede usar su propia API key de ElevenLabs
      voiceMessagesPerMonth: 0,

      // Images
      imageAnalysisPerMonth: 5, // 5 análisis gratis por mes
      imageAnalysisRewardedMax: 60, // Máximo 60 extra viendo ads
      imageAnalysisPerMinuteVideo: 4, // 4 análisis por cada minuto de video
      imageGeneration: 0, // Sin generación de imágenes

      // NSFW y Comportamientos
      nsfwMode: false, // Sin contenido NSFW
      advancedBehaviors: false, // Sin Yandere, BPD, NPD, etc.

      // Otros
      proactiveMessages: 1, // Solo 1 mensaje proactivo por semana
      exportConversations: false,
    },
  },
  plus: {
    id: "plus",
    name: "Plus",
    description: "Ideal para usuarios regulares que quieren más",
    price: 11250, // ~$7.50 USD (Beta -25% sobre $10 USD)
    priceOriginal: 15000, // Precio sin descuento
    currency: "ARS",
    interval: "month" as const,
    mercadopagoPreapprovalPlanId: process.env.MERCADOPAGO_PLUS_PLAN_ID,
    features: [
      "10 compañeros IA",
      "Mensajes de texto ilimitados",
      "100 mensajes con voz por mes",
      "Sistema emocional avanzado",
      "5 mundos virtuales (chat + novelas visuales)",
      "50 análisis de imágenes por mes",
      "20 generaciones de imágenes por mes",
      "✅ Acceso a Novelas Visuales",
      "✅ Contenido NSFW habilitado",
      "✅ Comportamientos psicológicos avanzados",
      "✅ Sin publicidad",
      "Soporte prioritario por email",
    ],
    limits: {
      agents: 10,
      messages: -1, // Ilimitado
      messagesPerDay: -1, // Sin límite diario
      worlds: 5,
      worldsAllowed: [], // Todos los mundos disponibles
      tokensPerMessage: 2000,

      // Voz
      voiceEnabled: true,
      voiceMessagesPerMonth: 100,

      // Images
      imageAnalysisPerMonth: 50,
      imageGeneration: 20,

      // NSFW y Comportamientos
      nsfwMode: true, // NSFW habilitado
      advancedBehaviors: true, // Yandere, BPD, NPD, etc.

      // Otros
      proactiveMessages: 20,
      exportConversations: true,
      prioritySupport: true,
      adsEnabled: false, // Sin publicidad
    },
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    description: "Experiencia completa sin límites",
    price: 16875, // ~$11.25 USD (Beta -25% sobre $15 USD)
    priceOriginal: 22500, // Precio sin descuento
    currency: "ARS",
    interval: "month" as const,
    mercadopagoPreapprovalPlanId: process.env.MERCADOPAGO_ULTRA_PLAN_ID,
    features: [
      "Compañeros IA ilimitados",
      "Mensajes de texto ilimitados",
      "50 mensajes con voz por mes",
      "Sistema emocional avanzado",
      "Mundos virtuales ilimitados",
      "200 análisis de imágenes por mes",
      "100 generaciones de imágenes por mes",
      "✅ Generación prioritaria de imágenes (rápida)",
      "✅ Contenido NSFW sin restricciones",
      "✅ Clonación de voz personalizada",
      "✅ Exportar conversaciones en PDF",
      "✅ Sin publicidad",
      "✅ Mensajes proactivos ilimitados",
      "Soporte prioritario 24/7",
      "Acceso anticipado a nuevas funciones",
    ],
    limits: {
      agents: -1,
      messages: -1,
      messagesPerDay: -1,
      worlds: -1,
      worldsAllowed: [],
      tokensPerMessage: 4000,

      // Voz
      voiceEnabled: true,
      voiceMessagesPerMonth: 50,
      customVoiceCloning: true, // Clonación de voz

      // Images
      imageAnalysisPerMonth: 200,
      imageGeneration: 100,
      priorityGeneration: true, // Generación rápida

      // NSFW y Comportamientos
      nsfwMode: true,
      advancedBehaviors: true,

      // Otros
      proactiveMessages: -1, // Ilimitado
      exportConversations: true,
      prioritySupport: true,
      adsEnabled: false,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

// Currency mapping by country
export const CURRENCY_BY_COUNTRY = {
  AR: { currency: "ARS", symbol: "$", locale: "es-AR" },
  BR: { currency: "BRL", symbol: "R$", locale: "pt-BR" },
  CL: { currency: "CLP", symbol: "$", locale: "es-CL" },
  CO: { currency: "COP", symbol: "$", locale: "es-CO" },
  MX: { currency: "MXN", symbol: "$", locale: "es-MX" },
  PE: { currency: "PEN", symbol: "S/", locale: "es-PE" },
  UY: { currency: "UYU", symbol: "$", locale: "es-UY" },
} as const;

export function hasPlanFeature(planId: PlanId, feature: string): boolean {
  return (PLANS[planId].features as readonly string[]).includes(feature);
}

export function getPlanLimit(
  planId: PlanId,
  resource: keyof (typeof PLANS)[PlanId]["limits"]
): number {
  return PLANS[planId].limits[resource] as number;
}

export function canCreateResource(
  planId: PlanId,
  resource: keyof (typeof PLANS)[PlanId]["limits"],
  currentCount: number
): boolean {
  const limit = getPlanLimit(planId, resource);
  if (limit === -1) return true;
  return currentCount < limit;
}

export function formatPrice(
  amount: number,
  countryCode: keyof typeof CURRENCY_BY_COUNTRY = "AR"
): string {
  const config = CURRENCY_BY_COUNTRY[countryCode];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
  }).format(amount);
}

export const MERCADOPAGO_URLS = {
  success: `${process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"}/dashboard/billing/success`,
  failure: `${process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"}/dashboard/billing/failure`,
  pending: `${process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"}/dashboard/billing/pending`,
  notification: `${process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"}/api/webhooks/mercadopago`,
};
