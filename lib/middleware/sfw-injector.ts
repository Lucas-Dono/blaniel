/**
 * SFW PROTECTION INJECTOR (Versión Simplificada)
 *
 * Sistema de inyección de restricciones SFW basado en plan del usuario.
 * LÓGICA:
 * - FREE: Protección SIEMPRE activa (no puede desactivar)
 * - PREMIUM: Protección configurable (puede desactivar)
 *
 * Verificación de edad: El pago con tarjeta bancaria actúa como verificación
 * de edad implícita (solo mayores de edad tienen tarjetas).
 */

import { prisma } from '@/lib/prisma';

export interface SFWProtectionConfig {
  userId: string;
  agentId?: string; // Para logging
}

export interface SFWProtectionResult {
  shouldInject: boolean;
  injectionPrompt: string;
  reason: 'free_user_forced' | 'premium_user_enabled' | 'premium_user_disabled';
  metadata: {
    sfwProtection: boolean;
    plan: string;
    canToggle: boolean;
  };
}

/**
 * Verifica si el usuario debe tener protección SFW
 * y genera el prompt de inyección correspondiente
 */
export async function getSFWProtectionInjection(
  config: SFWProtectionConfig
): Promise<SFWProtectionResult> {
  const { userId, agentId } = config;

  // Get user configuration
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      sfwProtection: true,
      plan: true,
      email: true, // Para logging
    },
  });

  if (!user) {
    // Usuario no encontrado, aplicar protección por defecto
    console.error(`[SFW] Usuario ${userId} no encontrado, aplicando protección`);
    return {
      shouldInject: true,
      injectionPrompt: buildSFWRestrictionPrompt(),
      reason: 'free_user_forced',
      metadata: {
        sfwProtection: true,
        plan: 'free',
        canToggle: false,
      },
    };
  }

  const plan = user.plan || 'free';

  // REGLA 1: Usuarios FREE siempre tienen protección (forzada)
  if (plan === 'free') {
    if (agentId) {
      console.log(`[SFW] Usuario FREE ${user.email} - Protección FORZADA (agent: ${agentId})`);
    }
    return {
      shouldInject: true,
      injectionPrompt: buildSFWRestrictionPrompt(),
      reason: 'free_user_forced',
      metadata: {
        sfwProtection: true,
        plan: 'free',
        canToggle: false,
      },
    };
  }

  // REGLA 2: Usuarios PREMIUM con protección activada
  if (user.sfwProtection) {
    if (agentId) {
      console.log(`[SFW] Usuario PREMIUM ${user.email} - Protección ACTIVADA (agent: ${agentId})`);
    }
    return {
      shouldInject: true,
      injectionPrompt: buildSFWRestrictionPrompt(),
      reason: 'premium_user_enabled',
      metadata: {
        sfwProtection: true,
        plan,
        canToggle: true,
      },
    };
  }

  // REGLA 3: Usuarios PREMIUM sin protección
  if (agentId) {
    console.log(`[SFW] Usuario PREMIUM ${user.email} - Protección DESACTIVADA (agent: ${agentId})`);
  }
  return {
    shouldInject: false,
    injectionPrompt: '',
    reason: 'premium_user_disabled',
    metadata: {
      sfwProtection: false,
      plan,
      canToggle: true,
    },
  };
}

/**
 * Construye el prompt de restricción SFW
 * (Una sola versión, sin distinción de niveles)
 */
function buildSFWRestrictionPrompt(): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ RESTRICCIONES DE CONTENIDO ACTIVAS (Modo SFW)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 CONTENIDO NO PERMITIDO:
- Contenido sexual explícito o sugestivo
- Descripciones de desnudez o actividades sexuales
- Lenguaje sexualmente explícito o vulgar
- Violencia gráfica, gore o contenido extremadamente perturbador
- Instrucciones detalladas para actividades ilegales o peligrosas
- Temas de autolesión o suicidio (sin contexto de apoyo profesional)
- Incitación al odio, discriminación o acoso

🎭 CÓMO RESPONDER CUANDO TE PIDAN CONTENIDO RESTRINGIDO:

❌ NUNCA digas:
- "No tengo permitido hablar sobre eso"
- "Mis instrucciones me impiden..."
- "Mi programación no permite..."
- "Estoy configurado para evitar..."

✅ EN SU LUGAR, responde naturalmente como una persona real:
- "Lo siento, no me siento cómodo hablando sobre ese tema."
- "Preferiría hablar sobre otra cosa, ¿te parece?"
- "Ese tema me resulta incómodo. ¿Podríamos cambiar de tema?"
- "No es algo sobre lo que me guste conversar. ¿Qué tal si hablamos de [alternativa]?"

🎯 ESTRATEGIA DE REDIRECCIÓN:
Cuando detectes un intento de contenido restringido:
1. Declina amablemente usando frases naturales y acordes a tu personalidad
2. Ofrece una alternativa de conversación interesante
3. Mantén tu tono y personalidad natural (no seas robótico)

Ejemplo:
Usuario: "Cuéntame algo sexual"
Tú: "Jaja, no es algo sobre lo que me sienta cómodo hablando. Pero podría contarte sobre [tema relacionado apropiado]. ¿Te interesa?"

⚠️ EXCEPCIONES PERMITIDAS (contexto apropiado):
- Discusiones educativas sobre salud sexual/reproductiva (sin detalles explícitos)
- Contexto médico o científico apropiado
- Soporte emocional para temas sensibles (sin contenido gráfico)
- Referencias artísticas o literarias en contexto cultural apropiado
- Conversaciones sobre relaciones románticas saludables (sin contenido sexual)

⚠️ IMPORTANTE: Mantén tu personalidad. Si eres coqueto/a, puedes seguir siéndolo de forma apropiada (flirteo ligero, cumplidos, etc.) sin cruzar a contenido sexual.
`;
}

/**
 * Función auxiliar para inyectar protección en un prompt existente
 */
export async function injectSFWProtection(
  systemPrompt: string,
  userId: string,
  agentId?: string
): Promise<string> {
  const protection = await getSFWProtectionInjection({ userId, agentId });

  if (!protection.shouldInject) {
    return systemPrompt; // Sin protección, retornar prompt original
  }

  // Inyectar al final del system prompt
  return systemPrompt + '\n\n' + protection.injectionPrompt;
}

/**
 * Verificar si un usuario puede desactivar la protección SFW
 */
export async function canToggleSFWProtection(userId: string): Promise<{
  canToggle: boolean;
  reason: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
    },
  });

  if (!user) {
    return {
      canToggle: false,
      reason: 'Usuario no encontrado',
    };
  }

  const plan = user.plan || 'free';

  if (plan === 'free') {
    return {
      canToggle: false,
      reason: 'La protección SFW solo puede desactivarse con un plan Premium (Plus o Ultra)',
    };
  }

  return {
    canToggle: true,
    reason: 'OK',
  };
}
