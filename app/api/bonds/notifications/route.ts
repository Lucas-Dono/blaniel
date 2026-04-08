import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  getUserBondNotifications,
  getUnreadBondNotificationsCount,
} from "@/lib/services/bond-notifications.service";

/**
 * GET /api/bonds/notifications
 * Obtener notificaciones de bonds del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const notifications = await getUserBondNotifications(
      user.id,
      limit,
      unreadOnly
    );

    const unreadCount = await getUnreadBondNotificationsCount(user.id);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error("[API] Error fetching bond notifications:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
