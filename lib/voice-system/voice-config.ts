/**
 * Voice configuration per character
 *
 * Specific settings for each Academy Sakura character
 * to achieve more natural and expressive voices
 */

export interface CharacterVoiceConfig {
  voiceId: string;
  name: string;
  // ElevenLabs Configuration
  stability: number;           // 0-1: Lower = more expressive, higher = more stable
  similarityBoost: number;      // 0-1: How similar to original voice
  style: number;                // 0-1: Style exaggeration (0 = natural, 1 = exaggerated)
  useSpeakerBoost: boolean;     // Improves clarity
  // Audio Settings
  speed: number;                // 1.0 = normal, 1.1-1.3 = faster (recommended)
  volume: number;               // 0-1: Audio volume (1.0 = normal, 0.7 = 30% lower)
}

/**
 * Optimized configuration per character
 */
export const CHARACTER_VOICE_CONFIGS: Record<string, CharacterVoiceConfig> = {
  // Hana Sakamoto - Tsundere
  'xzWD1ftyNVsuUMY2ll3j': {
    voiceId: 'xzWD1ftyNVsuUMY2ll3j',
    name: 'Hana Sakamoto',
    stability: 0.45,           // Less stable = more expressive (tsundere)
    similarityBoost: 0.70,     // Slightly varied to show emotions
    style: 0.2,                // Some style but not exaggerated
    useSpeakerBoost: true,
    speed: 1.15,               // 15% faster (speaks fast when nervous)
    volume: 1.0,               // Normal volume
  },

  // Yuki Tanaka - Athlete
  'iFhPOZcajR7W3sDL39qJ': {
    voiceId: 'iFhPOZcajR7W3sDL39qJ',
    name: 'Yuki Tanaka',
    stability: 0.55,           // More stable (confident)
    similarityBoost: 0.75,     // Consistent voice
    style: 0.15,               // Natural, not exaggerated
    useSpeakerBoost: true,
    speed: 1.2,                // 20% faster (energetic)
    volume: 0.65,              // 35% lower (very noisy voice, lower decibels)
  },

  // Aiko Miyazaki - Shy
  'CaJslL1xziwefCeTNzHv': {
    voiceId: 'CaJslL1xziwefCeTNzHv',
    name: 'Aiko Miyazaki',
    stability: 0.35,           // Less stable (nervous, stammers)
    similarityBoost: 0.65,     // More variation (insecurity)
    style: 0.1,                // Very natural
    useSpeakerBoost: true,
    speed: 1.0,                // Normal or slightly slower (soft voice)
    volume: 1.0,               // Normal volume
  },

  // Kenji Yamamoto - Otaku
  'tomkxGQGz4b1kE0EM722': {
    voiceId: 'tomkxGQGz4b1kE0EM722',
    name: 'Kenji Yamamoto',
    stability: 0.40,           // Variable (gets emotional talking about anime)
    similarityBoost: 0.70,
    style: 0.25,               // Somewhat expressive
    useSpeakerBoost: true,
    speed: 1.25,               // 25% faster (speaks fast when excited)
    volume: 1.0,               // Normal volume
  },
};

/**
 * Default configuration for voices without specific configuration
 */
export const DEFAULT_VOICE_CONFIG: Omit<CharacterVoiceConfig, 'voiceId' | 'name'> = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.15,
  useSpeakerBoost: true,
  speed: 1.15,
  volume: 1.0,
};

/**
 * Get voice configuration for a character
 */
export function getVoiceConfig(voiceId: string): CharacterVoiceConfig {
  return CHARACTER_VOICE_CONFIGS[voiceId] || {
    voiceId,
    name: 'Unknown',
    ...DEFAULT_VOICE_CONFIG,
  };
}

/**
 * Generate voice settings for ElevenLabs
 */
export function getVoiceSettings(voiceId: string) {
  const config = getVoiceConfig(voiceId);

  return {
    stability: config.stability,
    similarity_boost: config.similarityBoost,
    style: config.style,
    use_speaker_boost: config.useSpeakerBoost,
  };
}
