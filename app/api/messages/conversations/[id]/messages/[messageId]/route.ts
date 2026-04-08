import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { MessagingService } from '@/lib/services/messaging.service';

/**
 * PATCH /api/messages/conversations/[id]/messages/[messageId] - Editar mensaje
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { messageId } = await params;
    const { content } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });
    }

    const updated = await MessagingService.editMessage(
      messageId,
      user.id,
      content.trim()
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error editing message:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/messages/conversations/[id]/messages/[messageId] - Eliminar mensaje
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { messageId } = await params;
    const result = await MessagingService.deleteMessage(messageId, user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
