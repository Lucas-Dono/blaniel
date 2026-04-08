/**
 * URL validation to prevent Open Redirect vulnerability
 *
 * OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
 */

/**
 * List of allowed protocols
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Dangerous patterns that should always be blocked
 */
const DANGEROUS_PATTERNS = [
  /^javascript:/i,
  /^data:/i,
  /^vbscript:/i,
  /^file:/i,
  /^about:/i,
];

/**
 * Validate if a URL is safe to redirect to
 *
 * Criteria:
 * 1. Must be a relative URL (without domain) or from the same origin
 * 2. Must not use dangerous protocols (javascript:, data:, etc.)
 * 3. Must not attempt bypass with // (protocol-relative URLs to external domains)
 *
 * @param url - URL to validate
 * @param allowedOrigin - Allowed origin (default: window.location.origin or process.env.NEXTAUTH_URL)
 * @returns true if URL is safe, false if dangerous
 *
 * @example
 * isValidRedirectUrl('/dashboard') // true - relative URL
 * isValidRedirectUrl('https://myapp.com/profile') // true - same origin
 * isValidRedirectUrl('https://evil.com') // false - external domain
 * isValidRedirectUrl('//evil.com') // false - external protocol-relative
 * isValidRedirectUrl('javascript:alert(1)') // false - XSS
 */
export function isValidRedirectUrl(url: string, allowedOrigin?: string): boolean {
  // Basic validation
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Trim whitespace
  url = url.trim();

  // Block empty URLs
  if (url.length === 0) {
    return false;
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(url)) {
      console.warn('[SECURITY] Blocked dangerous URL pattern:', url);
      return false;
    }
  }

  // Relative URLs are always safe (start with /, but not //)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  // Determine allowed origin
  const origin = allowedOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';

  try {
    // Try to parse as absolute URL
    const parsedUrl = new URL(url, origin);

    // Check that protocol is allowed
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      console.warn('[SECURITY] Blocked URL with disallowed protocol:', parsedUrl.protocol);
      return false;
    }

    // Verificar que el origin sea el mismo
    const parsedOrigin = new URL(origin);
    const isSameOrigin = parsedUrl.origin === parsedOrigin.origin;

    if (!isSameOrigin) {
      console.warn('[SECURITY] Blocked URL with different origin:', {
        url: parsedUrl.origin,
        expected: parsedOrigin.origin,
      });
      return false;
    }

    return true;
  } catch (error) {
    // Si no se puede parsear, es probablemente inválida
    console.warn('[SECURITY] Failed to parse URL:', url, error);
    return false;
  }
}

/**
 * Sanitizar URL de redirect para uso seguro
 *
 * Si la URL es válida, la retorna. Si no, retorna una URL por defecto.
 *
 * @param url - URL a sanitizar
 * @param defaultUrl - URL por defecto si la validación falla (default: '/dashboard')
 * @param allowedOrigin - Origin permitido
 * @returns URL segura
 *
 * @example
 * sanitizeRedirectUrl('/profile') // '/profile'
 * sanitizeRedirectUrl('//evil.com') // '/dashboard'
 * sanitizeRedirectUrl('javascript:alert(1)') // '/dashboard'
 * sanitizeRedirectUrl('https://evil.com', '/home') // '/home'
 */
export function sanitizeRedirectUrl(
  url: string | null | undefined,
  defaultUrl: string = '/dashboard',
  allowedOrigin?: string
): string {
  // Si no hay URL, usar default
  if (!url) {
    return defaultUrl;
  }

  // Validate URL
  if (isValidRedirectUrl(url, allowedOrigin)) {
    return url;
  }

  // URL inválida, usar default
  console.warn('[SECURITY] Invalid redirect URL blocked, using default:', {
    attempted: url,
    default: defaultUrl,
  });

  return defaultUrl;
}

/**
 * Obtener callbackUrl segura de URL search params
 *
 * @param searchParams - URLSearchParams o string
 * @param defaultUrl - URL por defecto
 * @returns URL segura para callback
 *
 * @example
 * const params = new URLSearchParams('?callbackUrl=/profile');
 * getSecureCallbackUrl(params) // '/profile'
 *
 * const params2 = new URLSearchParams('?callbackUrl=https://evil.com');
 * getSecureCallbackUrl(params2) // '/dashboard'
 */
export function getSecureCallbackUrl(
  searchParams: URLSearchParams | string | null | undefined,
  defaultUrl: string = '/dashboard'
): string {
  if (!searchParams) {
    return defaultUrl;
  }

  // Convertir a URLSearchParams si es string
  const params = typeof searchParams === 'string'
    ? new URLSearchParams(searchParams)
    : searchParams;

  const callbackUrl = params.get('callbackUrl');

  return sanitizeRedirectUrl(callbackUrl, defaultUrl);
}
