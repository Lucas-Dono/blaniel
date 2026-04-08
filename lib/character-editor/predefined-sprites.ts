/**
 * Sistema de sprites prediseñados (Aiko, Miki, Sumi)
 * Estos son personajes completos pre-renderizados, no modulares como Sutemo
 */

export type CharacterPack = 'aiko' | 'miki' | 'sumi';
export type OutfitCategory = 'uniform' | 'casual' | 'seasonal' | 'special';

export interface PredefinedSprite {
  id: string;
  pack: CharacterPack;
  name: string;
  description: string;
  outfit: string;
  outfitCategory: OutfitCategory;
  expression: string;
  hasBlush: boolean;
  hasClosedEyes: boolean;
  path: string;
  emoji: string;
}

/**
 * Genera todas las variantes de Aiko (48 sprites)
 */
function generateAikoSprites(): PredefinedSprite[] {
  const sprites: PredefinedSprite[] = [];

  const outfits = [
    { name: 'Blazer', folder: 'Blazer Uniform', category: 'uniform' as OutfitCategory, emoji: '🎓' },
    { name: 'Casual', folder: 'Casual', category: 'casual' as OutfitCategory, emoji: '👕' },
    { name: 'SummerSera', folder: 'Summer Uniform', category: 'seasonal' as OutfitCategory, emoji: '☀️' },
    { name: 'WinterSera', folder: 'Winter Uniform', category: 'seasonal' as OutfitCategory, emoji: '❄️' },
  ];

  const expressions = [
    { name: 'Frown', label: 'Molesta', eyes: 'Frown' },
    { name: 'Open', label: 'Sorprendida', eyes: 'Open' },
    { name: 'Smile', label: 'Feliz', eyes: 'Smile' },
  ];

  const eyeStates = [
    { closed: false, prefix: '' },
    { closed: true, prefix: 'Closed_' },
  ];

  const blushStates = [
    { hasBlush: false, suffix: '' },
    { hasBlush: true, suffix: '_Blush' },
  ];

  outfits.forEach(outfit => {
    eyeStates.forEach(eyes => {
      expressions.forEach(expr => {
        blushStates.forEach(blush => {
          const fileName = `Aiko_${outfit.name}_${eyes.prefix}${expr.eyes}${blush.suffix}.png`;
          const path = `/worlds/Assets/Aiko_NoranekoGames/Aiko_NoranekoGames/${outfit.folder}/${fileName}`;

          const id = `aiko_${outfit.name.toLowerCase()}_${eyes.closed ? 'closed_' : ''}${expr.name.toLowerCase()}${blush.hasBlush ? '_blush' : ''}`;

          const description = [
            expr.label,
            eyes.closed ? 'ojos cerrados' : '',
            blush.hasBlush ? 'sonrojada' : '',
          ].filter(Boolean).join(', ');

          sprites.push({
            id,
            pack: 'aiko',
            name: `Aiko - ${outfit.name}`,
            description,
            outfit: outfit.name,
            outfitCategory: outfit.category,
            expression: expr.name,
            hasBlush: blush.hasBlush,
            hasClosedEyes: eyes.closed,
            path,
            emoji: outfit.emoji,
          });
        });
      });
    });
  });

  return sprites;
}

/**
 * Genera todas las variantes de Miki (48 sprites)
 */
function generateMikiSprites(): PredefinedSprite[] {
  const sprites: PredefinedSprite[] = [];

  const outfits = [
    { name: 'Seifuku', folder: 'Blazer Uni', category: 'uniform' as OutfitCategory, emoji: '🎓' },
    { name: 'Casual', folder: 'Casual', category: 'casual' as OutfitCategory, emoji: '👕' },
    { name: 'Summer_Uni', folder: 'Summer Uni', category: 'seasonal' as OutfitCategory, emoji: '☀️' },
    { name: 'Winter_Uni', folder: 'Winter Uni', category: 'seasonal' as OutfitCategory, emoji: '❄️' },
  ];

  const expressions = [
    { name: 'Frown', label: 'Molesta' },
    { name: 'OpenSmile', label: 'Risa abierta' },
    { name: 'Smile', label: 'Sonrisa' },
  ];

  const eyeStates = [
    { closed: false, suffix: '' },
    { closed: true, suffix: '_ClosedEyes' },
  ];

  const blushStates = [
    { hasBlush: false, suffix: '' },
    { hasBlush: true, suffix: '_Blush' },
  ];

  outfits.forEach(outfit => {
    expressions.forEach(expr => {
      eyeStates.forEach(eyes => {
        blushStates.forEach(blush => {
          const fileName = `Miki_${outfit.name}_${expr.name}${eyes.suffix}${blush.suffix}.png`;
          const path = `/worlds/Assets/MikiNewstyle/MikiNewstyle/Miki/${outfit.folder}/${fileName}`;

          const id = `miki_${outfit.name.toLowerCase()}_${expr.name.toLowerCase()}${eyes.closed ? '_closed' : ''}${blush.hasBlush ? '_blush' : ''}`;

          const description = [
            expr.label,
            eyes.closed ? 'ojos cerrados' : '',
            blush.hasBlush ? 'sonrojada' : '',
          ].filter(Boolean).join(', ');

          sprites.push({
            id,
            pack: 'miki',
            name: `Miki - ${outfit.name.replace('_', ' ')}`,
            description,
            outfit: outfit.name,
            outfitCategory: outfit.category,
            expression: expr.name,
            hasBlush: blush.hasBlush,
            hasClosedEyes: eyes.closed,
            path,
            emoji: outfit.emoji,
          });
        });
      });
    });
  });

  return sprites;
}

/**
 * Genera todas las variantes de Sumi (30 sprites)
 */
function generateSumiSprites(): PredefinedSprite[] {
  const sprites: PredefinedSprite[] = [];

  const outfits = [
    { name: 'Casual', folder: 'Casual', category: 'casual' as OutfitCategory, emoji: '👕' },
    { name: 'Gym', folder: 'Gym', category: 'special' as OutfitCategory, emoji: '🏋️' },
    { name: 'Maid', folder: 'Maid', category: 'special' as OutfitCategory, emoji: '🧹' },
    { name: 'SummerUni', folder: 'Summer Uniform', category: 'seasonal' as OutfitCategory, emoji: '☀️' },
    { name: 'WinterUni', folder: 'Winter Uniform', category: 'seasonal' as OutfitCategory, emoji: '❄️' },
  ];

  const expressions = [
    { name: 'Frown', label: 'Molesta' },
    { name: 'Open', label: 'Sorprendida' },
    { name: 'Smile', label: 'Feliz' },
  ];

  const blushStates = [
    { hasBlush: false, suffix: '' },
    { hasBlush: true, suffix: '_Blush' },
  ];

  outfits.forEach(outfit => {
    expressions.forEach(expr => {
      blushStates.forEach(blush => {
        const fileName = `Sumi_${outfit.name}_${expr.name}${blush.suffix}.png`;
        const path = `/worlds/Assets/Sumi Base Pack/Sumi Base Pack/${outfit.folder}/${fileName}`;

        const id = `sumi_${outfit.name.toLowerCase()}_${expr.name.toLowerCase()}${blush.hasBlush ? '_blush' : ''}`;

        const description = [
          expr.label,
          blush.hasBlush ? 'sonrojada' : '',
        ].filter(Boolean).join(', ');

        sprites.push({
          id,
          pack: 'sumi',
          name: `Sumi - ${outfit.name.replace('Uni', ' Uni')}`,
          description,
          outfit: outfit.name,
          outfitCategory: outfit.category,
          expression: expr.name,
          hasBlush: blush.hasBlush,
          hasClosedEyes: false, // Sumi no tiene ojos cerrados
          path,
          emoji: outfit.emoji,
        });
      });
    });
  });

  return sprites;
}

/**
 * Todas las sprites predefinidas (126 total)
 */
export const PREDEFINED_SPRITES: PredefinedSprite[] = [
  ...generateAikoSprites(),
  ...generateMikiSprites(),
  ...generateSumiSprites(),
];

/**
 * Filtra sprites por pack
 */
export function getSpritesByPack(pack: CharacterPack): PredefinedSprite[] {
  return PREDEFINED_SPRITES.filter(s => s.pack === pack);
}

/**
 * Filtra sprites por categoría de outfit
 */
export function getSpritesByCategory(category: OutfitCategory): PredefinedSprite[] {
  return PREDEFINED_SPRITES.filter(s => s.outfitCategory === category);
}

/**
 * Busca un sprite por ID
 */
export function getSpriteById(id: string): PredefinedSprite | undefined {
  return PREDEFINED_SPRITES.find(s => s.id === id);
}

/**
 * Metadata de los packs
 */
export const PACK_INFO = {
  aiko: {
    name: 'Aiko',
    emoji: '👩',
    description: 'Estudiante versátil con múltiples expresiones',
    author: 'NoranekoGames',
    spriteCount: 48,
  },
  miki: {
    name: 'Miki',
    emoji: '👧',
    description: 'Chica expresiva con estilo moderno',
    author: 'NoranekoGames',
    spriteCount: 48,
  },
  sumi: {
    name: 'Sumi',
    emoji: '👩‍🦰',
    description: 'Personaje con outfits especiales',
    author: 'Base Pack',
    spriteCount: 30,
  },
} as const;

/**
 * Categorías de outfit con metadata
 */
export const OUTFIT_CATEGORY_INFO = {
  uniform: {
    label: 'Uniformes',
    emoji: '🎓',
    description: 'Uniformes escolares',
  },
  casual: {
    label: 'Casual',
    emoji: '👕',
    description: 'Ropa casual',
  },
  seasonal: {
    label: 'Estacional',
    emoji: '🌤️',
    description: 'Outfits de verano e invierno',
  },
  special: {
    label: 'Especial',
    emoji: '✨',
    description: 'Outfits temáticos',
  },
} as const;
