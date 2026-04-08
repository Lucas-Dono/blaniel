-- Sistema de Administración Segura con mTLS + TOTP
-- Certificados de 48h con renovación automática
-- Recuperación vía SSH + TOTP

-- Tabla de Acceso Admin
CREATE TABLE "AdminAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "totpSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "lastLoginUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccess_pkey" PRIMARY KEY ("id")
);

-- Tabla de Certificados Admin
CREATE TABLE "AdminCertificate" (
    "id" TEXT NOT NULL,
    "adminAccessId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "deviceName" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdminCertificate_pkey" PRIMARY KEY ("id")
);

-- Tabla de Tokens de Descarga de Certificados
CREATE TABLE "CertificateDownloadToken" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateDownloadToken_pkey" PRIMARY KEY ("id")
);

-- Tabla de Códigos de Backup Admin (por si pierde TOTP)
CREATE TABLE "AdminBackupCode" (
    "id" TEXT NOT NULL,
    "adminAccessId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminBackupCode_pkey" PRIMARY KEY ("id")
);

-- Tabla de Logs de Auditoría
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminAccessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Índices únicos
CREATE UNIQUE INDEX "AdminAccess_userId_key" ON "AdminAccess"("userId");
CREATE UNIQUE INDEX "AdminCertificate_serialNumber_key" ON "AdminCertificate"("serialNumber");
CREATE UNIQUE INDEX "AdminCertificate_fingerprint_key" ON "AdminCertificate"("fingerprint");
CREATE UNIQUE INDEX "CertificateDownloadToken_certificateId_key" ON "CertificateDownloadToken"("certificateId");
CREATE UNIQUE INDEX "CertificateDownloadToken_token_key" ON "CertificateDownloadToken"("token");

-- Índices de búsqueda
CREATE INDEX "AdminAccess_userId_idx" ON "AdminAccess"("userId");
CREATE INDEX "AdminAccess_enabled_idx" ON "AdminAccess"("enabled");
CREATE INDEX "AdminCertificate_adminAccessId_idx" ON "AdminCertificate"("adminAccessId");
CREATE INDEX "AdminCertificate_serialNumber_idx" ON "AdminCertificate"("serialNumber");
CREATE INDEX "AdminCertificate_fingerprint_idx" ON "AdminCertificate"("fingerprint");
CREATE INDEX "AdminCertificate_adminAccessId_revokedAt_idx" ON "AdminCertificate"("adminAccessId", "revokedAt");
CREATE INDEX "AdminCertificate_expiresAt_idx" ON "AdminCertificate"("expiresAt");
CREATE INDEX "AdminBackupCode_adminAccessId_used_idx" ON "AdminBackupCode"("adminAccessId", "used");
CREATE INDEX "AuditLog_adminAccessId_idx" ON "AuditLog"("adminAccessId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_adminAccessId_createdAt_idx" ON "AuditLog"("adminAccessId", "createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "CertificateDownloadToken_token_idx" ON "CertificateDownloadToken"("token");
CREATE INDEX "CertificateDownloadToken_expiresAt_idx" ON "CertificateDownloadToken"("expiresAt");

-- Foreign Keys
ALTER TABLE "AdminAccess" ADD CONSTRAINT "AdminAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminCertificate" ADD CONSTRAINT "AdminCertificate_adminAccessId_fkey" FOREIGN KEY ("adminAccessId") REFERENCES "AdminAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CertificateDownloadToken" ADD CONSTRAINT "CertificateDownloadToken_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "AdminCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminBackupCode" ADD CONSTRAINT "AdminBackupCode_adminAccessId_fkey" FOREIGN KEY ("adminAccessId") REFERENCES "AdminAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminAccessId_fkey" FOREIGN KEY ("adminAccessId") REFERENCES "AdminAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
