#!/bin/bash

# Script principal de gestión - Blaniel
# Menú centralizado para acceder a todos los scripts operativos

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Banner
print_banner() {
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                                ║${NC}"
    echo -e "${CYAN}║           ${BOLD}BLANIEL - GESTIÓN DE SCRIPTS${NC}${CYAN}                    ║${NC}"
    echo -e "${CYAN}║                                                                ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Menú principal
show_menu() {
    print_banner
    echo -e "${BOLD}${BLUE}Categorías disponibles:${NC}"
    echo ""
    echo -e "  ${GREEN}1${NC}) 📊 Base de datos           - Backup, restore, migraciones"
    echo -e "  ${GREEN}2${NC}) ⏰ Cron Jobs              - Tareas programadas y configuración"
    echo -e "  ${GREEN}3${NC}) 🚀 Despliegue             - Verificaciones pre-deploy y sync"
    echo -e "  ${GREEN}4${NC}) 🔧 Mantenimiento          - Health check y seguridad"
    echo -e "  ${GREEN}5${NC}) 🌍 Internacionalización   - Traducciones"
    echo -e "  ${GREEN}6${NC}) 📱 Admin                  - Certificados, TOTP, cert manager"
    echo -e "  ${GREEN}7${NC}) 🎮 Minecraft              - Configuraciones de NPC"
    echo -e "  ${GREEN}8${NC}) 🤖 NPCs                   - Crear y probar NPCs"
    echo -e "  ${GREEN}9${NC}) 📸 Snapshots              - Gestión de snapshots del sistema"
    echo ""
    echo -e "  ${YELLOW}0${NC}) ❌ Salir"
    echo ""
    echo -ne "${BOLD}Selecciona una opción [0-9]: ${NC}"
}

# Menú base de datos
database_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}📊 BASE DE DATOS${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) 💾 Backup                 - Crear backup de la base de datos"
        echo -e "  ${GREEN}2${NC}) 📂 Restore                - Restaurar desde backup"
        echo -e "  ${GREEN}3${NC}) 🔄 Migrar personality cores"
        echo -e "  ${GREEN}4${NC}) ✅ Verificar campos Prisma"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-4]: ${NC}"
        read -r choice

        case $choice in
            1) bash "$SCRIPT_DIR/database/backup.sh"; press_key ;;
            2) bash "$SCRIPT_DIR/database/restore.sh"; press_key ;;
            3) npx tsx "$SCRIPT_DIR/database/migrate-personality-cores.ts"; press_key ;;
            4) node "$SCRIPT_DIR/database/verify-fields.js"; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú cron jobs
cron_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}⏰ CRON JOBS${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) 📬 Daily Digest           - Resumen diario"
        echo -e "  ${GREEN}2${NC}) 🤖 ML Analysis             - Análisis de moderación ML"
        echo -e "  ${GREEN}3${NC}) 📊 Weekly Digest          - Resumen semanal"
        echo -e "  ${GREEN}4${NC}) ⚙️  Setup Cron Jobs        - Configurar todas las tareas"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-4]: ${NC}"
        read -r choice

        case $choice in
            1) bash "$SCRIPT_DIR/cron/daily-digest.sh"; press_key ;;
            2) bash "$SCRIPT_DIR/cron/ml-analysis.sh"; press_key ;;
            3) bash "$SCRIPT_DIR/cron/weekly-digest.sh"; press_key ;;
            4) bash "$SCRIPT_DIR/cron/setup.sh"; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú despliegue
deployment_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}🚀 DESPLIEGUE${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) 🔍 Verificar pre-deploy   - Checklist de verificación"
        echo -e "  ${GREEN}2${NC}) 🔄 Sync to public         - Sincronizar con repositorio público"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-2]: ${NC}"
        read -r choice

        case $choice in
            1) bash "$SCRIPT_DIR/deployment/verify-before-deploy.sh"; press_key ;;
            2) bash "$SCRIPT_DIR/deployment/sync-to-public.sh"; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú mantenimiento
maintenance_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}🔧 MANTENIMIENTO${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) 🏥 Health Check           - Verificar estado del sistema"
        echo -e "  ${GREEN}2${NC}) 🔒 Security Audit         - Auditoría de seguridad"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-2]: ${NC}"
        read -r choice

        case $choice in
            1) bash "$SCRIPT_DIR/maintenance/health-check.sh"; press_key ;;
            2) bash "$SCRIPT_DIR/maintenance/security-audit.sh"; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú i18n
i18n_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}🌍 INTERNACIONALIZACIÓN${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) 🌐 Traducir              - Ejecutar traducciones seguras"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-1]: ${NC}"
        read -r choice

        case $choice in
            1) npx tsx "$SCRIPT_DIR/i18n/translate.ts"; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú admin
admin_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}📱 ADMIN${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) 📜 Setup CA               - Configurar Certificate Authority"
        echo -e "  ${GREEN}2${NC}) 🔐 Setup TOTP              - Configurar autenticación 2FA"
        echo -e "  ${GREEN}3${NC}) 🔄 Reset TOTP              - Resetear TOTP de usuario"
        echo -e "  ${GREEN}4${NC}) 📋 Generate Cert          - Generar certificado CLI"
        echo -e "  ${GREEN}5${NC}) 📋 List Certs             - Listar certificados"
        echo -e "  ${GREEN}6${NC}) ❌ Revoke Cert            - Revocar certificado"
        echo -e "  ${GREEN}7${NC}) 🧹 Cleanup Certs          - Limpiar certificados expirados"
        echo -e "  ${GREEN}8${NC}) 📋 Update CRL             - Actualizar Certificate Revocation List"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-8]: ${NC}"
        read -r choice

        case $choice in
            1) bash "$SCRIPT_DIR/admin/setup-ca.sh"; press_key ;;
            2) npx tsx "$SCRIPT_DIR/admin/setup-totp.ts"; press_key ;;
            3) npx tsx "$SCRIPT_DIR/admin/reset-totp.ts"; press_key ;;
            4) npx tsx "$SCRIPT_DIR/admin/generate-cert-cli.ts"; press_key ;;
            5) npm run admin:list-certs; press_key ;;
            6) npm run admin:revoke-cert; press_key ;;
            7) npm run admin:cleanup-certs; press_key ;;
            8) npm run admin:update-crl; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú minecraft
minecraft_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}🎮 MINECRAFT${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) ⚙️  Generate Configs       - Generar configuraciones batch"
        echo -e "  ${GREEN}2${NC}) 🔄 Migrate Manual          - Migración manual de configs"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-2]: ${NC}"
        read -r choice

        case $choice in
            1) npm run minecraft:generate-configs; press_key ;;
            2) npm run minecraft:migrate-manual; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú NPCs
npc_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}🤖 NPCs${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) ➕ Crear NPC              - Wizard interactivo para crear NPCs"
        echo -e "  ${GREEN}2${NC}) 📋 Listar NPCs            - Ver NPCs disponibles"
        echo -e "  ${GREEN}3${NC}) 💬 Probar NPC             - Chat con un NPC"
        echo -e "  ${GREEN}4${NC}) 📚 Ver Templates          - Templates disponibles"
        echo -e "  ${GREEN}5${NC}) 📖 Guía Rápida           - Ver guía de uso"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-5]: ${NC}"
        read -r choice

        case $choice in
            1)
                cd "$PROJECT_DIR"
                npm run npc:create
                press_key
                ;;
            2)
                cd "$PROJECT_DIR"
                npm run npc:list
                press_key
                ;;
            3)
                echo ""
                echo -ne "${CYAN}Ingresa el ID del NPC: ${NC}"
                read -r npc_id
                cd "$PROJECT_DIR"
                npm run npc:test "$npc_id"
                press_key
                ;;
            4)
                echo ""
                echo -e "${BOLD}${CYAN}📚 Templates Disponibles:${NC}"
                echo ""
                echo -e "  ${GREEN}merchant${NC}       - Comerciante amigable"
                echo -e "  ${GREEN}guard${NC}          - Guardia serio y protector"
                echo -e "  ${GREEN}villager${NC}       - Aldeano conversador"
                echo -e "  ${GREEN}quest-giver${NC}    - Dador de misiones misterioso"
                echo -e "  ${GREEN}companion${NC}      - Compañero leal"
                echo -e "  ${GREEN}enemy${NC}          - Adversario honorable"
                echo -e "  ${GREEN}friendly${NC}       - Amigo extremadamente positivo"
                echo -e "  ${GREEN}rpg-npc${NC}        - NPC genérico para RPG"
                echo ""
                echo "Usa: npm run npc:create -- --template <nombre> --name \"Tu NPC\""
                press_key
                ;;
            5)
                less "$PROJECT_DIR/NPC_QUICK_START.md" || cat "$PROJECT_DIR/NPC_QUICK_START.md"
                press_key
                ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Menú snapshots
snapshot_menu() {
    while true; do
        print_banner
        echo -e "${BOLD}${BLUE}📸 SNAPSHOTS${NC}"
        echo ""
        echo -e "  ${GREEN}1${NC}) 📋 List Snapshots         - Listar snapshots disponibles"
        echo -e "  ${GREEN}2${NC}) 🔄 Restore Snapshot       - Restaurar desde snapshot"
        echo -e "  ${GREEN}3${NC}) 👁️  Watch Service         - Iniciar servicio de snapshots"
        echo ""
        echo -e "  ${YELLOW}0${NC}) ⬅️  Volver al menú principal"
        echo ""
        echo -ne "${BOLD}Selecciona una opción [0-3]: ${NC}"
        read -r choice

        case $choice in
            1) npm run snapshot:list; press_key ;;
            2) npm run snapshot:restore; press_key ;;
            3) npm run snapshot:watch; press_key ;;
            0) break ;;
            *) echo -e "${RED}Opción inválida${NC}"; sleep 1 ;;
        esac
    done
}

# Presionar tecla para continuar
press_key() {
    echo ""
    echo -ne "${YELLOW}Presiona Enter para continuar...${NC}"
    read -r
}

# Main loop
main() {
    while true; do
        show_menu
        read -r choice

        case $choice in
            1) database_menu ;;
            2) cron_menu ;;
            3) deployment_menu ;;
            4) maintenance_menu ;;
            5) i18n_menu ;;
            6) admin_menu ;;
            7) minecraft_menu ;;
            8) npc_menu ;;
            9) snapshot_menu ;;
            0)
                echo -e "${GREEN}¡Hasta pronto!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Opción inválida${NC}"
                sleep 1
                ;;
        esac
    done
}

main