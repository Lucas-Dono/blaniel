import { CharacterConfig, Expression, Outfit, getAvailableHairFrontStyles, getAvailableOutfits } from './sutemo-assets';

/**
 * Presets predefinidos de personajes
 */
export const CHARACTER_PRESETS: Record<string, CharacterConfig> = {
  estudiante_alegre: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '0',
    hairBehindStyle: '0',
    hairColor: 'Brown',
    expression: 'Smile-1',
    outfit: 'Seifuku-1',
    blush: 'None',
    accessory: 'None',
  },
  atleta_seria: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '4',
    hairBehindStyle: '0',
    hairColor: 'Black',
    expression: 'Normal',
    outfit: 'PE-uniform-1',
    blush: 'None',
    accessory: 'None',
  },
  chica_timida: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '1',
    hairBehindStyle: '1',
    hairColor: 'Pink',
    expression: 'Awkward',
    outfit: 'Seifuku-2',
    blush: 'Blush1',
    accessory: 'glasses',
  },
  fashionista: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '2',
    hairBehindStyle: '2',
    hairColor: 'Blonde',
    expression: 'Smug',
    outfit: 'Summer-Dress',
    blush: 'None',
    accessory: 'None',
  },
  gamer_nocturna: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '3',
    hairBehindStyle: '3',
    hairColor: 'Silver',
    expression: 'Happy-1',
    outfit: 'Pajamas-1',
    blush: 'None',
    accessory: 'None',
  },
  verano_playero: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '2',
    hairBehindStyle: '2',
    hairColor: 'Blonde',
    expression: 'Happy-2',
    outfit: 'Swimsuit',
    blush: 'Blush2',
    accessory: 'None',
  },
  invierno_abrigada: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '1',
    hairBehindStyle: '1',
    hairColor: 'Brown',
    expression: 'Smile-2',
    outfit: 'Winter-1',
    blush: 'Blush1',
    accessory: 'None',
  },
  casual_relajada: {
    bodyType: 'female-halfbody',
    hairFrontStyle: '0',
    hairBehindStyle: '0',
    hairColor: 'Black',
    expression: 'Normal',
    outfit: 'T-shirt-1',
    blush: 'None',
    accessory: 'None',
  },
};

export const PRESET_LABELS: Record<string, { name: string; emoji: string; description: string }> = {
  estudiante_alegre: {
    name: 'Estudiante Alegre',
    emoji: '📚',
    description: 'Uniforme escolar',
  },
  atleta_seria: {
    name: 'Atleta Seria',
    emoji: '⚽',
    description: 'Deportista determinada',
  },
  chica_timida: {
    name: 'Chica Tímida',
    emoji: '🤓',
    description: 'Con gafas y sonrojo',
  },
  fashionista: {
    name: 'Fashionista',
    emoji: '👗',
    description: 'A la moda',
  },
  gamer_nocturna: {
    name: 'Gamer Nocturna',
    emoji: '🎮',
    description: 'Lista para gaming',
  },
  verano_playero: {
    name: 'Verano Playero',
    emoji: '🏖️',
    description: 'Día de playa',
  },
  invierno_abrigada: {
    name: 'Invierno',
    emoji: '❄️',
    description: 'Abrigada para el frío',
  },
  casual_relajada: {
    name: 'Casual Relajada',
    emoji: '👕',
    description: 'Look casual',
  },
};

/**
 * Agrupación de expresiones por categoría
 */
export const EXPRESSION_CATEGORIES = {
  neutral: {
    label: 'Neutral',
    emoji: '😐',
    expressions: ['Normal'] as Expression[],
  },
  happy: {
    label: 'Felices',
    emoji: '😊',
    expressions: ['Smile-1', 'Smile-2', 'Smile-3', 'Happy-1', 'Happy-2'] as Expression[],
  },
  sad: {
    label: 'Tristes',
    emoji: '😢',
    expressions: ['Sad', 'Sad-2', 'Awkward'] as Expression[],
  },
  angry: {
    label: 'Enojadas',
    emoji: '😠',
    expressions: ['Angry', 'Annoyed', 'Annoyed-2'] as Expression[],
  },
  surprised: {
    label: 'Sorprendidas',
    emoji: '😲',
    expressions: ['Surprised', 'Surprise-2', 'Scared'] as Expression[],
  },
  other: {
    label: 'Otras',
    emoji: '😏',
    expressions: ['Smug', 'Green-eyes'] as Expression[],
  },
};

/**
 * Categorización de outfits
 */
export const OUTFIT_CATEGORIES = {
  escolar: {
    label: 'Escolar',
    outfits: ['Seifuku-1', 'Seifuku-2', 'PE-uniform-1', 'PE-uniform-2'] as Outfit[],
  },
  casual: {
    label: 'Casual',
    outfits: ['T-shirt-1', 'T-shirt-2', 'Summer-Dress', 'Jacket'] as Outfit[],
  },
  casa: {
    label: 'Casa',
    outfits: ['Pajamas-1', 'Pajamas-2', 'Towel-1', 'Towel-2'] as Outfit[],
  },
  especial: {
    label: 'Especial',
    outfits: ['Swimsuit', 'Winter-1', 'Winter-2'] as Outfit[],
  },
};

/**
 * Nombres descriptivos para estilos de cabello frontal
 */
export const HAIR_FRONT_NAMES = {
  '0': 'Estilo 1',
  '1': 'Estilo 2',
  '2': 'Estilo 3',
  '3': 'Estilo 4',
  '4': 'Estilo 5',
};

/**
 * Nombres descriptivos para estilos de cabello trasero
 */
export const HAIR_BEHIND_NAMES = {
  '0': 'Estilo 1',
  '1': 'Estilo 2',
  '2': 'Estilo 3',
  '3': 'Estilo 4',
};

/**
 * Genera una configuración aleatoria
 */
export function randomizeCharacter(): CharacterConfig {
  const bodyTypes = ['female-halfbody', 'female-fullbody', 'male'] as const;
  const hairBehindStyles = ['0', '1', '2', '3'] as const;
  const hairColors = ['Black', 'Pink', 'Silver', 'Brown', 'Blonde'] as const;
  const expressions = Object.values(EXPRESSION_CATEGORIES).flatMap(cat => cat.expressions);
  const blushes = ['None', 'Blush1', 'Blush2'] as const;
  const accessories = ['None', 'glasses'] as const;

  // Primero seleccionar el tipo de cuerpo
  const bodyType = bodyTypes[Math.floor(Math.random() * bodyTypes.length)];

  // Get las opciones disponibles para ese tipo de cuerpo
  const availableHairFrontStyles = getAvailableHairFrontStyles(bodyType);
  const availableOutfits = getAvailableOutfits(bodyType);

  return {
    bodyType,
    hairFrontStyle: availableHairFrontStyles[Math.floor(Math.random() * availableHairFrontStyles.length)],
    hairBehindStyle: hairBehindStyles[Math.floor(Math.random() * hairBehindStyles.length)],
    hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
    expression: expressions[Math.floor(Math.random() * expressions.length)],
    outfit: availableOutfits[Math.floor(Math.random() * availableOutfits.length)],
    blush: blushes[Math.floor(Math.random() * blushes.length)],
    accessory: accessories[Math.floor(Math.random() * accessories.length)],
  };
}
