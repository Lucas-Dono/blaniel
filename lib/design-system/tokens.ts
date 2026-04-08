/**
 * DESIGN SYSTEM TOKENS
 * Blaniel - Design tokens basados en Material Design 3
 *
 * Este archivo centraliza todos los tokens de diseño para mantener
 * consistencia visual en toda la aplicación.
 */

// ============================================
// SHAPE & BORDER RADIUS
// ============================================

/**
 * Border Radius Tokens
 *
 * Basado en Material Design 3 shape system
 * https://m3.material.io/styles/shape/shape-scale-tokens
 */
export const SHAPE = {
  /**
   * None - Sin border radius
   * Uso: Elementos edge-to-edge, divisores
   */
  none: '0px',

  /**
   * Extra Small - 4px (rounded-sm en Tailwind)
   * Uso: Badges pequeños, tags compactos
   */
  xs: '4px',

  /**
   * Small - 8px (rounded-lg en Tailwind)
   * Uso: Botones pequeños, inputs compactos, tooltips
   */
  sm: '8px',

  /**
   * Medium - 12px (rounded-xl en Tailwind)
   * Uso: Chips, small cards, dropdowns
   */
  md: '12px',

  /**
   * Large - 16px (rounded-2xl en Tailwind) ⭐ DEFAULT
   * Uso: Cards, modals, panels, primary components
   *
   * Este es nuestro estándar principal para la mayoría de componentes.
   */
  lg: '16px',

  /**
   * Extra Large - 28px (rounded-3xl+ en Tailwind)
   * Uso: Hero cards, featured content, special emphasis
   */
  xl: '28px',

  /**
   * Full - 9999px (rounded-full en Tailwind)
   * Uso: Avatares circulares, badges circulares, pills
   */
  full: '9999px',
} as const;

/**
 * Tailwind Classes - Mapping directo a clases de Tailwind
 * Usar estas clases para consistencia
 */
export const SHAPE_CLASSES = {
  none: 'rounded-none',
  xs: 'rounded-sm',      // 4px
  sm: 'rounded-lg',      // 8px  - Para elementos pequeños
  md: 'rounded-xl',      // 12px - Para chips y dropdowns
  lg: 'rounded-2xl',     // 16px - ⭐ ESTÁNDAR PRINCIPAL
  xl: 'rounded-3xl',     // 28px - Para elementos destacados
  full: 'rounded-full',  // Circular
} as const;

/**
 * Default Border Radius
 * Este es el valor que se usa por defecto en toda la aplicación
 */
export const DEFAULT_BORDER_RADIUS = SHAPE.lg; // 16px (rounded-2xl)

// ============================================
// COMPONENT-SPECIFIC RADIUS
// ============================================

/**
 * Border Radius por tipo de componente
 * Guía de uso para mantener consistencia
 */
export const COMPONENT_RADIUS = {
  // ⭐ PRINCIPALES (rounded-2xl / 16px)
  card: SHAPE_CLASSES.lg,
  modal: SHAPE_CLASSES.lg,
  dialog: SHAPE_CLASSES.lg,
  panel: SHAPE_CLASSES.lg,
  container: SHAPE_CLASSES.lg,
  sheet: SHAPE_CLASSES.lg,

  // INPUTS & FORMS (rounded-2xl / 16px)
  input: SHAPE_CLASSES.lg,
  textarea: SHAPE_CLASSES.lg,
  select: SHAPE_CLASSES.lg,

  // BOTONES (rounded-2xl / 16px)
  button: SHAPE_CLASSES.lg,
  buttonSmall: SHAPE_CLASSES.sm, // Botones compactos pueden usar 8px

  // BADGES & TAGS (rounded-lg / 8px o rounded-full)
  badge: SHAPE_CLASSES.sm,       // O usar 'full' para circular
  tag: SHAPE_CLASSES.sm,
  chip: SHAPE_CLASSES.md,        // 12px para chips

  // AVATARES (rounded-full)
  avatar: SHAPE_CLASSES.full,
  avatarSquare: SHAPE_CLASSES.lg, // Avatares cuadrados con bordes

  // DROPDOWN & POPOVERS (rounded-2xl / 16px)
  dropdown: SHAPE_CLASSES.lg,
  popover: SHAPE_CLASSES.lg,
  tooltip: SHAPE_CLASSES.sm,     // Tooltips más pequeños

  // IMÁGENES (rounded-2xl / 16px)
  image: SHAPE_CLASSES.lg,
  thumbnail: SHAPE_CLASSES.md,

  // NAVEGACIÓN (rounded-2xl / 16px)
  nav: SHAPE_CLASSES.lg,
  navItem: SHAPE_CLASSES.lg,

  // ALERTAS & NOTIFICATIONS (rounded-2xl / 16px)
  alert: SHAPE_CLASSES.lg,
  notification: SHAPE_CLASSES.lg,
  toast: SHAPE_CLASSES.lg,
} as const;

// ============================================
// SPACING & LAYOUT
// ============================================

/**
 * Spacing Scale (en px)
 * Basado en sistema 4px base
 */
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '96px',
} as const;

// ============================================
// ELEVATION & SHADOWS
// ============================================

/**
 * Elevation Levels (Material Design 3)
 * Usar estas sombras para depth
 */
export const ELEVATION = {
  0: 'none',
  1: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  2: '0 2px 6px 0 rgb(0 0 0 / 0.06)',
  3: '0 4px 8px 0 rgb(0 0 0 / 0.08)',
  4: '0 6px 12px 0 rgb(0 0 0 / 0.10)',
  5: '0 8px 16px 0 rgb(0 0 0 / 0.12)',
} as const;

// ============================================
// DURATION & EASING (Motion)
// ============================================

/**
 * Animation Durations (CSS strings)
 * Basado en Material Design Motion
 *
 * Para Framer Motion, usa: lib/motion/system.ts
 */
export const DURATION = {
  instant: '100ms',
  fast: '150ms',
  normal: '250ms',
  moderate: '350ms',
  slow: '500ms',
  slower: '700ms',
  slowest: '1000ms',
} as const;

/**
 * Easing Functions (CSS cubic-bezier)
 * Material Design standard easing
 *
 * Para Framer Motion, usa: lib/motion/system.ts
 */
export const EASING = {
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
  linear: 'cubic-bezier(0, 0, 1, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * EJEMPLO DE USO:
 *
 * import { COMPONENT_RADIUS, ELEVATION, DURATION, EASING } from '@/lib/design-system/tokens';
 *
 * // En componentes
 * <div className={COMPONENT_RADIUS.card}>Card content</div>
 * <Button className={COMPONENT_RADIUS.button}>Click me</Button>
 *
 * // En Tailwind
 * <div className="rounded-2xl">Card</div>  // ⭐ ESTÁNDAR
 *
 * // En CSS/styled-components
 * border-radius: ${SHAPE.lg};
 * box-shadow: ${ELEVATION[2]};
 * transition: all ${DURATION.normal} ${EASING.standard};
 */

// ============================================
// EXPORT TYPES
// ============================================

export type ShapeToken = keyof typeof SHAPE;
export type ShapeClass = typeof SHAPE_CLASSES[keyof typeof SHAPE_CLASSES];
export type ComponentRadius = typeof COMPONENT_RADIUS[keyof typeof COMPONENT_RADIUS];
export type ElevationLevel = keyof typeof ELEVATION;
export type AnimationDuration = typeof DURATION[keyof typeof DURATION];
export type EasingFunction = typeof EASING[keyof typeof EASING];
