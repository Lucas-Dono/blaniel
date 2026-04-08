import { NextRequest, NextResponse } from 'next/server';
import { ModVersionService } from '@/lib/minecraft/mod-version-service';

/**
 * GET /api/v1/minecraft/mod/download/[version]
 *
 * Endpoint para descargar versiones específicas del mod de Minecraft
 * desde Cloudflare R2/S3.
 *
 * Ejemplos:
 * - /api/v1/minecraft/mod/download/latest (última versión)
 * - /api/v1/minecraft/mod/download/0.1.0
 * - /api/v1/minecraft/mod/download/0.2.0
 *
 * IMPORTANTE: Este endpoint es público y no requiere autenticación,
 * ya que el mod debe poder descargarse sin estar logueado.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
  try {
    let { version } = await params;

    if (!version) {
      return NextResponse.json(
        { error: 'Versión no especificada' },
        { status: 400 }
      );
    }

    // Manejar "latest" como caso especial
    if (version.toLowerCase() === 'latest') {
      const latestInfo = await ModVersionService.getLatestVersion();
      if (!latestInfo) {
        return NextResponse.json(
          { error: 'No hay versiones disponibles' },
          { status: 404 }
        );
      }
      version = latestInfo.version;
      console.log(`[Mod Download] Resolved 'latest' to version ${version}`);
    } else {
      // Validate formato de versión (semver básico)
      if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
        return NextResponse.json(
          { error: 'Formato de versión inválido. Use formato semver (ej: 0.1.0) o "latest"' },
          { status: 400 }
        );
      }
    }

    console.log(`[Mod Download] Requesting version ${version}`);

    // Get archivo del mod
    const fileBuffer = await ModVersionService.getModFile(version);

    if (!fileBuffer) {
      return NextResponse.json(
        { error: `Versión ${version} no encontrada` },
        { status: 404 }
      );
    }

    console.log(`[Mod Download] Serving version ${version} (${fileBuffer.length} bytes)`);

    // Retornar archivo con headers apropiados
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/java-archive',
        'Content-Disposition': `attachment; filename="blaniel-mc-${version}.jar"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache 1 año (versión específica no cambia)
        'X-Mod-Version': version,
      },
    });
  } catch (error) {
    console.error('[Mod Download API] Error:', error);
    return NextResponse.json(
      {
        error: 'Error al descargar el mod',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
