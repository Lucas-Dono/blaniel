/**
 * VAPID Public Key API
 * Returns the public key for push notification subscriptions
 */

import { NextResponse } from "next/server";

/**
 * @swagger
 * /api/notifications/vapid:
 *   get:
 *     summary: Get VAPID public key
 *     description: Retrieve the VAPID public key for push notification subscriptions
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: VAPID public key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ publicKey });
}
