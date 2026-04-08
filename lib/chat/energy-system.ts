import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type { EnergyState, UserTier } from "./types";
import { TIER_LIMITS } from "./tier-limits";

/**
 * Tier-based Energy System
 * 
 * Manages the character's fatigue based on how much they have conversed.
 * - FREE: Gets tired quickly (upgrade incentive)
 * - PLUS: Gets tired moderately
 * - ULTRA: NEVER gets tired (unlimited)
 */

// Cache en memoria para evitar writes constantes a DB
const energyCache = new Map<string, EnergyState>();

/** Gets or initializes the energy state for an agent */
export async function getEnergyState(agentId: string, _userId: string): Promise<EnergyState> {
  // Verificar cache
  const cached = energyCache.get(agentId);
  if (cached && Date.now() - cached.lastDecayAt.getTime() < 5 * 60 * 1000) {
    // Cache valid for 5 minutes
    return cached;
  }

  // Buscar en DB o crear nuevo
  let energyState = await prisma.agentEnergyState.findUnique({
    where: { agentId },
  });

  if (!energyState) {
    // Create nuevo estado
    energyState = await prisma.agentEnergyState.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        current: 100,
        max: 100,
        lastDecayAt: new Date(),
        conversationStartedAt: new Date(),
        messagesSinceReset: 0,
      },
    });
  }

  const state: EnergyState = {
    current: energyState.current,
    max: energyState.max,
    lastDecayAt: energyState.lastDecayAt,
    conversationStartedAt: energyState.conversationStartedAt,
    messagesSinceReset: energyState.messagesSinceReset,
  };

  // Cachear
  energyCache.set(agentId, state);

  return state;
}

/** Consumes energy after a message */
export async function consumeEnergy(
  agentId: string,
  userId: string,
  tier: UserTier
): Promise<EnergyState> {
  const limits = TIER_LIMITS[tier];

  // Ultra: No energy consumption
  if (limits.hasUnlimitedEnergy) {
    return {
      current: 100,
      max: 100,
      lastDecayAt: new Date(),
      conversationStartedAt: new Date(),
      messagesSinceReset: 0,
    };
  }

  const state = await getEnergyState(agentId, userId);

  // Calcular decay
  const messagesSinceReset = state.messagesSinceReset + 1;
  const energyDrain = limits.energyDrainRate * 10; // Drena cada mensaje

  // New energy (cannot drop below 0)
  const newEnergy = Math.max(0, state.current - energyDrain);

  // Update en DB
  const updated = await prisma.agentEnergyState.update({
    where: { agentId },
    data: {
      current: newEnergy,
      lastDecayAt: new Date(),
      messagesSinceReset,
    },
  });

  const newState: EnergyState = {
    current: updated.current,
    max: updated.max,
    lastDecayAt: updated.lastDecayAt,
    conversationStartedAt: updated.conversationStartedAt,
    messagesSinceReset: updated.messagesSinceReset,
  };

  // Update cache
  energyCache.set(agentId, newState);

  return newState;
}

/** Resets the energy (after the reset time) */
export async function resetEnergyIfNeeded(
  agentId: string,
  userId: string,
  tier: UserTier
): Promise<boolean> {
  const limits = TIER_LIMITS[tier];

  // Ultra: No necesita reset
  if (limits.hasUnlimitedEnergy || !limits.resetHours) {
    return false;
  }

  const state = await getEnergyState(agentId, userId);

  // Check if the reset time has passed
  const hoursSinceStart = (Date.now() - state.conversationStartedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceStart >= limits.resetHours) {
    // Reset completo
    await prisma.agentEnergyState.update({
      where: { agentId },
      data: {
        current: 100,
        conversationStartedAt: new Date(),
        messagesSinceReset: 0,
        lastDecayAt: new Date(),
      },
    });

    // Limpiar cache
    energyCache.delete(agentId);

    return true;
  }

  return false;
}

/**
 * Gradual energy recovery (passive)
 * Call periodically or when the user returns after a while
 */
export async function recoverEnergy(agentId: string, tier: UserTier): Promise<void> {
  const limits = TIER_LIMITS[tier];

  // Ultra: Siempre 100%
  if (limits.hasUnlimitedEnergy) {
    return;
  }

  const state = energyCache.get(agentId);
  if (!state) return;

  // Recover energy over time (1% per hour without speaking)
  const hoursSinceLastMessage = (Date.now() - state.lastDecayAt.getTime()) / (1000 * 60 * 60);
  const recovery = Math.min(100 - state.current, hoursSinceLastMessage * 1);

  if (recovery > 0) {
    await prisma.agentEnergyState.update({
      where: { agentId },
      data: {
        current: Math.min(100, state.current + recovery),
        lastDecayAt: new Date(),
      },
    });

    // Limpiar cache para refrescar
    energyCache.delete(agentId);
  }
}

/** Clears the energy cache (for testing or admin) */
export function clearEnergyCache(agentId?: string): void {
  if (agentId) {
    energyCache.delete(agentId);
  } else {
    energyCache.clear();
  }
}
