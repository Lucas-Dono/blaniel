import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { MessagingService } from '@/lib/services/messaging.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/messages/conversations/[id]/send - Enviar mensaje (endpoint legacy)
 * Use /api/messages/conversations/[id]/messages en su lugar
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { content, recipientId, contentType, attachmentUrl } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });
    }

    // Si no se proporciona recipientId, obtener el otro participante
    let targetRecipientId = recipientId;
    if (!targetRecipientId) {
      const conversation = await prisma.directConversation.findUnique({
        where: { id: (await params).id },
      });

      if (conversation) {
        const participants = conversation.participants as string[];
        targetRecipientId = participants.find(p => p !== user.id) || participants[0];
      }
    }

    if (!targetRecipientId) {
      return NextResponse.json({ error: 'recipientId requerido' }, { status: 400 });
    }

    const message = await MessagingService.sendMessage({
      conversationId: (await params).id,
      senderId: user.id,
      recipientId: targetRecipientId,
      content: content.trim(),
      contentType,
      attachmentUrl,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
