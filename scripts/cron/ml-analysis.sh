#!/bin/bash

# Script para ejecutar análisis ML de moderación (cron nocturno)
# Se ejecuta automáticamente a las 3 AM todos los días

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/ml-analysis-$(date +%Y-%m-%d).log"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

# Función de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================"
log "Iniciando análisis ML de moderación"
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
log "Llamando al endpoint de análisis ML..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$APP_URL/api/cron/ml-moderation-analysis")

if [ "$HTTP_CODE" = "200" ]; then
    log "✅ Análisis ML completado exitosamente (HTTP $HTTP_CODE)"

    # Obtener detalles de la respuesta
    RESPONSE=$(curl -s \
        -X GET \
        -H "Authorization: Bearer $CRON_SECRET" \
        "$APP_URL/api/cron/ml-moderation-analysis")

    log "Respuesta: $RESPONSE"
else
    log "❌ ERROR: Análisis ML falló (HTTP $HTTP_CODE)"
    exit 1
fi

log "========================================"
log "Análisis ML finalizado"
log "========================================"

# Limpiar logs antiguos (mantener últimos 30 días)
find "$LOG_DIR" -name "ml-analysis-*.log" -mtime +30 -delete

exit 0
