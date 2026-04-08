/**
 * Predefined color palettes for Minecraft skin generation
 *
 * The recoloring system automatically preserves shadows and highlights
 * by mapping the luminosity of original grays to the target color.
 */

// ============================================================================
// SKIN TONES
// ============================================================================

export const SKIN_TONES = {
  // Light tones
  PALE: '#F5E6D3',
  FAIR: '#F0D5BE',
  LIGHT_BEIGE: '#E8C8A8',

  // Medium tones
  BEIGE: '#D4A574',
  TAN: '#C68642',
  OLIVE: '#B08956',

  // Dark tones
  BROWN: '#8D5524',
  DARK_BROWN: '#6B4423',
  DEEP_BROWN: '#4A2F1A',

  // Mixed tones
  LIGHT_TAN: '#D9A066',
  MEDIUM_BROWN: '#9D6B3F',
  CARAMEL: '#B07D4F',

  // Special tones
  PORCELAIN: '#FFF0E1',
  SAND: '#E0C097',
  ESPRESSO: '#5C3317',
} as const;

// ============================================================================
// EYE COLORS
// ============================================================================

export const EYE_COLORS = {
  // Browns
  DARK_BROWN: '#2C1810',
  BROWN: '#5C3317',
  LIGHT_BROWN: '#8B6508',
  AMBER: '#C87137',
  HAZEL: '#8E6F3E',

  // Blues
  DARK_BLUE: '#1C3A5E',
  BLUE: '#4169E1',
  LIGHT_BLUE: '#6FA8DC',
  SKY_BLUE: '#87CEEB',
  ICE_BLUE: '#B0E0E6',

  // Greens
  DARK_GREEN: '#228B22',
  GREEN: '#32CD32',
  LIGHT_GREEN: '#90EE90',
  EMERALD: '#50C878',
  JADE: '#00A86B',

  // Grays
  GRAY: '#808080',
  LIGHT_GRAY: '#A9A9A9',
  SILVER: '#C0C0C0',

  // Special
  VIOLET: '#8B00FF',
  RED: '#DC143C',
  YELLOW: '#FFD700',
  TURQUOISE: '#40E0D0',

  // Heterochromia (use two different colors)
  HETEROCHROMIA_BLUE_BROWN: {
    left: '#4169E1',
    right: '#5C3317',
  },
} as const;

// ============================================================================
// HAIR COLORS
// ============================================================================

export const HAIR_COLORS = {
  // Blacks
  BLACK: '#0A0A0A',
  JET_BLACK: '#000000',
  CHARCOAL: '#1C1C1C',

  // Browns
  DARK_BROWN: '#3D2817',
  BROWN: '#5C4033',
  LIGHT_BROWN: '#8B6F47',
  CHESTNUT: '#825736',

  // Blondes
  PLATINUM_BLONDE: '#E5E4E2',
  BLONDE: '#F4E4C1',
  GOLDEN_BLONDE: '#E6C35C',
  SANDY_BLONDE: '#D4C4A8',
  STRAWBERRY_BLONDE: '#E5AA70',

  // Reds
  AUBURN: '#A52A2A',
  RED: '#C1440E',
  GINGER: '#D2691E',
  COPPER: '#B87333',

  // Grays and whites
  SALT_AND_PEPPER: '#6E6E6E',
  GRAY: '#808080',
  SILVER: '#C0C0C0',
  WHITE: '#F5F5F5',

  // Fantasy colors
  PINK: '#FF69B4',
  PURPLE: '#9370DB',
  BLUE: '#4169E1',
  GREEN: '#32CD32',
  RAINBOW: '#FF00FF', // For multi-color gradient effects
  CYAN: '#00CED1',
  MAGENTA: '#FF00FF',
  MINT: '#98FF98',
  LAVENDER: '#E6E6FA',
  ROSE_GOLD: '#B76E79',

  // Ombré (combine two colors)
  OMBRE_BROWN_BLONDE: {
    root: '#3D2817',
    tips: '#F4E4C1',
  },
  OMBRE_BLACK_RED: {
    root: '#0A0A0A',
    tips: '#C1440E',
  },
} as const;

// ============================================================================
// CLOTHING COLORS
// ============================================================================

export const CLOTHING_COLORS = {
  // Basics
  BLACK: '#1A1A1A',
  WHITE: '#F5F5F5',
  GRAY: '#808080',

  // Reds
  RED: '#DC143C',
  DARK_RED: '#8B0000',
  CRIMSON: '#DC143C',
  BURGUNDY: '#800020',

  // Blues
  NAVY: '#000080',
  BLUE: '#0000FF',
  ROYAL_BLUE: '#4169E1',
  SKY_BLUE: '#87CEEB',
  CYAN: '#00CED1',

  // Greens
  DARK_GREEN: '#006400',
  GREEN: '#008000',
  LIME: '#32CD32',
  MINT: '#98FF98',
  OLIVE: '#556B2F',

  // Yellows and oranges
  YELLOW: '#FFD700',
  GOLD: '#FFD700',
  ORANGE: '#FF8C00',
  AMBER: '#FFBF00',

  // Purples and pinks
  PURPLE: '#800080',
  VIOLET: '#8B00FF',
  MAGENTA: '#FF00FF',
  PINK: '#FF69B4',
  LAVENDER: '#E6E6FA',

  // Browns
  BROWN: '#8B4513',
  TAN: '#D2B48C',
  BEIGE: '#F5F5DC',
  KHAKI: '#C3B091',

  // Pastels
  PASTEL_PINK: '#FFB3BA',
  PASTEL_BLUE: '#BAE1FF',
  PASTEL_GREEN: '#BAFFC9',
  PASTEL_YELLOW: '#FFFFBA',
  PASTEL_PURPLE: '#E0BBE4',
} as const;

// ============================================================================
// PREDEFINED COMPLETE PALETTES
// ============================================================================

export interface CompletePalette {
  name: string;
  description: string;
  skinTone: string;
  hairColor: string;
  eyeColor: string;
  clothingPrimary: string;
  clothingSecondary?: string;
}

export const PRESET_PALETTES: Record<string, CompletePalette> = {
  CLASSIC_STEVE: {
    name: 'Classic Steve',
    description: 'The classic Minecraft character',
    skinTone: SKIN_TONES.BEIGE,
    hairColor: HAIR_COLORS.DARK_BROWN,
    eyeColor: EYE_COLORS.BLUE,
    clothingPrimary: CLOTHING_COLORS.CYAN,
    clothingSecondary: CLOTHING_COLORS.NAVY,
  },

  CLASSIC_ALEX: {
    name: 'Classic Alex',
    description: 'The classic Minecraft character',
    skinTone: SKIN_TONES.LIGHT_BEIGE,
    hairColor: HAIR_COLORS.GINGER,
    eyeColor: EYE_COLORS.GREEN,
    clothingPrimary: CLOTHING_COLORS.GREEN,
    clothingSecondary: CLOTHING_COLORS.BROWN,
  },

  DARK_KNIGHT: {
    name: 'Dark Knight',
    description: 'Gothic style with dark tones',
    skinTone: SKIN_TONES.PALE,
    hairColor: HAIR_COLORS.BLACK,
    eyeColor: EYE_COLORS.DARK_BLUE,
    clothingPrimary: CLOTHING_COLORS.BLACK,
    clothingSecondary: CLOTHING_COLORS.DARK_RED,
  },

  FOREST_ELF: {
    name: 'Forest Elf',
    description: 'Natural green tones',
    skinTone: SKIN_TONES.FAIR,
    hairColor: HAIR_COLORS.LIGHT_BROWN,
    eyeColor: EYE_COLORS.EMERALD,
    clothingPrimary: CLOTHING_COLORS.DARK_GREEN,
    clothingSecondary: CLOTHING_COLORS.BROWN,
  },

  FIRE_MAGE: {
    name: 'Fire Mage',
    description: 'Warm fire tones',
    skinTone: SKIN_TONES.TAN,
    hairColor: HAIR_COLORS.RED,
    eyeColor: EYE_COLORS.AMBER,
    clothingPrimary: CLOTHING_COLORS.RED,
    clothingSecondary: CLOTHING_COLORS.ORANGE,
  },

  ICE_QUEEN: {
    name: 'Ice Queen',
    description: 'Cool ice tones',
    skinTone: SKIN_TONES.PORCELAIN,
    hairColor: HAIR_COLORS.PLATINUM_BLONDE,
    eyeColor: EYE_COLORS.ICE_BLUE,
    clothingPrimary: CLOTHING_COLORS.SKY_BLUE,
    clothingSecondary: CLOTHING_COLORS.WHITE,
  },

  PASTEL_KAWAII: {
    name: 'Pastel Kawaii',
    description: 'Soft pastel colors',
    skinTone: SKIN_TONES.FAIR,
    hairColor: HAIR_COLORS.PINK,
    eyeColor: EYE_COLORS.VIOLET,
    clothingPrimary: CLOTHING_COLORS.PASTEL_PINK,
    clothingSecondary: CLOTHING_COLORS.PASTEL_PURPLE,
  },

  RAINBOW_PUNK: {
    name: 'Rainbow Punk',
    description: 'Vibrant and rebellious colors',
    skinTone: SKIN_TONES.LIGHT_TAN,
    hairColor: HAIR_COLORS.RAINBOW,
    eyeColor: EYE_COLORS.TURQUOISE,
    clothingPrimary: CLOTHING_COLORS.MAGENTA,
    clothingSecondary: CLOTHING_COLORS.CYAN,
  },

  DESERT_WARRIOR: {
    name: 'Desert Warrior',
    description: 'Warm desert tones',
    skinTone: SKIN_TONES.DARK_BROWN,
    hairColor: HAIR_COLORS.BLACK,
    eyeColor: EYE_COLORS.DARK_BROWN,
    clothingPrimary: CLOTHING_COLORS.TAN,
    clothingSecondary: CLOTHING_COLORS.BROWN,
  },

  ARCTIC_EXPLORER: {
    name: 'Arctic Explorer',
    description: 'Cool snow tones',
    skinTone: SKIN_TONES.PALE,
    hairColor: HAIR_COLORS.WHITE,
    eyeColor: EYE_COLORS.LIGHT_BLUE,
    clothingPrimary: CLOTHING_COLORS.WHITE,
    clothingSecondary: CLOTHING_COLORS.GRAY,
  },
};

// ============================================================================
// HELPERS FOR GENERATING COLOR VARIATIONS
// ============================================================================

/**
 * Darkens a hex color to create shadows
 */
export function darkenColor(hex: string, factor: number = 0.7): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Lightens a hex color to create highlights
 */
export function lightenColor(hex: string, factor: number = 1.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.min(255, Math.round(r * factor));
  const newG = Math.min(255, Math.round(g * factor));
  const newB = Math.min(255, Math.round(b * factor));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Automatically generates shadow and highlight for a base color
 */
export function generateColorVariations(baseColor: string) {
  return {
    base: baseColor,
    shadow: darkenColor(baseColor, 0.7),
    highlight: lightenColor(baseColor, 1.3),
  };
}
