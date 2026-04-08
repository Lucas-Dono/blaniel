/**
 * Admin Certificate Manager
 * Generates, renews and revokes client certificates for mTLS
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

// Lazy initialization to prevent errors during build time
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
    // During build time, simply ignore the error
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
 * Verifies that the CA exists
 */
function verifyCA(): void {
  if (!existsSync(join(CA_DIR, 'ca.key')) || !existsSync(join(CA_DIR, 'ca.crt'))) {
    throw new Error(
      'CA not found. First run: npm run admin:setup-ca'
    );
  }
}

/**
 * Generates a client certificate
 *
 * @param adminEmail - Admin email address
 * @param deviceName - Device name (e.g.: "MacBook Pro")
 * @param validityHours - Hours of validity (default: 48)
 * @param isEmergency - Whether it's an emergency certificate (24h)
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

    // 1. Look up admin in database
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: { AdminAccess: true }
    });

    if (!admin?.AdminAccess) {
      throw new Error(`User ${adminEmail} does not have admin access`);
    }

    if (!admin.AdminAccess.enabled) {
      throw new Error(`Admin access disabled for ${adminEmail}`);
    }

    // 2. Generate unique serial number
    const serialNumber = randomBytes(16);
    const timestamp = Date.now();
    const certName = `admin-${serialNumber}`;

    // Certificate paths
    const keyPath = join(CLIENT_DIR, `${certName}.key`);
    const csrPath = join(CLIENT_DIR, `${certName}.csr`);
    const certPath = join(CLIENT_DIR, `${certName}.crt`);
    const p12Path = join(CLIENT_DIR, `${certName}.p12`);

    console.log(`\n🔐 Generating client certificate...`);
    console.log(`   Admin: ${adminEmail}`);
    console.log(`   Device: ${deviceName}`);
    console.log(`   Validity: ${validityHours}h`);
    console.log(`   Emergency: ${isEmergency ? 'Yes' : 'No'}`);
    console.log();

    // 3. Generate client private key (2048 bits)
    console.log('  ⏳ Generating private key...');
    execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'pipe' });

    // 4. Generate CSR (Certificate Signing Request)
    console.log('  ⏳ Generating CSR...');
    const subject = `/C=AR/ST=Buenos Aires/L=Buenos Aires/O=Creador Inteligencias/OU=Admin/CN=admin-${admin.id}/emailAddress=${adminEmail}`;

    execSync(
      `openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "${subject}"`,
      { stdio: 'pipe' }
    );

    // 5. Sign certificate with CA
    console.log('  ⏳ Signing certificate with CA...');
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

    // 6. Generate PKCS12 file for browser
    console.log('  ⏳ Generating PKCS12 file...');
    const p12Password = randomBytes(8);

    execSync(
      `openssl pkcs12 -export ` +
      `-in "${certPath}" ` +
      `-inkey "${keyPath}" ` +
      `-out "${p12Path}" ` +
      `-password "pass:${p12Password}"`,
      { stdio: 'pipe' }
    );

    // 7. Calculate SHA-256 fingerprint
    const fingerprintOutput = execSync(
      `openssl x509 -in "${certPath}" -noout -fingerprint -sha256`,
      { encoding: 'utf8' }
    );

    const fingerprint = fingerprintOutput
      .split('=')[1]
      .trim()
      .replace(/:/g, '');

    // 8. Save to database
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

    // 9. Audit log
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
    console.log('  ✅ Certificate generated successfully');
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
    console.error('❌ Error generating certificate:', error);
    throw error;
  }
}

/**
 * Revokes a certificate
 */
export async function revokeCertificate(
  serialNumber: string,
  reason: string
): Promise<void> {
  try {
    ensureDirectories();
    // 1. Mark as revoked in database
    const cert = await prisma.adminCertificate.update({
      where: { serialNumber },
      data: {
        revokedAt: new Date(),
        revokedReason: reason
      },
      include: { AdminAccess: true }
    });

    // 2. Update CRL (Certificate Revocation List)
    await updateCRL();

    // 3. Audit log
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

    console.log(`✅ Certificate ${serialNumber} revoked`);
    console.log(`   Reason: ${reason}`);

  } catch (error) {
    console.error('❌ Error revoking certificate:', error);
    throw error;
  }
}

/**
 * Updates the CRL (Certificate Revocation List)
 */
export async function updateCRL(): Promise<void> {
  try {
    // 1. Get all revoked certificates
    const revokedCerts = await prisma.adminCertificate.findMany({
      where: {
        revokedAt: { not: null }
      },
      select: {
        serialNumber: true,
        revokedAt: true
      }
    });

    // 2. Write CRL in plain text format (for NGINX)
    const crlPath = join(CA_DIR, 'crl.txt');
    const crlContent = revokedCerts
      .map(cert => cert.serialNumber)
      .join('\n');

    writeFileSync(crlPath, crlContent, 'utf8');

    console.log(`✅ CRL updated: ${revokedCerts.length} revoked certificates`);

  } catch (error) {
    console.error('❌ Error updating CRL:', error);
    throw error;
  }
}

/**
 * Lists all active certificates
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

    console.log(`\n📜 Admin Certificates (${certs.length} total)\n`);

    for (const cert of certs) {
      const status = cert.revokedAt
        ? '🚫 Revoked'
        : cert.expiresAt < new Date()
        ? '⏰ Expired'
        : '✅ Active';

      const emergency = cert.isEmergency ? '🚨 Emergency' : '';

      console.log(`${status} ${emergency}`);
      console.log(`  Serial:   ${cert.serialNumber}`);
      console.log(`  Admin:    ${cert.AdminAccess.User.email}`);
      console.log(`  Device:   ${cert.deviceName || 'N/A'}`);
      console.log(`  Issued:   ${cert.issuedAt.toISOString()}`);
      console.log(`  Expires:  ${cert.expiresAt.toISOString()}`);
      if (cert.revokedAt) {
        console.log(`  Revoked:  ${cert.revokedAt.toISOString()}`);
        console.log(`  Reason:   ${cert.revokedReason || 'N/A'}`);
      }
      console.log();
    }

  } catch (error) {
    console.error('❌ Error listing certificates:', error);
    throw error;
  }
}

/**
 * Cleans up expired certificates
 */
export async function cleanupExpiredCertificates(): Promise<void> {
  try {
    const result = await prisma.adminCertificate.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    console.log(`🧹 Cleanup: ${result.count} expired certificates deleted`);

  } catch (error) {
    console.error('❌ Error cleaning certificates:', error);
    throw error;
  }
}
