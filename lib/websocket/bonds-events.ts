/**
 * WEBSOCKET SERVER FOR REAL-TIME BOND UPDATES
 * 
 * Real-time events for:
 * - bond_updated: When rarity, affinity, etc. changes
 * - slot_available: When a slot is freed
 * - rank_changed: When global ranking changes
 * - queue_position_changed: When queue position changes
 * - milestone_reached: When a milestone is reached
 * - bond_at_risk: When bond enters decay
 */

import { Server as SocketServer } from "socket.io";
import { Server as HTTPServer } from "http";
import {type Session} from "@/lib/auth";

// Re-export types from shared file (safe for client-side imports)
export * from "./bond-event-types";
import { BondEventType } from "./bond-event-types";

let io: SocketServer | null = null;

export interface BondEvent {
  type: BondEventType;
  bondId?: string;
  userId: string;
  data: any;
  timestamp: string;
}

/**
 * Inicializar WebSocket server
 */
export function initializeBondSocket(server: HTTPServer) {
  if (io) {
    console.log("WebSocket server already initialized");
    return io;
  }

  io = new SocketServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
    path: "/api/socketio",
  });

  io.use(async (socket, next) => {
    // Authentication via session
    try {
      const session = socket.handshake.auth.session as Session | null;

      if (!session?.user?.id) {
        return next(new Error("Unauthorized"));
      }

      // Agregar userId al socket
      (socket as any).userId = session.user.id;
      next();
    } catch {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;
    console.log(`[Socket] User ${userId} connected`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Heartbeat
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    // Subscribe to specific bond events
    socket.on("subscribe_bond", (bondId: string) => {
      socket.join(`bond:${bondId}`);
      console.log(`[Socket] User ${userId} subscribed to bond ${bondId}`);
    });

    socket.on("unsubscribe_bond", (bondId: string) => {
      socket.leave(`bond:${bondId}`);
      console.log(`[Socket] User ${userId} unsubscribed from bond ${bondId}`);
    });

    // Subscribe a leaderboards
    socket.on("subscribe_leaderboard", (tier: string) => {
      socket.join(`leaderboard:${tier}`);
      console.log(`[Socket] User ${userId} subscribed to leaderboard ${tier}`);
    });

    socket.on("unsubscribe_leaderboard", (tier: string) => {
      socket.leave(`leaderboard:${tier}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User ${userId} disconnected`);
    });
  });

  console.log("✅ WebSocket server initialized");
  return io;
}

/**
 * Obtener instancia de Socket.IO
 */
export function getSocketServer(): SocketServer | null {
  return io;
}

/**
 * Emitir evento de bond actualizado
 */
export function emitBondUpdated(bondId: string, userId: string, data: any) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.BOND_UPDATED,
    bondId,
    userId,
    data,
    timestamp: new Date().toISOString(),
  };

  // Send to specific user
  io.to(`user:${userId}`).emit(BondEventType.BOND_UPDATED, event);

  // Also send to bond subscribers
  io.to(`bond:${bondId}`).emit(BondEventType.BOND_UPDATED, event);
}

/**
 * Emitir evento de slot disponible
 */
export function emitSlotAvailable(
  userId: string,
  agentId: string,
  tier: string,
  data: any
) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.SLOT_AVAILABLE,
    userId,
    data: { agentId, tier, ...data },
    timestamp: new Date().toISOString(),
  };

  io.to(`user:${userId}`).emit(BondEventType.SLOT_AVAILABLE, event);
}

/**
 * Emitir evento de cambio de ranking
 */
export function emitRankChanged(
  bondId: string,
  userId: string,
  oldRank: number | null,
  newRank: number
) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.RANK_CHANGED,
    bondId,
    userId,
    data: { oldRank, newRank },
    timestamp: new Date().toISOString(),
  };

  io.to(`user:${userId}`).emit(BondEventType.RANK_CHANGED, event);
  io.to(`bond:${bondId}`).emit(BondEventType.RANK_CHANGED, event);
}

/** Emit change event in queue position */
export function emitQueuePositionChanged(
  userId: string,
  agentId: string,
  tier: string,
  oldPosition: number,
  newPosition: number
) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.QUEUE_POSITION_CHANGED,
    userId,
    data: { agentId, tier, oldPosition, newPosition },
    timestamp: new Date().toISOString(),
  };

  io.to(`user:${userId}`).emit(BondEventType.QUEUE_POSITION_CHANGED, event);
}

/**
 * Emitir evento de milestone alcanzado
 */
export function emitMilestoneReached(
  bondId: string,
  userId: string,
  milestone: string,
  data: any
) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.MILESTONE_REACHED,
    bondId,
    userId,
    data: { milestone, ...data },
    timestamp: new Date().toISOString(),
  };

  io.to(`user:${userId}`).emit(BondEventType.MILESTONE_REACHED, event);
}

/**
 * Emitir evento de bond en riesgo
 */
export function emitBondAtRisk(
  bondId: string,
  userId: string,
  decayPhase: string,
  daysInactive: number
) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.BOND_AT_RISK,
    bondId,
    userId,
    data: { decayPhase, daysInactive },
    timestamp: new Date().toISOString(),
  };

  io.to(`user:${userId}`).emit(BondEventType.BOND_AT_RISK, event);
}

/**
 * Emitir evento de bond liberado
 */
export function emitBondReleased(
  bondId: string,
  userId: string,
  reason: string,
  legacyBadge: string
) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.BOND_RELEASED,
    bondId,
    userId,
    data: { reason, legacyBadge },
    timestamp: new Date().toISOString(),
  };

  io.to(`user:${userId}`).emit(BondEventType.BOND_RELEASED, event);
}

/**
 * Emitir evento de bond establecido
 */
export function emitBondEstablished(
  bondId: string,
  userId: string,
  tier: string,
  agentId: string
) {
  if (!io) return;

  const event: BondEvent = {
    type: BondEventType.BOND_ESTABLISHED,
    bondId,
    userId,
    data: { tier, agentId },
    timestamp: new Date().toISOString(),
  };

  io.to(`user:${userId}`).emit(BondEventType.BOND_ESTABLISHED, event);
}

/** Broadcast a leaderboard (to all subscribers) */
export function broadcastLeaderboardUpdate(tier: string, leaderboard: any[]) {
  if (!io) return;

  io.to(`leaderboard:${tier}`).emit("leaderboard_updated", {
    tier,
    leaderboard,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Cerrar WebSocket server
 */
export function closeBondSocket() {
  if (io) {
    io.close();
    io = null;
    console.log("WebSocket server closed");
  }
}

// Stats de conexiones
export function getActiveConnections(): number {
  return io?.sockets.sockets.size || 0;
}

export function getRoomSize(room: string): number {
  return io?.sockets.adapter.rooms.get(room)?.size || 0;
}

export default io;
