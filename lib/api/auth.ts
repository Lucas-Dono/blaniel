import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkApiKeyRateLimit } from "@/lib/redis/ratelimit";

export interface APIAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
  status?: number;
}

// Extraer API key del header
function extractAPIKey(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) return null;

  // Soportar formato "Bearer YOUR_API_KEY"
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // O directamente el API key
  return authHeader;
}

// Verificar API key y retornar user ID
export async function authenticateAPIKey(
  req: NextRequest
): Promise<APIAuthResult> {
  const apiKey = extractAPIKey(req);

  if (!apiKey) {
    return {
      success: false,
      error: "Missing API key. Provide it in the Authorization header.",
      status: 401,
    };
  }

  // Buscar usuario por API key
  const user = await prisma.user.findUnique({
    where: { apiKey },
    select: {
      id: true,
      email: true,
      plan: true,
      apiKey: true,
    },
  });

  if (!user) {
    return {
      success: false,
      error: "Invalid API key",
      status: 401,
    };
  }

  // Verificar rate limit por API key
  const rateLimitResult = await checkApiKeyRateLimit(apiKey);

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: "Rate limit exceeded for API key",
      status: 429,
    };
  }

  return {
    success: true,
    userId: user.id,
  };
}

// Middleware para proteger endpoints de API
export async function withAPIAuth(
  req: NextRequest,
  handler: (userId: string, req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await authenticateAPIKey(req);

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status || 401 }
    );
  }

  try {
    return await handler(authResult.userId!, req);
  } catch (error) {
    console.error("API handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Generate un nuevo API key
export function generateAPIKey(): string {
  const prefix = "cda"; // Blaniel API
  const random = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${random}`;
}

// Regenerar API key para un usuario
export async function regenerateAPIKey(userId: string): Promise<string> {
  const newAPIKey = generateAPIKey();

  await prisma.user.update({
    where: { id: userId },
    data: { apiKey: newAPIKey },
  });

  return newAPIKey;
}
