#!/bin/bash

# Script para ejecutar digest semanal de posts seguidos
# Se ejecuta automáticamente a las 9 AM todos los lunes

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/weekly-digest-$(date +%Y-%m-%d).log"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

# Función de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================"
log "Iniciando envío de digest semanal"
log "========================================"

# Cargar variables de entorno
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
    log "Variables de entorno cargadas"
else
    log "ERROR: Archivo .env no encontrado"
    exit 1
fi

# Verificar que CRON_SECRET esté configurado
if [ -z "$CRON_SECRET" ]; then
    log "ERROR: CRON_SECRET no está configurado en .env"
    exit 1
fi

# Determinar la URL de la aplicación
if [ -z "$APP_URL" ]; then
    APP_URL="http://localhost:3000"
    log "Usando URL por defecto: $APP_URL"
else
    log "Usando URL configurada: $APP_URL"
fi

# Ejecutar el cron job vía HTTP
log "Enviando digests semanales..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$APP_URL/api/cron/weekly-digest")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    log "✅ Digest semanal completado exitosamente (HTTP $HTTP_CODE)"
    log "Respuesta: $BODY"
else
    log "❌ ERROR: Digest semanal falló (HTTP $HTTP_CODE)"
    log "Respuesta: $BODY"
    exit 1
fi

log "========================================"
log "Digest semanal finalizado"
log "========================================"

# Limpiar logs antiguos (mantener últimos 30 días)
find "$LOG_DIR" -name "weekly-digest-*.log" -mtime +30 -delete

exit 0
