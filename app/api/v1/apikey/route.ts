import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { generateAPIKey } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";

/**
 * @swagger
 * /api/v1/apikey:
 *   post:
 *     summary: Generate or regenerate API key
 *     description: Create a new API key for the authenticated user (invalidates previous key)
 *     tags: [API Keys]
 *     responses:
 *       200:
 *         description: API key generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                   example: cda_1234567890abcdef
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newAPIKey = generateAPIKey();

    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: newAPIKey },
    });

    return NextResponse.json({
      apiKey: newAPIKey,
      message:
        "API key generated successfully. Store it securely - it won't be shown again.",
    });
  } catch (error) {
    console.error("Error generating API key:", error);
    return NextResponse.json(
      { error: "Failed to generate API key" },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/v1/apikey:
 *   get:
 *     summary: Get current API key
 *     description: Retrieve the current API key (partially masked)
 *     tags: [API Keys]
 *     responses:
 *       200:
 *         description: API key info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                   example: cda_****...****abcdef
 *                 hasKey:
 *                   type: boolean
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { apiKey: true },
    });

    if (!dbUser?.apiKey) {
      return NextResponse.json({
        hasKey: false,
        message: "No API key generated yet",
      });
    }

    // Mask API key for security
    const masked =
      dbUser.apiKey.substring(0, 8) +
      "****" +
      dbUser.apiKey.substring(dbUser.apiKey.length - 8);

    return NextResponse.json({
      hasKey: true,
      apiKey: masked,
    });
  } catch (error) {
    console.error("Error fetching API key:", error);
    return NextResponse.json(
      { error: "Failed to fetch API key" },
      { status: 500 }
    );
  }
}
