import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { MessagingService } from '@/lib/services/messaging.service';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/messages/[id] - Editar mensaje
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { content } = await request.json();

    // Validate contenido
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'El contenido no puede estar vacío' }, { status: 400 });
    }

    // Check que el mensaje existe y pertenece al usuario
    const message = await prisma.directMessage.findUnique({
      where: { id },
      select: { senderId: true },
    });

    if (!message) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    if (message.senderId !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para editar este mensaje' },
        { status: 403 }
      );
    }

    // Update mensaje
    const updatedMessage = await prisma.directMessage.update({
      where: { id },
      data: {
        content: content.trim(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error: any) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/messages/[id] - Eliminar mensaje (endpoint legacy, use /conversations/[id]/messages/[messageId])
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await MessagingService.deleteMessage((await params).id, user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
