export interface SimpleWeather {
  temperature: number;
  condition: "sunny" | "cloudy" | "rainy" | "snowy" | "stormy";
  description: string;
  city: string;
  country: string;
  localTime: string;
  geohash?: string; // Geographic zone (precision 4 = ~20km square)
}

export interface WeatherZone {
  geohash: string;
  weather: SimpleWeather;
  expires: number;
  activeAgents: number; // How many characters are in conversation in this zone
}

export interface CityCoordinates {
  latitude: number;
  longitude: number;
  expires: number;
}

export interface GeocodingResult {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
    country: string;
    timezone: string;
  }>;
}

export interface WeatherAPIResponse {
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
    winddirection: number;
  };
  timezone: string;
}
