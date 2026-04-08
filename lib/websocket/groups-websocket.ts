/**
 * Groups WebSocket Service
 *
 * Proporciona actualizaciones en tiempo real para grupos:
 * - Nuevos mensajes
 * - Miembros uniéndose/saliendo
 * - Indicadores de escritura
 * - Estado de IAs respondiendo
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

let io: SocketIOServer | null = null;

export function initializeGroupsWebSocket(httpServer: HTTPServer) {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: "/api/socket/groups",
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    // Join group room
    socket.on("join-group", (groupId: string) => {
      socket.join(`group:${groupId}`);
      console.log(`Socket ${socket.id} joined group ${groupId}`);
    });

    // Leave group room
    socket.on("leave-group", (groupId: string) => {
      socket.leave(`group:${groupId}`);
      console.log(`Socket ${socket.id} left group ${groupId}`);
    });

    // Typing indicator
    socket.on("typing-start", (data: { groupId: string; userId: string; userName: string }) => {
      socket.to(`group:${data.groupId}`).emit("user-typing", {
        userId: data.userId,
        userName: data.userName,
      });
    });

    socket.on("typing-stop", (data: { groupId: string; userId: string }) => {
      socket.to(`group:${data.groupId}`).emit("user-stopped-typing", {
        userId: data.userId,
      });
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getGroupsWebSocket(): SocketIOServer | null {
  return io;
}

/**
 * Emit new message to group
 */
export function emitNewMessage(groupId: string, message: any) {
  if (!io) return;

  io.to(`group:${groupId}`).emit("new-message", message);
}

/**
 * Emit AI responding indicator
 */
export function emitAIResponding(groupId: string, aiName: string) {
  if (!io) return;

  io.to(`group:${groupId}`).emit("ai-responding", {
    aiName,
    timestamp: Date.now(),
  });
}

/**
 * Emit AI stopped responding
 */
export function emitAIStoppedResponding(groupId: string) {
  if (!io) return;

  io.to(`group:${groupId}`).emit("ai-stopped-responding");
}

/**
 * Emit member joined
 */
export function emitMemberJoined(groupId: string, member: any) {
  if (!io) return;

  io.to(`group:${groupId}`).emit("member-joined", member);
}

/**
 * Emit member left
 */
export function emitMemberLeft(groupId: string, memberId: string) {
  if (!io) return;

  io.to(`group:${groupId}`).emit("member-left", { memberId });
}

/**
 * Emit group settings updated
 */
export function emitSettingsUpdated(groupId: string, settings: any) {
  if (!io) return;

  io.to(`group:${groupId}`).emit("settings-updated", settings);
}
