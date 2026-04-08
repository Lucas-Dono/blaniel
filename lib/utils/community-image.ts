/**
 * Utilidades para manejar imágenes de comunidades con diferentes shapes
 */

export type ImageShape = 'circle' | 'square' | 'vertical' | 'horizontal' | 'banner';

interface ShapeStyles {
  containerClass: string;
  imageClass: string;
}

/**
 * Obtiene las clases CSS para el contenedor e imagen según el shape
 * @param shape - La forma de la imagen
 * @param size - Tamaño opcional para el contenedor (default, small, large)
 * @returns Objeto con las clases para el contenedor e imagen
 */
export function getCommunityImageStyles(
  shape: ImageShape | null | undefined,
  size: 'small' | 'default' | 'large' = 'default'
): ShapeStyles {
  const defaultShape = shape || 'circle';

  // Tamaños base según el size parameter
  const sizes = {
    circle: {
      small: 'w-8 h-8',
      default: 'w-16 h-16',
      large: 'w-32 h-32',
    },
    square: {
      small: 'w-8 h-8',
      default: 'w-16 h-16',
      large: 'w-32 h-32',
    },
    vertical: {
      small: 'w-8 h-10',
      default: 'w-16 h-20',
      large: 'w-32 h-40',
    },
    horizontal: {
      small: 'w-16 h-9',
      default: 'w-32 h-18',
      large: 'w-64 h-36',
    },
    banner: {
      small: 'w-full aspect-[4/1]',
      default: 'w-full aspect-[4/1]',
      large: 'w-full aspect-[4/1]',
    },
  };

  const baseImageClass = 'w-full h-full object-cover';

  switch (defaultShape) {
    case 'circle':
      return {
        containerClass: `${sizes.circle[size]} rounded-full overflow-hidden`,
        imageClass: `${baseImageClass}`,
      };
    case 'square':
      return {
        containerClass: `${sizes.square[size]} rounded-lg overflow-hidden`,
        imageClass: `${baseImageClass}`,
      };
    case 'vertical':
      return {
        containerClass: `${sizes.vertical[size]} rounded-lg overflow-hidden`,
        imageClass: `${baseImageClass}`,
      };
    case 'horizontal':
      return {
        containerClass: `${sizes.horizontal[size]} rounded-lg overflow-hidden`,
        imageClass: `${baseImageClass}`,
      };
    case 'banner':
      return {
        containerClass: `${sizes.banner[size]} rounded-lg overflow-hidden`,
        imageClass: `${baseImageClass}`,
      };
    default:
      // Fallback to circle
      return {
        containerClass: `${sizes.circle[size]} rounded-full overflow-hidden`,
        imageClass: `${baseImageClass}`,
      };
  }
}

/**
 * Obtiene el aspect ratio numérico de un shape
 * @param shape - La forma de la imagen
 * @returns El aspect ratio como número
 */
export function getShapeAspectRatio(shape: ImageShape | null | undefined): number {
  const defaultShape = shape || 'circle';

  const ratios: Record<ImageShape, number> = {
    circle: 1,
    square: 1,
    vertical: 3/4,
    horizontal: 16/9,
    banner: 4/1,
  };

  return ratios[defaultShape] || 1;
}
