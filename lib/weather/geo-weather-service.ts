// @ts-ignore - ngeohash no tiene tipos disponibles
import geohash from "ngeohash";
import type {
  SimpleWeather,
  WeatherZone,
  CityCoordinates,
  GeocodingResult,
  WeatherAPIResponse,
} from "./types";

// Cache by geographic zone (geohash), not by city
const zoneCache = new Map<string, WeatherZone>();

// Cache de coordenadas de ciudades (para evitar geocoding repetido)
const cityCoordinatesCache = new Map<string, CityCoordinates>();

// Tracking de popularidad para TTL adaptativo
const zonePopularity = new Map<string, number>();

/**
 * Obtiene el clima para un agente basado en su ubicación.
 * Usa sistema de geohash para agrupar ubicaciones cercanas y reducir llamadas API.
 *
 * @param agentId - ID del agente
 * @param city - Ciudad del agente
 * @param country - País del agente
 * @returns Información del clima actual
 */
export async function getWeatherForAgent(
  agentId: string,
  city: string,
  country: string
): Promise<SimpleWeather> {
  try {
    // 1. Get city coordinates (cache this too)
    const coords = await getCityCoordinates(city, country);

    // 2. Convertir a geohash (precision 4 = ~20km cuadrados)
    const zone = geohash.encode(coords.latitude, coords.longitude, 4);

    // 3. Verificar cache por ZONA, no por ciudad
    const cached = zoneCache.get(zone);

    if (cached && cached.expires > Date.now()) {
      // Cache hit - 0 llamadas API
      return cached.weather;
    }

    // 4. Obtener clima para esta zona
    const weather = await fetchWeatherForZone(coords.latitude, coords.longitude, city, country, zone);

    // 5. Cachear con TTL adaptativo
    const ttl = getAdaptiveTTL(zone);
    zoneCache.set(zone, {
      geohash: zone,
      weather,
      expires: Date.now() + ttl,
      activeAgents: zonePopularity.get(zone) || 0,
    });

    return weather;
  } catch (error) {
    console.error("Error getting weather for agent:", error);
    // Fallback to generic weather
    const coords = await getCityCoordinates(city, country).catch(() => ({
      latitude: 0,
      longitude: 0,
      expires: Date.now()
    }));
    return getClimateFallback(coords.latitude, coords.longitude, city, country);
  }
}

/**
 * TTL adaptativo: zonas populares se actualizan más seguido
 */
function getAdaptiveTTL(zone: string): number {
  const popularity = zonePopularity.get(zone) || 0;

  if (popularity > 1000) return 15 * 60 * 1000; // 15 min (Nueva York, Londres, Tokyo)
  if (popularity > 100) return 30 * 60 * 1000; // 30 min (ciudades grandes)
  if (popularity > 10) return 60 * 60 * 1000; // 1 hora (ciudades medianas)
  return 2 * 60 * 60 * 1000; // 2 horas (ciudades pequeñas)
}

/**
 * Trackear conversación activa en una zona (aumenta prioridad de actualización)
 */
export function trackActiveConversation(agentId: string, zone: string) {
  const current = zonePopularity.get(zone) || 0;
  zonePopularity.set(zone, current + 1);
}

/**
 * Dejar de trackear conversación activa
 */
export function untrackActiveConversation(agentId: string, zone: string) {
  const current = zonePopularity.get(zone) || 0;
  zonePopularity.set(zone, Math.max(0, current - 1));
}

/**
 * Obtiene coordenadas de una ciudad con cache permanente (30 días)
 */
async function getCityCoordinates(city: string, country: string): Promise<CityCoordinates> {
  const key = `${city},${country}`;
  const cached = cityCoordinatesCache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached;
  }

  try {
    // Geocoding usando Open-Meteo (gratis)
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1&language=en`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data: GeocodingResult = await response.json();

    if (!data.results?.[0]) {
      throw new Error(`City not found: ${city}, ${country}`);
    }

    const coords: CityCoordinates = {
      latitude: data.results[0].latitude,
      longitude: data.results[0].longitude,
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // Cache 30 días
    };

    cityCoordinatesCache.set(key, coords);
    return coords;
  } catch (error) {
    console.error("Geocoding error:", error);
    // Fallback: approximate coordinates by country/region
    return getFallbackCoordinates(country);
  }
}

/**
 * Obtiene clima real de Open-Meteo API para una zona geográfica
 */
async function fetchWeatherForZone(
  latitude: number,
  longitude: number,
  city: string,
  country: string,
  zone: string
): Promise<SimpleWeather> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${latitude}&longitude=${longitude}&` +
        `current_weather=true&timezone=auto`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data: WeatherAPIResponse = await response.json();
    const current = data.current_weather;

    return {
      temperature: Math.round(current.temperature),
      condition: mapWeatherCode(current.weathercode),
      description: getSimpleDescription(current.weathercode, current.temperature),
      city,
      country,
      localTime: new Date().toLocaleTimeString("es-AR", {
        timeZone: data.timezone,
        hour: "2-digit",
        minute: "2-digit",
      }),
      geohash: zone,
    };
  } catch (error) {
    console.error("Weather API fetch error:", error);
    // Fallback: generic weather by latitude
    return getClimateFallback(latitude, longitude, city, country);
  }
}

/**
 * Mapea código de clima WMO a condición simple
 * WMO Weather codes: https://open-meteo.com/en/docs
 */
function mapWeatherCode(code: number): SimpleWeather["condition"] {
  if (code === 0) return "sunny"; // Clear sky
  if (code <= 3) return "cloudy"; // Partly cloudy
  if (code <= 67) return "rainy"; // Rain
  if (code <= 77) return "snowy"; // Snow
  if (code >= 95) return "stormy"; // Thunderstorm
  return "cloudy";
}

/**
 * Genera descripción simple del clima en español
 */
function getSimpleDescription(code: number, temp: number): string {
  const condition = mapWeatherCode(code);

  const descriptions: Record<SimpleWeather["condition"], string> = {
    sunny: `soleado y ${temp > 25 ? "caluroso" : temp < 10 ? "fresco" : "agradable"}`,
    cloudy: `nublado y ${temp > 20 ? "templado" : "fresco"}`,
    rainy: `lluvioso${temp < 10 ? " y frío" : ""}`,
    snowy: "nevando",
    stormy: "tormentoso",
  };

  return descriptions[condition];
}

/**
 * Fallback inteligente basado en latitud y época del año
 * Usado cuando la API falla o no hay datos disponibles
 */
function getClimateFallback(
  latitude: number,
  longitude: number,
  city: string,
  country: string
): SimpleWeather {
  const absLat = Math.abs(latitude);
  const month = new Date().getMonth(); // 0-11

  // Determinar si es verano (hemisferio sur: invertir estaciones)
  const isSummer =
    latitude < 0
      ? month >= 11 || month <= 2 // Dic-Feb en hemisferio sur
      : month >= 5 && month <= 8; // Jun-Ago en hemisferio norte

  let temp = 20;
  let condition: SimpleWeather["condition"] = "cloudy";

  // Clima aproximado por latitud
  if (absLat < 23.5) {
    // Trópicos: caluroso todo el año
    temp = isSummer ? 32 : 28;
    condition = "sunny";
  } else if (absLat < 45) {
    // Templado
    temp = isSummer ? 25 : 12;
    condition = isSummer ? "sunny" : "cloudy";
  } else if (absLat < 66.5) {
    // Cold
    temp = isSummer ? 18 : -5;
    condition = isSummer ? "cloudy" : "snowy";
  } else {
    // Polar
    temp = isSummer ? 5 : -20;
    condition = "snowy";
  }

  return {
    temperature: temp,
    condition,
    description: getSimpleDescription(0, temp),
    city,
    country,
    localTime: new Date().toLocaleTimeString(),
    geohash: geohash.encode(latitude, longitude, 4),
  };
}

/**
 * Coordenadas de fallback por país (capitales)
 */
function getFallbackCoordinates(country: string): CityCoordinates {
  const capitals: Record<string, { latitude: number; longitude: number }> = {
    Russia: { latitude: 55.7558, longitude: 37.6173 }, // Moscow
    USA: { latitude: 38.9072, longitude: -77.0369 }, // Washington DC
    Japan: { latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    Argentina: { latitude: -34.6037, longitude: -58.3816 }, // Buenos Aires
    UK: { latitude: 51.5074, longitude: -0.1278 }, // London
    France: { latitude: 48.8566, longitude: 2.3522 }, // Paris
    Germany: { latitude: 52.52, longitude: 13.405 }, // Berlin
    Spain: { latitude: 40.4168, longitude: -3.7038 }, // Madrid
    Italy: { latitude: 41.9028, longitude: 12.4964 }, // Rome
    Brazil: { latitude: -15.7975, longitude: -47.8919 }, // Brasília
    Mexico: { latitude: 19.4326, longitude: -99.1332 }, // Mexico City
    Canada: { latitude: 45.4215, longitude: -75.6972 }, // Ottawa
    Australia: { latitude: -35.2809, longitude: 149.13 }, // Canberra
    China: { latitude: 39.9042, longitude: 116.4074 }, // Beijing
    India: { latitude: 28.6139, longitude: 77.209 }, // New Delhi
    "South Korea": { latitude: 37.5665, longitude: 126.978 }, // Seoul
  };

  const coords = capitals[country] || { latitude: 0, longitude: 0 }; // Ecuador como último fallback

  return {
    ...coords,
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
}

/**
 * Formatea el contexto de clima para incluir en el prompt del chat
 */
export function formatWeatherContext(weather: SimpleWeather): string {
  const emoji = {
    sunny: "☀️",
    cloudy: "☁️",
    rainy: "🌧️",
    snowy: "❄️",
    stormy: "⛈️",
  }[weather.condition];

  return `
## ${emoji} CLIMA ACTUAL EN TU UBICACIÓN

**${weather.city}, ${weather.country}** - ${weather.localTime} (hora local)
- Temperatura: ${weather.temperature}°C
- Condición: ${weather.description}

**IMPORTANTE:**
- Este es el clima REAL en tu ciudad AHORA MISMO
- Si mencionas el clima, el clima exterior, o actividades al aire libre, usa esta información
- No inventes clima, usa solo lo que dice arriba
- Menciónalo naturalmente solo si es relevante a la conversación

Ejemplos de cuándo mencionarlo:
✅ Usuario pregunta sobre el clima
✅ Hablas de salir a caminar/correr/ejercicio al aire libre
✅ Hablas de tu día y el clima afectó tus planes
✅ Mencionas ventanas abiertas/cerradas, ropa que usas, etc.
❌ No lo fuerces si no es relevante
`;
}

/**
 * Limpia caches viejos (ejecutar periódicamente)
 */
export function cleanupWeatherCaches() {
  const now = Date.now();

  // Limpiar zonas expiradas
  for (const [key, value] of zoneCache.entries()) {
    if (value.expires < now) {
      zoneCache.delete(key);
    }
  }

  // Limpiar coordenadas expiradas
  for (const [key, value] of cityCoordinatesCache.entries()) {
    if (value.expires < now) {
      cityCoordinatesCache.delete(key);
    }
  }

  // Limpiar popularidad de zonas sin actividad reciente
  for (const [key, value] of zonePopularity.entries()) {
    if (value === 0) {
      zonePopularity.delete(key);
    }
  }
}

// Limpiar caches cada 1 hora
setInterval(cleanupWeatherCaches, 60 * 60 * 1000);
