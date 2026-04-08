/**
 * Weather Service using Open-Meteo API
 *
 * Open-Meteo es completamente gratuito, sin necesidad de API key
 * https://open-meteo.com/
 *
 * Proporciona información básica del clima para agregar contexto
 * a las conversaciones del agente.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('WeatherService');

// Weather cache (1 hour duration)
const weatherCache = new Map<string, { data: WeatherData; expiresAt: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora en ms

export interface WeatherData {
  temperature: number; // °C
  weatherCode: number; // WMO Weather interpretation code
  weatherDescription: string; // Human-readable description
  windSpeed: number; // km/h
  humidity: number; // %
  isDay: boolean; // true if daytime
  location: string; // City name for reference
}

export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

// Ubicaciones pre-configuradas de Argentina (principales ciudades)
export const ARGENTINA_CITIES: Record<string, Location> = {
  'Buenos Aires': { latitude: -34.6037, longitude: -58.3816, city: 'Buenos Aires', country: 'Argentina' },
  'Córdoba': { latitude: -31.4201, longitude: -64.1888, city: 'Córdoba', country: 'Argentina' },
  'Rosario': { latitude: -32.9442, longitude: -60.6505, city: 'Rosario', country: 'Argentina' },
  'Mendoza': { latitude: -32.8895, longitude: -68.8458, city: 'Mendoza', country: 'Argentina' },
  'La Plata': { latitude: -34.9205, longitude: -57.9536, city: 'La Plata', country: 'Argentina' },
  'Mar del Plata': { latitude: -38.0055, longitude: -57.5426, city: 'Mar del Plata', country: 'Argentina' },
  'Salta': { latitude: -24.7821, longitude: -65.4232, city: 'Salta', country: 'Argentina' },
  'Tucumán': { latitude: -26.8083, longitude: -65.2176, city: 'Tucumán', country: 'Argentina' },
  'Bariloche': { latitude: -41.1335, longitude: -71.3103, city: 'Bariloche', country: 'Argentina' },
};

/**
 * WMO Weather interpretation codes
 * https://open-meteo.com/en/docs
 */
function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Despejado',
    1: 'Mayormente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Neblina',
    48: 'Niebla con escarcha',
    51: 'Llovizna ligera',
    53: 'Llovizna moderada',
    55: 'Llovizna intensa',
    61: 'Lluvia ligera',
    63: 'Lluvia moderada',
    65: 'Lluvia intensa',
    71: 'Nevada ligera',
    73: 'Nevada moderada',
    75: 'Nevada intensa',
    77: 'Granizo',
    80: 'Chubascos ligeros',
    81: 'Chubascos moderados',
    82: 'Chubascos intensos',
    85: 'Chubascos de nieve ligeros',
    86: 'Chubascos de nieve intensos',
    95: 'Tormenta',
    96: 'Tormenta con granizo ligero',
    99: 'Tormenta con granizo intenso',
  };

  return descriptions[code] || 'Desconocido';
}

/**
 * Fetch weather from Open-Meteo API
 */
export async function getWeather(location: Location): Promise<WeatherData | null> {
  const cacheKey = `${location.latitude},${location.longitude}`;

  // Check cache first
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    log.debug({ location: location.city }, 'Weather data from cache');
    return cached.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
      log.error({ status: response.status, statusText: response.statusText, location }, 'Failed to fetch weather from Open-Meteo');
      return null;
    }

    const data = await response.json();

    const weatherData: WeatherData = {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      weatherDescription: getWeatherDescription(data.current.weather_code),
      windSpeed: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
      isDay: data.current.is_day === 1,
      location: location.city || 'Unknown',
    };

    // Cache result
    weatherCache.set(cacheKey, {
      data: weatherData,
      expiresAt: Date.now() + CACHE_DURATION,
    });

    log.info({ location: location.city, temperature: weatherData.temperature }, 'Fetched weather data');

    return weatherData;
  } catch (error) {
    log.error({ error, location }, 'Error fetching weather data');
    return null;
  }
}

/**
 * Build weather context for system prompt
 */
export function buildWeatherPrompt(weather: WeatherData): string {
  let prompt = `\n## Contexto del Clima\n`;
  prompt += `Ubicación: ${weather.location}\n`;
  prompt += `Temperatura: ${weather.temperature}°C\n`;
  prompt += `Clima: ${weather.weatherDescription}\n`;
  prompt += `Viento: ${weather.windSpeed} km/h\n`;
  prompt += `Humedad: ${weather.humidity}%\n`;
  prompt += `Es de ${weather.isDay ? 'día' : 'noche'}\n`;

  // Contextual suggestions based on weather
  if (weather.temperature < 10) {
    prompt += `\nConsejo: Hace frío, el usuario podría agradecer un recordatorio de abrigarse.\n`;
  } else if (weather.temperature > 30) {
    prompt += `\nConsejo: Hace calor, el usuario podría apreciar consejos de hidratación.\n`;
  }

  if (weather.weatherCode >= 61 && weather.weatherCode <= 65) {
    prompt += `Consejo: Está lloviendo, el usuario podría necesitar llevar paraguas.\n`;
  }

  if (weather.weatherCode >= 95) {
    prompt += `Consejo: Hay tormenta, muestra preocupación por la seguridad del usuario.\n`;
  }

  prompt += `\nUSO: Menciona el clima solo si es relevante o el usuario pregunta. No fuerces el tema.`;

  return prompt;
}

/**
 * Get weather for user's location
 * Returns null if location not configured
 */
export async function getUserWeather(userLocation?: string): Promise<WeatherData | null> {
  if (!userLocation) {
    log.debug('No user location configured');
    return null;
  }

  // Check if it's a known Argentine city
  const location = ARGENTINA_CITIES[userLocation];
  if (!location) {
    log.warn({ userLocation }, 'Unknown city, cannot fetch weather');
    return null;
  }

  return getWeather(location);
}
