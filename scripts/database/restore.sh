#!/bin/bash

###############################################################################
# Database Restore Script
#
# Restaura un backup de la base de datos desde Cloudflare R2.
#
# REQUISITOS:
# - AWS CLI instalado y configurado con credenciales de R2
# - PostgreSQL client (psql) instalado
# - Variable de entorno DATABASE_URL configurada
#
# USO:
#   ./scripts/restore-database.sh backup_2025-01-31_03-00-00.sql.gz
#   ./scripts/restore-database.sh list  # Lista backups disponibles
#
# SEGURIDAD:
# - Este script SOBRESCRIBIRÁ la base de datos actual
# - SIEMPRE haz un backup antes de restaurar
# - Ejecutar solo en entornos de desarrollo/staging
###############################################################################

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
BUCKET_NAME="${R2_BUCKET_NAME:-database-backups}"
BACKUP_PREFIX="postgres-backups/"
TEMP_DIR="/tmp"

# Función para mostrar uso
show_usage() {
    echo "Usage: $0 <backup-filename.sql.gz>"
    echo "       $0 list"
    echo ""
    echo "Examples:"
    echo "  $0 backup_2025-01-31_03-00-00.sql.gz"
    echo "  $0 list"
    exit 1
}

# Función para listar backups
list_backups() {
    echo -e "${GREEN}Available backups:${NC}"
    echo ""

    aws s3 ls "s3://${BUCKET_NAME}/${BACKUP_PREFIX}" \
        --endpoint-url "${R2_ENDPOINT}" \
        | sort -r \
        | head -20 \
        | while read -r line; do
            date=$(echo "$line" | awk '{print $1, $2}')
            size=$(echo "$line" | awk '{print $3}')
            filename=$(echo "$line" | awk '{print $4}')
            echo -e "  ${YELLOW}${filename}${NC} - ${date} - ${size} bytes"
        done

    echo ""
    echo -e "${GREEN}To restore a backup, run:${NC}"
    echo "  $0 <backup-filename.sql.gz>"
}

# Función para restaurar backup
restore_backup() {
    local BACKUP_FILE=$1
    local LOCAL_GZ_PATH="${TEMP_DIR}/${BACKUP_FILE}"
    local LOCAL_SQL_PATH="${LOCAL_GZ_PATH%.gz}"

    echo -e "${YELLOW}⚠️  WARNING: This will OVERWRITE your current database!${NC}"
    echo -e "${YELLOW}   Database: ${DATABASE_URL}${NC}"
    echo -e "${YELLOW}   Backup: ${BACKUP_FILE}${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo -e "${RED}Restore cancelled${NC}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}Starting restore process...${NC}"

    # 1. Download backup from R2
    echo -e "${GREEN}[1/4] Downloading backup from R2...${NC}"
    aws s3 cp \
        "s3://${BUCKET_NAME}/${BACKUP_PREFIX}${BACKUP_FILE}" \
        "${LOCAL_GZ_PATH}" \
        --endpoint-url "${R2_ENDPOINT}"

    if [ ! -f "${LOCAL_GZ_PATH}" ]; then
        echo -e "${RED}Error: Failed to download backup${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Download complete ($(du -h ${LOCAL_GZ_PATH} | cut -f1))${NC}"

    # 2. Decompress backup
    echo -e "${GREEN}[2/4] Decompressing backup...${NC}"
    gunzip -c "${LOCAL_GZ_PATH}" > "${LOCAL_SQL_PATH}"

    if [ ! -f "${LOCAL_SQL_PATH}" ]; then
        echo -e "${RED}Error: Failed to decompress backup${NC}"
        rm -f "${LOCAL_GZ_PATH}"
        exit 1
    fi

    echo -e "${GREEN}✓ Decompression complete ($(du -h ${LOCAL_SQL_PATH} | cut -f1))${NC}"

    # 3. Create safety backup of current database
    echo -e "${GREEN}[3/4] Creating safety backup of current database...${NC}"
    SAFETY_BACKUP="${TEMP_DIR}/safety_backup_$(date +%Y%m%d_%H%M%S).sql"
    pg_dump "${DATABASE_URL}" > "${SAFETY_BACKUP}" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Warning: Could not create safety backup${NC}"
    }

    if [ -f "${SAFETY_BACKUP}" ]; then
        echo -e "${GREEN}✓ Safety backup created: ${SAFETY_BACKUP}${NC}"
    fi

    # 4. Restore database
    echo -e "${GREEN}[4/4] Restoring database...${NC}"
    psql "${DATABASE_URL}" < "${LOCAL_SQL_PATH}"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database restored successfully!${NC}"
    else
        echo -e "${RED}Error: Restore failed${NC}"
        echo -e "${YELLOW}Safety backup available at: ${SAFETY_BACKUP}${NC}"
        exit 1
    fi

    # 5. Cleanup
    echo -e "${GREEN}Cleaning up temporary files...${NC}"
    rm -f "${LOCAL_GZ_PATH}" "${LOCAL_SQL_PATH}"

    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ Restore completed successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo ""

    if [ -f "${SAFETY_BACKUP}" ]; then
        echo -e "${YELLOW}Safety backup kept at:${NC}"
        echo "  ${SAFETY_BACKUP}"
        echo ""
        echo -e "${YELLOW}To remove it:${NC}"
        echo "  rm ${SAFETY_BACKUP}"
    fi
}

# Main script
main() {
    # Verificar requisitos
    if [ -z "${DATABASE_URL}" ]; then
        echo -e "${RED}Error: DATABASE_URL not set${NC}"
        exit 1
    fi

    if [ -z "${R2_ENDPOINT}" ]; then
        echo -e "${RED}Error: R2_ENDPOINT not set${NC}"
        exit 1
    fi

    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI not installed${NC}"
        echo "Install with: pip install awscli"
        exit 1
    fi

    if ! command -v psql &> /dev/null; then
        echo -e "${RED}Error: PostgreSQL client (psql) not installed${NC}"
        exit 1
    fi

    # Parsear argumentos
    if [ $# -eq 0 ]; then
        show_usage
    fi

    case "$1" in
        list)
            list_backups
            ;;
        *.sql.gz)
            restore_backup "$1"
            ;;
        *)
            echo -e "${RED}Error: Invalid argument${NC}"
            show_usage
            ;;
    esac
}

main "$@"
