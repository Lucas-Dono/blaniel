/**
 * API: Conversaciones Recientes
 * GET /api/conversations/recent - Obtener conversaciones recientes del usuario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { ConversationTrackingService } from '@/lib/services/conversation-tracking.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

    // Get parámetros
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get conversaciones recientes
    const conversations = await ConversationTrackingService.getRecentConversations(
      userId,
      limit
    );

    return NextResponse.json({
      conversations,
      totalUnread: await ConversationTrackingService.getTotalUnreadCount(userId)
    });
  } catch (error) {
    console.error('Error fetching recent conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
