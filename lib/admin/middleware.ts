/**
 * Validation Middleware for Admin API
 * Supports authentication via Cloudflare Access or mTLS certificates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export interface AdminContext {
  adminAccessId: string;
  userId: string;
  email: string;
  role: string;
  certificateSerial?: string; // Optional, only for mTLS
  ipAddress: string;
  userAgent: string;
}

/**
 * Admin authentication error
 */
export class AdminAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public logReason?: string
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

/**
 * Validates authentication via Cloudflare Access
 *
 * Cloudflare injects the `Cf-Access-Authenticated-User-Email` header when the user
 * passes Cloudflare Access authentication.
 *
 * @param request - NextRequest
 * @returns AdminContext with authenticated admin information
 * @throws AdminAuthError if authentication fails
 */
async function validateCloudflareAccess(
  request: NextRequest
): Promise<AdminContext> {
  // 1. Get email from Cloudflare Access header
  const email = request.headers.get('cf-access-authenticated-user-email');

  if (!email) {
    throw new AdminAuthError(
      'No Cloudflare Access authentication detected',
      401,
      'missing_cloudflare_auth'
    );
  }

  // 2. Look up AdminAccess by email
  const adminAccess = await prisma.adminAccess.findFirst({
    where: {
      User: { email },
      enabled: true
    },
    include: {
      User: {
        select: {
          id: true,
          email: true,
          name: true
        }
      }
    }
  });

  if (!adminAccess) {
    throw new AdminAuthError(
      'User is not authorized as administrator',
      403,
      'user_not_admin'
    );
  }

  // 3. Get IP and User Agent
  const ipAddress = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('cf-connecting-ip') // Real IP when passing through Cloudflare
    || 'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  // 4. Update last login
  await prisma.adminAccess.update({
    where: { id: adminAccess.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      lastLoginUserAgent: userAgent
    }
  });

  // 5. Retornar contexto admin
  return {
    adminAccessId: adminAccess.id,
    userId: adminAccess.userId,
    email: adminAccess.User.email,
    role: adminAccess.role,
    ipAddress,
    userAgent
  };
}

/**
 * Valida acceso admin usando el método configurado
 *
 * Soporta dos métodos de autenticación:
 * - Cloudflare Access (por defecto en producción)
 * - mTLS con certificados (legacy)
 *
 * Este middleware debe usarse en TODAS las rutas /api/congrats-secure/*
 *
 * @param request - NextRequest
 * @returns AdminContext con información del admin autenticado
 * @throws AdminAuthError si la autenticación falla
 */
export async function validateAdminAccess(
  request: NextRequest
): Promise<AdminContext> {
  try {
    // Determine authentication method
    const authMethod = process.env.ADMIN_AUTH_METHOD || 'cloudflare';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const devAdminEmail = request.headers.get('x-dev-admin-email');

    // DEVELOPMENT MODE: Allow testing without real authentication
    if (isDevelopment && devAdminEmail) {
      console.log(`[DEV MODE] Usando email de desarrollo: ${devAdminEmail}`);

      const adminAccess = await prisma.adminAccess.findFirst({
        where: {
          User: { email: devAdminEmail },
          enabled: true
        },
        include: {
          User: {
            select: { id: true, email: true, name: true }
          }
        }
      });

      if (!adminAccess) {
        throw new AdminAuthError(
          'Email de desarrollo no tiene AdminAccess',
          401,
          'dev_email_not_admin'
        );
      }

      return {
        adminAccessId: adminAccess.id,
        userId: adminAccess.userId,
        email: adminAccess.User.email,
        role: adminAccess.role,
        ipAddress: 'dev-mode',
        userAgent: 'dev-mode'
      };
    }

    // CLOUDFLARE ACCESS (por defecto)
    if (authMethod === 'cloudflare') {
      return await validateCloudflareAccess(request);
    }

    // mTLS (legacy) - keep original code for compatibility
    const devAdminEmail_legacy = devAdminEmail;

    let certSerial: string | null;
    let certFingerprint: string | null;
    let certificate: any;

    if (isDevelopment && devAdminEmail) {
      // In development, search for the most recent active certificate of the admin
      console.log(`[DEV MODE] Buscando certificado activo para ${devAdminEmail}`);

      const adminAccess = await prisma.adminAccess.findFirst({
        where: {
          User: { email: devAdminEmail },
          enabled: true
        },
        include: {
          AdminCertificate: {
            where: {
              revokedAt: null,
              expiresAt: { gt: new Date() }
            },
            orderBy: { issuedAt: 'desc' },
            take: 1,
            include: {
              AdminAccess: {
                include: {
                  User: {
                    select: { id: true, email: true, name: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!adminAccess || adminAccess.AdminCertificate.length === 0) {
        throw new AdminAuthError(
          'No hay certificado activo para este admin',
          401,
          'no_active_certificate'
        );
      }

      certificate = adminAccess.AdminCertificate[0];
      certSerial = certificate.serialNumber;
      certFingerprint = certificate.fingerprint;

      console.log(`[DEV MODE] Usando certificado: ${certSerial?.substring(0, 16)}...`);
    } else {
      // MODO PRODUCCIÓN: Obtener headers del certificado cliente (inyectados por NGINX)
      certSerial = request.headers.get('x-client-cert-serial');
      certFingerprint = request.headers.get('x-client-cert-fingerprint');
      const certVerify = request.headers.get('x-client-cert-verify');

      // Validate that NGINX injected the headers
      if (!certSerial || !certFingerprint || certVerify !== 'SUCCESS') {
        throw new AdminAuthError(
          'Certificado cliente no válido o no presente',
          401,
          'missing_certificate'
        );
      }
    }

    // 2. Search for certificate in DB (if not already searched in development mode)
    if (!certificate) {
      certificate = await prisma.adminCertificate.findUnique({
        where: { serialNumber: certSerial! },
        include: {
          AdminAccess: {
            include: {
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (!certificate) {
        throw new AdminAuthError(
          'Certificado no encontrado',
          403,
          'certificate_not_found'
        );
      }
    }

    // 3. Verify that the certificate is not revoked
    if (certificate.revokedAt) {
      throw new AdminAuthError(
        `Certificado revocado: ${certificate.revokedReason || 'unknown'}`,
        403,
        'certificate_revoked'
      );
    }

    // 4. Verificar que el certificado no ha expirado
    if (certificate.expiresAt < new Date()) {
      throw new AdminAuthError(
        'Certificado expirado',
        403,
        'certificate_expired'
      );
    }

    // 5. Verify that the fingerprint matches (double verification in production)
    if (!isDevelopment && certFingerprint) {
      if (certificate.fingerprint !== certFingerprint.replace(/:/g, '')) {
        throw new AdminAuthError(
          'Fingerprint de certificado no coincide',
          403,
          'fingerprint_mismatch'
        );
      }
    }

    // 6. Verify that AdminAccess is enabled
    if (!certificate.AdminAccess.enabled) {
      throw new AdminAuthError(
        'Acceso admin deshabilitado',
        403,
        'admin_access_disabled'
      );
    }

    // 7. Obtener IP y User Agent
    const ipAddress = request.headers.get('x-real-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]
      || 'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 8. Update last login
    await prisma.adminAccess.update({
      where: { id: certificate.AdminAccess.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        lastLoginUserAgent: userAgent
      }
    });

    // 9. Retornar contexto admin (mTLS legacy)
    return {
      adminAccessId: certificate.AdminAccess.id,
      userId: certificate.AdminAccess.userId,
      email: certificate.AdminAccess.User.email,
      role: certificate.AdminAccess.role,
      certificateSerial: certSerial || '',
      ipAddress,
      userAgent
    };

  } catch (error) {
    // If it's an authentication error, propagate it
    if (error instanceof AdminAuthError) {
      throw error;
    }

    // Error inesperado
    console.error('Error validando acceso admin:', error);
    throw new AdminAuthError(
      'Error interno validando acceso',
      500,
      'internal_error'
    );
  }
}

/**
 * Wrapper para endpoints admin que maneja autenticación y errores
 *
 * Uso:
 * ```ts
 * export const GET = withAdminAuth(async (request, context) => {
 *   // context.admin contiene AdminContext
 *   // Your logic here
 *   return NextResponse.json({ data: '...' });
 * });
 * ```
 */
export function withAdminAuth(
  handler: (
    request: NextRequest,
    context: { admin: AdminContext; params?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: { params: any }) => {
    try {
      // Validate acceso admin
      const admin = await validateAdminAccess(request);

      // Ejecutar handler con contexto
      return await handler(request, {
        admin,
        params: routeContext?.params
      });

    } catch (error) {
      // Handle authentication errors
      if (error instanceof AdminAuthError) {
        // Log de intento fallido
        try {
          const ipAddress = request.headers.get('x-real-ip') || 'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';

          await prisma.auditLog.create({
            data: {
              id: nanoid(),
              adminAccessId: 'system',
              action: 'admin.access_denied',
              targetType: 'AdminAccess',
              ipAddress,
              userAgent,
              details: {
                reason: error.logReason,
                message: error.message,
                path: request.nextUrl.pathname
              }
            }
          });
        } catch (logError) {
          console.error('Error logging failed access:', logError);
        }

        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }

      // Error inesperado
      console.error('Unexpected error in admin endpoint:', error);
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  };
}

/**
 * Verifica que el admin tiene un rol específico
 */
export function requireRole(admin: AdminContext, requiredRole: string): void {
  if (admin.role !== requiredRole && admin.role !== 'admin') {
    throw new AdminAuthError(
      `Requiere rol: ${requiredRole}`,
      403,
      'insufficient_role'
    );
  }
}

/**
 * Verifica que el admin tiene uno de varios roles
 */
export function requireAnyRole(admin: AdminContext, roles: string[]): void {
  if (!roles.includes(admin.role) && admin.role !== 'admin') {
    throw new AdminAuthError(
      `Requiere uno de los roles: ${roles.join(', ')}`,
      403,
      'insufficient_role'
    );
  }
}
