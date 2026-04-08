/**
 * API: Marcar Conversación como Leída
 * POST /api/conversations/[agentId]/mark-read - Marcar conversación como leída
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { ConversationTrackingService } from '@/lib/services/conversation-tracking.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Check authentication (soporta Better Auth y JWT)
    const session = await getAuthSession(req);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { agentId } = await params;

    // Marcar como leída
    await ConversationTrackingService.markAsRead(userId, agentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
