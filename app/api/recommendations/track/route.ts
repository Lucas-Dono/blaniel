import { NextRequest, NextResponse } from "next/server";
import { trackInteraction } from "@/lib/recommendations/tracker";

// POST /api/recommendations/track - Trackear interacción
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      itemType,
      itemId,
      interactionType,
      duration,
      messageCount,
      completionRate,
      rating,
      liked,
      shared,
      metadata,
    } = body;

    if (!userId || !itemType || !itemId || !interactionType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const interaction = await trackInteraction({
      userId,
      itemType,
      itemId,
      interactionType,
      duration,
      messageCount,
      completionRate,
      rating,
      liked,
      shared,
      metadata,
    });

    return NextResponse.json({
      success: true,
      interaction,
    });
  } catch (error) {
    console.error("Error tracking interaction:", error);
    return NextResponse.json(
      { error: "Error tracking interaction" },
      { status: 500 }
    );
  }
}
