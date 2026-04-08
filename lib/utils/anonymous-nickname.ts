/**
 * Anonymous Nickname Generator
 *
 * Generates consistent and friendly nicknames for unauthenticated users
 * Similar to Discord guest names: "Adjective + Animal + #number"
 *
 * Examples: "Curious Fox #3421", "Swift Eagle #9182", "Brave Wolf #7654"
 */

const adjectives = [
  'Curious', 'Swift', 'Brave', 'Clever', 'Silent', 'Bright', 'Bold', 'Calm',
  'Daring', 'Eager', 'Fierce', 'Gentle', 'Happy', 'Jolly', 'Kind', 'Lively',
  'Mighty', 'Noble', 'Quick', 'Quiet', 'Rapid', 'Sharp', 'Smart', 'Strong',
  'Wise', 'Young', 'Zesty', 'Active', 'Agile', 'Alert', 'Astute', 'Awake',
];

const animals = [
  'Fox', 'Eagle', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Hawk', 'Owl',
  'Panda', 'Lynx', 'Falcon', 'Raven', 'Phoenix', 'Dragon', 'Shark', 'Whale',
  'Dolphin', 'Penguin', 'Koala', 'Jaguar', 'Panther', 'Leopard', 'Cheetah', 'Cobra',
  'Viper', 'Python', 'Gecko', 'Turtle', 'Otter', 'Badger', 'Raccoon', 'Squirrel',
];

/**
 * Generate simple numeric hash from string
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate consistent anonymous nickname based on identifier
 *
 * @param identifier - Unique identifier (ex: sessionId, IP hash, fingerprint)
 * @param short - If true, only returns number without adjective+animal
 * @returns Nickname in format "Adjective Animal #number" or "Anonymous #number"
 *
 * @example
 * ```ts
 * generateAnonymousNickname('session-abc-123') // "Curious Fox #3421"
 * generateAnonymousNickname('session-xyz-789') // "Swift Eagle #9182"
 * generateAnonymousNickname('session-abc-123', true) // "Anonymous #3421"
 * ```
 */
export function generateAnonymousNickname(identifier: string, short: boolean = false): string {
  const hash = simpleHash(identifier);

  // Generate 4-digit number
  const number = (hash % 10000).toString().padStart(4, '0');

  if (short) {
    return `Anónimo #${number}`;
  }

  // Seleccionar adjetivo y animal basado en el hash
  const adjectiveIndex = hash % adjectives.length;
  const animalIndex = Math.floor(hash / adjectives.length) % animals.length;

  const adjective = adjectives[adjectiveIndex];
  const animal = animals[animalIndex];

  return `${adjective} ${animal} #${number}`;
}

/**
 * Genera un identificador de sesión para usuario anónimo
 * Combina fingerprint del navegador con timestamp
 *
 * @returns Identificador único de sesión
 */
export function generateAnonymousSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: generar random
    return `anon-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  // Client-side: basic browser fingerprint
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|');

  const hash = simpleHash(fingerprint);
  return `anon-${hash}`;
}

/**
 * Obtiene o crea el nickname anónimo para la sesión actual
 * Almacena en localStorage para consistencia
 *
 * @param short - Si true, usa formato corto "Anónimo #número"
 * @returns Nickname anónimo para la sesión actual
 */
export function getOrCreateAnonymousNickname(short: boolean = false): string {
  if (typeof window === 'undefined') {
    // Server-side: generar temporal
    return generateAnonymousNickname(Date.now().toString(), short);
  }

  const STORAGE_KEY = 'anonymous_nickname';
  const SESSION_ID_KEY = 'anonymous_session_id';

  // Intentar obtener nickname existente
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return stored;
  }

  // Generate nuevo nickname
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateAnonymousSessionId();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  const nickname = generateAnonymousNickname(sessionId, short);
  localStorage.setItem(STORAGE_KEY, nickname);

  return nickname;
}

/**
 * Limpia el nickname anónimo almacenado
 * Útil al hacer logout o limpiar sesión
 */
export function clearAnonymousNickname(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('anonymous_nickname');
    localStorage.removeItem('anonymous_session_id');
  }
}

/**
 * Hook para obtener el nickname del usuario actual
 * Devuelve nickname real si está autenticado, o anónimo si no
 *
 * @example
 * ```tsx
 * const UserDisplay = () => {
 *   const { nickname, isAnonymous } = useUserNickname();
 *   return <div>{nickname} {isAnonymous && '(invitado)'}</div>;
 * };
 * ```
 */
export interface UserNicknameResult {
  nickname: string;
  isAnonymous: boolean;
  userId?: string;
}

/**
 * Obtiene datos de usuario para mostrar en UI
 * Compatible con usuarios autenticados y anónimos
 */
export function getUserDisplayData(
  user: { id: string; name?: string | null; email?: string } | null | undefined,
  short: boolean = false
): UserNicknameResult {
  if (user?.id) {
    return {
      nickname: user.name || user.email?.split('@')[0] || 'Usuario',
      isAnonymous: false,
      userId: user.id,
    };
  }

  return {
    nickname: getOrCreateAnonymousNickname(short),
    isAnonymous: true,
  };
}
