# Scripts Organizados

Esta carpeta contiene todos los scripts operativos del proyecto, organizados por funcionalidad.

## 📁 Estructura

```
scripts/
├── main.sh                 # 🔥 Menú principal - Ejecuta este para acceder a todos los scripts
├── database/               # 📊 Operaciones de base de datos
│   ├── backup.sh          # Backup de la base de datos
│   ├── restore.sh         # Restaurar desde backup
│   ├── migrate-personality-cores.ts  # Migrar personality cores
│   └── verify-fields.js   # Verificar campos de Prisma
├── cron/                  # ⏰ Cron jobs y configuraciones
│   ├── daily-digest.sh    # Resumen diario
│   ├── ml-analysis.sh     # Análisis de moderación ML
│   ├── weekly-digest.sh   # Resumen semanal
│   └── setup.sh           # Configurar todas las tareas
├── deployment/            # 🚀 Scripts de despliegue
│   ├── verify-before-deploy.sh  # Checklist pre-deploy
│   └── sync-to-public.sh  # Sincronizar con repositorio público
├── maintenance/           # 🔧 Mantenimiento y salud del sistema
│   ├── health-check.sh    # Verificar estado del sistema
│   └── security-audit.sh  # Auditoría de seguridad
├── i18n/                  # 🌍 Internacionalización
│   └── translate.ts       # Traducciones seguras
├── admin/                 # 📱 Certificados y autenticación
│   ├── setup-ca.sh        # Configurar Certificate Authority
│   ├── setup-totp.ts      # Configurar autenticación 2FA
│   ├── reset-totp.ts      # Resetear TOTP
│   ├── generate-cert-cli.ts  # Generar certificados
│   ├── cert-manager.ts    # Gestión de certificados
│   └── revoke-cert.ts     # Revocar certificados
├── minecraft/             # 🎮 Configuraciones de NPC
│   └── generate-minecraft-configs-batch.ts
├── snapshot/              # 📸 Gestión de snapshots
│   ├── list-snapshots.ts
│   ├── restore-snapshot.ts
│   └── snapshot-service.ts
└── generate-scene-catalog/ # 📦 Generación de catálogos
```

## 🚀 Uso Rápido

### Método 1: Menú Interactivo (Recomendado)

```bash
cd /path/to/blaniel
./scripts/main.sh
```

Este menú te permitirá navegar fácilmente entre todas las categorías y ejecutar cualquier script con opciones claras.

### Método 2: Ejecución Directa

Puedes ejecutar cualquier script directamente:

```bash
# Base de datos
./scripts/database/backup.sh
./scripts/database/restore.sh

# Despliegue
./scripts/deployment/verify-before-deploy.sh

# Mantenimiento
./scripts/maintenance/health-check.sh
./scripts/maintenance/security-audit.sh

# Cron jobs
./scripts/cron/setup.sh
```

### Método 3: Scripts de Package.json

```bash
# Verificar antes de deploy
npm run verify:prisma

# Snapshots
npm run snapshot:list
npm run snapshot:restore
npm run snapshot:watch

# Minecraft
npm run minecraft:generate-configs
npm run minecraft:migrate-manual

# Admin
npm run admin:setup-ca
npm run admin:setup-totp
npm run admin:reset-totp
npm run admin:generate-cert
npm run admin:list-certs
npm run admin:revoke-cert
npm run admin:cleanup-certs
npm run admin:update-crl
```

## 📋 Categorías

### 📊 Base de Datos
Scripts para gestionar la base de datos PostgreSQL:
- Backup manual
- Restore desde backup
- Migraciones de datos
- Verificación de esquema

### ⏰ Cron Jobs
Tareas programadas para automatización:
- Daily Digest - Resumen diario
- Weekly Digest - Resumen semanal
- ML Analysis - Análisis de moderación con ML
- Setup - Configurar todas las tareas

### 🚀 Despliegue
Scripts para facilitar el proceso de despliegue:
- Verificación pre-deploy con checklist
- Sincronización con repositorio público

### 🔧 Mantenimiento
Scripts de mantenimiento rutinario:
- Health check del sistema
- Auditoría de seguridad

### 🌍 Internacionalización
Gestión de traducciones:
- Traducción segura de archivos i18n

### 📱 Admin
Gestión de certificados y autenticación:
- Setup de Certificate Authority
- Configuración de TOTP (2FA)
- Generación y revocación de certificados
- Gestión de CRL (Certificate Revocation List)

### 🎮 Minecraft
Configuraciones para integración con Minecraft:
- Generación de configuraciones de NPC
- Migración manual de configs

### 📸 Snapshots
Gestión de snapshots del sistema:
- Listar snapshots disponibles
- Restaurar desde snapshot
- Servicio de monitoreo de snapshots

## ⚡ Atajos Comunes

```bash
# Verificar antes de deploy
./scripts/main.sh → 🚀 Despliegue → 🔍 Verificar pre-deploy

# Backup de base de datos
./scripts/main.sh → 📊 Base de datos → 💾 Backup

# Health check del sistema
./scripts/main.sh → 🔧 Mantenimiento → 🏥 Health Check

# Configurar cron jobs
./scripts/main.sh → ⏰ Cron Jobs → ⚙️ Setup Cron Jobs

# Auditoría de seguridad
./scripts/main.sh → 🔧 Mantenimiento → 🔒 Security Audit
```

## 📝 Notas

- Todos los scripts tienen permisos de ejecución
- Los scripts en `*.ts` se ejecutan con `tsx`
- Los scripts en `*.js` se ejecutan con `node`
- Los scripts en `*.sh` se ejecutan directamente con `bash`

## 🔧 Mantenimiento

Para agregar un nuevo script:
1. Colócalo en la carpeta apropiada según su función
2. Asegúrate de que tenga permisos de ejecución (`chmod +x script.sh`)
3. Actualiza este README con la descripción
4. Si es necesario, actualiza `main.sh` para incluirlo en el menú

## ❓ Ayuda

Para ver la ayuda de cualquier script específico, ejecútalo con `-h` o `--help` si está disponible.

Para más información sobre el proyecto, ver el README principal en la raíz del repositorio.
