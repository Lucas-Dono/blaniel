#!/bin/bash

# ===============================================
# Setup Cron Jobs para Cloud Server
# ===============================================
# Este script configura automáticamente todos los
# cron jobs necesarios para el sistema
# ===============================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Setup de Cron Jobs para Cloud Server${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Debe ejecutar este script desde el directorio raíz del proyecto${NC}"
    exit 1
fi

# Obtener el directorio actual
PROJECT_DIR=$(pwd)
echo -e "${GREEN}📁 Directorio del proyecto: ${PROJECT_DIR}${NC}"

# Verificar que existe .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: Archivo .env no encontrado${NC}"
    exit 1
fi

# Cargar variables de entorno
source .env

# Verificar CRON_SECRET
if [ -z "$CRON_SECRET" ]; then
    echo -e "${YELLOW}⚠️  CRON_SECRET no encontrado en .env${NC}"
    echo -e "${YELLOW}   Generando nuevo CRON_SECRET...${NC}"
    NEW_SECRET=$(openssl rand -base64 32)
    echo "CRON_SECRET=\"$NEW_SECRET\"" >> .env
    CRON_SECRET=$NEW_SECRET
    echo -e "${GREEN}✅ CRON_SECRET generado y agregado a .env${NC}"
fi

# Verificar APP_URL
if [ -z "$APP_URL" ]; then
    echo -e "${YELLOW}⚠️  APP_URL no encontrado en .env${NC}"
    APP_URL="http://localhost:3000"
    echo "APP_URL=\"$APP_URL\"" >> .env
    echo -e "${GREEN}✅ APP_URL configurado como ${APP_URL}${NC}"
fi

echo -e "${GREEN}✅ Variables de entorno verificadas${NC}"
echo ""

# Crear directorio de logs si no existe
echo -e "${BLUE}📋 Creando directorio de logs...${NC}"
mkdir -p ${PROJECT_DIR}/logs
chmod 755 ${PROJECT_DIR}/logs
echo -e "${GREEN}✅ Directorio de logs creado: ${PROJECT_DIR}/logs${NC}"
echo ""

# Backup del crontab actual
echo -e "${BLUE}💾 Haciendo backup del crontab actual...${NC}"
crontab -l > ${PROJECT_DIR}/logs/crontab-backup-$(date +%Y%m%d-%H%M%S).txt 2>/dev/null || echo "# No existing crontab" > ${PROJECT_DIR}/logs/crontab-backup-$(date +%Y%m%d-%H%M%S).txt
echo -e "${GREEN}✅ Backup creado en logs/crontab-backup-*.txt${NC}"
echo ""

# Crear archivo temporal con los nuevos cron jobs
TEMP_CRON=$(mktemp)

# Obtener crontab existente (si existe) y filtrar jobs antiguos
crontab -l 2>/dev/null | grep -v "/api/cron/" > $TEMP_CRON || true

# Agregar header
cat >> $TEMP_CRON << EOF

# ===============================================
# Circuit Prompt AI - Cron Jobs
# Auto-generado por setup-cron-jobs.sh
# Fecha: $(date +"%Y-%m-%d %H:%M:%S")
# ===============================================

# Variables
CRON_SECRET="${CRON_SECRET}"
APP_URL="${APP_URL}"
PROJECT_DIR="${PROJECT_DIR}"

# 1. Mensajes Proactivos de IA (cada hora)
0 * * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/proactive-messaging >> \${PROJECT_DIR}/logs/proactive-messaging.log 2>&1

# 2. Auto-pausa de Mundos Inactivos (cada 6 horas)
0 */6 * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/auto-pause-worlds >> \${PROJECT_DIR}/logs/auto-pause-worlds.log 2>&1

# 3. Eliminar Mundos Programados (diario a las 3 AM)
0 3 * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/delete-scheduled-worlds >> \${PROJECT_DIR}/logs/delete-worlds.log 2>&1

# 4. Backup de Base de Datos (diario a las 3 AM)
0 3 * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/backup-database >> \${PROJECT_DIR}/logs/backup-database.log 2>&1

# 5. Expirar Grants Temporales (cada hora)
0 * * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/expire-temp-grants >> \${PROJECT_DIR}/logs/expire-grants.log 2>&1

# 6. Análisis ML de Moderación (diario a las 3 AM)
0 3 * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/ml-moderation-analysis >> \${PROJECT_DIR}/logs/ml-analysis.log 2>&1

# 7. Limpieza de Caché (diario a las 2 AM)
0 2 * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/cache-cleanup >> \${PROJECT_DIR}/logs/cache-cleanup.log 2>&1

# 8. Verificación de Alertas (cada hora)
0 * * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/check-alerts >> \${PROJECT_DIR}/logs/check-alerts.log 2>&1

# 9. Digest Diario de Posts Seguidos (diario a las 9 AM)
0 9 * * * curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/daily-digest >> \${PROJECT_DIR}/logs/daily-digest.log 2>&1

# 10. Digest Semanal de Posts Seguidos (lunes a las 9 AM)
0 9 * * 1 curl -X POST -H "Authorization: Bearer \${CRON_SECRET}" \${APP_URL}/api/cron/weekly-digest >> \${PROJECT_DIR}/logs/weekly-digest.log 2>&1

# Limpieza de logs antiguos (semanal, domingos a las 4 AM)
0 4 * * 0 find \${PROJECT_DIR}/logs -name "*.log" -mtime +30 -delete >> \${PROJECT_DIR}/logs/cleanup.log 2>&1

# ===============================================
EOF

# Instalar nuevo crontab
crontab $TEMP_CRON

# Limpiar archivo temporal
rm $TEMP_CRON

echo -e "${GREEN}✅ Cron jobs instalados exitosamente!${NC}"
echo ""

# Mostrar crontab instalado
echo -e "${BLUE}📋 Cron jobs configurados:${NC}"
echo -e "${YELLOW}-----------------------------------------------${NC}"
crontab -l | grep -A 100 "Circuit Prompt AI"
echo -e "${YELLOW}-----------------------------------------------${NC}"
echo ""

# Verificar que el servicio cron esté activo
echo -e "${BLUE}🔍 Verificando servicio cron...${NC}"
if systemctl is-active --quiet cron 2>/dev/null || systemctl is-active --quiet crond 2>/dev/null; then
    echo -e "${GREEN}✅ Servicio cron activo${NC}"
else
    echo -e "${YELLOW}⚠️  Servicio cron no está activo${NC}"
    echo -e "${YELLOW}   Intentando iniciar...${NC}"
    sudo systemctl start cron 2>/dev/null || sudo systemctl start crond 2>/dev/null || true
    sudo systemctl enable cron 2>/dev/null || sudo systemctl enable crond 2>/dev/null || true
    echo -e "${GREEN}✅ Servicio cron iniciado${NC}"
fi
echo ""

# Información adicional
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ Setup completado exitosamente!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}📝 Notas importantes:${NC}"
echo ""
echo -e "  • Los logs se guardan en: ${PROJECT_DIR}/logs/"
echo -e "  • CRON_SECRET: ${CRON_SECRET:0:20}..."
echo -e "  • APP_URL: ${APP_URL}"
echo ""
echo -e "${YELLOW}📊 Monitoreo:${NC}"
echo ""
echo -e "  Ver logs en tiempo real:"
echo -e "  ${BLUE}tail -f ${PROJECT_DIR}/logs/proactive-messaging.log${NC}"
echo ""
echo -e "  Ver todos los logs:"
echo -e "  ${BLUE}tail -f ${PROJECT_DIR}/logs/*.log${NC}"
echo ""
echo -e "  Ver ejecuciones de cron del sistema:"
echo -e "  ${BLUE}sudo tail -f /var/log/syslog | grep CRON${NC}"
echo ""
echo -e "${YELLOW}🧪 Probar cron job manualmente:${NC}"
echo ""
echo -e "  ${BLUE}curl -X POST -H \"Authorization: Bearer ${CRON_SECRET}\" \\${NC}"
echo -e "  ${BLUE}  ${APP_URL}/api/cron/proactive-messaging${NC}"
echo ""
echo -e "${YELLOW}📚 Documentación:${NC}"
echo -e "  ${BLUE}docs/CLOUD_SERVER_CRON_JOBS.md${NC}"
echo ""
echo -e "${GREEN}✅ Todo listo! Los cron jobs comenzarán a ejecutarse automáticamente.${NC}"
echo ""
