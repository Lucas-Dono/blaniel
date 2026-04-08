#!/bin/bash
###############################################################################
# SCRIPT DE AUDITORÍA DE SEGURIDAD AUTOMATIZADA
#
# Ejecuta múltiples verificaciones de seguridad y genera un reporte
# Uso: ./scripts/security-audit.sh
###############################################################################

set -e

echo "🔐 =========================================="
echo "🔐  AUDITORÍA DE SEGURIDAD - BLANIEL"
echo "🔐 =========================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_DIR="./security-reports"
REPORT_FILE="$REPORT_DIR/security-audit-$TIMESTAMP.txt"

# Crear directorio de reportes
mkdir -p "$REPORT_DIR"

# Función para log
log() {
  echo "$1" | tee -a "$REPORT_FILE"
}

log ""
log "Fecha: $(date)"
log "=========================================="
log ""

# 1. NPM AUDIT
echo -e "${BLUE}📦 1. Ejecutando npm audit...${NC}"
log "1. NPM AUDIT"
log "----------------------------------------"

if npm audit --json > /tmp/npm-audit.json 2>&1; then
  VULN_COUNT=$(cat /tmp/npm-audit.json | grep -o '"total":[0-9]*' | tail -1 | cut -d':' -f2)
  if [ "$VULN_COUNT" = "0" ]; then
    echo -e "${GREEN}✅ 0 vulnerabilidades detectadas${NC}"
    log "✅ Estado: SEGURO (0 vulnerabilidades)"
  else
    echo -e "${RED}❌ $VULN_COUNT vulnerabilidades detectadas${NC}"
    log "❌ Estado: VULNERABLE ($VULN_COUNT vulnerabilidades)"
    npm audit >> "$REPORT_FILE"
  fi
else
  echo -e "${YELLOW}⚠️  Error ejecutando npm audit${NC}"
  log "⚠️  Error ejecutando npm audit"
fi
log ""

# 2. PAQUETES CRÍTICOS
echo -e "${BLUE}🎯 2. Verificando paquetes críticos...${NC}"
log "2. PAQUETES CRÍTICOS"
log "----------------------------------------"

CRITICAL_PACKAGES=(
  "jspdf"
  "nodemailer"
  "next"
  "prisma"
  "@aws-sdk/client-s3"
  "@sentry/nextjs"
)

for pkg in "${CRITICAL_PACKAGES[@]}"; do
  VERSION=$(npm ls "$pkg" --depth=0 2>/dev/null | grep "$pkg" | awk '{print $2}' | sed 's/@//')
  if [ -n "$VERSION" ]; then
    log "✅ $pkg@$VERSION"
  else
    log "⚠️  $pkg no encontrado"
  fi
done
log ""

# 3. PAQUETES DESACTUALIZADOS
echo -e "${BLUE}📊 3. Verificando paquetes desactualizados...${NC}"
log "3. PAQUETES DESACTUALIZADOS"
log "----------------------------------------"

OUTDATED=$(npm outdated 2>/dev/null | wc -l)
if [ "$OUTDATED" -gt 1 ]; then
  echo -e "${YELLOW}⚠️  $((OUTDATED-1)) paquetes desactualizados${NC}"
  log "⚠️  $((OUTDATED-1)) paquetes desactualizados"
  npm outdated --long 2>/dev/null | head -20 >> "$REPORT_FILE"
else
  echo -e "${GREEN}✅ Todos los paquetes están actualizados${NC}"
  log "✅ Todos los paquetes están actualizados"
fi
log ""

# 4. TYPESCRIPT ERRORS
echo -e "${BLUE}🔍 4. Verificando errores de TypeScript...${NC}"
log "4. TYPESCRIPT ERRORS"
log "----------------------------------------"

if npx tsc --noEmit 2>&1 | tee /tmp/tsc-errors.txt | grep -q "error TS"; then
  ERROR_COUNT=$(grep -c "error TS" /tmp/tsc-errors.txt || echo "0")
  echo -e "${RED}❌ $ERROR_COUNT errores de TypeScript${NC}"
  log "❌ $ERROR_COUNT errores de TypeScript"
  head -20 /tmp/tsc-errors.txt >> "$REPORT_FILE"
else
  echo -e "${GREEN}✅ Sin errores de TypeScript${NC}"
  log "✅ Sin errores de TypeScript"
fi
log ""

# 5. SECRETS EN CÓDIGO
echo -e "${BLUE}🔑 5. Buscando secrets expuestos...${NC}"
log "5. SECRETS SCAN"
log "----------------------------------------"

# Buscar patrones comunes de secrets
PATTERNS=(
  "password\s*=\s*['\"]"
  "api[_-]?key\s*=\s*['\"]"
  "secret\s*=\s*['\"]"
  "token\s*=\s*['\"]"
  "AKIA[0-9A-Z]{16}"
)

FOUND_SECRETS=0
for pattern in "${PATTERNS[@]}"; do
  if grep -rn -E "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null | grep -v ".env"; then
    FOUND_SECRETS=$((FOUND_SECRETS+1))
  fi
done

if [ "$FOUND_SECRETS" -eq 0 ]; then
  echo -e "${GREEN}✅ No se encontraron secrets expuestos${NC}"
  log "✅ No se encontraron secrets expuestos"
else
  echo -e "${RED}❌ Posibles secrets encontrados (revisar manualmente)${NC}"
  log "❌ Posibles secrets encontrados (revisar manualmente)"
fi
log ""

# 6. ARCHIVOS SENSIBLES
echo -e "${BLUE}📁 6. Verificando archivos sensibles...${NC}"
log "6. ARCHIVOS SENSIBLES"
log "----------------------------------------"

SENSITIVE_FILES=(
  ".env"
  ".env.local"
  ".env.production"
  "prisma/.env"
)

for file in "${SENSITIVE_FILES[@]}"; do
  if [ -f "$file" ]; then
    if git check-ignore "$file" >/dev/null 2>&1; then
      log "✅ $file (ignorado por git)"
    else
      echo -e "${RED}❌ $file NO está en .gitignore${NC}"
      log "❌ $file NO está en .gitignore"
    fi
  fi
done
log ""

# 7. DEPENDENCIAS DE PRODUCCIÓN
echo -e "${BLUE}🏭 7. Auditando solo dependencias de producción...${NC}"
log "7. PRODUCCIÓN AUDIT"
log "----------------------------------------"

if npm audit --omit=dev --json > /tmp/npm-audit-prod.json 2>&1; then
  PROD_VULN=$(cat /tmp/npm-audit-prod.json | grep -o '"total":[0-9]*' | tail -1 | cut -d':' -f2)
  if [ "$PROD_VULN" = "0" ]; then
    echo -e "${GREEN}✅ Producción segura (0 vulnerabilidades)${NC}"
    log "✅ Producción: SEGURA (0 vulnerabilidades)"
  else
    echo -e "${RED}❌ Producción vulnerable ($PROD_VULN vulnerabilidades)${NC}"
    log "❌ Producción: VULNERABLE ($PROD_VULN vulnerabilidades)"
  fi
fi
log ""

# 8. RESUMEN FINAL
echo ""
echo -e "${BLUE}=========================================="
echo -e " RESUMEN DE AUDITORÍA"
echo -e "==========================================${NC}"
log ""
log "=========================================="
log "RESUMEN FINAL"
log "=========================================="

# Calcular score
SCORE=100

if [ "$VULN_COUNT" != "0" ]; then
  SCORE=$((SCORE - 30))
fi

if [ "$PROD_VULN" != "0" ]; then
  SCORE=$((SCORE - 40))
fi

if [ "$FOUND_SECRETS" -gt 0 ]; then
  SCORE=$((SCORE - 20))
fi

if [ "$ERROR_COUNT" -gt 0 ]; then
  SCORE=$((SCORE - 10))
fi

log "Score de Seguridad: $SCORE/100"
log ""

if [ "$SCORE" -ge 90 ]; then
  echo -e "${GREEN}🎖️  ESTADO: EXCELENTE ($SCORE/100)${NC}"
  log "🎖️  Estado: EXCELENTE"
elif [ "$SCORE" -ge 70 ]; then
  echo -e "${YELLOW}⚠️  ESTADO: ACEPTABLE ($SCORE/100)${NC}"
  log "⚠️  Estado: ACEPTABLE"
else
  echo -e "${RED}🚨 ESTADO: CRÍTICO ($SCORE/100)${NC}"
  log "🚨 Estado: CRÍTICO"
fi

log ""
log "Reporte guardado en: $REPORT_FILE"
echo ""
echo -e "${BLUE}📄 Reporte guardado en: $REPORT_FILE${NC}"
echo ""

# Limpiar archivos temporales
rm -f /tmp/npm-audit.json /tmp/npm-audit-prod.json /tmp/tsc-errors.txt

echo -e "${GREEN}✅ Auditoría completada${NC}"
