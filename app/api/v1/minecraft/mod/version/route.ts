import { NextRequest, NextResponse } from 'next/server';
import { ModVersionService } from '@/lib/minecraft/mod-version-service';

/**
 * GET /api/v1/minecraft/mod/version
 *
 * Endpoint para verificar la versión actual del mod de Minecraft
 * y obtener información de actualización si hay disponible.
 *
 * Query params:
 * - currentVersion: Versión actual del mod del cliente (opcional)
 *
 * Ejemplos:
 * - /api/v1/minecraft/mod/version
 * - /api/v1/minecraft/mod/version?currentVersion=0.1.0
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const currentVersion = searchParams.get('currentVersion');

    console.log(
      `[Mod Version API] Checking version (current: ${currentVersion || 'unknown'})`
    );

    // Si el cliente proporciona versión actual, verificar si hay actualización
    if (currentVersion) {
      const updateInfo = await ModVersionService.checkForUpdate(currentVersion);

      if (!updateInfo) {
        // No hay versiones en la BD, retornar error
        return NextResponse.json(
          {
            error: 'No hay versiones del mod disponibles en el servidor',
            hasUpdate: false,
            updateAvailable: false,
          },
          { status: 404 }
        );
      }

      console.log(
        `[Mod Version API] Update available: ${updateInfo.hasUpdate} (${currentVersion} -> ${updateInfo.version})`
      );

      return NextResponse.json(updateInfo);
    }

    // Sin versión actual, retornar solo info de la última versión
    const latestVersion = await ModVersionService.getLatestVersion();

    if (!latestVersion) {
      return NextResponse.json(
        {
          error: 'No hay versiones del mod disponibles en el servidor',
        },
        { status: 404 }
      );
    }

    console.log(`[Mod Version API] Latest version: ${latestVersion.version}`);

    return NextResponse.json({
      ...latestVersion,
      hasUpdate: true,
      updateAvailable: true,
    });
  } catch (error) {
    console.error('[Mod Version API] Error:', error);
    return NextResponse.json(
      {
        error: 'Error al verificar versión del mod',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
