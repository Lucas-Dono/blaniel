#!/usr/bin/env tsx
/**
 * Script para probar NPCs creados
 *
 * Uso:
 *   npm run npc:test <npc-id>                    # Chat interactivo
 *   npm run npc:test <npc-id> "Hola, ¿cómo estás?"  # Enviar mensaje único
 */

import { prisma } from '@/lib/prisma';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Simula una conversación con el NPC
 */
async function chatWithNPC(npcId: string, message: string): Promise<string> {
  // Obtener el NPC
  const npc = await prisma.agent.findUnique({
    where: { id: npcId },
    select: {
      id: true,
      name: true,
      personality: true,
      purpose: true,
      systemPrompt: true,
    },
  });

  if (!npc) {
    throw new Error(`NPC con ID ${npcId} no encontrado`);
  }

  // Simular respuesta basada en el systemPrompt
  // En producción, esto llamaría al LLM
  const response = `[${npc.name}] *Responde con personalidad: ${npc.personality}*\n\nEsta es una respuesta simulada. Para respuestas reales, usa:\n- API: POST /api/v1/agents/${npcId}/chat\n- SDK Rust: blaniel npc chat ${npcId} "${message}"`;

  return response;
}

/**
 * Modo interactivo de chat
 */
async function interactiveChat(npcId: string) {
  const rl = readline.createInterface({ input, output });

  // Obtener info del NPC
  const npc = await prisma.agent.findUnique({
    where: { id: npcId },
    select: {
      id: true,
      name: true,
      personality: true,
      purpose: true,
      kind: true,
    },
  });

  if (!npc) {
    console.error(`❌ NPC con ID ${npcId} no encontrado`);
    process.exit(1);
  }

  console.log('\n🎮 Chat con NPC\n');
  console.log(`Nombre: ${npc.name}`);
  console.log(`Tipo: ${npc.kind}`);
  console.log(`Personalidad: ${npc.personality}`);
  console.log(`Propósito: ${npc.purpose}`);
  console.log('\n(Escribe "salir" o "exit" para terminar)\n');

  const conversationHistory: ChatMessage[] = [];

  while (true) {
    const userMessage = await rl.question('Tú: ');

    if (!userMessage.trim()) continue;
    if (userMessage.toLowerCase() === 'salir' || userMessage.toLowerCase() === 'exit') {
      console.log('\n👋 ¡Hasta luego!');
      break;
    }

    conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const response = await chatWithNPC(npcId, userMessage);
      console.log(`\n${response}\n`);

      conversationHistory.push({
        role: 'assistant',
        content: response,
      });
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
    }
  }

  rl.close();
}

/**
 * Listar NPCs disponibles
 */
async function listNPCs() {
  const npcs = await prisma.agent.findMany({
    where: {
      userId: null, // NPCs del sistema
    },
    select: {
      id: true,
      name: true,
      kind: true,
      personality: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  });

  if (npcs.length === 0) {
    console.log('\n⚠️  No hay NPCs disponibles. Crea uno usando:');
    console.log('   npm run npc:create\n');
    return;
  }

  console.log('\n📋 NPCs Disponibles:\n');

  for (const npc of npcs) {
    console.log(`  ${npc.id.padEnd(15)} - ${npc.name} (${npc.kind})`);
    console.log(`  ${''.padEnd(15)}   ${npc.personality?.slice(0, 60) || 'Sin descripción'}...`);
    console.log('');
  }

  console.log('Usa: npm run npc:test <id>\n');
}

// ==================== MAIN ====================

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--list' || args[0] === '-l') {
      await listNPCs();
      await prisma.$disconnect();
      return;
    }

    const npcId = args[0];

    if (args.length === 1) {
      // Modo interactivo
      await interactiveChat(npcId);
    } else {
      // Mensaje único
      const message = args.slice(1).join(' ');

      const npc = await prisma.agent.findUnique({
        where: { id: npcId },
        select: { name: true },
      });

      if (!npc) {
        console.error(`❌ NPC con ID ${npcId} no encontrado`);
        process.exit(1);
      }

      console.log(`\nTú: ${message}\n`);
      const response = await chatWithNPC(npcId, message);
      console.log(response);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
