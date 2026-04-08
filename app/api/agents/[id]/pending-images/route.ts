/**
 * Pending Images API
 * 
 * GET /api/agents/[id]/pending-images
 * - Returns pending and completed images for an agent
 * - Allows the frontend to poll to detect new images
 * 
 * TODO: Restore when pendingImageGeneration model is added to Prisma schema
 */

import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'pendingImageGeneration model not found in schema' },
    { status: 501 }
  );
  /*
  try {
    const { id: agentId } = await params;

    // Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Check that agent belongs to user
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true },
    });

    if (!agent || agent.userId !== userId) {
      return NextResponse.json({ error: 'Agent not found or unauthorized' }, { status: 404 });
    }

    // Get pending and recently completed images
    const pendingImages = await prisma.pendingImageGeneration.findMany({
      where: {
        agentId,
        userId,
        OR: [
          { status: 'pending' },
          { status: 'generating' },
          {
            // Include completed in the last 5 minutes
            status: 'completed',
            completedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000),
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        description: true,
        status: true,
        imageUrl: true,
        errorMessage: true,
        waitingMessageId: true,
        completedMessageId: true,
        createdAt: true,
        completedAt: true,
      },
    });

    // For cada imagen completada, obtener el mensaje
    const completedWithMessages = await Promise.all(
      pendingImages
        .filter((img) => img.status === 'completed' && img.completedMessageId)
        .map(async (img) => {
          const message = await prisma.message.findUnique({
            where: { id: img.completedMessageId! },
            select: {
              id: true,
              content: true,
              metadata: true,
              createdAt: true,
            },
          });

          return {
            ...img,
            completedMessage: message,
          };
        })
    );

    // Combinar con imágenes pendientes/generando
    const pendingWithoutMessages = pendingImages.filter(
      (img) => img.status === 'pending' || img.status === 'generating'
    );

    log.info(
      {
        agentId,
        userId,
        pending: pendingWithoutMessages.length,
        completed: completedWithMessages.length,
      },
      'Pending images retrieved'
    );

    return NextResponse.json({
      pending: pendingWithoutMessages,
      completed: completedWithMessages,
      totalPending: pendingWithoutMessages.length,
      totalCompleted: completedWithMessages.length,
    });
  } catch (error) {
    log.error({ error }, 'Failed to get pending images');
    return NextResponse.json(
      {
        error: 'Failed to get pending images',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
  */
}
