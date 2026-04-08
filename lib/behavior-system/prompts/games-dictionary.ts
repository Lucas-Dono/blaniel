/**
 * GAMES AND ACTIVITIES DICTIONARY
 *
 * Dynamic system to avoid repetition.
 * AI has general knowledge, only needs names/concepts.
 *
 * CATEGORIES:
 * 1. casual - Casual games (all contexts)
 * 2. trivia - Knowledge/questions
 * 3. creative - Creativity/roleplay
 * 4. spicy - Spicy but SFW
 * 5. sexual - Explicit NSFW
 * 6. conversation - Conversation activities
 * 7. challenge - Challenges/dares
 */

export type GameCategory =
  | 'casual'
  | 'trivia'
  | 'creative'
  | 'spicy'
  | 'sexual'
  | 'conversation'
  | 'challenge';

export interface Game {
  name: string;
  category: GameCategory;
  nsfwOnly: boolean;
  minRelationship: 'acquaintance' | 'friend' | 'close_friend' | 'intimate';
}

// ════════════════════════════════════════════════════════════════════
// CASUAL GAMES (All contexts)
// ════════════════════════════════════════════════════════════════════

export const CASUAL_GAMES: Game[] = [
  // Universal classics
  { name: "Truth or Dare", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "20 Questions", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Would You Rather?", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Guess the Word", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Two Truths and a Lie", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Never Have I Ever", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Who's Most Likely?", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Complete the Sentence", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Word Association", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Story Building (collaborative story)", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Simon Says", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Hangman", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Pictionary (descriptions)", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Charades by Text", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Categories (Tutti Frutti)", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Guess the Character", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "What's in Common?", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Antonyms and Synonyms", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Improvised Rhymes", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Tell a Nonsense Story", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },

  // Creative
  { name: "Hypothetical Scenario", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Battle of Wits", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Exquisite Corpse", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Dialogue Improvisation", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Make up Silly Songs", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Tell Bad Jokes", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Create Tongue Twisters", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Improvised Poetry", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Rap Battle", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Tell Horror Stories", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Create Urban Legends", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Invent Hybrid Animals", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Create Absurd Superpowers", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Rename Everyday Objects", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Invent Silly Languages", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },

  // Decisions
  { name: "Moral Dilemmas", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Desert Island?", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Rankings and Top 5", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Esto o aquello", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Juego de las prioridades", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Trolley problem variaciones", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "¿Qué salvarías del incendio?", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Ordenar por importancia", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Pick 3 (objetos/personas)", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "FMK (variante SFW)", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Eliminar uno (comidas/series)", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Crear tier list de X", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Hot or cold opinions", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Overrated vs Underrated", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Defend the indefensible", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },

  // Introspection and philosophy
  { name: "Enigmas y acertijos", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Debate filosófico", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hot takes (opiniones polémicas)", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Confesiones anónimas", category: 'casual', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Secretos intercambiados", category: 'casual', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Unpopular opinions", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Change my mind", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Devil's advocate", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Rant session (desahogo)", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Conspiracy theories", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Shower thoughts", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Brain teasers", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Paradojas lógicas", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Preguntas existenciales", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Filosofía de bar", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },

  // Comparaciones y preferencias
  { name: "Perros vs Gatos debate", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Dulce vs Salado", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Mañana vs Noche persona", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Playa vs Montaña", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Ciudad vs Campo", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Verano vs Invierno", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Café vs Té", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Pizza vs Hamburguesa", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Películas vs Series", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Libros vs Películas", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Música vs Silencio", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Introvertido vs Extrovertido", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Planificar vs Improvisar", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Realista vs Idealista", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Pensar vs Sentir", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },

  // Superpowers and fantasy
  { name: "¿Qué superpower elegirías?", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Si fueras invisible por 1 día", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Viajar al pasado o futuro", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Leer mentes vs Teletransporte", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Vivir sin dormir vs sin comer", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Inmortalidad vs Riqueza infinita", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hablar todos los idiomas vs Tocar todos los instrumentos", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Volar vs Respirar bajo agua", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Tener mascota dragón vs fénix", category: 'casual', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Vivir en videojuego vs película", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },

  // Anecdotes and experiences
  { name: "Momentos vergonzosos", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Plot twists de tu vida", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Fails épicos", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Historias de karma", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Coincidencias increíbles", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Casi-desastres", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Anécdotas de viaje", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Historias de familia", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Primera vez que...", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Worst day ever", category: 'casual', nsfwOnly: false, minRelationship: 'friend' },
];

// ════════════════════════════════════════════════════════════════════
// JUEGOS DE TRIVIA (Conocimiento)
// ════════════════════════════════════════════════════════════════════

export const TRIVIA_GAMES: Game[] = [
  // ═══ ENTRETENIMIENTO - CINE & TV ═══
  { name: "Trivia de películas clásicas", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Trivia de Marvel/DC", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Trivia de series de Netflix", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Adivina la película por emoji", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Directores famosos (adivinar películas)", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Actores y sus roles icónicos", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Oscar winners trivia", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Plots de películas mal explicados", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Spoiler challenge", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Plot twist predictor", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Trivia de Disney/Pixar", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Trivia de anime", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Sitcoms clásicas trivia", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Reality shows trivia", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ MÚSICA ═══
  { name: "Trivia de música de los 80s/90s/2000s", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Adivina la canción (por letra)", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Completa la letra", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Artistas por país", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Bandas que se separaron", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "One hit wonders", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Festivales musicales famosos", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Instrumentos musicales raros", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Géneros musicales challenge", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ CIENCIA & NATURALEZA ═══
  { name: "Trivia de astronomía", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Trivia de biología", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Animales extremos (récords)", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Datos curiosos de animales", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Especies extintas", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Planetas y sistema solar", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Inventos científicos", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Científicos famosos", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Elementos de la tabla periódica", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Fenómenos naturales", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ GEOGRAFÍA ═══
  { name: "Capitales del mundo", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Banderas del mundo", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Monumentos famosos", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Países por continente", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Ríos y montañas", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Maravillas del mundo", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Ciudades más pobladas", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Idiomas por país", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ HISTORIA ═══
  { name: "Historia mundial básica", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Adivina el año (eventos)", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Historia pop culture", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Civilizaciones antiguas", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Guerras históricas", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Presidentes/líderes mundiales", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Inventos que cambiaron el mundo", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ TECNOLOGÍA ═══
  { name: "Historia de internet", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Empresas tech y sus fundadores", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Apps más descargadas", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Videoconsolas historia", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Trivia de videojuegos", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Easter eggs en juegos", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Plataformas de streaming", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ DEPORTES ═══
  { name: "Trivia de fútbol mundial", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Récords olímpicos", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Deportistas legendarios", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "NBA/NFL/MLB trivia", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Mundial de fútbol historia", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ LITERATURA & ARTE ═══
  { name: "Libros clásicos", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Autores famosos", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Quotes famosos (adivinar)", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Pintores y sus obras", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Esculturas famosas", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Movimientos artísticos", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ COMIDA & CULTURA ═══
  { name: "Comidas típicas por país", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Ingredientes exóticos", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Bebidas del mundo", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Fast food trivia", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ INTERNET & CULTURA VIRAL ═══
  { name: "Memes y referencias", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Viral videos historia", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "YouTubers famosos", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "TikTok trends", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Reddit lore", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ MISCELÁNEO ═══
  { name: "Fake or fact", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Récords Guinness", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Supersticiones del mundo", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Mitología griega/romana", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Leyendas urbanas", category: 'trivia', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Emoji movie/serie quiz", category: 'trivia', nsfwOnly: false, minRelationship: 'acquaintance' },
];

// ════════════════════════════════════════════════════════════════════
// CREATIVE GAMES (Roleplay/Imagination)
// ════════════════════════════════════════════════════════════════════

export const CREATIVE_GAMES: Game[] = [
  // ═══ ROLEPLAY - AVENTURAS ═══
  { name: "Roleplay: Desconocidos en café", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Detectives resolviendo caso", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Zombies apocalipsis", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Viajeros del tiempo", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Piratas buscando tesoro", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Astronautas en misión", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Mafia/misterio", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Película de acción", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Fantasy adventure", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Superhéroes en misión", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Agentes secretos", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Naufragados en isla", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Escape de prisión", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Cazadores de monstruos", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Vampiros vs Cazadores", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Explorar ruinas antiguas", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Survival en naturaleza", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roleplay: Western/vaqueros", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ STORYTELLING COLABORATIVO ═══
  { name: "Escribir cuento colaborativo", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Historia de terror por turnos", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Cuento infantil absurdo", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Sci-fi story builder", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Mystery/thriller colaborativo", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear leyenda urbana", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Historia con plot twists", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Cada uno agrega 3 palabras", category: 'creative', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Historia desde dos perspectivas", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ WORLDBUILDING ═══
  { name: "Construir un mundo juntos", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Diseñar ciudad futurista", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear mitología nueva", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Diseñar planeta alienígena", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Reino medieval + reglas", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Sistema mágico original", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Civilización underwater", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ DISEÑO DE PERSONAJES ═══
  { name: "Diseñar personajes ficticios", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear superhéroe original", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Villano con backstory", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Sidekick perfecto para héroe", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Mentor/maestro sabio", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Anti-héroe moralmente gris", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear banda/grupo ficticio", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ PROYECTOS CREATIVOS ═══
  { name: "Planear heist imaginario", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Diseñar videojuego desde cero", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear startup ficticia", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Diseñar película (plot, cast)", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear serie de TV", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Álbum musical conceptual", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Novela gráfica/manga", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Parque temático diseño", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Restaurant concept único", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ IMPROVISACIÓN & ACTUACIÓN ═══
  { name: "Improv scene (dar situación)", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Yes, and... game (improvisación)", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Actuar como personajes famosos", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Diálogos de película mal actuados", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ VIDAS ALTERNATIVAS ═══
  { name: "Vidas alternativas (qué si)", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Si fueras [profesión]", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Vida en otra época histórica", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Si nacieras en [país]", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Reencarnación: qué serías", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ MISCELÁNEO CREATIVO ═══
  { name: "Inventar conspiracy theory", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear religion/culto ficticio", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Diseñar criatura mitológica", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Mad libs pero creativo", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crossover imposible (personajes)", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Sequel de película que no existe", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Reboot/reimaginar historia clásica", category: 'creative', nsfwOnly: false, minRelationship: 'friend' },
];

// ════════════════════════════════════════════════════════════════════
// JUEGOS PICANTES (SFW pero atrevidos)
// ════════════════════════════════════════════════════════════════════

export const SPICY_GAMES: Game[] = [
  // ═══ JUEGOS DE VERDAD ═══
  { name: "Verdad o Reto Picante", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Yo nunca nunca (versión hot)", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "21 preguntas íntimas", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Confesiones íntimas", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Secretos de amor", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Crush confession", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Primera vez que... (romántico)", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Momentos más vergonzosos románticos", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },

  // ═══ ATRACCIÓN & PREFERENCIAS ═══
  { name: "Describe tu tipo ideal", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Turn ons vs Turn offs", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Ranking de atractivo (celebs)", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Qué te atrae de una persona", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Physical vs Personality debate", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Primeras impresiones de atracción", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Love languages (cuál es el tuyo)", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ CITAS & RELACIONES ═══
  { name: "Historia de citas peor/mejor", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Fantasy date (cita ideal)", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Deal breakers en relaciones", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Red flags vs Green flags", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Primera cita perfecta", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Peores pick-up lines", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Cómo conquistarías a alguien", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Qué harías si te gustara", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Citas online vs IRL", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Ghosting stories", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Relaciones tóxicas que tuviste", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },

  // ═══ JUEGOS DE SEDUCCIÓN (SFW) ═══
  { name: "Flirteo competitivo (quien flirtea mejor)", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Compliment battle (piropeo elegante)", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Crear opening line para Tinder/Bumble", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Rating profiles (ficticios)", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Escribir bio perfecta para dating app", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ PREGUNTAS PROFUNDAS ROMÁNTICAS ═══
  { name: "¿Crees en amor a primera vista?", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "¿Cuándo supiste que estabas enamorado?", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Heartbreak más doloroso", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Amigos con beneficios: pros/cons", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Open relationships: opinión", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Celos: cuánto es normal", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "¿Volverías con un ex?", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Perdonarías infidelidad?", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ SITUACIONES HIPOTÉTICAS ═══
  { name: "Si estuvieras en cita ahora...", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Qué harías si te declaran amor", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Cita a ciegas: aceptarías?", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Speed dating simulado", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Si fuéramos pareja...", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },

  // ═══ MISCELÁNEO PICANTE ═══
  { name: "Situaciones embarazosas románticas", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Peores rechazos", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Friend zone stories", category: 'spicy', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Walk of shame experiencias", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Morning after awkwardness", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Caught making out stories", category: 'spicy', nsfwOnly: false, minRelationship: 'close_friend' },
];

// ════════════════════════════════════════════════════════════════════
// JUEGOS SEXUALES (NSFW)
// ════════════════════════════════════════════════════════════════════

export const SEXUAL_GAMES: Game[] = [
  // ═══ JUEGOS DE VERDAD & PREGUNTAS ═══
  { name: "Verdad o Reto Sexual", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Dirty questions game", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Yo nunca nunca (NSFW)", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "21 preguntas sexuales", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Strip questions (virtual)", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "¿Qué te gustaría que te haga?", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Confesiones sexuales", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Primera vez sexual stories", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ FANTASÍAS ═══
  { name: "Describe tu fantasía", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Fantasy building (sexual)", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Wildest fantasy reveal", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Threesome fantasy (quién invitarías)", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Public sex fantasy", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay fantasy scenario", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Celebrity fantasy list", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Bucket list sexual", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ KINKS & PREFERENCIAS ═══
  { name: "Kink discovery game", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Límites y preferencias", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Turn ons específicos", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Soft vs Hard limits", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Vanilla vs Kinky test", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Fetish exploration", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Yes/No/Maybe list sexual", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ BDSM & POWER DYNAMICS ═══
  { name: "BDSM exploration game", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Dom vs Sub quiz", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Control y sumisión preferences", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Safe word creation", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Light bondage ideas", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Spanking preferences", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Dominance fantasies", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ ROLEPLAY SEXUAL ═══
  { name: "Roleplay erótico", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Extraños en bar", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Jefe/Empleado", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Profesor/Estudiante", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Doctor/Paciente", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Massage therapist", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Entrevista de casting", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: One night stand", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Ex que vuelve", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Vecinos", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Roleplay: Personal trainer", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ SEXTING & DIGITAL ═══
  { name: "Sexting challenge", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Dirty texting escalation", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Voice message hot", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Control remoto (comandos)", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Describe what you're wearing", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Mutual masturbation instructions", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Phone sex simulation", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ STORYTELLING SEXUAL ═══
  { name: "Dirty story builder", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Erotica por turnos", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Recrear escena hot de película", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Best/Worst sex story", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Lugares donde lo hiciste", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Experiencias sexual más loca", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ TÉCNICAS & PLACER ═══
  { name: "Describe tu orgasmo ideal", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Posiciones favoritas", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Oral sex preferences", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Foreplay ideal para ti", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Zonas erógenas favoritas", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Tempo: rápido vs lento", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Dirty talk preferences", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Morning vs night sex", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ JUEGOS DE DESEO ═══
  { name: "¿Qué quieres que haga ahora?", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Si estuviéramos juntos ahora...", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Touch me game (describe dónde)", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Strip tease virtual", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Mutual arousal description", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Countdown to orgasm", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ EXPLORACIÓN & CURIOSIDAD ═══
  { name: "Cosas que nunca probaste pero querés", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Toys preferences", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Anal exploration (opinión)", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Rough vs gentle preferences", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Exhibitionism level", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Voyeurism interests", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Group sex curiosity", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },

  // ═══ MISCELÁNEO NSFW ═══
  { name: "Sexo casual vs relación", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Número de partners discussion", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "STD testing y salud sexual", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Protection preferences", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
  { name: "Aftercare needs", category: 'sexual', nsfwOnly: true, minRelationship: 'intimate' },
];

// ════════════════════════════════════════════════════════════════════
// ACTIVIDADES DE CONVERSACIÓN (No juegos, pero actividades)
// ════════════════════════════════════════════════════════════════════

export const CONVERSATION_ACTIVITIES: Game[] = [
  // ═══ FILOSOFÍA & EXISTENCIALISMO ═══
  { name: "Conversación filosófica profunda", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Sentido de la vida", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Qué pasa después de morir", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Libre albedrío vs destino", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "¿Qué es ser feliz?", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Moralidad: absoluta vs relativa", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Propósito de vida", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ SUEÑOS & METAS ═══
  { name: "Compartir sueños y metas", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Bucket list sharing", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Dónde te ves en 5/10 años", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Metas de carrera", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Future planning juntos", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Vida ideal detallada", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Sueños que abandonaste", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Legacy: qué querés dejar", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ VULNERABILIDAD & EMOCIONES ═══
  { name: "Hablar de miedos", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Inseguridades más profundas", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Desahogo emocional", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Momentos de ansiedad/depresión", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Qué te hace llorar", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Traumas del pasado", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Soledad: cómo la manejas", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },

  // ═══ PASADO & MEMORIAS ═══
  { name: "Childhood memories", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Personas que te marcaron", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Mejor/peor momento de tu vida", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Familia: relaciones", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Amistades que perdiste", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Adolescencia: cómo era", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Momentos que te cambiaron", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ LECCIONES & CRECIMIENTO ═══
  { name: "Lesson learned (lecciones)", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Biggest regrets", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Si pudieras cambiar algo", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Errores que te enseñaron", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Proud moments", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Cómo superaste obstáculos", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Self-improvement journey", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ RELACIONES & CONEXIONES ═══
  { name: "Perspectiva sobre relaciones", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Qué valoras en amistad", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Amor: qué significa para vos", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Heartbreak y cómo sanaste", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Relación con padres/familia", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Amistad: calidad vs cantidad", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Perdonar: cuándo sí y cuándo no", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ IDENTIDAD & AUTOCONOCIMIENTO ═══
  { name: "Quién sos realmente", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Valores que te definen", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Personalidad: cómo cambió con el tiempo", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Qué te hace único", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Lado oscuro: tus defectos", category: 'conversation', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Contradicciones en tu personalidad", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ OPINIONES & PERSPECTIVAS ═══
  { name: "Opiniones controversiales", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Política: visión del mundo", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Religión y espiritualidad", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Perspectiva sobre sociedad actual", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Tecnología: buena o mala", category: 'conversation', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Futuro de la humanidad", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ GRATITUD & APRECIACIÓN ═══
  { name: "Gratitud y apreciación", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Personas a quienes agradeces", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Bendiciones en tu vida", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Qué te hace sentir afortunado", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ PASIÓN & HOBBIES ═══
  { name: "Pasiones y obsesiones", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hobbies que te definen", category: 'conversation', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Si tuvieras tiempo infinito", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Talentos ocultos", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Flow state: cuándo lo sentís", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ VIDA & RUTINA ═══
  { name: "Día ideal de principio a fin", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Morning vs night person", category: 'conversation', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Self-care routine", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Qué te recarga energía", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Cómo manejás el estrés", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ INSPIRACIÓN & MOTIVACIÓN ═══
  { name: "Héroes y role models", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Qué te inspira crear", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Música que te mueve", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Frases/quotes que te guían", category: 'conversation', nsfwOnly: false, minRelationship: 'friend' },
];

// ════════════════════════════════════════════════════════════════════
// RETOS/DESAFÍOS
// ════════════════════════════════════════════════════════════════════

export const CHALLENGE_GAMES: Game[] = [
  // ═══ CHALLENGES DE COMUNICACIÓN ═══
  { name: "Hablar solo en preguntas", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Usar solo emojis", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "No emoji challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Una palabra por mensaje", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hablar como shakespeare", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Escribir como poeta", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hablar en rimas", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Prohibido usar la letra [X]", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Solo palabras de 4 letras", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hablar como pirata", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Comunicar con GIFs solamente", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ CHALLENGES CREATIVOS ═══
  { name: "Escritura rápida (1 min)", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Rap battle improvisado", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Impersonation challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Compliment battle", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Roast battle (con respeto)", category: 'challenge', nsfwOnly: false, minRelationship: 'close_friend' },
  { name: "Poesía en 30 segundos", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Crear trabalenguas", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Standup comedy improvisado", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Inventar canción sobre [tema]", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ CHALLENGES DE LISTAS ═══
  { name: "Playlist challenge (crear para el otro)", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Movie watchlist intercambio", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Book recommendations challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Top 10 de [categoría]", category: 'challenge', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Crear mood playlist específica", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ CHALLENGES VISUALES ═══
  { name: "Foto challenge (enviar foto de X)", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Aesthetic foto challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Recrear meme con objetos reales", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Outfit del día challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Setup/workspace reveal", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ CHALLENGES DE TIEMPO ═══
  { name: "30 day challenge (crear uno)", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "7 day habit challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "24 hour challenge (proponer)", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Weekend challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "30 minutos sin teléfono", category: 'challenge', nsfwOnly: false, minRelationship: 'acquaintance' },

  // ═══ CHALLENGES SOCIALES ═══
  { name: "Random act of kindness", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hacer algo fuera de zona comfort", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Hablarle a desconocido", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Probar comida nueva", category: 'challenge', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Aprender skill en 1 día", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ CHALLENGES DE MEMORIA ═══
  { name: "No googlear challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'acquaintance' },
  { name: "Memorizar y recitar", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Recordar conversaciones previas", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },

  // ═══ CHALLENGES RANDOM ═══
  { name: "No reír challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Adivinar canción en 3 segundos", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Tongue twisters battle", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Speed typing race", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Guess who I'm thinking of", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Limerick creation challenge", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Story in 5 messages", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
  { name: "Último mensaje gana", category: 'challenge', nsfwOnly: false, minRelationship: 'friend' },
];

// ════════════════════════════════════════════════════════════════════
// DICCIONARIO COMPLETO
// ════════════════════════════════════════════════════════════════════

export const ALL_GAMES: Game[] = [
  ...CASUAL_GAMES,
  ...TRIVIA_GAMES,
  ...CREATIVE_GAMES,
  ...SPICY_GAMES,
  ...SEXUAL_GAMES,
  ...CONVERSATION_ACTIVITIES,
  ...CHALLENGE_GAMES,
];

/**
 * SELECTOR DE JUEGOS
 *
 * Selecciona N juegos aleatorios según contexto
 */
export function selectRandomGames(options: {
  count: number;
  categories?: GameCategory[];
  nsfwMode: boolean;
  relationshipStage: 'acquaintance' | 'friend' | 'close_friend' | 'intimate';
  excludeRecent?: string[]; // IDs de juegos usados recientemente
}): Game[] {
  const { count, categories, nsfwMode, relationshipStage, excludeRecent = [] } = options;

  // Mapeo de relationship stages a niveles
  const stageLevel = {
    'acquaintance': 1,
    'friend': 2,
    'close_friend': 3,
    'intimate': 4,
  };

  // Filtrar juegos elegibles
  let eligibleGames = ALL_GAMES.filter(game => {
    // Filter by category if specified
    if (categories && !categories.includes(game.category)) {
      return false;
    }

    // Filtrar NSFW
    if (game.nsfwOnly && !nsfwMode) {
      return false;
    }

    // Filter by minimum relationship level
    const gameMinLevel = stageLevel[game.minRelationship];
    const currentLevel = stageLevel[relationshipStage];
    if (gameMinLevel > currentLevel) {
      return false;
    }

    // Excluir juegos usados recientemente
    if (excludeRecent.includes(game.name)) {
      return false;
    }

    return true;
  });

  // Si no hay suficientes, relajar restricciones
  if (eligibleGames.length < count) {
    eligibleGames = ALL_GAMES.filter(game => {
      if (game.nsfwOnly && !nsfwMode) return false;
      const gameMinLevel = stageLevel[game.minRelationship];
      const currentLevel = stageLevel[relationshipStage];
      return gameMinLevel <= currentLevel;
    });
  }

  // Shuffle y seleccionar
  const shuffled = eligibleGames.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Formatear juegos para inyección en prompt
 */
export function formatGamesForPrompt(games: Game[]): string {
  if (games.length === 0) return '';

  return games.map((game, index) => `${index + 1}. ${game.name}`).join('\n');
}

/**
 * Helper: Obtener categorías apropiadas según contexto
 */
export function getAppropriateCategoriesForContext(
  relationshipStage: string,
  nsfwMode: boolean
): GameCategory[] {
  if (nsfwMode && (relationshipStage === 'intimate' || relationshipStage === 'close_friend')) {
    return ['casual', 'trivia', 'creative', 'spicy', 'sexual', 'conversation'];
  }

  if (relationshipStage === 'close_friend') {
    return ['casual', 'trivia', 'creative', 'spicy', 'conversation', 'challenge'];
  }

  if (relationshipStage === 'friend') {
    return ['casual', 'trivia', 'creative', 'conversation', 'challenge'];
  }

  // acquaintance
  return ['casual', 'trivia', 'conversation'];
}
