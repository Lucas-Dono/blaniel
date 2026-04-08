/**
 * Feature Flags Middleware
 * Backend middleware para proteger API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  Feature,
  FeatureCheckResult,
} from "./types";
import {
  hasFeature,
  checkFeature,
  canUseFeature,
  logFeatureAccess,
  getUserTier,
} from "./index";
import { FEATURE_METADATA } from "./config";

/**
 * Error response for feature access denied
 */
function featureAccessDeniedResponse(
  featureCheck: FeatureCheckResult
): NextResponse {
  return NextResponse.json(
    {
      error: "Feature not available",
      feature: featureCheck.feature,
      userTier: featureCheck.userTier,
      requiredTier: featureCheck.requiredTier,
      message: featureCheck.reason,
      upgradeUrl: featureCheck.upgradeUrl,
    },
    { status: 403 }
  );
}

/**
 * Require feature - Blocks request if user doesn't have feature
 * Use in API routes to gate features
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   await requireFeature(req, Feature.WORLDS);
 *   // ... rest of handler
 * }
 */
export async function requireFeature(
  req: NextRequest,
  feature: Feature
): Promise<void> {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const featureCheck = await checkFeature(userId, feature);

  // Log access attempt
  await logFeatureAccess(userId, feature, featureCheck.hasAccess, featureCheck.reason);

  if (!featureCheck.hasAccess) {
    throw new FeatureAccessError(featureCheck);
  }
}

/**
 * Custom error for feature access denied
 */
export class FeatureAccessError extends Error {
  public featureCheck: FeatureCheckResult;

  constructor(featureCheck: FeatureCheckResult) {
    super(featureCheck.reason || "Feature not available");
    this.name = "FeatureAccessError";
    this.featureCheck = featureCheck;
  }
}

/**
 * Require feature with usage limit check
 * Use for features that have daily/monthly limits
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   await requireFeatureWithLimit(req, Feature.IMAGE_GENERATION);
 *   // ... generate image
 * }
 */
export async function requireFeatureWithLimit(
  req: NextRequest,
  feature: Feature
): Promise<void> {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const usageCheck = await canUseFeature(userId, feature);

  await logFeatureAccess(userId, feature, usageCheck.canUse, usageCheck.reason);

  if (!usageCheck.canUse) {
    throw new FeatureUsageLimitError(feature, usageCheck.reason, usageCheck.upgradeUrl);
  }
}

/**
 * Custom error for usage limit exceeded
 */
export class FeatureUsageLimitError extends Error {
  public feature: Feature;
  public upgradeUrl?: string;

  constructor(feature: Feature, reason?: string, upgradeUrl?: string) {
    super(reason || "Usage limit exceeded");
    this.name = "FeatureUsageLimitError";
    this.feature = feature;
    this.upgradeUrl = upgradeUrl;
  }
}

/**
 * Check feature (non-blocking)
 * Returns boolean, doesn't throw
 *
 * @example
 * const hasWorlds = await checkFeatureAccess(req, Feature.WORLDS);
 * if (!hasWorlds) {
 *   return NextResponse.json({ message: "Upgrade to access worlds" });
 * }
 */
export async function checkFeatureAccess(
  req: NextRequest,
  feature: Feature
): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return false;
    }

    return await hasFeature(userId, feature);
  } catch (error) {
    console.error("Feature check error:", error);
    return false;
  }
}

/**
 * Middleware wrapper for feature-gated routes
 * Wraps your handler and checks feature before executing
 *
 * @example
 * export const POST = withFeature(Feature.WORLDS, async (req) => {
 *   // Your handler code
 *   return NextResponse.json({ success: true });
 * });
 */
export function withFeature(
  feature: Feature,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      const userId = session?.user?.id;

      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const featureCheck = await checkFeature(userId, feature);

      await logFeatureAccess(userId, feature, featureCheck.hasAccess, featureCheck.reason);

      if (!featureCheck.hasAccess) {
        return featureAccessDeniedResponse(featureCheck);
      }

      return await handler(req);
    } catch (error) {
      if (error instanceof FeatureAccessError) {
        return featureAccessDeniedResponse(error.featureCheck);
      }

      console.error("withFeature middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware wrapper with usage limit check
 *
 * @example
 * export const POST = withFeatureLimit(Feature.IMAGE_GENERATION, async (req) => {
 *   // Your handler code
 *   return NextResponse.json({ success: true });
 * });
 */
export function withFeatureLimit(
  feature: Feature,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      const userId = session?.user?.id;

      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const usageCheck = await canUseFeature(userId, feature);

      await logFeatureAccess(userId, feature, usageCheck.canUse, usageCheck.reason);

      if (!usageCheck.canUse) {
        return NextResponse.json(
          {
            error: "Usage limit exceeded",
            feature,
            message: usageCheck.reason,
            upgradeUrl: usageCheck.upgradeUrl,
            usage: usageCheck.usage,
          },
          { status: 429 }
        );
      }

      return await handler(req);
    } catch (error) {
      if (error instanceof FeatureUsageLimitError) {
        return NextResponse.json(
          {
            error: "Usage limit exceeded",
            feature: error.feature,
            message: error.message,
            upgradeUrl: error.upgradeUrl,
          },
          { status: 429 }
        );
      }

      console.error("withFeatureLimit middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Get user's feature access info for API responses
 * Useful for returning feature status in responses
 *
 * @example
 * const featureInfo = await getFeatureInfo(userId, Feature.WORLDS);
 * return NextResponse.json({ ...data, featureAccess: featureInfo });
 */
export async function getFeatureInfo(
  userId: string,
  feature: Feature
): Promise<{
  hasAccess: boolean;
  metadata: typeof FEATURE_METADATA[Feature];
  userTier: string;
  upgradeUrl?: string;
}> {
  const featureCheck = await checkFeature(userId, feature);
  const metadata = FEATURE_METADATA[feature];
  const userTier = await getUserTier(userId);

  return {
    hasAccess: featureCheck.hasAccess,
    metadata,
    userTier,
    upgradeUrl: featureCheck.upgradeUrl,
  };
}

/**
 * Helper to handle feature errors in try/catch
 *
 * @example
 * try {
 *   await requireFeature(req, Feature.WORLDS);
 * } catch (error) {
 *   return handleFeatureError(error);
 * }
 */
export function handleFeatureError(error: unknown): NextResponse {
  if (error instanceof FeatureAccessError) {
    return featureAccessDeniedResponse(error.featureCheck);
  }

  if (error instanceof FeatureUsageLimitError) {
    return NextResponse.json(
      {
        error: "Usage limit exceeded",
        feature: error.feature,
        message: error.message,
        upgradeUrl: error.upgradeUrl,
      },
      { status: 429 }
    );
  }

  console.error("Unhandled feature error:", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
