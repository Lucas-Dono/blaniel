import { cookies } from 'next/headers';
import { defaultLocale, locales, LOCALE_COOKIE_NAME } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

/**
 * Get the current locale from cookies (set by middleware)
 * Falls back to default locale if not found
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME);

  const locale = localeCookie?.value;

  // Validate locale
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale;
  }

  return defaultLocale;
}

/**
 * Get messages for the current locale
 * Used by the root layout to pass to IntlProvider
 */
export async function getMessages() {
  const locale = await getLocale();

  try {
    const messages = (await import(`@/messages/${locale}.json`)).default;
    return { locale, messages };
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    // Fallback to default locale
    const messages = (await import(`@/messages/${defaultLocale}.json`)).default;
    return { locale: defaultLocale, messages };
  }
}
