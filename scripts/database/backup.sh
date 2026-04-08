#!/bin/bash

###############################################################################
# Manual Database Backup Script
#
# Crea un backup manual de la base de datos (útil para testing o backups
# antes de migraciones importantes).
#
# REQUISITOS:
# - PostgreSQL client (pg_dump) instalado
# - AWS CLI instalado y configurado con credenciales de R2
# - Variable de entorno DATABASE_URL configurada
#
# USO:
#   ./scripts/backup-database-manual.sh
#   ./scripts/backup-database-manual.sh --local-only  # Solo guarda localmente
#
###############################################################################

set -e  # Exit on error

# Cargar variables de entorno desde .env (eliminar comillas)
if [ -f .env ]; then
  set -a  # Automatically export all variables
  source <(grep -v '^#' .env | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^export //' -e 's/="\(.*\)"$/=\1/')
  set +a
fi

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuración
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="backup_${TIMESTAMP}.sql"
GZIP_FILENAME="${FILENAME}.gz"
LOCAL_DIR="${BACKUP_DIR:-./backups}"
LOCAL_PATH="${LOCAL_DIR}/${FILENAME}"
GZIP_PATH="${LOCAL_DIR}/${GZIP_FILENAME}"
BUCKET_NAME="${R2_BUCKET_NAME:-database-backups}"
BACKUP_PREFIX="postgres-backups/"

# Crear directorio de backups si no existe
mkdir -p "${LOCAL_DIR}"

echo -e "${GREEN}Starting manual database backup...${NC}"
echo ""

# Verificar requisitos
if [ -z "${DATABASE_URL}" ]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    exit 1
fi

if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump not installed${NC}"
    exit 1
fi

# 1. Crear dump
echo -e "${GREEN}[1/4] Creating database dump...${NC}"
pg_dump "${DATABASE_URL}" > "${LOCAL_PATH}"

if [ ! -f "${LOCAL_PATH}" ]; then
    echo -e "${RED}Error: Failed to create dump${NC}"
    exit 1
fi

DUMP_SIZE=$(du -h "${LOCAL_PATH}" | cut -f1)
echo -e "${GREEN}✓ Dump created: ${LOCAL_PATH} (${DUMP_SIZE})${NC}"

# 2. Comprimir
echo -e "${GREEN}[2/4] Compressing backup...${NC}"
gzip -c "${LOCAL_PATH}" > "${GZIP_PATH}"

if [ ! -f "${GZIP_PATH}" ]; then
    echo -e "${RED}Error: Failed to compress backup${NC}"
    rm -f "${LOCAL_PATH}"
    exit 1
fi

GZIP_SIZE=$(du -h "${GZIP_PATH}" | cut -f1)
echo -e "${GREEN}✓ Compressed: ${GZIP_PATH} (${GZIP_SIZE})${NC}"

# Eliminar archivo sin comprimir
rm -f "${LOCAL_PATH}"

# 3. Encriptar con GPG
echo -e "${GREEN}[3/4] Encrypting backup with GPG...${NC}"

# Verificar si existe clave GPG
GPG_KEY_EMAIL="${GPG_BACKUP_EMAIL:-backup@creador-inteligencias.com}"
GPG_ENCRYPTED_PATH="${GZIP_PATH}.gpg"

if ! gpg --list-keys "${GPG_KEY_EMAIL}" &> /dev/null; then
    echo -e "${YELLOW}⚠️  GPG key not found. Creating new key for backups...${NC}"
    # Crear clave GPG no interactiva
    gpg --batch --gen-key <<EOF
%no-protection
Key-Type: RSA
Key-Length: 4096
Name-Real: Database Backup
Name-Email: ${GPG_KEY_EMAIL}
Expire-Date: 0
%commit
EOF
    echo -e "${GREEN}✓ GPG key created${NC}"
fi

# Encriptar el backup
gpg --encrypt --recipient "${GPG_KEY_EMAIL}" --output "${GPG_ENCRYPTED_PATH}" "${GZIP_PATH}"

if [ ! -f "${GPG_ENCRYPTED_PATH}" ]; then
    echo -e "${RED}Error: Failed to encrypt backup${NC}"
    rm -f "${GZIP_PATH}"
    exit 1
fi

ENCRYPTED_SIZE=$(du -h "${GPG_ENCRYPTED_PATH}" | cut -f1)
echo -e "${GREEN}✓ Encrypted: ${GPG_ENCRYPTED_PATH} (${ENCRYPTED_SIZE})${NC}"

# Eliminar archivo sin encriptar
rm -f "${GZIP_PATH}"

# 4. Upload a R2 (opcional)
if [ "$1" != "--local-only" ]; then
    if command -v aws &> /dev/null && [ -n "${R2_ENDPOINT}" ]; then
        echo -e "${GREEN}[4/4] Uploading to R2...${NC}"

        aws s3 cp \
            "${GPG_ENCRYPTED_PATH}" \
            "s3://${BUCKET_NAME}/${BACKUP_PREFIX}${GZIP_FILENAME}.gpg" \
            --endpoint-url "${R2_ENDPOINT}" \
            --metadata backup-timestamp="${TIMESTAMP}",database-name="creador-inteligencias",backup-type="manual",encrypted="gpg"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Uploaded encrypted backup to R2${NC}"
        else
            echo -e "${YELLOW}⚠️  Warning: Failed to upload to R2, but local encrypted backup exists${NC}"
        fi
    else
        echo -e "${YELLOW}[4/4] Skipping R2 upload (AWS CLI not installed or R2_ENDPOINT not set)${NC}"
    fi
else
    echo -e "${YELLOW}[4/4] Skipping R2 upload (--local-only flag)${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Encrypted backup completed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "Local encrypted backup: ${YELLOW}${GPG_ENCRYPTED_PATH}${NC}"
echo -e "Size: ${YELLOW}${ENCRYPTED_SIZE}${NC}"
echo -e "Encryption: ${YELLOW}GPG (${GPG_KEY_EMAIL})${NC}"
echo ""
echo -e "${GREEN}To restore this backup:${NC}"
echo "  gpg --decrypt ${GPG_ENCRYPTED_PATH} | gunzip | psql \$DATABASE_URL"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Keep your GPG private key safe!${NC}"
echo "  Export key: gpg --export-secret-keys ${GPG_KEY_EMAIL} > backup-key.asc"
