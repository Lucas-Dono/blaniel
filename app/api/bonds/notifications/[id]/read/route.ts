import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { markBondNotificationAsRead } from "@/lib/services/bond-notifications.service";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/bonds/notifications/[id]/read
 * Marcar notificación específica como leída
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify notification ownership
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { recipientId: true },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.recipientId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await markBondNotificationAsRead(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Error marking notification as read:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
