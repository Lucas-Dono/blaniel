/**
 * Bond Event Types
 *
 * Shared types for real-time bond events (client + server)
 */

// Tipos de eventos
export enum BondEventType {
  BOND_UPDATED = "bond_updated",
  SLOT_AVAILABLE = "slot_available",
  RANK_CHANGED = "rank_changed",
  QUEUE_POSITION_CHANGED = "queue_position_changed",
  MILESTONE_REACHED = "milestone_reached",
  BOND_AT_RISK = "bond_at_risk",
  BOND_RELEASED = "bond_released",
  BOND_ESTABLISHED = "bond_established",
}

// Payloads de eventos
export interface BondUpdatedPayload {
  bondId: string;
  userId: string;
  agentId: string;
  changes: {
    rarityTier?: string;
    rarityScore?: number;
    affinityLevel?: number;
    trust?: number;
    respect?: number;
  };
}

export interface SlotAvailablePayload {
  agentId: string;
  agentName: string;
  slotNumber: number;
  rarityTier: string;
}

export interface RankChangedPayload {
  bondId: string;
  userId: string;
  oldRank?: number;
  newRank: number;
  rarityTier: string;
}

export interface QueuePositionChangedPayload {
  userId: string;
  agentId: string;
  oldPosition?: number;
  newPosition: number;
  estimatedWaitTime?: string;
}

export interface MilestoneReachedPayload {
  bondId: string;
  userId: string;
  agentId: string;
  milestone: string;
  description: string;
  reward?: {
    type: string;
    value: string | number;
  };
}

export interface BondAtRiskPayload {
  bondId: string;
  userId: string;
  agentId: string;
  reason: string;
  decayRate: number;
  hoursUntilRelease?: number;
}

export interface BondReleasedPayload {
  bondId: string;
  userId: string;
  agentId: string;
  reason: string;
  slotFreed: number;
}

export interface BondEstablishedPayload {
  bondId: string;
  userId: string;
  agentId: string;
  agentName: string;
  rarityTier: string;
  slotNumber: number;
}
