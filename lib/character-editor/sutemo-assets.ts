/**
 * Asset system for Sutemo Character Creator
 * Supports multiple body types: Female Halfbody, Female Fullbody, Male
 */

export type BodyType = 'female-halfbody' | 'female-fullbody' | 'male';

export type HairFrontStyle = '0' | '1' | '2' | '3' | '4';
export type HairBehindStyle = '0' | '1' | '2' | '3';
export type HairColor = 'Black' | 'Pink' | 'Silver' | 'Brown' | 'Blonde' | 'Dark' | 'Blond' | 'Red';
export type Expression =
  | 'Normal'
  | 'Smile-1' | 'Smile-2' | 'Smile-3'
  | 'Happy-1' | 'Happy-2'
  | 'Sad' | 'Sad-2'
  | 'Angry'
  | 'Annoyed' | 'Annoyed-2'
  | 'Surprised' | 'Surprise-2'
  | 'Scared'
  | 'Smug'
  | 'Awkward'
  | 'Green-eyes';

export type Outfit =
  | 'Seifuku-1' | 'Seifuku-2'
  | 'Summer-Dress'
  | 'Swimsuit'
  | 'T-shirt-1' | 'T-shirt-2'
  | 'Winter-1' | 'Winter-2'
  | 'Pajamas-1' | 'Pajamas-2'
  | 'Jacket'
  | 'PE-uniform-1' | 'PE-uniform-2'
  | 'Towel-1' | 'Towel-2';

export type Blush = 'None' | 'Blush1' | 'Blush2';
export type Accessory = 'None' | 'glasses';

export interface CharacterConfig {
  bodyType: BodyType;
  hairFrontStyle: HairFrontStyle;
  hairBehindStyle: HairBehindStyle;
  hairColor: HairColor;
  expression: Expression;
  outfit: Outfit;
  blush: Blush;
  accessory: Accessory;
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  bodyType: 'female-halfbody',
  hairFrontStyle: '0',
  hairBehindStyle: '0',
  hairColor: 'Brown',
  expression: 'Normal',
  outfit: 'Seifuku-1',
  blush: 'None',
  accessory: 'None',
};

/**
 * Mapeo de nombres internos a rutas de archivos
 */
function getAssetsBase(bodyType: BodyType): string {
  switch (bodyType) {
    case 'female-halfbody':
      return '/worlds/Assets/Sutemo - Female';
    case 'female-fullbody':
      return '/worlds/Assets/Sutemo - Female 2';
    case 'male':
      return '/worlds/Assets/Sutemo - Male';
  }
}

// Mapeo de estilos de cabello a sus códigos de archivo
const HAIR_FRONT_MAP: Record<HairFrontStyle, string> = {
  '0': '0000',
  '1': '0001',
  '2': '0002',
  '3': '0003',
  '4': '0004',
};

const HAIR_BEHIND_MAP: Record<HairBehindStyle, string> = {
  '0': '0000',
  '1': '0001',
  '2': '0002',
  '3': '0003',
};

/**
 * Genera la ruta del asset según la configuración
 */
export function getAssetPath(layer: string, config: CharacterConfig): string | null {
  const ASSETS_BASE = getAssetsBase(config.bodyType);

  // Para Female Halfbody (implementación actual)
  if (config.bodyType === 'female-halfbody') {
    switch (layer) {
      case 'base':
        return `${ASSETS_BASE}/Halfbody-Female-by-Sutemo_0000_Base-Body.png`;

      case 'outfit':
        return `${ASSETS_BASE}/Outfits/Halfbody-Female-by-Sutemo_0003s_${getOutfitCode(config.outfit)}_${config.outfit}.png`;

      case 'blush':
        if (config.blush === 'None') return null;
        return `${ASSETS_BASE}/Blush/Halfbody-Female-by-Sutemo_0004s_${config.blush === 'Blush1' ? '0001' : '0000'}_${config.blush}.png`;

      case 'expression': {
        let fileName: string = config.expression;
        if (config.expression === 'Green-eyes') fileName = 'Layer-16';
        if (config.expression === 'Happy-1') fileName = 'Happy-1-';
        return `${ASSETS_BASE}/Expressions/Halfbody-Female-by-Sutemo_0001s_${getExpressionCode(config.expression)}_${fileName}.png`;
      }

      case 'hairBehind': {
        const styleCode = HAIR_BEHIND_MAP[config.hairBehindStyle];
        return `${ASSETS_BASE}/Hair behind/Halfbody-Female-by-Sutemo_0005s_${styleCode}s_${getHairColorCode(config.hairColor)}_${config.hairColor}.png`;
      }

      case 'accessory':
        if (config.accessory === 'None') return null;
        return `${ASSETS_BASE}/Accesories/Halfbody-Female-by-Sutemo_0000s_0000_${config.accessory}.png`;

      case 'hairFront': {
        const styleCode = HAIR_FRONT_MAP[config.hairFrontStyle];
        const colorName = config.hairColor === 'Blonde' && config.hairFrontStyle === '2' ? 'BLonde' : config.hairColor;
        return `${ASSETS_BASE}/Hair front/Halfbody-Female-by-Sutemo_0002s_${styleCode}s_${getHairColorCode(config.hairColor)}_${colorName}.png`;
      }

      default:
        return null;
    }
  }

  // Para Female Fullbody
  if (config.bodyType === 'female-fullbody') {
    // Mapeo de colores (Female Halfbody -> Female Fullbody)
    const colorMap: Record<string, string> = {
      'Black': 'Dark',
      'Blonde': 'Blond',
      'Pink': 'Pink',
      'Silver': 'Silver',
      'Brown': 'Brown',
    };
    const fullbodyColor = colorMap[config.hairColor] || 'Brown';

    switch (layer) {
      case 'base':
        return `${ASSETS_BASE}/Female-Sprite-by-Sutemo_0000_Base-Body.png`;

      case 'outfit': {
        // Mapeo básico de outfits
        const outfitMap: Record<string, string> = {
          'Seifuku-1': 'seifuku-1',
          'Seifuku-2': 'seifuku-2',
          'Summer-Dress': 'Summer-Dress',
          'Swimsuit': 'Sswimsuit',
          'T-shirt-1': 'Hoodie-1',
          'T-shirt-2': 'Hoodie-1',
          'Winter-1': 'Winter-outfit',
          'Winter-2': 'Winter-outfit',
          'Pajamas-1': 'Pajama',
          'Pajamas-2': 'Pajama',
          'Jacket': 'Hoodie-1',
          'PE-uniform-1': 'PE-uniform',
          'PE-uniform-2': 'PE-uniform',
          'Towel-1': 'Towel',
          'Towel-2': 'Towel',
        };
        const fullbodyOutfit = outfitMap[config.outfit] || 'seifuku-1';
        const outfitCode = getFullbodyOutfitCode(fullbodyOutfit);
        return `${ASSETS_BASE}/Outfits/Female-Sprite-by-Sutemo_0003s_${outfitCode}_${fullbodyOutfit}.png`;
      }

      case 'blush': {
        if (config.blush === 'None') return null;
        const blushCode = config.blush === 'Blush1' ? '0001' : '0000';
        const blushName = config.blush === 'Blush1' ? '1' : '2';
        return `${ASSETS_BASE}/Blush/Female-Sprite-by-Sutemo_0004s_${blushCode}_${blushName}.png`;
      }

      case 'expression': {
        // Mapeo de expresiones
        const expressionMap: Record<string, string> = {
          'Normal': 'normal',
          'Smile-1': 'Smile',
          'Smile-2': 'Smile-2',
          'Smile-3': 'Smile',
          'Happy-1': 'Delighted',
          'Happy-2': 'Laugh',
          'Sad': 'Sad',
          'Sad-2': 'Sad',
          'Angry': 'Angry',
          'Annoyed': 'Annoyed',
          'Annoyed-2': 'Annoyed',
          'Surprised': 'Shocked',
          'Surprise-2': 'Shocked',
          'Scared': 'Shocked',
          'Smug': 'Smug',
          'Awkward': 'Sleepy',
          'Green-eyes': 'normal',
        };
        const fullbodyExpression = expressionMap[config.expression] || 'normal';
        const expressionCode = getFullbodyExpressionCode(fullbodyExpression);
        return `${ASSETS_BASE}/Expressions/Female-Sprite-by-Sutemo_0001s_${expressionCode}_${fullbodyExpression}.png`;
      }

      case 'hairBehind': {
        const styleCode = HAIR_BEHIND_MAP[config.hairBehindStyle];

        // Style 4 (0003s) uses different numbering system
        // Solo tiene: Brown (0000), Pink (0001), Silver (0002), Blondie (0003)
        if (config.hairBehindStyle === '3') {
          const style3ColorMap: Record<string, { code: string; name: string }> = {
            'Brown': { code: '0000', name: 'Brown' },
            'Pink': { code: '0001', name: 'Pink' },
            'Silver': { code: '0002', name: 'Silver' },
            'Blond': { code: '0003', name: 'Blondie' },
            // Dark y Black no existen, usar Brown como fallback
            'Dark': { code: '0000', name: 'Brown' },
          };

          const colorInfo = style3ColorMap[fullbodyColor] || { code: '0000', name: 'Brown' };
          return `${ASSETS_BASE}/Hair behind/Female-Sprite-by-Sutemo_0005s_${styleCode}s_${colorInfo.code}_${colorInfo.name}.png`;
        }

        // Para estilos 1, 2, 3 (0000s, 0001s, 0002s)
        // Todos usan el mismo mapeo de colores:
        // 0000=Dark, 0001=Brown, 0002=Pink, 0003=Silver, 0004=Blondie
        const fullbodyHairBehindColorMap: Record<string, string> = {
          'Dark': '0000',
          'Brown': '0001',
          'Pink': '0002',
          'Silver': '0003',
          'Blond': '0004',
        };

        const colorCode = fullbodyHairBehindColorMap[fullbodyColor] || '0001'; // Default to Brown

        // Determinar el nombre del color en el archivo
        let colorName = fullbodyColor === 'Blond' ? 'Blondie' : fullbodyColor;

        // Style 2 (0001s) usa "dark" con minúscula para Dark
        if (config.hairBehindStyle === '1' && fullbodyColor === 'Dark') {
          colorName = 'dark';
        }

        return `${ASSETS_BASE}/Hair behind/Female-Sprite-by-Sutemo_0005s_${styleCode}s_${colorCode}_${colorName}.png`;
      }

      case 'accessory': {
        if (config.accessory === 'None') return null;
        // Female Fullbody usa "Glasses" folder
        return `${ASSETS_BASE}/Glasses/Female-Sprite-by-Sutemo_0006s_0000_${config.accessory}.png`;
      }

      case 'hairFront': {
        const styleCode = HAIR_FRONT_MAP[config.hairFrontStyle];

        // Female Fullbody hairFront usa el mismo mapeo que hairBehind:
        // 0000=Dark, 0001=Brown, 0002=Pink, 0003=Silver, 0004=Blond
        const fullbodyHairColorMap: Record<string, string> = {
          'Dark': '0000',
          'Brown': '0001',
          'Pink': '0002',
          'Silver': '0003',
          'Blond': '0004',
        };

        const colorCode = fullbodyHairColorMap[fullbodyColor] || '0001'; // Default to Brown

        // Algunos estilos usan "Blondie" en lugar de "Blond"
        let colorName = fullbodyColor;
        if (fullbodyColor === 'Blond' && ['1', '2', '3'].includes(config.hairFrontStyle)) {
          colorName = 'Blondie';
        }

        // Style 3 con Dark tiene un guión extra al final
        const suffix = (config.hairFrontStyle === '3' && fullbodyColor === 'Dark') ? '-' : '';

        return `${ASSETS_BASE}/Hair front/Female-Sprite-by-Sutemo_0002s_${styleCode}s_${colorCode}_${colorName}${suffix}.png`;
      }

      default:
        return null;
    }
  }

  // Para Male
  if (config.bodyType === 'male') {
    // Mapeo de colores
    const colorMap: Record<string, string> = {
      'Black': 'Dark',
      'Blonde': 'Blond',
      'Pink': 'Brown',  // Male no tiene pink, usar brown
      'Silver': 'Silver',
      'Brown': 'Brown',
      'Red': 'red',
    };
    const maleColor = colorMap[config.hairColor] || 'Brown';

    switch (layer) {
      case 'base':
        return `${ASSETS_BASE}/Male-Sprite-by-Sutemo_0002_Base-Male-Body.png`;

      case 'outfit': {
        // Mapeo de outfits
        const outfitMap: Record<string, string> = {
          'Seifuku-1': 'School-Uniform-1',
          'Seifuku-2': 'School-Uniform-2',
          'Summer-Dress': 'Casual-1-1',
          'Swimsuit': 'Tanktop-1',
          'T-shirt-1': 'Casual-2-1',
          'T-shirt-2': 'Casual-3-1',
          'Winter-1': 'winter',
          'Winter-2': 'winter',
          'Pajamas-1': 'Casual-1-1',
          'Pajamas-2': 'Casual-1-1',
          'Jacket': 'Vest',
          'PE-uniform-1': 'P.E-Uniform',
          'PE-uniform-2': 'P.E-Uniform',
          'Towel-1': 'Tanktop-1',
          'Towel-2': 'Tanktop-2',
        };
        const maleOutfit = outfitMap[config.outfit] || 'School-Uniform-1';
        const outfitCode = getMaleOutfitCode(maleOutfit);
        return `${ASSETS_BASE}/Outfit/Male-Sprite-by-Sutemo_0004s_${outfitCode}_${maleOutfit}.png`;
      }

      case 'blush':
        // Male no tiene blush
        return null;

      case 'expression': {
        // Mapeo de expresiones
        const expressionMap: Record<string, string> = {
          'Normal': 'Normal',
          'Smile-1': 'Smile-1',
          'Smile-2': 'Smile-2',
          'Smile-3': 'Smile-3',
          'Happy-1': 'Laugh',
          'Happy-2': 'Laugh',
          'Sad': 'Sad',
          'Sad-2': 'Sad',
          'Angry': 'Angry-1',
          'Annoyed': 'Angry-2',
          'Annoyed-2': 'Angry-2',
          'Surprised': 'Surprised',
          'Surprise-2': 'Surprised',
          'Scared': 'sweat',
          'Smug': 'Smirk',
          'Awkward': 'sweat',
          'Green-eyes': 'Normal',
        };
        const maleExpression = expressionMap[config.expression] || 'Normal';
        const expressionCode = getMaleExpressionCode(maleExpression);
        return `${ASSETS_BASE}/Expression/Male-Sprite-by-Sutemo_0002s_${expressionCode}_${maleExpression}.png`;
      }

      case 'hairBehind': {
        const styleCode = HAIR_BEHIND_MAP[config.hairBehindStyle];
        const colorCode = getMaleHairColorCode(maleColor);
        const colorName = getMaleHairBehindColorName(maleColor, config.hairBehindStyle);
        return `${ASSETS_BASE}/Hair_behind/Male-Sprite-by-Sutemo_0005s_${styleCode}s_${colorCode}_${colorName}.png`;
      }

      case 'accessory': {
        if (config.accessory === 'None') return null;
        // Male usa "Glasses" pero con nombres diferentes
        const glassesMap: Record<string, string> = {
          'glasses': 'Black-Glasses-Copy',
        };
        const maleGlasses = glassesMap[config.accessory] || 'Black-Glasses-Copy';
        return `${ASSETS_BASE}/Glasses/Male-Sprite-by-Sutemo_0001s_0001_${maleGlasses}.png`;
      }

      case 'hairFront': {
        // Male hair front tiene estructura diferente
        // Pattern is: Male-Sprite-by-Sutemo_XXXXs_YYYYs_ZZZZ_ColorName.png
        const styleMap: Record<string, { major: string; minor: string }> = {
          '0': { major: '0000', minor: '0000' },
          '1': { major: '0003', minor: '0000' },
          '2': { major: '0003', minor: '0001' },
          '3': { major: '0003', minor: '0002' },
          '4': { major: '0003', minor: '0003' },
        };
        const style = styleMap[config.hairFrontStyle] || { major: '0000', minor: '0000' };
        const colorCode = getMaleHairColorCode(maleColor);
        const colorName = getMaleHairFrontColorName(maleColor, config.hairFrontStyle);
        return `${ASSETS_BASE}/Hair front/Male-Sprite-by-Sutemo_${style.major}s_${style.minor}s_${colorCode}_${colorName}.png`;
      }

      default:
        return null;
    }
  }

  return null;
}

function getOutfitCode(outfit: Outfit): string {
  const outfits: Record<Outfit, string> = {
    'Towel-2': '0000',
    'Towel-1': '0001',
    'PE-uniform-2': '0002',
    'PE-uniform-1': '0003',
    'Jacket': '0004',
    'Pajamas-2': '0005',
    'Pajamas-1': '0006',
    'Winter-2': '0007',
    'Winter-1': '0008',
    'T-shirt-2': '0009',
    'T-shirt-1': '0010',
    'Swimsuit': '0011',
    'Summer-Dress': '0012',
    'Seifuku-2': '0013',
    'Seifuku-1': '0014',
  };
  return outfits[outfit];
}

function getExpressionCode(expression: Expression): string {
  const expressions: Record<Expression, string> = {
    'Scared': '0000',
    'Angry': '0001',
    'Surprise-2': '0002',
    'Surprised': '0003',
    'Annoyed-2': '0004',
    'Annoyed': '0005',
    'Sad-2': '0006',
    'Sad': '0007',
    'Smug': '0008',
    'Awkward': '0009',
    'Happy-2': '0010',
    'Happy-1': '0011',
    'Smile-3': '0012',
    'Smile-2': '0013',
    'Smile-1': '0014',
    'Green-eyes': '0015',
    'Normal': '0016',
  };

  const code = expressions[expression];
  if (!code) {
    console.error('Expression code not found for:', expression, 'Available:', Object.keys(expressions));
  }
  return code;
}

function getHairColorCode(color: HairColor | string): string {
  const colors: Record<string, string> = {
    'Black': '0000',
    'Dark': '0000',
    'Pink': '0001',
    'Silver': '0002',
    'Brown': '0003',
    'Blonde': '0004',
    'Blond': '0004',
    'Red': '0002',
  };
  return colors[color] || '0003';
}

// Mapeo específico para Male assets
function getMaleHairColorCode(color: string): string {
  const colors: Record<string, string> = {
    'Brown': '0000',
    'Silver': '0001',
    'red': '0002',
    'Dark': '0003',
    'black': '0003',
    'dark': '0003',
    'Blond': '0004',
  };
  return colors[color] || '0000';
}

// Mapeo de nombres de colores para Male Hair_behind según el estilo
function getMaleHairBehindColorName(color: string, style: HairBehindStyle): string {
  // Para Dark/black, el nombre del archivo varía según el estilo
  if (color === 'Dark' || color === 'black' || color === 'dark') {
    const colorNames: Record<HairBehindStyle, string> = {
      '0': 'black',
      '1': 'Dark',
      '2': 'dark',
      '3': 'Dark',
    };
    return colorNames[style];
  }

  // Para otros colores, usar el color tal cual
  if (color === 'Brown') return 'Brown';
  if (color === 'Silver') return 'Silver';
  if (color === 'red') return 'red';
  if (color === 'Blond') return 'Blond';

  return color;
}

// Mapeo de nombres de colores para Male Hair front
function getMaleHairFrontColorName(color: string, style: HairFrontStyle): string {
  // Male hair front - la mayoría usa estos nombres
  // EXCEPCIÓN: style '4' (0003s_0003s) usa 'Black' en lugar de 'Dark'
  if ((color === 'Dark' || color === 'black' || color === 'dark') && style === '4') {
    return 'Black';
  }

  const colorNames: Record<string, string> = {
    'Brown': 'Brown',
    'Silver': 'Silver',
    'red': 'red',
    'Dark': 'Dark',
    'black': 'Dark',
    'dark': 'Dark',
    'Blond': 'Blond',
  };
  return colorNames[color] || 'Brown';
}

function getFullbodyOutfitCode(outfit: string): string {
  const outfits: Record<string, string> = {
    'seifuku-1': '0008',
    'seifuku-2': '0007',
    'Summer-Dress': '0006',
    'Sswimsuit': '0004',
    'Hoodie-1': '0003',
    'Winter-outfit': '0001',
    'Pajama': '0000',
    'PE-uniform': '0002',
    'Towel': '0005',
  };
  return outfits[outfit] || '0008';
}

function getFullbodyExpressionCode(expression: string): string {
  const expressions: Record<string, string> = {
    'Laugh': '0000',
    'Smile-2': '0001',
    'Sleepy': '0002',
    'Annoyed': '0003',
    'Smug': '0004',
    'Angry': '0005',
    'Sad': '0006',
    'Delighted': '0007',
    'normal': '0008',
    'Shocked': '0009',
    'Smile': '0010',
  };
  return expressions[expression] || '0008';
}

function getMaleOutfitCode(outfit: string): string {
  const outfits: Record<string, string> = {
    'Tanktop-2': '0000',
    'Tanktop-1': '0001',
    'Casual-3-3': '0002',
    'Casual-3-1': '0003',
    'Casual-2-2': '0004',
    'Casual-2-1': '0005',
    'Casual-1-2': '0006',
    'Casual-1-1': '0007',
    'Vest': '0008',
    'P.E-Uniform': '0009',
    'winter': '0010',
    'School-Uniform-3': '0011',
    'School-Uniform-2': '0012',
    'School-Uniform-1': '0013',
  };
  return outfits[outfit] || '0013';
}

function getMaleExpressionCode(expression: string): string {
  const expressions: Record<string, string> = {
    'sweat': '0000',
    'Sad': '0001',
    'Angry-2': '0002',
    'Angry-1': '0003',
    'Smirk': '0004',
    'Surprised': '0005',
    'Normal': '0006',
    'Laugh': '0007',
    'Smile-3': '0008',
    'Smile-2': '0009',
    'Smile-1': '0010',
  };
  return expressions[expression] || '0006';
}

/**
 * Orden de capas para renderizado (de atrás hacia adelante)
 * El orden correcto para arte anime es crucial para que las capas se superpongan correctamente
 */
export const LAYER_ORDER = [
  'hairBehind',    // 1. Pelo trasero (detrás de todo)
  'base',          // 2. Cuerpo base
  'outfit',        // 3. Ropa
  'blush',         // 4. Rubor
  'expression',    // 5. Expresión facial (ojos, boca)
  'hairFront',     // 6. Pelo frontal (tapa los ojos de manera realista como en anime)
  'accessory',     // 7. Accesorios (gafas, etc. - encima de todo)
] as const;

/**
 * Devuelve los estilos de pelo frontal disponibles según el tipo de cuerpo
 */
export function getAvailableHairFrontStyles(bodyType: BodyType): HairFrontStyle[] {
  // Female Fullbody solo tiene estilos 0-3
  if (bodyType === 'female-fullbody') {
    return ['0', '1', '2', '3'];
  }

  // Female Halfbody y Male tienen todos los estilos 0-4
  return ['0', '1', '2', '3', '4'];
}

/**
 * Devuelve los outfits disponibles según el tipo de cuerpo
 */
export function getAvailableOutfits(bodyType: BodyType): Outfit[] {
  if (bodyType === 'female-halfbody') {
    // Female Halfbody tiene todos los outfits
    return [
      'Seifuku-1', 'Seifuku-2',
      'Summer-Dress',
      'Swimsuit',
      'T-shirt-1', 'T-shirt-2',
      'Winter-1', 'Winter-2',
      'Pajamas-1', 'Pajamas-2',
      'Jacket',
      'PE-uniform-1', 'PE-uniform-2',
      'Towel-1', 'Towel-2'
    ];
  }

  if (bodyType === 'female-fullbody') {
    // Female Fullbody tiene solo algunas opciones (sin variantes)
    return [
      'Seifuku-1', 'Seifuku-2',
      'Summer-Dress',
      'Swimsuit',
      'T-shirt-1',  // Mapeado a Hoodie-1
      'Winter-1',   // Mapeado a Winter-outfit
      'Pajamas-1',  // Mapeado a Pajama
      'PE-uniform-1', // Mapeado a PE-uniform
      'Towel-1'     // Mapeado a Towel
    ];
  }

  if (bodyType === 'male') {
    // Male tiene sus propios outfits
    return [
      'Seifuku-1', 'Seifuku-2',  // Mapeados a School-Uniform-1 y 2
      'Summer-Dress',  // Mapeado a Casual-1-1
      'Swimsuit',      // Mapeado a Tanktop-1
      'T-shirt-1',     // Mapeado a Casual-2-1
      'T-shirt-2',     // Mapeado a Casual-3-1
      'Winter-1',      // Mapeado a winter
      'Jacket',        // Mapeado a Vest
      'PE-uniform-1',  // Mapeado a P.E-Uniform
      'Towel-1',       // Mapeado a Tanktop-1
      'Towel-2'        // Mapeado a Tanktop-2
    ];
  }

  return [];
}

/**
 * Opciones disponibles para cada categoría (para la UI)
 */
export const AVAILABLE_OPTIONS = {
  hairFrontStyles: ['0', '1', '2', '3', '4'] as HairFrontStyle[],
  hairBehindStyles: ['0', '1', '2', '3'] as HairBehindStyle[],
  hairColors: ['Black', 'Pink', 'Silver', 'Brown', 'Blonde'] as HairColor[],
  expressions: [
    'Normal', 'Smile-1', 'Smile-2', 'Smile-3',
    'Happy-1', 'Happy-2', 'Sad', 'Sad-2',
    'Angry', 'Annoyed', 'Annoyed-2',
    'Surprised', 'Surprise-2', 'Scared',
    'Smug', 'Awkward', 'Green-eyes'
  ] as Expression[],
  outfits: [
    'Seifuku-1', 'Seifuku-2', 'Summer-Dress', 'Swimsuit',
    'T-shirt-1', 'T-shirt-2', 'Winter-1', 'Winter-2',
    'Pajamas-1', 'Pajamas-2', 'Jacket',
    'PE-uniform-1', 'PE-uniform-2', 'Towel-1', 'Towel-2'
  ] as Outfit[],
  blushes: ['None', 'Blush1', 'Blush2'] as Blush[],
  accessories: ['None', 'glasses'] as Accessory[],
};

/**
 * Labels bonitos para la UI
 */
export const LABELS = {
  bodyType: 'Tipo de cuerpo',
  hairFrontStyle: 'Pelo frontal',
  hairBehindStyle: 'Pelo trasero',
  hairColor: 'Color de cabello',
  expression: 'Expresión',
  outfit: 'Vestimenta',
  blush: 'Rubor',
  accessory: 'Accesorios',
};

export const BODY_TYPE_NAMES: Record<BodyType, string> = {
  'female-halfbody': 'Mujer (Cuerpo completo)',
  'female-fullbody': 'Mujer (Medio cuerpo)',
  'male': 'Hombre',
};
