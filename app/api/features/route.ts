/**
 * Features API - Get user's enabled features and limits
 * GET /api/features
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserTier,
  getEnabledFeatures,
  getFeatureLimits,
} from "@/lib/feature-flags";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's tier, features, and limits
    const [tier, features, limits] = await Promise.all([
      getUserTier(userId),
      getEnabledFeatures(userId),
      getFeatureLimits(userId),
    ]);

    return NextResponse.json({
      tier,
      features,
      limits,
    });
  } catch (error) {
    console.error("Error fetching features:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
