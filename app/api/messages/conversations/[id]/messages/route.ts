import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { MessagingService } from '@/lib/services/messaging.service';

/** GET /api/messages/conversations/[id]/messages - Get messages from a conversation */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await MessagingService.getMessages(
      (await params).id,
      user.id,
      page,
      limit
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error getting messages:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/messages/conversations/[id]/messages - Enviar mensaje nuevo
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

    const { content, recipientId, contentType, attachmentUrl, sharedItemId, sharedItemType } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });
    }

    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId requerido' }, { status: 400 });
    }

    const message = await MessagingService.sendMessage({
      conversationId: (await params).id,
      senderId: user.id,
      recipientId,
      content: content.trim(),
      contentType,
      attachmentUrl,
      sharedItemId,
      sharedItemType,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
