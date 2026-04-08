/**
 * Feature Check API - Check if user can use a feature (with usage limits)
 * GET /api/features/check?feature=FEATURE_NAME
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { canUseFeature } from "@/lib/feature-flags";
import { Feature } from "@/lib/feature-flags/types";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const feature = searchParams.get("feature") as Feature | null;

    if (!feature || !Object.values(Feature).includes(feature)) {
      return NextResponse.json(
        { error: "Invalid feature" },
        { status: 400 }
      );
    }

    const result = await canUseFeature(userId, feature);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking feature:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
