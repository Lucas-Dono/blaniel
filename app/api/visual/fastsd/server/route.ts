/**
 * API Endpoint para gestionar el servidor FastSD CPU
 *
 * GET /api/visual/fastsd/server - Verificar estado del servidor
 * POST /api/visual/fastsd/server - Iniciar servidor
 * DELETE /api/visual/fastsd/server - Detener servidor (not implemented)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getFastSDLocalClient } from "@/lib/visual-system/fastsd-local-client";

/**
 * GET - Verificar estado del servidor FastSD
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { FastSDInstallation: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const fastsd = getFastSDLocalClient();
    const isRunning = await fastsd.isRunning();
    const systemInfo = await fastsd.getSystemInfo();

    // Update estado en BD
    if (dbUser.FastSDInstallation) {
      await prisma.fastSDInstallation.update({
        where: { userId: dbUser.id },
        data: {
          serverRunning: isRunning,
          lastHealthCheck: new Date(),
        },
      });
    }

    return NextResponse.json({
      running: isRunning,
      installed: systemInfo.installed,
      serverUrl: "http://localhost:8000",
      availableModels: systemInfo.availableModels,
      device: systemInfo.device,
    });
  } catch (error: any) {
    console.error("[FastSD Server API] Error checking server:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check server status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Iniciar servidor FastSD
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { FastSDInstallation: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!dbUser.FastSDInstallation?.installed) {
      return NextResponse.json(
        { error: "FastSD is not installed. Install it first." },
        { status: 400 }
      );
    }

    const fastsd = getFastSDLocalClient();
    const started = await fastsd.startServer();

    // Update estado
    await prisma.fastSDInstallation.update({
      where: { userId: dbUser.id },
      data: {
        serverRunning: started,
        lastHealthCheck: new Date(),
      },
    });

    return NextResponse.json({
      success: started,
      running: started,
      message: started
        ? "Server started successfully"
        : "Failed to start server",
      serverUrl: "http://localhost:8000",
    });
  } catch (error: any) {
    console.error("[FastSD Server API] Error starting server:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start server" },
      { status: 500 }
    );
  }
}
