#!/usr/bin/env tsx
/**
 * CLI Tool para crear NPCs de forma rápida y fácil
 *
 * Uso:
 *   npm run npc:create                              # Modo interactivo
 *   npm run npc:create -- --template merchant       # Usar template
 *   npm run npc:create -- --name "Juan" --kind npc --personality "Amigable y servicial"
 *
 * Templates disponibles:
 *   merchant, guard, villager, quest-giver, companion, enemy, friendly, rpg-npc
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

// ==================== TEMPLATES ====================
const NPC_TEMPLATES = {
  merchant: {
    kind: 'npc',
    personality: 'Amigable, astuto en los negocios, siempre buscando una buena oferta',
    purpose: 'Vender objetos y comerciar con los jugadores',
    tone: 'Profesional pero cercano, usa jerga comercial',
    profile: {
      occupation: 'Comerciante',
      traits: ['negociador', 'carismático', 'astuto'],
      hobbies: ['contar monedas', 'regatear', 'coleccionar objetos raros'],
    },
    systemPrompt: 'Eres un comerciante en un mundo de fantasía. Te encanta hacer negocios y siempre buscas la mejor oferta. Eres amigable pero firme en tus precios.',
  },
  guard: {
    kind: 'npc',
    personality: 'Serio, protector, leal a su deber',
    purpose: 'Proteger la ciudad y mantener el orden',
    tone: 'Formal y autoritario, pero justo',
    profile: {
      occupation: 'Guardia',
      traits: ['valiente', 'responsable', 'vigilante'],
      hobbies: ['entrenar con la espada', 'patrullar', 'mantener el orden'],
    },
    systemPrompt: 'Eres un guardia dedicado que protege la ciudad. Tomas tu trabajo muy en serio pero eres justo con todos.',
  },
  villager: {
    kind: 'npc',
    personality: 'Amable, trabajador, conoce todos los chismes del pueblo',
    purpose: 'Compartir información sobre el pueblo y sus habitantes',
    tone: 'Casual y conversador, usa lenguaje coloquial',
    profile: {
      occupation: 'Aldeano',
      traits: ['chismoso', 'trabajador', 'sociable'],
      hobbies: ['conversar', 'cuidar el jardín', 'conocer gente nueva'],
    },
    systemPrompt: 'Eres un aldeano que conoce todo lo que pasa en el pueblo. Te encanta conversar y compartir historias con los visitantes.',
  },
  'quest-giver': {
    kind: 'npc',
    personality: 'Misterioso, sabio, con problemas que resolver',
    purpose: 'Dar misiones y recompensas a los jugadores',
    tone: 'Enigmático pero claro en sus instrucciones',
    profile: {
      occupation: 'Dador de misiones',
      traits: ['misterioso', 'sabio', 'problemático'],
      hobbies: ['estudiar mapas antiguos', 'coleccionar artefactos', 'planear expediciones'],
    },
    systemPrompt: 'Tienes problemas que necesitan ser resueltos y buscas aventureros valientes. Eres misterioso pero justo con las recompensas.',
  },
  companion: {
    kind: 'npc',
    personality: 'Leal, valiente, siempre dispuesto a ayudar',
    purpose: 'Acompañar al jugador en sus aventuras',
    tone: 'Amistoso y motivador',
    profile: {
      occupation: 'Compañero de aventuras',
      traits: ['leal', 'valiente', 'optimista'],
      hobbies: ['explorar', 'ayudar a otros', 'contar historias de aventuras'],
    },
    systemPrompt: 'Eres un compañero fiel que acompaña al jugador. Siempre estás listo para la siguiente aventura y apoyas a tus amigos.',
  },
  enemy: {
    kind: 'npc',
    personality: 'Hostil, amenazante, pero con honor',
    purpose: 'Ser un adversario desafiante pero justo',
    tone: 'Intimidante pero respetuoso con oponentes dignos',
    profile: {
      occupation: 'Adversario',
      traits: ['fuerte', 'orgulloso', 'honorable'],
      hobbies: ['entrenar', 'desafiar a guerreros', 'mejorar técnicas de combate'],
    },
    systemPrompt: 'Eres un adversario formidable pero honorable. Respetas a los oponentes dignos y siempre buscas mejorar tus habilidades.',
  },
  friendly: {
    kind: 'companion',
    personality: 'Extremadamente amigable, optimista, siempre positivo',
    purpose: 'Hacer compañía y alegrar el día del jugador',
    tone: 'Alegre, entusiasta y cálido',
    profile: {
      occupation: 'Amigo',
      traits: ['alegre', 'positivo', 'empático'],
      hobbies: ['hacer nuevos amigos', 'contar chistes', 'organizar fiestas'],
    },
    systemPrompt: 'Eres extremadamente amigable y optimista. Tu propósito es hacer sentir bien a todos y crear un ambiente positivo.',
  },
  'rpg-npc': {
    kind: 'npc',
    personality: 'Variado según la situación, adaptable',
    purpose: 'NPC genérico para juegos RPG',
    tone: 'Neutral pero expresivo',
    profile: {
      occupation: 'Habitante del mundo',
      traits: ['adaptable', 'conversador', 'útil'],
      hobbies: ['vivir la vida cotidiana', 'interactuar con aventureros'],
    },
    systemPrompt: 'Eres un habitante de este mundo. Tienes tu propia vida y personalidad, pero también interactúas con aventureros que pasan.',
  },
};

// ==================== TIPOS ====================
interface NPCConfig {
  name: string;
  kind: string;
  personality: string;
  purpose: string;
  tone: string;
  avatar?: string;
  nsfwMode?: boolean;
  initialBehavior?: string;
  template?: keyof typeof NPC_TEMPLATES;
  profile?: Record<string, unknown>;
  systemPrompt?: string;
}

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Parsea argumentos de línea de comandos
 */
function parseArgs(): Partial<NPCConfig> & { help?: boolean } {
  const args = process.argv.slice(2);
  const config: Partial<NPCConfig> & { help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      config.help = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];

      if (!value || value.startsWith('--')) {
        console.error(`❌ Error: El argumento ${arg} requiere un valor`);
        process.exit(1);
      }

      switch (key) {
        case 'name':
        case 'kind':
        case 'personality':
        case 'purpose':
        case 'tone':
        case 'avatar':
        case 'template':
        case 'initialBehavior':
          (config as any)[key] = value;
          break;
        case 'nsfw':
          config.nsfwMode = value.toLowerCase() === 'true';
          break;
        default:
          console.error(`❌ Argumento desconocido: ${arg}`);
          process.exit(1);
      }

      i++; // Saltar el valor
    }
  }

  return config;
}

/**
 * Muestra la ayuda
 */
function showHelp() {
  console.log(`
🎮 Creador de NPCs - Blaniel

Uso:
  npm run npc:create                              # Modo interactivo
  npm run npc:create -- --template merchant       # Usar template
  npm run npc:create -- --name "Juan" --kind npc --personality "Amigable"

Opciones:
  --name <nombre>                Nombre del NPC
  --kind <tipo>                  Tipo: npc, companion, assistant
  --personality <descripción>    Personalidad del NPC
  --purpose <propósito>          Propósito o rol del NPC
  --tone <tono>                  Tono de conversación
  --template <nombre>            Usar un template predefinido
  --avatar <url>                 URL del avatar
  --nsfw <true/false>            Activar modo NSFW
  --initialBehavior <tipo>       Comportamiento inicial
  -h, --help                     Mostrar esta ayuda

Templates disponibles:
  merchant       - Comerciante amigable
  guard          - Guardia serio y protector
  villager       - Aldeano conversador
  quest-giver    - Dador de misiones misterioso
  companion      - Compañero leal
  enemy          - Adversario honorable
  friendly       - Amigo extremadamente positivo
  rpg-npc        - NPC genérico para RPG

Ejemplos:
  # Crear un comerciante usando template
  npm run npc:create -- --template merchant --name "Mercader Juan"

  # Crear NPC personalizado
  npm run npc:create -- --name "Elara" --kind companion --personality "Sabia maga" --purpose "Enseñar magia"

  # Modo interactivo (recomendado para principiantes)
  npm run npc:create
`);
}

/**
 * Lista los templates disponibles
 */
function listTemplates() {
  console.log('\n📋 Templates disponibles:\n');

  for (const [key, template] of Object.entries(NPC_TEMPLATES)) {
    console.log(`  ${key.padEnd(15)} - ${template.purpose}`);
  }

  console.log('\nUsa: npm run npc:create -- --template <nombre>\n');
}

/**
 * Modo interactivo para crear NPC
 */
async function interactiveMode(): Promise<NPCConfig> {
  const rl = readline.createInterface({ input, output });

  console.log('\n🎮 Creador Interactivo de NPCs\n');

  // Preguntar si quiere usar un template
  console.log('¿Quieres usar un template? (deja vacío para crear desde cero)\n');
  listTemplates();

  const templateChoice = await rl.question('Template (o Enter para omitir): ');

  let config: Partial<NPCConfig> = {};

  if (templateChoice && NPC_TEMPLATES[templateChoice as keyof typeof NPC_TEMPLATES]) {
    config = { ...NPC_TEMPLATES[templateChoice as keyof typeof NPC_TEMPLATES] };
    console.log(`\n✅ Template "${templateChoice}" cargado\n`);
  }

  // Solicitar datos (con valores por defecto del template si existe)
  const name = await rl.question(`Nombre del NPC${config.personality ? ` [${generateNameSuggestion(config.personality)}]` : ''}: `);
  if (name) config.name = name;
  else if (config.personality) config.name = generateNameSuggestion(config.personality);

  if (!config.kind) {
    const kind = await rl.question('Tipo (npc/companion/assistant) [npc]: ');
    config.kind = kind || 'npc';
  }

  if (!config.personality) {
    const personality = await rl.question('Personalidad: ');
    config.personality = personality;
  }

  if (!config.purpose) {
    const purpose = await rl.question('Propósito: ');
    config.purpose = purpose;
  }

  if (!config.tone) {
    const tone = await rl.question('Tono (formal/casual/amigable) [casual]: ');
    config.tone = tone || 'casual';
  }

  const nsfw = await rl.question('¿Activar modo NSFW? (s/n) [n]: ');
  config.nsfwMode = nsfw.toLowerCase() === 's';

  rl.close();

  if (!config.name || !config.personality || !config.purpose) {
    throw new Error('Nombre, personalidad y propósito son requeridos');
  }

  return config as NPCConfig;
}

/**
 * Genera una sugerencia de nombre basada en la personalidad
 */
function generateNameSuggestion(personality: string): string {
  const names = [
    'Aria', 'Thorne', 'Luna', 'Marcus', 'Elara', 'Kai',
    'Zara', 'Finn', 'Nova', 'Rook', 'Sage', 'Echo'
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Crea el NPC en la base de datos
 */
async function createNPC(config: NPCConfig, userId: string = 'system') {
  console.log('\n🔨 Creando NPC...');

  // Usar template si está especificado
  let finalConfig = { ...config };

  if (config.template && NPC_TEMPLATES[config.template]) {
    const template = NPC_TEMPLATES[config.template];
    finalConfig = {
      ...template,
      ...config,
      name: config.name, // El nombre siempre viene del input
    };
  }

  // Generar profile y systemPrompt
  const profile = finalConfig.profile || {
    occupation: finalConfig.purpose,
    traits: [],
    hobbies: [],
  };

  const systemPrompt = finalConfig.systemPrompt ||
    `Eres ${finalConfig.name}. ${finalConfig.personality}. ${finalConfig.purpose}.`;

  // Crear el agente
  const agent = await prisma.agent.create({
    data: {
      id: nanoid(),
      userId: null, // NPCs del sistema no tienen userId
      kind: finalConfig.kind,
      name: finalConfig.name,
      description: finalConfig.personality,
      personality: finalConfig.personality,
      purpose: finalConfig.purpose,
      tone: finalConfig.tone,
      avatar: finalConfig.avatar || null,
      profile: profile as any,
      systemPrompt: systemPrompt,
      visibility: 'public',
      nsfwMode: finalConfig.nsfwMode || false,
      updatedAt: new Date(),
    },
  });

  console.log('✅ NPC creado exitosamente!');
  console.log(`\nID: ${agent.id}`);
  console.log(`Nombre: ${agent.name}`);
  console.log(`Tipo: ${agent.kind}`);
  console.log(`Personalidad: ${agent.personality}`);

  return agent;
}

// ==================== MAIN ====================

async function main() {
  try {
    const args = parseArgs();

    // Mostrar ayuda
    if (args.help) {
      showHelp();
      process.exit(0);
    }

    // Listar templates si se solicita
    if (Object.keys(args).length === 0) {
      // Modo interactivo
      const config = await interactiveMode();
      const npc = await createNPC(config);

      console.log('\n🎉 ¡NPC creado con éxito!');
      console.log('\nPuedes probarlo usando:');
      console.log(`  - API: POST /api/v1/agents/${npc.id}/chat`);
      console.log(`  - SDK Rust: blaniel npc chat ${npc.id} "Hola"`);
      console.log(`  - Minecraft: /summon blaniel-mc:blaniel_villager`);
    } else if (args.template && !args.name) {
      // Solo template sin nombre - mostrar info del template
      const template = NPC_TEMPLATES[args.template as keyof typeof NPC_TEMPLATES];
      if (!template) {
        console.error(`❌ Template "${args.template}" no encontrado`);
        listTemplates();
        process.exit(1);
      }

      console.log(`\n📋 Template: ${args.template}`);
      console.log(`\nPersonalidad: ${template.personality}`);
      console.log(`Propósito: ${template.purpose}`);
      console.log(`Tono: ${template.tone}`);
      console.log('\nUsa: npm run npc:create -- --template ' + args.template + ' --name "Tu Nombre"');
    } else {
      // Modo no interactivo con argumentos
      if (!args.name) {
        console.error('❌ Error: --name es requerido');
        console.log('Usa --help para más información');
        process.exit(1);
      }

      const config: NPCConfig = {
        name: args.name,
        kind: args.kind || 'npc',
        personality: args.personality || 'NPC genérico',
        purpose: args.purpose || 'Interactuar con jugadores',
        tone: args.tone || 'neutral',
        avatar: args.avatar,
        nsfwMode: args.nsfwMode,
        initialBehavior: args.initialBehavior,
        template: args.template as keyof typeof NPC_TEMPLATES,
      };

      const npc = await createNPC(config);

      console.log('\n🎉 ¡NPC creado con éxito!');
      console.log('\nPuedes probarlo usando:');
      console.log(`  - API: POST /api/v1/agents/${npc.id}/chat`);
      console.log(`  - SDK Rust: blaniel npc chat ${npc.id} "Hola"`);
      console.log(`  - Minecraft: /summon blaniel-mc:blaniel_villager`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
