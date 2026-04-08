/**
 * Socket.IO Chat Events
 *
 * Manejo de eventos de chat en tiempo real
 */

import { Server as SocketServer, Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

/**
 * Register basic chat events (placeholder)
 * TODO: Implement full chat events when emotional system modules are complete
 */
export function registerChatEvents(io: SocketServer, socket: Socket) {
  console.log("[Socket] Basic chat events registered");

  // Placeholder - implement when modules are ready
  socket.on("message:send", (data) => {
    console.log("[Socket] Message received:", data);
  });
}

/**
 * Register reaction events for WhatsApp-like message reactions
 */
export function registerReactionEvents(io: SocketServer, socket: Socket) {
  /**
   * Usuario reacciona a un mensaje
   */
  socket.on(
    "message:react",
    async (data: { messageId: string; emoji: string; userId: string }) => {
      try {
        console.log(`[Socket] User ${data.userId} reacting to message ${data.messageId} with ${data.emoji}`);

        // 1. Verificar que el mensaje existe
        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
          select: { id: true, agentId: true },
        });

        if (!message) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        if (!message.agentId) {
          socket.emit("error", { message: "Message has no agent context" });
          return;
        }

        // 2. Search for existing reaction
        const existingReaction = await prisma.reaction.findUnique({
          where: {
            messageId_emoji_userId: {
              messageId: data.messageId,
              emoji: data.emoji,
              userId: data.userId,
            },
          },
        });

        if (existingReaction) {
          // Toggle: Remover reacción
          await prisma.reaction.delete({
            where: { id: existingReaction.id },
          });
        } else {
          // Add new reaction
          await prisma.reaction.create({
            data: {
              id: nanoid(),
              messageId: data.messageId,
              emoji: data.emoji,
              userId: data.userId,
            },
          });
        }

        // 3. Obtener todas las reacciones actualizadas con conteo
        const reactions = await prisma.reaction.groupBy({
          by: ['emoji'],
          where: {
            messageId: data.messageId,
          },
          _count: {
            emoji: true,
          },
        });

        // 4. Obtener usuarios que reaccionaron a cada emoji
        const reactionsWithUsers = await Promise.all(
          reactions.map(async (reaction) => {
            const users = await prisma.reaction.findMany({
              where: {
                messageId: data.messageId,
                emoji: reaction.emoji,
              },
              select: {
                userId: true,
              },
            });

            return {
              emoji: reaction.emoji,
              count: reaction._count.emoji,
              users: users.map(u => u.userId),
              reacted: users.some(u => u.userId === data.userId),
            };
          })
        );

        // 5. Emitir a todos en la sala del agente
        const roomId = message.agentId;
        io.to(roomId).emit("message:reactions:updated", {
          messageId: data.messageId,
          reactions: reactionsWithUsers,
        });

        console.log(`[Socket] Reactions updated for message ${data.messageId}`);
      } catch (error: any) {
        console.error("[Socket] Error handling reaction:", error);
        socket.emit("error", {
          message: "Failed to process reaction",
          details: error.message,
        });
      }
    }
  );

  /**
   * Usuario se une a la sala del agente
   */
  socket.on("join:agent:room", (data: { agentId: string }) => {
    socket.join(data.agentId);
    console.log(`[Socket] User joined agent room: ${data.agentId}`);
  });

  /**
   * Usuario sale de la sala del agente
   */
  socket.on("leave:agent:room", (data: { agentId: string }) => {
    socket.leave(data.agentId);
    console.log(`[Socket] User left agent room: ${data.agentId}`);
  });
}
