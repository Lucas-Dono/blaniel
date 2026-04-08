/**
 * Clip-Path Utilities for Angular Card Design
 * Provides reusable clip-path patterns for stylized cards
 */

export type ClipPathVariant = 'featured' | 'regular' | 'flat' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Get clip-path CSS value for a specific variant
 */
export function getClipPath(variant: ClipPathVariant): string {
  switch (variant) {
    case 'featured':
      // Dramatic diagonal cut on top-right corner
      return 'polygon(0 0, calc(100% - 40px) 0, 100% 40px, 100% 100%, 0 100%)';

    case 'regular':
      // Subtle corner cuts on top-right and bottom-left
      return 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 0px) 100%, 20px 100%, 0 calc(100% - 20px))';

    case 'top-left':
      // Diagonal cut on top-left corner only (50px for visibility)
      return 'polygon(50px 0, 100% 0, 100% 100%, 0 100%, 0 50px)';

    case 'top-right':
      // Diagonal cut on top-right corner only (50px for visibility)
      return 'polygon(0 0, calc(100% - 50px) 0, 100% 50px, 100% 100%, 0 100%)';

    case 'bottom-left':
      // Diagonal cut on bottom-left corner only (50px for visibility)
      return 'polygon(0 0, 100% 0, 100% 100%, 50px 100%, 0 calc(100% - 50px))';

    case 'bottom-right':
      // Diagonal cut on bottom-right corner only (50px for visibility)
      return 'polygon(0 0, 100% 0, 100% calc(100% - 50px), calc(100% - 50px) 100%, 0 100%)';

    case 'flat':
    default:
      // No clip-path, uses border-radius instead
      return 'none';
  }
}

/**
 * Get inline style object with clip-path
 */
export function getClipPathStyle(variant: ClipPathVariant): React.CSSProperties {
  const clipPath = getClipPath(variant);

  if (clipPath === 'none') {
    return {};
  }

  return {
    clipPath,
    WebkitClipPath: clipPath, // Safari support
  };
}

/**
 * Get Tailwind-compatible class for clip-path
 * Note: These need to be defined in tailwind.config.ts or used as inline styles
 */
export function getClipPathClass(variant: ClipPathVariant): string {
  switch (variant) {
    case 'featured':
      return 'clip-path-featured';
    case 'regular':
      return 'clip-path-regular';
    case 'top-left':
      return 'clip-path-top-left';
    case 'top-right':
      return 'clip-path-top-right';
    case 'bottom-left':
      return 'clip-path-bottom-left';
    case 'bottom-right':
      return 'clip-path-bottom-right';
    case 'flat':
    default:
      return '';
  }
}

/**
 * Rotate through clip-path variants for variety
 * Useful for creating asymmetric grids with different corner cuts
 */
export function getRotatingClipPath(index: number): ClipPathVariant {
  const variants: ClipPathVariant[] = ['top-right', 'bottom-left', 'top-left', 'bottom-right'];
  return variants[index % variants.length];
}

/**
 * Get random clip-path variant for more organic feel
 */
export function getRandomClipPath(excludeFlat: boolean = false): ClipPathVariant {
  const variants: ClipPathVariant[] = excludeFlat
    ? ['featured', 'regular', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
    : ['featured', 'regular', 'flat', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

  return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Check if clip-path is supported in current browser
 */
export function isClipPathSupported(): boolean {
  if (typeof window === 'undefined') return false;

  const testElement = document.createElement('div');
  testElement.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';

  return testElement.style.clipPath !== '';
}

/**
 * Calculate clip-path variant based on grid position to create diamond pattern
 * Cards cut towards the center, creating an organized "hidden order"
 *
 * @param index - Card index in the array
 * @param totalCards - Total number of cards
 * @param columns - Number of columns in grid (default: 4)
 * @returns ClipPathVariant that points towards the center
 */
export function getDiamondPatternClipPath(
  index: number,
  totalCards: number,
  columns: number = 4
): ClipPathVariant {
  // Calculate row and column position
  const row = Math.floor(index / columns);
  const col = index % columns;
  const totalRows = Math.ceil(totalCards / columns);
  const middleRow = totalRows / 2;

  // Determine if we're in upper or lower half
  const isUpperHalf = row < middleRow;

  // Determine if we're on left or right side
  // For 4 columns: 0,2 are "left", 1,3 are "right"
  const isLeftSide = col % 2 === 0;

  // Combine to create diamond pattern:
  // - Upper half cuts point DOWN (bottom-*)
  // - Lower half cuts point UP (top-*)
  // - Left side cuts point RIGHT (*-right)
  // - Right side cuts point LEFT (*-left)

  if (isUpperHalf) {
    // Upper half - cuts point DOWN
    return isLeftSide ? 'bottom-right' : 'bottom-left';
  } else {
    // Lower half - cuts point UP
    return isLeftSide ? 'top-right' : 'top-left';
  }
}
