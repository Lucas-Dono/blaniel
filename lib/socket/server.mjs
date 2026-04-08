/**
 * WebSocket Server for Real-time Features (ESM Module)
 * Handles real-time chat, agent typing indicators, notifications, and group chats
 */

import { Server as SocketIOServer } from "socket.io";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client (solo errores y warnings)
const prisma = new PrismaClient({
  log: ["error", "warn"],
});

// Socket.IO server instance (stored in globalThis for sharing with Next.js)
// @ts-ignore - Using globalThis for cross-module singleton
let io = globalThis.__socketIO || null;

// Typing timeouts storage
const typingTimeouts = new Map();
const groupTypingTimeouts = new Map();

// Timeout duration for typing indicators (5 seconds)
const TYPING_TIMEOUT = 5000;

// Room name generators
const getRoomName = {
  user: (userId) => `user:${userId}`,
  chat: (agentId, userId) => `chat:${agentId}:${userId}`,
  agent: (agentId) => `agent:${agentId}`,
  group: (groupId) => `group:${groupId}`,
  global: () => "global",
};

/**
 * Lista de orígenes permitidos para CORS en WebSockets
 */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://creador-inteligencias.vercel.app',
  process.env.NEXTAUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

/**
 * Validar origen para CORS de Socket.IO
 */
function validateSocketOrigin(origin, callback) {
  // Desarrollo: permitir localhost y 127.0.0.1 con cualquier puerto
  if (process.env.NODE_ENV !== 'production') {
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (!origin || localhostPattern.test(origin)) {
      return callback(null, true);
    }
  }

  // Producción: validación exacta contra whitelist
  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }

  // Origen no permitido
  console.warn('[SocketServer] CORS: Origin not allowed:', origin);
  callback(new Error('Not allowed by CORS'));
}

/**
 * Initialize Socket.IO server
 */
export function initSocketServer(httpServer) {
  if (io) {
    console.log('[Socket.IO] Server already initialized');
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: validateSocketOrigin,
      credentials: true,
    },
    path: "/api/socketio",
    addTrailingSlash: false,
  });

  // Store in globalThis for sharing with Next.js API routes
  globalThis.__socketIO = io;

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Validate token - check if it's an API key
      const user = await prisma.user.findUnique({
        where: { apiKey: token },
        select: { id: true, plan: true },
      });

      if (!user) {
        return next(new Error("Invalid authentication token"));
      }

      socket.userId = user.id;
      next();
    } catch (error) {
      console.error("[Socket] Authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] User connected: ${userId}`);

    // Join user's personal room
    socket.join(getRoomName.user(userId));

    // Emit connection confirmation
    socket.emit("system:connection", {
      connected: true,
      timestamp: Date.now(),
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CHAT EVENTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Chat: Join agent room
    socket.on("chat:join", async (data) => {
      try {
        const agent = await prisma.agent.findFirst({
          where: { id: data.agentId, userId },
        });

        if (!agent) {
          socket.emit("chat:error", {
            code: "AGENT_NOT_FOUND",
            message: "Agent not found",
            timestamp: Date.now(),
          });
          return;
        }

        const roomName = getRoomName.chat(data.agentId, userId);
        socket.join(roomName);
        console.log(`[Socket] User ${userId} joined chat ${roomName}`);
      } catch (error) {
        console.error("[Socket] Error joining chat:", error);
        socket.emit("chat:error", {
          code: "JOIN_ERROR",
          message: "Failed to join chat",
          timestamp: Date.now(),
        });
      }
    });

    // Chat: Leave agent room
    socket.on("chat:leave", (data) => {
      const roomName = getRoomName.chat(data.agentId, userId);
      socket.leave(roomName);
      console.log(`[Socket] User ${userId} left chat ${roomName}`);
    });

    // Chat: Typing indicator
    socket.on("chat:typing", (data) => {
      handleTypingIndicator(data);
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GROUP EVENTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Group: Join room
    socket.on("group:join", async (data) => {
      try {
        // Verify user is member of the group
        const member = await prisma.groupMember.findFirst({
          where: {
            groupId: data.groupId,
            userId: data.userId,
            memberType: "user",
            isActive: true,
          },
        });

        if (!member) {
          console.warn(`[Socket] User ${data.userId} not member of group ${data.groupId}`);
          return;
        }

        const roomName = getRoomName.group(data.groupId);
        socket.join(roomName);
        console.log(`[Socket] User ${data.userId} joined group room ${roomName}`);
      } catch (error) {
        console.error("[Socket] Error joining group:", error);
      }
    });

    // Group: Leave room
    socket.on("group:leave", (data) => {
      const roomName = getRoomName.group(data.groupId);
      socket.leave(roomName);
      console.log(`[Socket] User ${data.userId} left group room ${roomName}`);
    });

    // Group: Typing indicator
    socket.on("group:typing", (data) => {
      handleGroupTypingIndicator(data);
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // AGENT EVENTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Agent: Subscribe to updates
    socket.on("agent:subscribe", async (data) => {
      try {
        const agent = await prisma.agent.findFirst({
          where: { id: data.agentId, userId },
        });

        if (agent) {
          socket.join(getRoomName.agent(data.agentId));
        }
      } catch (error) {
        console.error("[Socket] Error subscribing to agent:", error);
      }
    });

    // Agent: Unsubscribe from updates
    socket.on("agent:unsubscribe", (data) => {
      socket.leave(getRoomName.agent(data.agentId));
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PRESENCE EVENTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Presence: Manual online
    socket.on("presence:online", (data) => {
      socket.to(getRoomName.global()).emit("presence:user:online", {
        userId: data.userId,
        timestamp: Date.now(),
      });
    });

    // Presence: Manual offline
    socket.on("presence:offline", (data) => {
      io.to(getRoomName.global()).emit("presence:user:offline", {
        userId: data.userId,
        timestamp: Date.now(),
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DISCONNECT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${userId}`);
      io.to(getRoomName.global()).emit("presence:user:offline", {
        userId,
        timestamp: Date.now(),
      });
    });
  });

  console.log("[Socket.IO] Server initialized successfully");
  return io;
}

/**
 * Handle chat typing indicator with timeout
 */
function handleTypingIndicator(data) {
  const { agentId, userId, isTyping } = data;
  const roomName = getRoomName.chat(agentId, userId);
  const timeoutKey = `${agentId}:${userId}`;

  // Clear existing timeout
  const existingTimeout = typingTimeouts.get(timeoutKey);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Emit typing event
  io.to(roomName).emit("chat:typing", {
    agentId,
    userId,
    isTyping,
    timestamp: Date.now(),
  });

  // Set timeout to auto-stop typing
  if (isTyping) {
    const timeout = setTimeout(() => {
      io.to(roomName).emit("chat:typing", {
        agentId,
        userId,
        isTyping: false,
        timestamp: Date.now(),
      });
      typingTimeouts.delete(timeoutKey);
    }, TYPING_TIMEOUT);

    typingTimeouts.set(timeoutKey, timeout);
  }
}

/**
 * Handle group typing indicator with timeout
 */
function handleGroupTypingIndicator(data) {
  const { groupId, userId, userName, isTyping } = data;
  const roomName = getRoomName.group(groupId);
  const timeoutKey = `group:${groupId}:${userId}`;

  // Clear existing timeout
  const existingTimeout = groupTypingTimeouts.get(timeoutKey);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Emit typing event to all in room
  io.to(roomName).emit("group:typing", {
    groupId,
    userId,
    userName,
    isTyping,
    timestamp: Date.now(),
  });

  // Set timeout to auto-stop typing
  if (isTyping) {
    const timeout = setTimeout(() => {
      io.to(roomName).emit("group:typing", {
        groupId,
        userId,
        userName,
        isTyping: false,
        timestamp: Date.now(),
      });
      groupTypingTimeouts.delete(timeoutKey);
    }, TYPING_TIMEOUT);

    groupTypingTimeouts.set(timeoutKey, timeout);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTED EMIT FUNCTIONS
// These are called from other parts of the application
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get Socket.IO server instance
 */
export function getSocketServer() {
  return io;
}

/**
 * Emit group message to all members
 */
export function emitGroupMessage(groupId, message) {
  if (!io) {
    console.warn('[Socket] Cannot emit group:message - server not initialized');
    return;
  }
  io.to(getRoomName.group(groupId)).emit("group:message", message);
}

/**
 * Emit member joined event to group
 */
export function emitGroupMemberJoined(groupId, member) {
  if (!io) {
    console.warn('[Socket] Cannot emit group:member:joined - server not initialized');
    return;
  }
  io.to(getRoomName.group(groupId)).emit("group:member:joined", member);
}

/**
 * Emit member left event to group
 */
export function emitGroupMemberLeft(groupId, memberId, memberType) {
  if (!io) {
    console.warn('[Socket] Cannot emit group:member:left - server not initialized');
    return;
  }
  io.to(getRoomName.group(groupId)).emit("group:member:left", {
    groupId,
    memberId,
    memberType,
  });
}

/**
 * Emit AI responding indicator
 */
export function emitGroupAIResponding(groupId, agentId, agentName) {
  if (!io) {
    console.warn('[Socket] Cannot emit group:ai:responding - server not initialized');
    return;
  }
  io.to(getRoomName.group(groupId)).emit("group:ai:responding", {
    groupId,
    agentId,
    agentName,
  });
}

/**
 * Emit AI stopped responding
 */
export function emitGroupAIStopped(groupId, agentId) {
  if (!io) {
    console.warn('[Socket] Cannot emit group:ai:stopped - server not initialized');
    return;
  }
  io.to(getRoomName.group(groupId)).emit("group:ai:stopped", {
    groupId,
    agentId,
  });
}

/**
 * Emit agent update to all subscribers
 */
export function emitAgentUpdate(agentId, updates) {
  if (!io) return;
  io.to(getRoomName.agent(agentId)).emit("agent:updated", {
    agentId,
    updates,
    timestamp: Date.now(),
  });
}

/**
 * Emit agent deletion to all subscribers
 */
export function emitAgentDeleted(agentId) {
  if (!io) return;
  io.to(getRoomName.agent(agentId)).emit("agent:deleted", {
    agentId,
  });
}

/**
 * Send system notification to user
 */
export function sendSystemNotification(userId, notification) {
  if (!io) return;
  io.to(getRoomName.user(userId)).emit("system:notification", {
    ...notification,
    timestamp: Date.now(),
  });
}

export default initSocketServer;
