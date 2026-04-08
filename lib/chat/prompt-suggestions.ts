/**
 * PROMPT SUGGESTIONS SYSTEM
 * Contextual prompt suggestions system
 *
 * Generates intelligent prompts based on:
 * - Agent type
 * - Personality
 * - Conversation context
 * - Time of day
 */

export interface PromptSuggestion {
  id: string;
  text: string;
  category: 'greeting' | 'question' | 'creative' | 'roleplay' | 'deep' | 'fun';
  icon?: string;
}

export interface Agent {
  id: string;
  name: string;
  personality?: string;
  backstory?: string;
  occupation?: string;
  interests?: string[];
}

/**
 * Generates suggested prompts based on agent
 */
export function generatePromptSuggestions(agent: Agent): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];

  // 1. GREETING - Always include contextual greeting
  suggestions.push(getContextualGreeting(agent));

  // 2. PERSONALITY-BASED - Based on personality
  if (agent.personality) {
    suggestions.push(...getPersonalityPrompts(agent));
  }

  // 3. OCCUPATION-BASED - Based on occupation
  if (agent.occupation) {
    suggestions.push(...getOccupationPrompts(agent));
  }

  // 4. INTERESTS-BASED - Based on interests
  if (agent.interests && agent.interests.length > 0) {
    suggestions.push(...getInterestPrompts(agent));
  }

  // 5. GENERIC ENGAGING - Generic but interesting prompts
  suggestions.push(...getGenericPrompts(agent));

  // Mix and limit to 4-6 suggestions
  return shuffleAndLimit(suggestions, 4);
}

/** Contextual greeting based on time of day */
function getContextualGreeting(_agent: Agent): PromptSuggestion {
  const hour = new Date().getHours();
  let greeting = '¡Hola!';

  if (hour >= 5 && hour < 12) {
    greeting = '¡Buenos días!';
  } else if (hour >= 12 && hour < 19) {
    greeting = '¡Buenas tardes!';
  } else {
    greeting = '¡Buenas noches!';
  }

  return {
    id: 'greeting',
    text: `${greeting} ¿Cómo estás hoy?`,
    category: 'greeting',
    icon: '👋',
  };
}

/**
 * Personality-based prompts
 */
function getPersonalityPrompts(agent: Agent): PromptSuggestion[] {
  const personality = agent.personality?.toLowerCase() || '';
  const prompts: PromptSuggestion[] = [];

  // Shy/Tímido
  if (personality.includes('shy') || personality.includes('tímid')) {
    prompts.push({
      id: 'shy-1',
      text: '¿Qué te hace sentir más cómodo/a?',
      category: 'deep',
      icon: '💭',
    });
  }

  // Confident/Seguro
  if (personality.includes('confident') || personality.includes('segur')) {
    prompts.push({
      id: 'confident-1',
      text: '¿Cuál es tu mayor logro?',
      category: 'question',
      icon: '⭐',
    });
  }

  // Playful/Juguetón
  if (personality.includes('playful') || personality.includes('juguetón')) {
    prompts.push({
      id: 'playful-1',
      text: '¿Jugamos a algo divertido?',
      category: 'fun',
      icon: '🎮',
    });
  }

  // Mysterious/Misterioso
  if (personality.includes('mysterious') || personality.includes('misterios')) {
    prompts.push({
      id: 'mysterious-1',
      text: '¿Qué secretos guardas?',
      category: 'deep',
      icon: '🔮',
    });
  }

  // Romantic/Romántico
  if (personality.includes('romantic') || personality.includes('romántic')) {
    prompts.push({
      id: 'romantic-1',
      text: '¿Qué es lo más romántico que has hecho?',
      category: 'deep',
      icon: '💕',
    });
  }

  // Intelligent/Inteligente
  if (personality.includes('intelligent') || personality.includes('inteligent')) {
    prompts.push({
      id: 'intelligent-1',
      text: '¿Qué opinas sobre [tema actual]?',
      category: 'question',
      icon: '🧠',
    });
  }

  return prompts;
}

/** Prompts based on occupation */
function getOccupationPrompts(agent: Agent): PromptSuggestion[] {
  const occupation = agent.occupation?.toLowerCase() || '';
  const prompts: PromptSuggestion[] = [];

  // Teacher/Profesor
  if (occupation.includes('teacher') || occupation.includes('profesor')) {
    prompts.push({
      id: 'teacher-1',
      text: '¿Puedes enseñarme algo interesante?',
      category: 'question',
      icon: '📚',
    });
  }

  // Artist/Artista
  if (occupation.includes('artist') || occupation.includes('artista')) {
    prompts.push({
      id: 'artist-1',
      text: '¿Cuál es tu obra favorita?',
      category: 'creative',
      icon: '🎨',
    });
  }

  // Doctor/Medical
  if (occupation.includes('doctor') || occupation.includes('médico')) {
    prompts.push({
      id: 'doctor-1',
      text: '¿Cuál fue tu caso más memorable?',
      category: 'question',
      icon: '⚕️',
    });
  }

  // Musician/Músico
  if (occupation.includes('musician') || occupation.includes('músico')) {
    prompts.push({
      id: 'musician-1',
      text: '¿Qué música te inspira?',
      category: 'creative',
      icon: '🎵',
    });
  }

  // Chef/Cocinero
  if (occupation.includes('chef') || occupation.includes('cocinero')) {
    prompts.push({
      id: 'chef-1',
      text: '¿Cuál es tu plato favorito?',
      category: 'question',
      icon: '👨‍🍳',
    });
  }

  return prompts;
}

/**
 * Prompts based on interests
 */
function getInterestPrompts(agent: Agent): PromptSuggestion[] {
  const interests = agent.interests || [];
  const prompts: PromptSuggestion[] = [];

  interests.slice(0, 2).forEach((interest, index) => {
    prompts.push({
      id: `interest-${index}`,
      text: `Cuéntame sobre tu interés en ${interest}`,
      category: 'question',
      icon: '✨',
    });
  });

  return prompts;
}

/** Generic but interesting prompts */
function getGenericPrompts(agent: Agent): PromptSuggestion[] {
  return [
    {
      id: 'generic-story',
      text: `Cuéntame una historia sobre ${agent.name}`,
      category: 'creative',
      icon: '📖',
    },
    {
      id: 'generic-day',
      text: '¿Cómo fue tu día?',
      category: 'question',
      icon: '☀️',
    },
    {
      id: 'generic-dream',
      text: '¿Cuál es tu sueño más grande?',
      category: 'deep',
      icon: '🌟',
    },
    {
      id: 'generic-fun',
      text: '¿Qué te divierte más?',
      category: 'fun',
      icon: '😄',
    },
    {
      id: 'generic-fear',
      text: '¿Qué te da miedo?',
      category: 'deep',
      icon: '😰',
    },
    {
      id: 'generic-adventure',
      text: 'Vamos a vivir una aventura juntos',
      category: 'roleplay',
      icon: '🗺️',
    },
    {
      id: 'generic-secret',
      text: 'Comparte un secreto conmigo',
      category: 'deep',
      icon: '🤫',
    },
    {
      id: 'generic-talent',
      text: '¿Cuál es tu talento oculto?',
      category: 'question',
      icon: '🎭',
    },
  ];
}

/** Randomly mixes and limits the number of suggestions */
function shuffleAndLimit(
  suggestions: PromptSuggestion[],
  limit: number
): PromptSuggestion[] {
  // Ensure there's always a greeting first
  const greeting = suggestions.find((s) => s.category === 'greeting');
  const others = suggestions.filter((s) => s.category !== 'greeting');

  // Mix the others
  const shuffled = others.sort(() => Math.random() - 0.5);

  // Combine: greeting + other mixed
  const result = greeting ? [greeting, ...shuffled] : shuffled;

  return result.slice(0, limit);
}

/** Generates prompts based on the conversation context */
export function generateFollowUpSuggestions(
  lastMessage: string,
  _agent: Agent
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];

  // If the last message was short, suggest digging deeper
  if (lastMessage.length < 50) {
    suggestions.push({
      id: 'followup-more',
      text: 'Cuéntame más sobre eso',
      category: 'question',
      icon: '💬',
    });
  }

  // If emotions were mentioned, suggest exploring them
  const emotions = ['feliz', 'triste', 'enojado', 'asustado', 'emocionado'];
  const hasEmotion = emotions.some((e) => lastMessage.toLowerCase().includes(e));

  if (hasEmotion) {
    suggestions.push({
      id: 'followup-emotion',
      text: '¿Cómo te hace sentir eso?',
      category: 'deep',
      icon: '💭',
    });
  }

  // Always offer to change topic
  suggestions.push({
    id: 'followup-change',
    text: 'Change topic',
    category: 'question',
    icon: '🔄',
  });

  // Suggest something fun
  suggestions.push({
    id: 'followup-fun',
    text: 'Do something fun',
    category: 'fun',
    icon: '🎉',
  });

  return shuffleAndLimit(suggestions, 3);
}

/**
 * Prompts for different special contexts
 */
export const SPECIAL_PROMPTS = {
  FIRST_MESSAGE: [
    {
      id: 'first-intro',
      text: 'Preséntate, ¿quién eres?',
      category: 'greeting' as const,
      icon: '👋',
    },
    {
      id: 'first-interest',
      text: '¿Qué te gusta hacer?',
      category: 'question' as const,
      icon: '❤️',
    },
    {
      id: 'first-story',
      text: 'Cuéntame tu historia',
      category: 'creative' as const,
      icon: '📖',
    },
  ],

  EMPTY_CHAT: [
    {
      id: 'empty-start',
      text: '¡Empecemos a conversar!',
      category: 'greeting' as const,
      icon: '💬',
    },
    {
      id: 'empty-hello',
      text: 'Hola, ¿cómo estás?',
      category: 'greeting' as const,
      icon: '👋',
    },
  ],

  LONG_PAUSE: [
    {
      id: 'pause-back',
      text: '¡He vuelto! ¿Qué hay de nuevo?',
      category: 'greeting' as const,
      icon: '👋',
    },
    {
      id: 'pause-continue',
      text: 'Continuemos donde lo dejamos',
      category: 'question' as const,
      icon: '▶️',
    },
  ],
};

/** Gets prompts based on the context */
export function getContextualPrompts(
  context: 'first' | 'empty' | 'pause',
  agent: Agent
): PromptSuggestion[] {
  switch (context) {
    case 'first':
      return [...SPECIAL_PROMPTS.FIRST_MESSAGE, ...generatePromptSuggestions(agent)].slice(0, 4);
    case 'empty':
      return [...SPECIAL_PROMPTS.EMPTY_CHAT, ...generatePromptSuggestions(agent)].slice(0, 4);
    case 'pause':
      return [...SPECIAL_PROMPTS.LONG_PAUSE, ...generatePromptSuggestions(agent)].slice(0, 3);
    default:
      return generatePromptSuggestions(agent);
  }
}
