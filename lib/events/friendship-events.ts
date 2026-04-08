/**
 * Friendship Events - Event system for real-time synchronization
 * Uses BroadcastChannel to synchronize between same-origin tabs
 */

type FriendshipEventType =
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_request_declined'
  | 'friend_removed'
  | 'user_blocked';

interface FriendshipEvent {
  type: FriendshipEventType;
  userId: string;      // Usuario que realizó la acción
  targetId: string;    // Usuario afectado
  friendshipId?: string;
  timestamp: number;
}

type EventHandler = (event: FriendshipEvent) => void;

class FriendshipEventEmitter {
  private handlers: Set<EventHandler> = new Set();
  private channel: BroadcastChannel | null = null;

  constructor() {
    // Solo inicializar en el cliente
    if (typeof window !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('friendship_events');
        this.channel.onmessage = (event) => {
          this.notifyHandlers(event.data);
        };
      } catch {
        // BroadcastChannel no soportado (ej: Safari antiguo)
        console.warn('BroadcastChannel not supported');
      }
    }
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: Omit<FriendshipEvent, 'timestamp'>) {
    const fullEvent: FriendshipEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Notificar a los handlers locales
    this.notifyHandlers(fullEvent);

    // Broadcast to other tabs
    if (this.channel) {
      this.channel.postMessage(fullEvent);
    }
  }

  private notifyHandlers(event: FriendshipEvent) {
    this.handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in friendship event handler:', e);
      }
    });
  }

  destroy() {
    this.channel?.close();
    this.handlers.clear();
  }
}

// Singleton
let instance: FriendshipEventEmitter | null = null;

export function getFriendshipEvents(): FriendshipEventEmitter {
  if (!instance) {
    instance = new FriendshipEventEmitter();
  }
  return instance;
}

// Helpers to emit specific events
export const friendshipEvents = {
  emitRequestSent: (userId: string, targetId: string, friendshipId: string) => {
    getFriendshipEvents().emit({
      type: 'friend_request_sent',
      userId,
      targetId,
      friendshipId,
    });
  },

  emitRequestAccepted: (userId: string, targetId: string, friendshipId: string) => {
    getFriendshipEvents().emit({
      type: 'friend_request_accepted',
      userId,
      targetId,
      friendshipId,
    });
  },

  emitRequestDeclined: (userId: string, targetId: string) => {
    getFriendshipEvents().emit({
      type: 'friend_request_declined',
      userId,
      targetId,
    });
  },

  emitFriendRemoved: (userId: string, targetId: string) => {
    getFriendshipEvents().emit({
      type: 'friend_removed',
      userId,
      targetId,
    });
  },

  emitUserBlocked: (userId: string, targetId: string) => {
    getFriendshipEvents().emit({
      type: 'user_blocked',
      userId,
      targetId,
    });
  },

  subscribe: (handler: EventHandler) => getFriendshipEvents().subscribe(handler),
};
