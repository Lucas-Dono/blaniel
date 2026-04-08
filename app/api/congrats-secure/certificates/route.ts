/**
 * API Admin - Gestión de Certificados
 * Lista, revoca y genera certificados desde el panel web
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';
import { prisma } from '@/lib/prisma';
import { generateClientCertificate, revokeCertificate } from '@/lib/admin/cert-manager';

/**
 * GET /api/admin-secure/certificates
 * Lista certificados del admin actual o todos (si es super admin)
 */
export const GET = withAdminAuth(async (request, { admin }) => {
  try {
    const url = new URL(request.url);
    const all = url.searchParams.get('all') === 'true';

    const where: any = {};

    // Si no es super admin, solo mostrar sus propios certificados
    if (!all || admin.role !== 'admin') {
      where.adminAccessId = admin.adminAccessId;
    }

    const certificates = await prisma.adminCertificate.findMany({
      where,
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
      },
      orderBy: { issuedAt: 'desc' }
    });

    // Clasificar certificados
    const now = new Date();
    const active = certificates.filter(c => !c.revokedAt && c.expiresAt > now);
    const expired = certificates.filter(c => !c.revokedAt && c.expiresAt <= now);
    const revoked = certificates.filter(c => c.revokedAt !== null);

    // Log audit
    await logAuditAction(admin, {
      action: 'certificates.view',
      targetType: AuditTargetType.SYSTEM,
      details: {
        viewAll: all,
        totalCertificates: certificates.length
      }
    });

    return NextResponse.json({
      certificates,
      stats: {
        active: active.length,
        expired: expired.length,
        revoked: revoked.length,
        total: certificates.length
      }
    });

  } catch (error) {
    console.error('Error fetching certificates:', error);
    return NextResponse.json(
      { error: 'Error al obtener certificados' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin-secure/certificates
 * Genera un nuevo certificado para el admin actual
 *
 * Body:
 * {
 *   "deviceName": "MacBook Pro",
 *   "validityHours": 48
 * }
 */
export const POST = withAdminAuth(async (request, { admin }) => {
  try {
    const body = await request.json();
    const { deviceName, validityHours = 48 } = body;

    if (!deviceName) {
      return NextResponse.json(
        { error: 'deviceName es requerido' },
        { status: 400 }
      );
    }

    // Validate validity hours (entre 1 y 168 horas = 7 días)
    const hours = Math.min(Math.max(validityHours, 1), 168);

    // Generate certificado
    const cert = await generateClientCertificate(
      admin.email,
      deviceName,
      hours,
      false
    );

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.CERTIFICATE_GENERATE,
      targetType: AuditTargetType.CERTIFICATE,
      targetId: cert.serialNumber,
      details: {
        deviceName,
        validityHours: hours,
        expiresAt: cert.expiresAt
      }
    });

    return NextResponse.json({
      message: 'Certificado generado exitosamente',
      certificate: {
        serialNumber: cert.serialNumber,
        fingerprint: cert.fingerprint,
        deviceName,
        expiresAt: cert.expiresAt,
        p12Path: cert.p12Path,
        p12Password: cert.p12Password
      }
    });

  } catch (error) {
    console.error('Error generating certificate:', error);
    return NextResponse.json(
      { error: 'Error al generar certificado' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin-secure/certificates/[serialNumber]
 * Revoca un certificado
 */
export const DELETE = withAdminAuth(async (request, { admin }) => {
  try {
    const url = new URL(request.url);
    const serialNumber = url.pathname.split('/').pop();
    const reason = url.searchParams.get('reason') || 'revoked_by_admin';

    if (!serialNumber) {
      return NextResponse.json(
        { error: 'serialNumber es requerido' },
        { status: 400 }
      );
    }

    // Check que el certificado pertenece al admin (o es super admin)
    const cert = await prisma.adminCertificate.findUnique({
      where: { serialNumber },
      include: { AdminAccess: true }
    });

    if (!cert) {
      return NextResponse.json(
        { error: 'Certificado no encontrado' },
        { status: 404 }
      );
    }

    // Solo el dueño o super admin puede revocar
    if (cert.adminAccessId !== admin.adminAccessId && admin.role !== 'admin') {
      return NextResponse.json(
        { error: 'No tienes permisos para revocar este certificado' },
        { status: 403 }
      );
    }

    // Revocar
    await revokeCertificate(serialNumber, reason);

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.CERTIFICATE_REVOKE,
      targetType: AuditTargetType.CERTIFICATE,
      targetId: serialNumber,
      details: {
        reason,
        deviceName: cert.deviceName
      }
    });

    return NextResponse.json({
      message: 'Certificado revocado exitosamente',
      serialNumber,
      reason
    });

  } catch (error) {
    console.error('Error revoking certificate:', error);
    return NextResponse.json(
      { error: 'Error al revocar certificado' },
      { status: 500 }
    );
  }
});
