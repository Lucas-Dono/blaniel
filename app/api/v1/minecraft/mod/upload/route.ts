import { NextRequest, NextResponse } from 'next/server';
import { ModVersionService } from '@/lib/minecraft/mod-version-service';
import { getAuthenticatedUser } from '@/lib/auth-server';

/**
 * POST /api/v1/minecraft/mod/upload
 *
 * Endpoint administrativo para subir nuevas versiones del mod.
 *
 * IMPORTANTE: Solo administradores pueden usar este endpoint.
 *
 * Body (multipart/form-data):
 * - file: Archivo JAR del mod
 * - version: Versión semver (ej: "0.2.0")
 * - changelog: Novedades de esta versión
 * - required: (opcional) Si es obligatorio actualizar (true/false)
 * - minimumVersion: (opcional) Versión mínima compatible
 *
 * Ejemplo usando curl:
 * ```bash
 * curl -X POST http://localhost:3000/api/v1/minecraft/mod/upload \
 *   -H "Authorization: Bearer YOUR_TOKEN" \
 *   -F "file=@blaniel-mc-0.2.0.jar" \
 *   -F "version=0.2.0" \
 *   -F "changelog=Nueva versión con mejoras..." \
 *   -F "required=false"
 * ```
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication via Cloudflare Zero Trust
    // Si la petición llega aquí, ya pasó por Zero Trust en /congrats/*
    // Get email del header de Cloudflare Access
    const cfAccessEmail = req.headers.get('cf-access-authenticated-user-email');

    // Fallback: intentar obtener usuario de better-auth
    let userEmail = cfAccessEmail;

    if (!userEmail) {
      const user = await getAuthenticatedUser(req);
      if (user?.email) {
        userEmail = user.email;
      }
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    console.log(`[Mod Upload] Admin ${userEmail} uploading version`);

    // Parsear FormData
    const formData = await req.formData() as unknown as globalThis.FormData;
    const file = formData.get('file') as File | null;
    const version = formData.get('version') as string | null;
    const changelog = formData.get('changelog') as string | null;
    const required = formData.get('required') === 'true';
    const minimumVersion = formData.get('minimumVersion') as string | null;

    // Validaciones
    if (!file) {
      return NextResponse.json(
        { error: 'Archivo JAR no proporcionado' },
        { status: 400 }
      );
    }

    if (!version) {
      return NextResponse.json(
        { error: 'Versión no proporcionada' },
        { status: 400 }
      );
    }

    if (!changelog) {
      return NextResponse.json(
        { error: 'Changelog no proporcionado' },
        { status: 400 }
      );
    }

    // Validate formato de versión (semver)
    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
      return NextResponse.json(
        {
          error:
            'Formato de versión inválido. Use formato semver (ej: 0.1.0, 1.0.0-beta)',
        },
        { status: 400 }
      );
    }

    // Validate que sea un archivo JAR
    if (!file.name.endsWith('.jar')) {
      return NextResponse.json(
        { error: 'El archivo debe ser un JAR (.jar)' },
        { status: 400 }
      );
    }

    console.log(`[Mod Upload] File: ${file.name} (${file.size} bytes)`);

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const jarBuffer = Buffer.from(arrayBuffer);

    // Subir nueva versión
    const newVersion = await ModVersionService.uploadNewVersion({
      version,
      jarBuffer,
      changelog,
      required,
      minimumVersion: minimumVersion || undefined,
    });

    console.log(`[Mod Upload] Version ${version} uploaded successfully`);
    console.log(`[Mod Upload] SHA-256: ${newVersion.sha256}`);
    console.log(`[Mod Upload] Size: ${newVersion.fileSize} bytes`);

    return NextResponse.json({
      success: true,
      version: newVersion,
      message: `Versión ${version} subida exitosamente`,
    });
  } catch (error) {
    console.error('[Mod Upload API] Error:', error);

    if (error instanceof Error && error.message.includes('ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      {
        error: 'Error al subir la versión del mod',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/minecraft/mod/upload
 *
 * Obtener lista de todas las versiones (solo admin)
 */
export async function GET(req: NextRequest) {
  try {
    // Authentication via Cloudflare Zero Trust
    const cfAccessEmail = req.headers.get('cf-access-authenticated-user-email');

    let userEmail = cfAccessEmail;

    if (!userEmail) {
      const user = await getAuthenticatedUser(req);
      if (user?.email) {
        userEmail = user.email;
      }
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const versions = await ModVersionService.listVersions();
    const stats = await ModVersionService.getDownloadStats();

    // Convertir BigInt a Number para serialización JSON
    const serializedVersions = versions.map(v => ({
      ...v,
      fileSize: Number(v.fileSize)
    }));

    return NextResponse.json({
      versions: serializedVersions,
      stats,
    });
  } catch (error) {
    console.error('[Mod Upload API] Error:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener versiones',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/minecraft/mod/upload
 *
 * Eliminar una versión específica (solo admin)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authentication via Cloudflare Zero Trust
    const cfAccessEmail = req.headers.get('cf-access-authenticated-user-email');

    let userEmail = cfAccessEmail;

    if (!userEmail) {
      const user = await getAuthenticatedUser(req);
      if (user?.email) {
        userEmail = user.email;
      }
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const version = searchParams.get('version');

    if (!version) {
      return NextResponse.json(
        { error: 'Versión no especificada' },
        { status: 400 }
      );
    }

    await ModVersionService.deleteVersion(version);

    return NextResponse.json({
      success: true,
      message: `Versión ${version} eliminada exitosamente`,
    });
  } catch (error) {
    console.error('[Mod Upload API] Error:', error);

    if (error instanceof Error && error.message.includes('no existe')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Error al eliminar la versión',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
