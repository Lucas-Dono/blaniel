/**
 * Gestor de Certificados Admin
 * Genera, renueva y revoca certificados cliente para mTLS
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { randomBytes, hash } from '@/lib/admin/crypto';

const PROJECT_ROOT = process.cwd();
const CERTS_DIR = join(PROJECT_ROOT, 'certs');
const CA_DIR = join(CERTS_DIR, 'ca');
const CLIENT_DIR = join(CERTS_DIR, 'client');
const TEMP_DIR = join(CERTS_DIR, 'temp');

// Lazy initialization para evitar errores durante build time
let directoriesInitialized = false;
function ensureDirectories(): void {
  if (directoriesInitialized) return;

  try {
    if (!existsSync(CLIENT_DIR)) {
      mkdirSync(CLIENT_DIR, { recursive: true, mode: 0o700 });
    }
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true, mode: 0o700 });
    }
    directoriesInitialized = true;
  } catch (error) {
    // Durante build time, simplemente ignorar el error
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Could not initialize cert directories (build time):', error);
    }
  }
}

interface CertificateInfo {
  serialNumber: string;
  fingerprint: string;
  certPath: string;
  keyPath: string;
  p12Path: string;
  p12Password: string;
  expiresAt: Date;
}

/**
 * Verifica que la CA existe
 */
function verifyCA(): void {
  if (!existsSync(join(CA_DIR, 'ca.key')) || !existsSync(join(CA_DIR, 'ca.crt'))) {
    throw new Error(
      'CA no encontrada. Ejecuta primero: npm run admin:setup-ca'
    );
  }
}

/**
 * Genera un certificado cliente
 *
 * @param adminEmail - Email del administrador
 * @param deviceName - Nombre del dispositivo (ej: "MacBook Pro")
 * @param validityHours - Horas de validez (default: 48)
 * @param isEmergency - Si es certificado de emergencia (24h)
 */
export async function generateClientCertificate(
  adminEmail: string,
  deviceName: string,
  validityHours: number = 48,
  isEmergency: boolean = false
): Promise<CertificateInfo> {
  try {
    ensureDirectories();
    verifyCA();

    // 1. Buscar admin en BD
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: { AdminAccess: true }
    });

    if (!admin?.AdminAccess) {
      throw new Error(`Usuario ${adminEmail} no tiene acceso admin`);
    }

    if (!admin.AdminAccess.enabled) {
      throw new Error(`Acceso admin deshabilitado para ${adminEmail}`);
    }

    // 2. Generar serial number único
    const serialNumber = randomBytes(16);
    const timestamp = Date.now();
    const certName = `admin-${serialNumber}`;

    // Paths de certificados
    const keyPath = join(CLIENT_DIR, `${certName}.key`);
    const csrPath = join(CLIENT_DIR, `${certName}.csr`);
    const certPath = join(CLIENT_DIR, `${certName}.crt`);
    const p12Path = join(CLIENT_DIR, `${certName}.p12`);

    console.log(`\n🔐 Generando certificado cliente...`);
    console.log(`   Admin: ${adminEmail}`);
    console.log(`   Device: ${deviceName}`);
    console.log(`   Validity: ${validityHours}h`);
    console.log(`   Emergency: ${isEmergency ? 'Yes' : 'No'}`);
    console.log();

    // 3. Generar clave privada del cliente (2048 bits)
    console.log('  ⏳ Generando clave privada...');
    execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'pipe' });

    // 4. Generar CSR (Certificate Signing Request)
    console.log('  ⏳ Generando CSR...');
    const subject = `/C=AR/ST=Buenos Aires/L=Buenos Aires/O=Creador Inteligencias/OU=Admin/CN=admin-${admin.id}/emailAddress=${adminEmail}`;

    execSync(
      `openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "${subject}"`,
      { stdio: 'pipe' }
    );

    // 5. Firmar certificado con la CA
    console.log('  ⏳ Firmando certificado con CA...');
    const validityDays = Math.ceil(validityHours / 24);

    execSync(
      `openssl x509 -req ` +
      `-in "${csrPath}" ` +
      `-CA "${join(CA_DIR, 'ca.crt')}" ` +
      `-CAkey "${join(CA_DIR, 'ca.key')}" ` +
      `-out "${certPath}" ` +
      `-set_serial 0x${serialNumber} ` +
      `-days ${validityDays} ` +
      `-sha256 ` +
      `-extfile "${join(CA_DIR, 'openssl-client.cnf')}" ` +
      `-extensions v3_req`,
      { stdio: 'pipe' }
    );

    // 6. Generar archivo PKCS12 para navegador
    console.log('  ⏳ Generando archivo PKCS12...');
    const p12Password = randomBytes(8);

    execSync(
      `openssl pkcs12 -export ` +
      `-in "${certPath}" ` +
      `-inkey "${keyPath}" ` +
      `-out "${p12Path}" ` +
      `-password "pass:${p12Password}"`,
      { stdio: 'pipe' }
    );

    // 7. Calcular fingerprint SHA-256
    const fingerprintOutput = execSync(
      `openssl x509 -in "${certPath}" -noout -fingerprint -sha256`,
      { encoding: 'utf8' }
    );

    const fingerprint = fingerprintOutput
      .split('=')[1]
      .trim()
      .replace(/:/g, '');

    // 8. Guardar en base de datos
    const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000);

    await prisma.adminCertificate.create({
      data: {
        id: nanoid(),
        adminAccessId: admin.AdminAccess.id,
        serialNumber,
        fingerprint,
        expiresAt,
        deviceName,
        isEmergency,
      }
    });

    // 9. Log de auditoría
    await prisma.auditLog.create({
      data: {
        id: nanoid(),
        adminAccessId: admin.AdminAccess.id,
        action: 'certificate.generated',
        targetType: 'Certificate',
        targetId: serialNumber,
        ipAddress: 'localhost',
        userAgent: 'cert-manager-cli',
        details: {
          deviceName,
          validityHours,
          isEmergency,
          fingerprint
        }
      }
    });

    console.log();
    console.log('  ✅ Certificado generado exitosamente');
    console.log();

    return {
      serialNumber,
      fingerprint,
      certPath,
      keyPath,
      p12Path,
      p12Password,
      expiresAt
    };

  } catch (error) {
    console.error('❌ Error generando certificado:', error);
    throw error;
  }
}

/**
 * Revoca un certificado
 */
export async function revokeCertificate(
  serialNumber: string,
  reason: string
): Promise<void> {
  try {
    ensureDirectories();
    // 1. Marcar como revocado en BD
    const cert = await prisma.adminCertificate.update({
      where: { serialNumber },
      data: {
        revokedAt: new Date(),
        revokedReason: reason
      },
      include: { AdminAccess: true }
    });

    // 2. Actualizar CRL (Certificate Revocation List)
    await updateCRL();

    // 3. Log de auditoría
    await prisma.auditLog.create({
      data: {
        id: nanoid(),
        adminAccessId: cert.adminAccessId,
        action: 'certificate.revoked',
        targetType: 'Certificate',
        targetId: serialNumber,
        ipAddress: 'localhost',
        userAgent: 'cert-manager-cli',
        details: { reason }
      }
    });

    console.log(`✅ Certificado ${serialNumber} revocado`);
    console.log(`   Razón: ${reason}`);

  } catch (error) {
    console.error('❌ Error revocando certificado:', error);
    throw error;
  }
}

/**
 * Actualiza el CRL (Certificate Revocation List)
 */
export async function updateCRL(): Promise<void> {
  try {
    // 1. Obtener todos los certificados revocados
    const revokedCerts = await prisma.adminCertificate.findMany({
      where: {
        revokedAt: { not: null }
      },
      select: {
        serialNumber: true,
        revokedAt: true
      }
    });

    // 2. Escribir CRL en formato texto simple (para NGINX)
    const crlPath = join(CA_DIR, 'crl.txt');
    const crlContent = revokedCerts
      .map(cert => cert.serialNumber)
      .join('\n');

    writeFileSync(crlPath, crlContent, 'utf8');

    console.log(`✅ CRL actualizado: ${revokedCerts.length} certificados revocados`);

  } catch (error) {
    console.error('❌ Error actualizando CRL:', error);
    throw error;
  }
}

/**
 * Lista todos los certificados activos
 */
export async function listCertificates(adminEmail?: string): Promise<void> {
  try {
    const where = adminEmail
      ? { AdminAccess: { User: { email: adminEmail } } }
      : {};

    const certs = await prisma.adminCertificate.findMany({
      where,
      include: {
        AdminAccess: {
          include: { User: true }
        }
      },
      orderBy: { issuedAt: 'desc' }
    });

    console.log(`\n📜 Certificados Admin (${certs.length} total)\n`);

    for (const cert of certs) {
      const status = cert.revokedAt
        ? '🚫 Revocado'
        : cert.expiresAt < new Date()
        ? '⏰ Expirado'
        : '✅ Activo';

      const emergency = cert.isEmergency ? '🚨 Emergency' : '';

      console.log(`${status} ${emergency}`);
      console.log(`  Serial:   ${cert.serialNumber}`);
      console.log(`  Admin:    ${cert.AdminAccess.User.email}`);
      console.log(`  Device:   ${cert.deviceName || 'N/A'}`);
      console.log(`  Emitido:  ${cert.issuedAt.toISOString()}`);
      console.log(`  Expira:   ${cert.expiresAt.toISOString()}`);
      if (cert.revokedAt) {
        console.log(`  Revocado: ${cert.revokedAt.toISOString()}`);
        console.log(`  Razón:    ${cert.revokedReason || 'N/A'}`);
      }
      console.log();
    }

  } catch (error) {
    console.error('❌ Error listando certificados:', error);
    throw error;
  }
}

/**
 * Limpia certificados expirados
 */
export async function cleanupExpiredCertificates(): Promise<void> {
  try {
    const result = await prisma.adminCertificate.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    console.log(`🧹 Limpieza: ${result.count} certificados expirados eliminados`);

  } catch (error) {
    console.error('❌ Error limpiando certificados:', error);
    throw error;
  }
}
