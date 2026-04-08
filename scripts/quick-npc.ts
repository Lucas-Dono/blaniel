#!/usr/bin/env tsx
/**
 * Script simplificado para crear NPCs
 * Funciona con el servidor backend corriendo
 *
 * Uso:
 *   npm run quick-npc merchant "Juan el Mercader"
 *   npm run quick-npc list
 *   npm run quick-npc templates
 */

import * as fs from 'fs';
import * as path from 'path';

// Leer configuración del SDK
function getAPIUrl(): { url: string; token?: string } {
  const configPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.blaniel',
    'config.json'
  );

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        url: config.apiUrl,
        token: config.token,
      };
    } catch (error) {
      // Fallback to default
    }
  }

  // Default local
  return {
    url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  };
}

const { url: API_URL, token: SDK_TOKEN } = getAPIUrl();

async function createNPC(template: string, name: string) {
  try {
    console.log(`\n🔨 Creando NPC: ${name} (${template})\n`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (SDK_TOKEN) {
      headers['Authorization'] = `Bearer ${SDK_TOKEN}`;
    }

    const response = await fetch(`${API_URL}/api/npc/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, template }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error.error);
      if (error.availableTemplates) {
        console.log('\nTemplates disponibles:', error.availableTemplates.join(', '));
      }
      process.exit(1);
    }

    const data = await response.json();

    console.log('✅ NPC creado exitosamente!\n');
    console.log(`ID:          ${data.npc.id}`);
    console.log(`Nombre:      ${data.npc.name}`);
    console.log(`Tipo:        ${data.npc.kind}`);
    console.log(`Personalidad: ${data.npc.personality}\n`);
    console.log('📌 Cómo usar:\n');
    console.log(`  API:       curl -X POST ${data.usage.api}`);
    console.log(`  SDK Rust:  ${data.usage.sdk}`);
    console.log(`  Minecraft: ${data.usage.minecraft}\n`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.log('\n⚠️  Si usas modo local, asegúrate de que el servidor esté corriendo:');
    console.log('   npm run dev');
    console.log('\n   Si usas modo cloud, verifica tu conexión:');
    console.log('   npm run sdk-init cloud\n');
    process.exit(1);
  }
}

async function listNPCs() {
  try {
    const response = await fetch(`${API_URL}/api/npc/create`);

    if (!response.ok) {
      throw new Error('Error al obtener NPCs');
    }

    const data = await response.json();

    if (data.npcs.length === 0) {
      console.log('\n⚠️  No hay NPCs creados aún.\n');
      console.log('Crea uno usando: npm run quick-npc merchant "Nombre"\n');
      return;
    }

    console.log(`\n📋 NPCs Disponibles (${data.count}):\n`);

    for (const npc of data.npcs) {
      console.log(`  ${npc.id.padEnd(15)} - ${npc.name} (${npc.kind})`);
      if (npc.personality) {
        console.log(`  ${''.padEnd(15)}   ${npc.personality.slice(0, 60)}...`);
      }
      console.log('');
    }

    console.log('Usa: npm run quick-npc test <id>\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function listTemplates() {
  try {
    const response = await fetch(`${API_URL}/api/npc/create?action=templates`);

    if (!response.ok) {
      throw new Error('Error al obtener templates');
    }

    const data = await response.json();

    console.log('\n📚 Templates Disponibles:\n');

    for (const template of data.templates) {
      console.log(`  ${template.id.padEnd(15)} - ${template.purpose}`);
    }

    console.log('\nUsa: npm run quick-npc <template> "Nombre del NPC"\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function testNPC(npcId: string) {
  console.log('\n💬 Para probar el NPC, usa:\n');
  console.log(`  1. API REST:`);
  console.log(`     curl -X POST ${API_URL}/api/v1/agents/${npcId}/chat \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '{"message": "Hola"}'`);
  console.log('');
  console.log(`  2. SDK Rust (si está configurado):`);
  console.log(`     blaniel npc chat ${npcId} "Hola"`);
  console.log('');
  console.log(`  3. Minecraft:`);
  console.log(`     /summon blaniel-mc:blaniel_villager`);
  console.log('');
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
  console.log(`
🤖 Quick NPC Creator

Uso:
  npm run quick-npc <template> "Nombre"    Crear NPC con template
  npm run quick-npc list                   Listar NPCs
  npm run quick-npc templates              Ver templates
  npm run quick-npc test <id>              Cómo probar un NPC

Templates:
  merchant, guard, villager, quest-giver, companion, enemy, friendly, rpg-npc

Ejemplos:
  npm run quick-npc merchant "Juan el Mercader"
  npm run quick-npc companion "Luna la Valiente"
  npm run quick-npc list
`);
  process.exit(0);
}

const command = args[0];

if (command === 'list') {
  listNPCs();
} else if (command === 'templates') {
  listTemplates();
} else if (command === 'test' && args[1]) {
  testNPC(args[1]);
} else if (args[1]) {
  createNPC(command, args[1]);
} else {
  console.error('\n❌ Uso incorrecto. Usa: npm run quick-npc help\n');
  process.exit(1);
}
