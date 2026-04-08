/**
 * API Endpoint para gestionar instalación de FastSD CPU
 *
 * GET /api/visual/fastsd/install - Verificar estado de instalación
 * POST /api/visual/fastsd/install - Iniciar instalación con aprobación del usuario
 * DELETE /api/visual/fastsd/install - Desinstalar FastSD
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getFastSDLocalClient } from "@/lib/visual-system/fastsd-local-client";

/**
 * GET - Verificar estado de instalación de FastSD
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

    // Check estado actual del sistema
    const fastsd = getFastSDLocalClient();
    const systemInfo = await fastsd.getSystemInfo();

    // Update registro en BD si es necesario
    if (dbUser.FastSDInstallation) {
      if (
        systemInfo.installed !== dbUser.FastSDInstallation.installed ||
        systemInfo.running !== dbUser.FastSDInstallation.serverRunning
      ) {
        await prisma.fastSDInstallation.update({
          where: { userId: dbUser.id },
          data: {
            installed: systemInfo.installed,
            serverRunning: systemInfo.running,
            version: systemInfo.version,
            lastHealthCheck: new Date(),
            installedModels: systemInfo.availableModels || [],
          },
        });
      }
    }

    return NextResponse.json({
      installed: systemInfo.installed,
      running: systemInfo.running,
      version: systemInfo.version,
      installPath: systemInfo.installPath,
      availableModels: systemInfo.availableModels,
      dbRecord: dbUser.FastSDInstallation,
    });
  } catch (error: any) {
    console.error("[FastSD Install API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check installation" },
      { status: 500 }
    );
  }
}

/**
 * POST - Iniciar instalación de FastSD con aprobación del usuario
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

    const body = await request.json();
    const { userApproved, installPath, device } = body;

    // Check aprobación del usuario
    if (!userApproved) {
      return NextResponse.json(
        { error: "User approval required" },
        { status: 400 }
      );
    }

    // Create o actualizar registro de instalación
    let installation = dbUser.FastSDInstallation;

    if (!installation) {
      installation = await prisma.fastSDInstallation.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId: dbUser.id,
          userApprovedInstallation: true,
          installationRequestedAt: new Date(),
          installPath,
          device: device || "CPU",
        },
      });
    } else {
      installation = await prisma.fastSDInstallation.update({
        where: { userId: dbUser.id },
        data: {
          userApprovedInstallation: true,
          installationRequestedAt: new Date(),
          installPath,
          device: device || installation.device,
        },
      });
    }

    // Iniciar instalación
    const fastsd = getFastSDLocalClient({
      installPath: installPath || undefined,
    });

    const result = await fastsd.installFastSD();

    // Update resultado
    await prisma.fastSDInstallation.update({
      where: { userId: dbUser.id },
      data: {
        installed: result.success,
        installationCompletedAt: result.success ? new Date() : undefined,
        installationError: result.success ? null : result.message,
        installPath: result.installPath,
      },
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      installPath: result.installPath,
      installation,
    });
  } catch (error: any) {
    console.error("[FastSD Install API] Installation error:", error);

    // Registrar error en BD
    const authUser = await getAuthenticatedUser(request);
    if (authUser?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: authUser.email },
      });

      if (dbUser) {
        await prisma.fastSDInstallation.update({
          where: { userId: dbUser.id },
          data: {
            installationError: error.message || "Unknown error",
          },
        });
      }
    }

    return NextResponse.json(
      { error: error.message || "Installation failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Desinstalar FastSD (solo marca como desinstalado, no borra archivos)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Marcar como desinstalado (no borramos archivos por seguridad)
    await prisma.fastSDInstallation.update({
      where: { userId: dbUser.id },
      data: {
        installed: false,
        serverRunning: false,
        userApprovedInstallation: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "FastSD marked as uninstalled. Manual cleanup may be required.",
    });
  } catch (error: any) {
    console.error("[FastSD Install API] Uninstall error:", error);
    return NextResponse.json(
      { error: error.message || "Uninstall failed" },
      { status: 500 }
    );
  }
}
