/**
 * Feature Usage Tracking API
 * POST /api/features/track
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { trackFeatureUsage } from "@/lib/feature-flags";
import { Feature } from "@/lib/feature-flags/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { feature, count = 1 } = body;

    if (!feature || !Object.values(Feature).includes(feature)) {
      return NextResponse.json(
        { error: "Invalid feature" },
        { status: 400 }
      );
    }

    if (typeof count !== "number" || count < 1) {
      return NextResponse.json(
        { error: "Invalid count" },
        { status: 400 }
      );
    }

    const usage = await trackFeatureUsage(userId, feature, count);

    return NextResponse.json({ success: true, usage });
  } catch (error) {
    console.error("Error tracking feature usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
