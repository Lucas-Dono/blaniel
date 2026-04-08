# Scripts de NPCs

Scripts para crear y probar NPCs de forma rápida y fácil.

## 📁 Archivos

- **create-npc.ts** - Script para crear NPCs con templates o personalizado
- **test-npc.ts** - Script para probar NPCs mediante chat

## 🚀 Uso Rápido

### Crear un NPC

```bash
# Modo interactivo (recomendado)
npm run npc:create

# Usar template
npm run npc:create -- --template merchant --name "Mercader Juan"

# Personalizado
npm run npc:create -- --name "Elara" --kind companion --personality "Sabia maga"
```

### Probar un NPC

```bash
# Listar NPCs
npm run npc:list

# Chat interactivo
npm run npc:test <npc-id>

# Mensaje único
npm run npc:test <npc-id> "Hola"
```

## 📋 Templates Disponibles

| Template | Descripción |
|----------|-------------|
| merchant | Comerciante amigable |
| guard | Guardia serio |
| villager | Aldeano conversador |
| quest-giver | Dador de misiones |
| companion | Compañero leal |
| enemy | Adversario honorable |
| friendly | Amigo positivo |
| rpg-npc | NPC genérico |

## 📚 Documentación Completa

Ver [NPC_QUICK_START.md](../../NPC_QUICK_START.md) en la raíz del proyecto.

## 🔧 Opciones Avanzadas

### create-npc.ts

```bash
--name <nombre>                Nombre del NPC
--kind <tipo>                  npc, companion, assistant
--personality <descripción>    Personalidad
--purpose <propósito>          Propósito o rol
--tone <tono>                  Tono de conversación
--template <nombre>            Template predefinido
--avatar <url>                 URL del avatar
--nsfw <true/false>            Modo NSFW
--initialBehavior <tipo>       Comportamiento inicial
```

### test-npc.ts

```bash
npm run npc:test <npc-id>                    # Chat interactivo
npm run npc:test <npc-id> "mensaje"          # Mensaje único
npm run npc:test --list                      # Listar NPCs
```

## 🎯 Ejemplos

```bash
# Crear comerciante
npm run npc:create -- --template merchant --name "Alfonso el Herrero"

# Crear compañero personalizado
npm run npc:create -- \
  --name "Luna" \
  --kind companion \
  --personality "Leal y valiente guerrera" \
  --purpose "Acompañar en aventuras" \
  --tone "Amistoso y motivador"

# Probar NPC
npm run npc:test abc-123-xyz "¿Qué vendes?"
```

## 🔗 Integración

Los NPCs creados están disponibles para:
- API REST: `/api/v1/agents/{id}/chat`
- SDK Rust: `blaniel npc chat {id} "mensaje"`
- Minecraft: `/summon blaniel-mc:blaniel_villager`

## ⚠️ Notas

- Los NPCs se crean como públicos (sin userId)
- Las respuestas en el script de prueba son simuladas
- Para respuestas reales, usa la API o el SDK Rust con LLM configurado
