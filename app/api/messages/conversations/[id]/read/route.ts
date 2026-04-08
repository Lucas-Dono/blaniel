import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { MessagingService } from '@/lib/services/messaging.service';

/** POST /api/messages/conversations/[id]/read - Mark messages as read */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await MessagingService.markAsRead((await params).id, user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error marking as read:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
