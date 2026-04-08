/**
 * Global type declarations for next-intl
 *
 * Este archivo extiende los tipos globales de TypeScript para proporcionar
 * autocompletado y type-safety en traducciones de next-intl.
 */

import type { Messages } from './i18n/types';

declare global {
  // Extiende IntlMessages con nuestros tipos personalizados
  interface IntlMessages extends Messages {}
}

export {};
