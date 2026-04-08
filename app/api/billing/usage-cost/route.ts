/**
 * Usage Cost API - Returns detailed cost breakdown for transparency
 *
 * GET /api/billing/usage-cost
 * - Real-time cost tracking
 * - Refund calculation
 * - Complete transparency
 *
 * PHASE 5: Honest monetization
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

// Cost constants (in USD) - Based on real provider costs + operational markup
// Mistral Small: $0.40/1M input, $1.20/1M output
// ElevenLabs: $0.50/1000 credits (~1 min)
// Flux Ultra: $0.088 base + markup
const COSTS = {
  MESSAGE_TEXT_SIMPLE: 0.001, // ~200 input + 400 output tokens = $0.0006, rounded to $0.001
  MESSAGE_TEXT_EXTENDED: 0.002, // ~1000 input + 600 output tokens (with memory) = $0.0012, rounded to $0.002
  MESSAGE_IMAGE_ANALYSIS: 0.05, // Vision analysis with markup
  MESSAGE_VOICE_TRANSCRIPTION: 0.17, // ElevenLabs generation ($0.165) + Whisper transcription ($0.002)
  IMAGE_GENERATION: 0.12, // Flux Ultra ($0.088) + operational markup
};

// Helper to calculate days since subscription
function daysSince(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Helper to get plan price
function getPlanPrice(plan: string): number {
  const prices: Record<string, number> = {
    free: 0,
    plus: 5,
    ultra: 15,
  };
  return prices[plan.toLowerCase()] || 0;
}

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get user with subscription info
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        createdAt: true,
        Subscription: {
          where: {
            status: "active",
          },
          take: 1,
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const planName = dbUser.plan || "free";

    // Free plan doesn't have costs
    if (planName === "free") {
      return NextResponse.json({
        planName: "free",
        message: "Free plan - no cost tracking",
      });
    }

    // Get subscription start date (use account creation as fallback)
    // In production, you should track subscription date separately
    const subscriptionDate = dbUser.createdAt;
    const daysElapsed = daysSince(subscriptionDate);

    // Get all messages from this billing period (current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const messages = await prisma.message.findMany({
      where: {
        userId,
        createdAt: {
          gte: startOfMonth,
        },
      },
      select: {
        id: true,
        content: true,
        role: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Calculate costs based on usage
    let textMessageCount = 0;
    let imageAnalysisCount = 0;
    let voiceMessageCount = 0;

    let textCost = 0;
    let imageCost = 0;
    let voiceCost = 0;

    for (const msg of messages) {
      if (msg.role === "user") {
        const metadata = msg.metadata as any;

        // Check message type from metadata
        if (metadata?.type === "image" || metadata?.hasImage) {
          imageAnalysisCount++;
          imageCost += COSTS.MESSAGE_IMAGE_ANALYSIS;
        } else if (metadata?.type === "voice" || metadata?.hasVoice) {
          voiceMessageCount++;
          voiceCost += COSTS.MESSAGE_VOICE_TRANSCRIPTION;
        } else {
          textMessageCount++;
          // Estimate cost based on content length (rough approximation)
          const contentLength = msg.content?.length || 0;
          if (contentLength > 1000) {
            textCost += COSTS.MESSAGE_TEXT_EXTENDED;
          } else {
            textCost += COSTS.MESSAGE_TEXT_SIMPLE;
          }
        }
      }
    }

    const totalCost = textCost + imageCost + voiceCost;
    const subscriptionAmount = getPlanPrice(planName);

    // Calculate estimated refund
    const estimatedRefund = subscriptionAmount - totalCost;

    // Check if eligible for refund (14 days)
    const refundEligible = daysElapsed <= 14;
    const daysLeftForRefund = Math.max(0, 14 - daysElapsed);

    return NextResponse.json({
      subscriptionAmount,
      planName,
      subscriptionDate: subscriptionDate.toISOString(),
      daysElapsed,
      usage: {
        messages: {
          count: textMessageCount,
          unitCost: COSTS.MESSAGE_TEXT_SIMPLE, // Average
          totalCost: textCost,
        },
        images: {
          count: imageAnalysisCount,
          unitCost: COSTS.MESSAGE_IMAGE_ANALYSIS,
          totalCost: imageCost,
        },
        voice: {
          count: voiceMessageCount,
          unitCost: COSTS.MESSAGE_VOICE_TRANSCRIPTION,
          totalCost: voiceCost,
        },
      },
      totalCost: Number(totalCost.toFixed(2)),
      estimatedRefund: Number(estimatedRefund.toFixed(2)),
      refundEligible,
      daysLeftForRefund,
      metadata: {
        generatedAt: new Date().toISOString(),
        billingPeriod: "current_month",
        costs: COSTS, // Include costs for transparency
      },
    });
  } catch (error) {
    console.error("[Usage Cost API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to calculate usage costs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
