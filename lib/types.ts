export type AgentKind = "companion" | "assistant";
export type AgentVisibility = "private" | "world" | "public";
export type Plan = "free" | "plus" | "ultra";

export interface User {
  id: string;
  email: string;
  name?: string;
  plan: Plan;
  createdAt: Date;
}

export interface Agent {
  id: string;
  userId: string;
  kind: AgentKind;
  name: string;
  description?: string;
  gender?: string;
  personality?: string;
  tone?: string;
  purpose?: string;
  profile: Record<string, unknown>;
  systemPrompt: string;
  visibility: AgentVisibility;
  avatar?: string;
  createdAt: Date;
}

export interface World {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface WorldAgent {
  worldId: string;
  agentId: string;
  joinedAt: Date;
}

export interface Relation {
  id: string;
  subjectId: string;
  targetId: string;
  trust: number;
  affinity: number;
  respect: number;
  privateState: Record<string, unknown>;
  visibleState: Record<string, unknown>;
  updatedAt: Date;
}

export interface Message {
  id: string;
  worldId?: string;
  agentId?: string;
  userId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

export interface EmotionalState {
  valence: number;
  arousal: number;
  dominance: number;
  trust: number;
  affinity: number;
  respect: number;
  love?: number;
  curiosity?: number;
}

export interface ConversationContext {
  agentId: string;
  messages: Message[];
  emotionalState: EmotionalState;
  relationshipLevel: number;
}
