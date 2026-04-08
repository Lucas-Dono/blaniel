/**
 * Socket.IO Event Types and Interfaces
 * Defines all real-time communication events and their payloads
 */

// Client -> Server Events
export interface ClientToServerEvents {
  // Chat events
  "chat:message": (data: {
    agentId: string;
    message: string;
    userId: string;
  }) => void;
  "chat:typing": (data: { agentId: string; userId: string; isTyping: boolean }) => void;
  "chat:join": (data: { agentId: string; userId: string }) => void;
  "chat:leave": (data: { agentId: string; userId: string }) => void;

  // Room management (WhatsAppChat)
  "join:agent:room": (data: { agentId: string }) => void;
  "leave:agent:room": (data: { agentId: string }) => void;

  // User message with metadata
  "user:message": (data: {
    agentId: string;
    userId: string;
    message: string;
    metadata?: {
      type?: 'text' | 'audio' | 'gif' | 'image';
      emotion?: string;
      intensity?: number;
      tone?: string;
      duration?: number;
      [key: string]: unknown;
    };
  }) => void;

  // Message reactions
  "message:react": (data: {
    messageId: string;
    emoji: string;
    userId: string;
  }) => void;

  // Presence events
  "presence:online": (data: { userId: string }) => void;
  "presence:offline": (data: { userId: string }) => void;

  // Agent events
  "agent:subscribe": (data: { agentId: string; userId: string }) => void;
  "agent:unsubscribe": (data: { agentId: string; userId: string }) => void;

  // Group events
  "group:join": (data: { groupId: string; userId: string }) => void;
  "group:leave": (data: { groupId: string; userId: string }) => void;
  "group:typing": (data: { groupId: string; userId: string; userName: string; isTyping: boolean }) => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  // Chat events
  "chat:message": (data: ChatMessageEvent) => void;
  "chat:message:stream": (data: StreamChunkEvent) => void;
  "chat:message:complete": (data: MessageCompleteEvent) => void;
  "chat:typing": (data: TypingEvent) => void;
  "chat:error": (data: ErrorEvent) => void;

  // Agent messages (WhatsAppChat)
  "agent:message": (data: AgentMessageEvent) => void;
  "agent:typing": (data: { agentId: string; isTyping: boolean }) => void;

  // Message reactions (WhatsAppChat)
  "message:reactions:updated": (data: {
    messageId: string;
    reactions: Reaction[];
  }) => void;

  // Presence events
  "presence:update": (data: PresenceUpdateEvent) => void;
  "presence:user:online": (data: { userId: string; timestamp: number }) => void;
  "presence:user:offline": (data: { userId: string; timestamp: number }) => void;

  // Agent events
  "agent:updated": (data: AgentUpdatedEvent) => void;
  "agent:deleted": (data: { agentId: string }) => void;

  // System events
  "system:notification": (data: SystemNotification) => void;
  "system:connection": (data: { connected: boolean; timestamp: number }) => void;

  // Relation/Emotional state updates
  "relation:updated": (data: RelationUpdateEvent) => void;

  // Group events
  "group:message": (data: GroupMessageEvent) => void;
  "group:typing": (data: GroupTypingEvent) => void;
  "group:member:joined": (data: GroupMemberEvent) => void;
  "group:member:left": (data: { groupId: string; memberId: string; memberType: 'user' | 'agent' }) => void;
  "group:ai:responding": (data: { groupId: string; agentId: string; agentName: string }) => void;
  "group:ai:stopped": (data: { groupId: string; agentId: string }) => void;
}

// Event payload interfaces
export interface ChatMessageEvent {
  id: string;
  agentId: string;
  userId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: {
    emotions?: string[];
    relationLevel?: string;
    tokensUsed?: number;
  };
}

export interface StreamChunkEvent {
  agentId: string;
  messageId: string;
  chunk: string;
  index: number;
  timestamp: number;
}

export interface MessageCompleteEvent {
  agentId: string;
  messageId: string;
  fullContent: string;
  timestamp: number;
  metadata: {
    emotions: string[];
    relationLevel: string;
    tokensUsed: number;
    state: {
      trust: number;
      affinity: number;
      respect: number;
    };
  };
}

export interface TypingEvent {
  agentId: string;
  userId?: string;
  isTyping: boolean;
  timestamp: number;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface PresenceUpdateEvent {
  userId: string;
  status: "online" | "offline" | "away";
  lastSeen: number;
}

export interface AgentUpdatedEvent {
  agentId: string;
  updates: {
    name?: string;
    personality?: string;
    purpose?: string;
    tone?: string;
    visibility?: string;
  };
  timestamp: number;
}

export interface SystemNotification {
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: number;
  action?: {
    label: string;
    url: string;
  };
}

export interface RelationUpdateEvent {
  agentId: string;
  userId: string;
  state: {
    trust: number;
    affinity: number;
    respect: number;
  };
  relationLevel: string;
  emotions: string[];
  timestamp: number;
}

export interface AgentMessageEvent {
  messageId: string;
  agentId: string;
  content: {
    text?: string;
    audioUrl?: string;
    imageUrl?: string;
    emotion?: string;
  };
  // Behavior system metadata
  behaviors?: {
    active: string[];
    phase?: number;
    safetyLevel: 'SAFE' | 'WARNING' | 'CRITICAL' | 'EXTREME_DANGER';
    triggers: string[];
    intensity?: number;
  };
  // Emotional state
  emotional?: {
    state: {
      trust: number;
      affinity: number;
      respect: number;
    };
    emotions: string[];
    relationLevel: number;
  };
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  reacted: boolean;
}

// Group event interfaces
export interface GroupMessageEvent {
  id: string;
  groupId: string;
  authorType: 'user' | 'agent';
  authorId: string;
  content: string;
  contentType?: string;
  mediaUrl?: string;
  createdAt: string;
  replyToId?: string;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  };
  agent?: {
    id: string;
    name: string;
    avatar: string | null;
  };
  replyTo?: {
    id: string;
    content: string;
    authorType: 'user' | 'agent';
    user?: { name: string | null };
    agent?: { name: string };
  };
}

export interface GroupTypingEvent {
  groupId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: number;
}

export interface GroupMemberEvent {
  groupId: string;
  memberId: string;
  memberType: 'user' | 'agent';
  role: string;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  };
  agent?: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

// Room naming conventions
export const getRoomName = {
  agent: (agentId: string) => `agent:${agentId}`,
  user: (userId: string) => `user:${userId}`,
  chat: (agentId: string, userId: string) => `chat:${agentId}:${userId}`,
  group: (groupId: string) => `group:${groupId}`,
  global: () => "global",
};

// Connection states
export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTING = "disconnecting",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

// Typing indicator timeout (milliseconds)
export const TYPING_TIMEOUT = 3000;

// Presence heartbeat interval (milliseconds)
export const PRESENCE_HEARTBEAT = 30000;
