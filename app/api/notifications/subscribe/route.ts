/**
 * Push Notification Subscription API
 * Handles subscribing and unsubscribing from push notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  savePushSubscription,
  removePushSubscription,
  type PushSubscription,
} from "@/lib/notifications/push";

/**
 * @swagger
 * /api/notifications/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     description: Register a push notification subscription for the authenticated user
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: object
 *                 properties:
 *                   endpoint:
 *                     type: string
 *                   keys:
 *                     type: object
 *                     properties:
 *                       p256dh:
 *                         type: string
 *                       auth:
 *                         type: string
 *     responses:
 *       200:
 *         description: Subscription saved successfully
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid subscription data
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subscription } = body as { subscription: PushSubscription };

    if (
      !subscription ||
      !subscription.endpoint ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    await savePushSubscription(user.id, subscription);

    return NextResponse.json({
      success: true,
      message: "Push notifications enabled",
    });
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    return NextResponse.json(
      { error: "Failed to subscribe to push notifications" },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/notifications/subscribe:
 *   delete:
 *     summary: Unsubscribe from push notifications
 *     description: Remove push notification subscription for the authenticated user
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Subscription removed successfully
 *       401:
 *         description: Unauthorized
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await removePushSubscription(user.id);

    return NextResponse.json({
      success: true,
      message: "Push notifications disabled",
    });
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);
    return NextResponse.json(
      { error: "Failed to unsubscribe from push notifications" },
      { status: 500 }
    );
  }
}
