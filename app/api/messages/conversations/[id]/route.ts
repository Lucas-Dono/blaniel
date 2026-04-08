import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { MessagingService } from '@/lib/services/messaging.service';

/** GET /api/messages/conversations/[id] - Get messages from a conversation */
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

/** PATCH /api/messages/conversations/[id] - Update conversation configuration */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();

    const updated = await MessagingService.updateConversation(
      (await params).id,
      user.id,
      data
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** DELETE /api/messages/conversations/[id] - Delete conversation */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await MessagingService.deleteConversation((await params).id, user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
