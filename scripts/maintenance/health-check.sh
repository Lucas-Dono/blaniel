#!/bin/bash

# Health Check Script
# Verifica que todos los sistemas estén funcionando correctamente

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cargar variables de entorno
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

echo "======================================"
echo "   HEALTH CHECK - Sistema ML"
echo "======================================"
echo ""

# 1. Verificar que la aplicación esté corriendo
echo -n "🌐 Aplicación Next.js: "
if [ -z "$APP_URL" ]; then
    APP_URL="http://localhost:3000"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" --max-time 5)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✅ CORRIENDO${NC} (HTTP $HTTP_CODE)"
else
    echo -e "${RED}❌ NO DISPONIBLE${NC} (HTTP $HTTP_CODE)"
fi

# 2. Verificar Redis
echo -n "🔴 Redis (Upstash): "
if [ -z "$UPSTASH_REDIS_REST_URL" ]; then
    echo -e "${YELLOW}⚠️  NO CONFIGURADO${NC}"
else
    echo -e "${GREEN}✅ CONFIGURADO${NC}"
fi

# 3. Verificar base de datos
echo -n "🗄️  PostgreSQL: "
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ NO CONFIGURADO${NC}"
else
    echo -e "${GREEN}✅ CONFIGURADO${NC}"
fi

# 4. Verificar CRON_SECRET
echo -n "🔐 CRON_SECRET: "
if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}❌ NO CONFIGURADO${NC}"
else
    echo -e "${GREEN}✅ CONFIGURADO${NC}"
fi

# 5. Verificar modelo Qwen
echo -n "🤖 Modelo Qwen (embeddings): "
MODEL_PATH="$PROJECT_DIR/model/Qwen3-Embedding-0.6B-Q8_0.gguf"
if [ -f "$MODEL_PATH" ]; then
    MODEL_SIZE=$(du -h "$MODEL_PATH" | cut -f1)
    echo -e "${GREEN}✅ DISPONIBLE${NC} ($MODEL_SIZE)"
else
    echo -e "${RED}❌ NO ENCONTRADO${NC}"
    echo "   📁 Ruta esperada: $MODEL_PATH"
fi

# 6. Verificar directorio de logs
echo -n "📋 Directorio de logs: "
LOG_DIR="$PROJECT_DIR/logs"
if [ -d "$LOG_DIR" ]; then
    LOG_COUNT=$(ls -1 "$LOG_DIR" 2>/dev/null | wc -l)
    echo -e "${GREEN}✅ EXISTE${NC} ($LOG_COUNT archivos)"
else
    mkdir -p "$LOG_DIR"
    echo -e "${YELLOW}⚠️  CREADO${NC}"
fi

# 7. Verificar endpoint de stats (si la app está corriendo)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -n "📊 API Embeddings Stats: "
    STATS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/admin/embeddings/stats" --max-time 5)

    if [ "$STATS_CODE" = "200" ] || [ "$STATS_CODE" = "401" ]; then
        echo -e "${GREEN}✅ DISPONIBLE${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTP $STATS_CODE${NC}"
    fi
fi

echo ""
echo "======================================"
echo "   FIN DEL HEALTH CHECK"
echo "======================================"

exit 0
