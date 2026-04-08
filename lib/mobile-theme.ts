/**
 * Mobile Theme - Design tokens sincronizados con la app React Native
 *
 * Estos tokens están sincronizados con /mobile/src/theme/
 * para mantener consistencia visual entre la app web móvil y la app nativa.
 */

// Colores primarios - Sincronizados con mobile/src/theme/colors.ts
export const mobileColors = {
  // Colores primarios
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6', // Principal
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Colores secundarios
  secondary: {
    50: '#FDF4FF',
    100: '#FAE8FF',
    200: '#F5D0FE',
    300: '#F0ABFC',
    400: '#E879F9',
    500: '#D946EF',
    600: '#C026D3',
    700: '#A21CAF',
    800: '#86198F',
    900: '#701A75',
  },

  // Colores neutros (grises)
  neutral: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
  },

  // Estados
  success: {
    light: '#86EFAC',
    main: '#22C55E',
    dark: '#16A34A',
  },

  error: {
    light: '#FCA5A5',
    main: '#EF4444',
    dark: '#DC2626',
  },

  warning: {
    light: '#FCD34D',
    main: '#F59E0B',
    dark: '#D97706',
  },

  info: {
    light: '#7DD3FC',
    main: '#0EA5E9',
    dark: '#0284C7',
  },

  // Backgrounds - Mobile usa el mismo tema oscuro que desktop
  background: {
    primary: '#1C1C1C',   // Fondo principal oscuro (rgb(28, 28, 28))
    secondary: '#202020', // Fondo secundario (rgb(32, 32, 32))
    tertiary: '#282828',  // Fondo terciario (rgb(40, 40, 40))
    card: '#141416',      // Fondo de cards - igual que desktop
    elevated: '#27272a',  // Fondo elevado
  },

  // Texto - Sincronizado con desktop dark theme
  text: {
    primary: '#E6E6E6',   // Texto principal (claro) - rgb(230, 230, 230)
    secondary: '#B4B4B4', // Texto secundario - rgb(180, 180, 180)
    tertiary: '#94A3B8',  // Texto terciario - mantener para consistencia
    disabled: '#787878',  // Texto deshabilitado - rgb(120, 120, 120)
  },

  // Bordes - Sincronizado con desktop dark theme
  border: {
    light: '#464646',     // rgb(70, 70, 70) - border color del desktop
    main: '#525252',      // Un poco más claro
    dark: '#282828',      // rgb(40, 40, 40)
  },

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Transparente
  transparent: 'transparent',
} as const;

// Gradientes
export const mobileGradients = {
  primary: ['#8B5CF6', '#D946EF'],
  secondary: ['#D946EF', '#F97316'],
  dark: ['#0F172A', '#1E293B'],
  purple: ['#6366F1', '#8B5CF6', '#D946EF'],
  sunset: ['#F59E0B', '#F97316', '#EF4444'],
} as const;

// Spacing - Sincronizado con mobile/src/theme/spacing.ts
export const mobileSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// Border Radius
export const mobileBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Typography - Sincronizado con mobile/src/theme/typography.ts
export const mobileTypography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

// Shadows para web (convertidos de React Native)
export const mobileShadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.18)',
  md: '0 2px 4px rgba(0, 0, 0, 0.23)',
  lg: '0 4px 8px rgba(0, 0, 0, 0.30)',
  xl: '0 6px 12px rgba(0, 0, 0, 0.37)',
} as const;

// Tab Bar configuration - Similar a MainTabs de la app móvil
export const mobileTabBarConfig = {
  height: 65, // + safe area
  backgroundColor: '#202020', // mobileColors.background.secondary
  borderTopColor: '#464646', // mobileColors.border.light
  activeTintColor: '#8B5CF6', // mobileColors.primary[500]
  inactiveTintColor: '#94A3B8', // mobileColors.text.tertiary
  labelFontSize: 12,
  labelFontWeight: '600',
} as const;

// Header configuration - Similar to mobile app header
export const mobileHeaderConfig = {
  height: 56,
  backgroundColor: '#202020', // mobileColors.background.secondary
  borderBottomColor: '#464646', // mobileColors.border.light
  titleColor: '#E6E6E6', // mobileColors.text.primary
  titleFontSize: 20,
  titleFontWeight: '700',
} as const;

// Tailwind CSS classes para aplicar el theme móvil
// Estas clases se usan con el prefijo "mobile:" en el responsive design
export const mobileTailwindClasses = {
  // Background classes - Sincronizadas con desktop dark theme
  bgPrimary: 'bg-[#1C1C1C]',
  bgSecondary: 'bg-[#202020]',
  bgTertiary: 'bg-[#282828]',
  bgCard: 'bg-[#141416]',
  bgElevated: 'bg-[#27272a]',

  // Text classes - Sincronizadas con desktop dark theme
  textPrimary: 'text-[#E6E6E6]',
  textSecondary: 'text-[#B4B4B4]',
  textTertiary: 'text-[#94A3B8]',

  // Border classes - Sincronizadas con desktop dark theme
  borderLight: 'border-[#464646]',
  borderMain: 'border-[#525252]',

  // Primary color classes
  primaryBg: 'bg-[#8B5CF6]',
  primaryText: 'text-[#8B5CF6]',
  primaryBorder: 'border-[#8B5CF6]',
} as const;

// Exportar todo como un theme unificado
export const mobileTheme = {
  colors: mobileColors,
  gradients: mobileGradients,
  spacing: mobileSpacing,
  borderRadius: mobileBorderRadius,
  typography: mobileTypography,
  shadows: mobileShadows,
  tabBar: mobileTabBarConfig,
  header: mobileHeaderConfig,
  tailwind: mobileTailwindClasses,
} as const;

export default mobileTheme;
