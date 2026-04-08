/**
 * Popular Characters - Curated list of pre-configured characters
 * For zero-friction character creation in Quick Start
 */

import type { GenreId, SubGenreId, ArchetypeId } from '../core/types';

export interface PopularCharacter {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  thumbnailUrl?: string;

  // Genre classification
  suggestedGenre: GenreId;
  suggestedSubgenre?: SubGenreId;
  suggestedArchetype?: ArchetypeId;

  // Search metadata (for fetching full data if needed)
  source: 'anilist' | 'tmdb' | 'custom';
  externalId?: string;

  // Display metadata
  tags: string[];
  popularity: number; // 0-100
  category: 'anime' | 'movie' | 'tv' | 'game' | 'custom';
  gender: 'male' | 'female' | 'other';

  // Pre-configured data (optional, for instant creation)
  preConfigured?: {
    personality: string[];
    background: string;
    age?: string;
    gender?: string;
    occupation?: string;
  };
}

/**
 * Curated list of 12 popular characters
 * Sorted by popularity and category diversity
 */
export const POPULAR_CHARACTERS: PopularCharacter[] = [
  // Anime characters
  {
    id: 'naruto-uzumaki',
    name: 'Naruto Uzumaki',
    description: 'Ninja optimista con sueños de convertirse en Hokage',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Naruto&backgroundColor=ffb74d',
    suggestedGenre: 'roleplay',
    source: 'anilist',
    externalId: '17',
    tags: ['anime', 'shonen', 'ninja', 'optimista'],
    popularity: 98,
    category: 'anime',
    gender: 'male',
  },
  {
    id: 'goku',
    name: 'Son Goku',
    description: 'Guerrero Saiyajin que siempre busca superarse',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Goku&backgroundColor=ff9800',
    suggestedGenre: 'gaming',
    suggestedSubgenre: 'competitive-pro',
    source: 'anilist',
    externalId: '246',
    tags: ['anime', 'shonen', 'martial-arts', 'powerful'],
    popularity: 99,
    category: 'anime',
    gender: 'male',
  },
  {
    id: 'luffy',
    name: 'Monkey D. Luffy',
    description: 'Pirata alegre en busca del One Piece',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Luffy&backgroundColor=e91e63',
    suggestedGenre: 'friendship',
    source: 'anilist',
    externalId: '40',
    tags: ['anime', 'pirate', 'adventure', 'loyal'],
    popularity: 97,
    category: 'anime',
    gender: 'male',
  },
  {
    id: 'light-yagami',
    name: 'Light Yagami',
    description: 'Genio estratega con ambiciones de justicia',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Light&backgroundColor=9c27b0',
    suggestedGenre: 'professional',
    suggestedSubgenre: 'mentor-professional',
    source: 'anilist',
    externalId: '80',
    tags: ['anime', 'intelligent', 'strategic', 'complex'],
    popularity: 95,
    category: 'anime',
    gender: 'male',
  },

  // Movie/TV characters
  {
    id: 'tony-stark',
    name: 'Tony Stark',
    description: 'Genio, millonario, playboy, filántropo',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=TonyStark&backgroundColor=f44336',
    suggestedGenre: 'professional',
    suggestedSubgenre: 'mentor-professional',
    suggestedArchetype: 'senior-advisor',
    source: 'tmdb',
    externalId: '1269',
    tags: ['marvel', 'genius', 'tech', 'billionaire'],
    popularity: 98,
    category: 'movie',
    gender: 'male',
    preConfigured: {
      personality: ['intelligent', 'sarcastic', 'confident', 'innovative', 'protective'],
      background: 'Billionaire inventor and CEO of Stark Industries. Superhero known as Iron Man.',
      age: '48',
      gender: 'male',
      occupation: 'CEO, Inventor, Superhero',
    },
  },
  {
    id: 'hermione-granger',
    name: 'Hermione Granger',
    description: 'Bruja brillante y leal amiga',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Hermione&backgroundColor=795548',
    suggestedGenre: 'friendship',
    source: 'tmdb',
    tags: ['harry-potter', 'intelligent', 'loyal', 'brave'],
    popularity: 96,
    category: 'movie',
    gender: 'female',
  },
  {
    id: 'gandalf',
    name: 'Gandalf',
    description: 'Sabio mago con profundo conocimiento',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Gandalf&backgroundColor=9e9e9e',
    suggestedGenre: 'wellness',
    source: 'tmdb',
    tags: ['lotr', 'wizard', 'wise', 'mentor'],
    popularity: 94,
    category: 'movie',
    gender: 'male',
  },
  {
    id: 'elsa',
    name: 'Elsa',
    description: 'Reina con poderes de hielo y corazón cálido',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Elsa&backgroundColor=00bcd4',
    suggestedGenre: 'romance',
    suggestedSubgenre: 'sweet',
    source: 'tmdb',
    tags: ['disney', 'magical', 'independent', 'caring'],
    popularity: 93,
    category: 'movie',
    gender: 'female',
  },

  // Gaming characters
  {
    id: 'cloud-strife',
    name: 'Cloud Strife',
    description: 'Mercenario espadachín con pasado misterioso',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Cloud&backgroundColor=3f51b5',
    suggestedGenre: 'gaming',
    source: 'custom',
    tags: ['ff7', 'jrpg', 'swordsman', 'brooding'],
    popularity: 92,
    category: 'game',
    gender: 'male',
  },
  {
    id: 'lara-croft',
    name: 'Lara Croft',
    description: 'Arqueóloga aventurera y atlética',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lara&backgroundColor=4caf50',
    suggestedGenre: 'roleplay',
    source: 'custom',
    tags: ['tomb-raider', 'adventure', 'athletic', 'brave'],
    popularity: 91,
    category: 'game',
    gender: 'female',
  },

  // Custom/original characters
  {
    id: 'sophie-muller',
    name: 'Sophie Müller',
    description: 'Fotógrafa alemana con amor por la naturaleza',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sophie&backgroundColor=8bc34a',
    suggestedGenre: 'romance',
    suggestedSubgenre: 'sweet',
    suggestedArchetype: 'gentle-soul',
    source: 'custom',
    tags: ['photography', 'nature', 'sweet', 'caring'],
    popularity: 85,
    category: 'custom',
    gender: 'female',
    preConfigured: {
      personality: ['empathetic', 'creative', 'gentle', 'observant', 'romantic'],
      background: 'Professional photographer from Berlin who finds beauty in nature and human connection.',
      age: '26',
      gender: 'female',
      occupation: 'Professional Photographer',
    },
  },
  {
    id: 'spider-man',
    name: 'Spider-Man',
    description: 'Héroe vecinal con grandes responsabilidades',
    imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=SpiderMan&backgroundColor=f44336',
    suggestedGenre: 'friendship',
    source: 'tmdb',
    externalId: '1930',
    tags: ['marvel', 'hero', 'friendly', 'responsible'],
    popularity: 97,
    category: 'movie',
    gender: 'male',
  },
];

/**
 * Get character by ID
 */
export function getPopularCharacter(id: string): PopularCharacter | undefined {
  return POPULAR_CHARACTERS.find(char => char.id === id);
}

/**
 * Get characters by category
 */
export function getCharactersByCategory(category: PopularCharacter['category']): PopularCharacter[] {
  return POPULAR_CHARACTERS.filter(char => char.category === category);
}

/**
 * Get top N most popular characters
 */
export function getTopCharacters(limit: number = 8): PopularCharacter[] {
  return [...POPULAR_CHARACTERS]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

/**
 * Search characters by name or tags
 */
export function searchPopularCharacters(query: string): PopularCharacter[] {
  const lowerQuery = query.toLowerCase();
  return POPULAR_CHARACTERS.filter(
    char =>
      char.name.toLowerCase().includes(lowerQuery) ||
      char.description.toLowerCase().includes(lowerQuery) ||
      char.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
