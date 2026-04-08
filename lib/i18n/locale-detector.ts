/**
 * Sistema de detección automática de idioma basado en geolocalización
 *
 * Este módulo implementa la lógica de detección de idioma con el siguiente orden de prioridad:
 * 1. Cookie/localStorage (preferencia manual guardada)
 * 2. Geolocalización por IP (usando headers de Vercel/Cloudflare)
 * 3. Header Accept-Language del navegador
 * 4. Default: español
 *
 * La detección automática solo se ejecuta en la primera visita.
 * Después, se respeta la preferencia guardada.
 */

import { type NextRequest } from 'next/server';
import {
  type Locale,
  locales,
  defaultLocale,
  SPANISH_SPEAKING_COUNTRIES,
  LOCALE_COOKIE_NAME,
} from '@/i18n/config';
import { middlewareLogger as log } from '@/lib/logging/loggers';

/**
 * Detecta el país del usuario basado en headers de geolocalización
 *
 * Vercel y Cloudflare agregan headers automáticamente con información
 * de geolocalización basada en la IP del usuario:
 *
 * Vercel:
 * - x-vercel-ip-country: código ISO 3166-1 alpha-2 del país (ej: "US", "AR", "ES")
 * - x-vercel-ip-country-region: región dentro del país
 * - x-vercel-ip-city: ciudad
 *
 * Cloudflare:
 * - cf-ipcountry: código ISO 3166-1 alpha-2 del país
 *
 * Estos headers son completamente gratuitos y no requieren configuración adicional.
 *
 * @param request - Request de Next.js
 * @returns Código de país (ISO 3166-1 alpha-2) o null si no se puede detectar
 */
function detectCountryFromIP(request: NextRequest): string | null {
  // Prioridad 1: Vercel (más preciso en Vercel deployments)
  const vercelCountry = request.headers.get('x-vercel-ip-country');
  if (vercelCountry) {
    log.debug({ country: vercelCountry, source: 'vercel' }, 'Country detected from Vercel headers');
    return vercelCountry.toUpperCase();
  }

  // Prioridad 2: Cloudflare (si está detrás de Cloudflare)
  const cloudflareCountry = request.headers.get('cf-ipcountry');
  if (cloudflareCountry && cloudflareCountry !== 'XX') { // XX = unknown
    log.debug({ country: cloudflareCountry, source: 'cloudflare' }, 'Country detected from Cloudflare headers');
    return cloudflareCountry.toUpperCase();
  }

  log.debug('No country detected from IP headers');
  return null;
}

/**
 * Determina si un país debe usar español como idioma por defecto
 *
 * @param countryCode - Código de país ISO 3166-1 alpha-2
 * @returns true si el país es de habla hispana
 */
function isSpanishSpeakingCountry(countryCode: string): boolean {
  return SPANISH_SPEAKING_COUNTRIES.includes(countryCode as any);
}

/**
 * Detecta el idioma preferido del navegador desde el header Accept-Language
 *
 * El header Accept-Language tiene el formato:
 * "es-ES,es;q=0.9,en;q=0.8,en-GB;q=0.7"
 *
 * Donde q es el factor de calidad (prioridad) de 0 a 1.
 * Si no se especifica q, se asume 1.0 (máxima prioridad).
 *
 * @param request - Request de Next.js
 * @returns Locale detectado o null
 */
function detectLanguageFromAcceptLanguage(request: NextRequest): Locale | null {
  const acceptLanguage = request.headers.get('accept-language');

  if (!acceptLanguage) {
    log.debug('No Accept-Language header found');
    return null;
  }

  log.debug({ acceptLanguage }, 'Parsing Accept-Language header');

  // Parse el header Accept-Language
  // Formato: "es-ES,es;q=0.9,en;q=0.8"
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale, qValue] = lang.trim().split(';');
      const quality = qValue ? parseFloat(qValue.split('=')[1]) : 1.0;

      // Extract only language code (es-ES -> es)
      const languageCode = locale.split('-')[0].toLowerCase();

      return { locale: languageCode, quality };
    })
    .sort((a, b) => b.quality - a.quality); // Ordenar por prioridad

  // Buscar el primer idioma soportado
  for (const { locale: languageCode } of languages) {
    if (locales.includes(languageCode as Locale)) {
      log.debug({ detectedLocale: languageCode }, 'Language detected from Accept-Language');
      return languageCode as Locale;
    }
  }

  log.debug('No supported language found in Accept-Language header');
  return null;
}

/**
 * Detecta el idioma preferido del usuario con el siguiente orden de prioridad:
 *
 * 1. Cookie NEXT_LOCALE (preferencia guardada del usuario)
 * 2. Geolocalización por IP (Vercel/Cloudflare headers)
 * 3. Header Accept-Language del navegador
 * 4. Default: español
 *
 * @param request - Request de Next.js
 * @returns Locale detectado
 */
export function detectLocale(request: NextRequest): Locale {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  log.debug({ requestId }, 'Starting locale detection');

  // Prioridad 1: Cookie con preferencia guardada
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    log.info({
      locale: cookieLocale,
      source: 'cookie',
      requestId
    }, 'Locale detected from cookie (user preference)');
    return cookieLocale as Locale;
  }

  // Prioridad 2: Geolocalización por IP
  const countryCode = detectCountryFromIP(request);
  if (countryCode) {
    const locale = isSpanishSpeakingCountry(countryCode) ? 'es' : 'en';
    log.info({
      locale,
      country: countryCode,
      source: 'geolocation',
      requestId
    }, 'Locale detected from geolocation');
    return locale;
  }

  // Prioridad 3: Header Accept-Language
  const browserLocale = detectLanguageFromAcceptLanguage(request);
  if (browserLocale) {
    log.info({
      locale: browserLocale,
      source: 'accept-language',
      requestId
    }, 'Locale detected from Accept-Language header');
    return browserLocale;
  }

  // Default: Spanish
  log.info({
    locale: defaultLocale,
    source: 'default',
    requestId
  }, 'Using default locale');
  return defaultLocale;
}

/**
 * Verifica si la ruta actual ya tiene un prefijo de locale
 *
 * @param pathname - Ruta actual
 * @returns true si la ruta ya tiene prefijo de locale
 */
export function hasLocalePrefix(pathname: string): boolean {
  return locales.some(locale =>
    pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
}

/**
 * Extrae el locale de una ruta que tiene prefijo de locale
 *
 * @param pathname - Ruta con prefijo de locale
 * @returns Locale extraído o null
 */
export function getLocaleFromPathname(pathname: string): Locale | null {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return null;
}

/**
 * Agrega el prefijo de locale a una ruta
 *
 * @param pathname - Ruta sin prefijo
 * @param locale - Locale a agregar
 * @returns Ruta con prefijo de locale
 */
export function addLocalePrefix(pathname: string, locale: Locale): string {
  // Si ya tiene prefijo, no agregar otro
  if (hasLocalePrefix(pathname)) {
    return pathname;
  }

  // Asegurar que pathname empiece con /
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;

  return `/${locale}${normalizedPathname}`;
}
