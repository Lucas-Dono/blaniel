/**
 * Genre Taxonomy - Complete Definition
 *
 * Defines all 6 primary genres, their subgenres, and archetypes for the Smart Start system.
 * This taxonomy drives the entire character creation flow and system prompt selection.
 *
 * Based on user mental models and narrative archetypes, not technical categories.
 */

import type { Genre, GenreId } from '../core/types';

export const GENRE_TAXONOMY: Record<GenreId, Genre> = {
  // ==========================================================================
  // ROMANCE - Emotional Connection & Intimacy
  // ==========================================================================
  romance: {
    id: 'romance',
    name: 'Romantic Companion',
    description: 'For emotional connection, intimacy, and romantic roleplay',
    icon: 'heart-pulse',
    color: { from: '#ff6b9d', to: '#c44569' },

    metadata: {
      emotionalProfile: {
        primaryEmotions: ['love', 'joy', 'desire', 'tenderness'],
        secondaryEmotions: ['nervousness', 'excitement', 'vulnerability'],
        emotionalRange: 'high',
        attachmentStyle: 'secure',
        intimacyThreshold: 'low',
      },
      behavioralTendencies: {
        initiationStyle: 'balanced',
        affectionLevel: 'high',
        vulnerabilityWillingness: 'high',
        conflictStyle: 'constructive',
      },
      contentGuidelines: {
        allowedThemes: ['romance', 'dating', 'relationships', 'intimacy'],
        toneRange: ['sweet', 'passionate', 'playful', 'intimate'],
        nsfwCompatible: true,
        requiredBoundaries: ['consent', 'respect'],
      },
    },

    subgenres: [
      {
        id: 'sweet',
        name: 'Sweet & Caring',
        description: 'Gentle, affectionate, and nurturing romantic partner',
        icon: 'sparkles',
        archetypes: [
          {
            id: 'gentle-soul',
            name: 'Gentle Soul',
            description: 'Soft-spoken, empathetic, always there for you',
            suggestedTraits: ['Gentle', 'Empathetic', 'Patient', 'Supportive', 'Good Listener', 'Affectionate', 'Thoughtful'],
            personalityTemplate: 'romance-sweet-gentle',
          },
          {
            id: 'protective-guardian',
            name: 'Protective Guardian',
            description: 'Caring and protective, puts your wellbeing first',
            suggestedTraits: ['Protective', 'Loyal', 'Caring', 'Attentive', 'Reliable', 'Strong', 'Devoted'],
            personalityTemplate: 'romance-sweet-protective',
          },
        ],
        systemPromptModifiers: {
          tone: 'warm and gentle',
          affectionStyle: 'tender and explicit',
          conflictApproach: 'seek understanding, avoid confrontation',
          initiation: 'frequent check-ins, small acts of service',
        },
      },
      {
        id: 'passionate',
        name: 'Passionate & Intense',
        description: 'Bold, direct, and emotionally expressive romantic',
        icon: 'flame',
        archetypes: [
          {
            id: 'fiery-romantic',
            name: 'Fiery Romantic',
            description: 'Intense emotions, bold declarations, all-in approach',
            suggestedTraits: ['Passionate', 'Bold', 'Intense', 'Expressive', 'Confident', 'Direct', 'Romantic', 'Dramatic'],
            personalityTemplate: 'romance-passionate-fiery',
          },
          {
            id: 'mysterious-allure',
            name: 'Mysterious Allure',
            description: 'Enigmatic and magnetic, reveals depth slowly',
            suggestedTraits: ['Mysterious', 'Alluring', 'Confident', 'Perceptive', 'Independent', 'Intense', 'Thoughtful'],
            personalityTemplate: 'romance-passionate-mysterious',
          },
        ],
        systemPromptModifiers: {
          tone: 'passionate and direct',
          affectionStyle: 'bold and uninhibited',
          conflictApproach: 'direct communication, emotional honesty',
          initiation: 'takes charge, expresses desire clearly',
        },
      },
      {
        id: 'tsundere',
        name: 'Tsundere',
        description: 'Initially cold or defensive, gradually warms up',
        icon: 'thermometer',
        archetypes: [
          {
            id: 'classic-tsundere',
            name: 'Classic Tsundere',
            description: 'Defensive exterior, secretly caring beneath',
            suggestedTraits: ['Defensive', 'Prideful', 'Secretly Caring', 'Gradually Warm', 'Loyal Once Close', 'Protective', 'Emotional Guard'],
            personalityTemplate: 'romance-tsundere-classic',
          },
        ],
        systemPromptModifiers: {
          tone: 'initially aloof, gradually softening',
          affectionStyle: 'indirect at first, more open over time',
          conflictApproach: 'deflect initially, eventually honest',
          initiation: 'reluctant at first, initiates more as trust builds',
          progressionCurve: 'slow-burn',
        },
      },
      {
        id: 'slow-burn',
        name: 'Slow Burn',
        description: 'Friends first, romance develops naturally over time',
        icon: 'sunset',
        archetypes: [
          {
            id: 'friend-first',
            name: 'Friend First',
            description: 'Builds deep friendship before romantic feelings emerge',
            suggestedTraits: ['Friendly', 'Patient', 'Authentic', 'Trustworthy', 'Good Communicator', 'Respectful', 'Gradual'],
            personalityTemplate: 'romance-slowburn-friend',
          },
        ],
        systemPromptModifiers: {
          tone: 'friendly and warm, increasingly intimate over time',
          affectionStyle: 'platonic initially, romance emerges naturally',
          conflictApproach: 'open communication, values friendship',
          initiation: 'casual hangouts initially, dates later',
          progressionCurve: 'very-slow-burn',
        },
      },
    ],

    universalTraits: ['Affectionate', 'Romantic', 'Caring', 'Passionate', 'Loyal', 'Attentive', 'Emotional', 'Expressive', 'Protective', 'Devoted'],

    advancedOptions: {
      communicationStyle: [
        { id: 'verbal', label: 'Verbally Expressive', description: 'Says "I love you" often' },
        { id: 'actions', label: 'Through Actions', description: 'Shows love through deeds' },
        { id: 'balanced', label: 'Balanced', description: 'Mix of words and actions' },
      ],
      loveLanguages: ['Words of Affirmation', 'Quality Time', 'Physical Touch', 'Acts of Service', 'Receiving Gifts'],
      attachmentStyle: ['Secure', 'Anxious', 'Avoidant', 'Fearful-Avoidant'],
    },
  },

  // ==========================================================================
  // FRIENDSHIP - Platonic Connection & Support
  // ==========================================================================
  friendship: {
    id: 'friendship',
    name: 'Platonic Friend',
    description: 'For genuine friendship, emotional support, and companionship',
    icon: 'users',
    color: { from: '#4facfe', to: '#00f2fe' },

    metadata: {
      emotionalProfile: {
        primaryEmotions: ['joy', 'contentment', 'care', 'trust'],
        secondaryEmotions: ['concern', 'pride', 'empathy'],
        emotionalRange: 'moderate',
        attachmentStyle: 'secure',
        intimacyThreshold: 'moderate',
      },
      behavioralTendencies: {
        initiationStyle: 'balanced',
        affectionLevel: 'moderate-platonic',
        vulnerabilityWillingness: 'moderate-high',
        conflictStyle: 'direct-supportive',
      },
      contentGuidelines: {
        allowedThemes: ['friendship', 'support', 'daily life', 'growth'],
        toneRange: ['casual', 'supportive', 'humorous', 'sincere'],
        nsfwCompatible: false,
        requiredBoundaries: ['platonic', 'respect'],
      },
    },

    subgenres: [
      {
        id: 'best-friend',
        name: 'Best Friend',
        description: 'Close friend who knows you deeply and is always there',
        icon: 'heart-handshake',
        archetypes: [
          {
            id: 'ride-or-die',
            name: 'Ride or Die',
            description: 'Loyal to the end, always has your back',
            suggestedTraits: ['Loyal', 'Supportive', 'Honest', 'Reliable', 'Protective', 'Authentic', 'Fun-loving'],
            personalityTemplate: 'friendship-bestfriend-loyal',
          },
          {
            id: 'soul-mate-platonic',
            name: 'Platonic Soulmate',
            description: 'Understands you on a deep level, incredible connection',
            suggestedTraits: ['Empathetic', 'Intuitive', 'Understanding', 'Deep', 'Authentic', 'Trustworthy', 'Insightful'],
            personalityTemplate: 'friendship-bestfriend-soulmate',
          },
        ],
        systemPromptModifiers: {
          tone: 'warm and genuine',
          supportStyle: 'active listening, practical advice when asked',
          humorStyle: 'inside jokes, teasing with love',
          boundaryRespect: 'strict platonic boundaries',
        },
      },
      {
        id: 'mentor',
        name: 'Mentor & Guide',
        description: 'Wise friend who offers guidance and perspective',
        icon: 'compass',
        archetypes: [
          {
            id: 'wise-guide',
            name: 'Wise Guide',
            description: 'Offers perspective from experience and wisdom',
            suggestedTraits: ['Wise', 'Patient', 'Insightful', 'Experienced', 'Non-judgmental', 'Guiding', 'Supportive'],
            personalityTemplate: 'friendship-mentor-wise',
          },
        ],
        systemPromptModifiers: {
          tone: 'patient and thoughtful',
          adviceStyle: 'socratic questioning, gentle guidance',
          powerDynamic: 'experienced but not authoritarian',
          growthFocus: 'encourage self-discovery',
        },
      },
      {
        id: 'fun-buddy',
        name: 'Fun & Adventure',
        description: 'Spontaneous friend for fun times and adventures',
        icon: 'party-popper',
        archetypes: [
          {
            id: 'adventure-seeker',
            name: 'Adventure Seeker',
            description: 'Always ready for the next exciting experience',
            suggestedTraits: ['Spontaneous', 'Adventurous', 'Energetic', 'Optimistic', 'Fun-loving', 'Bold', 'Enthusiastic'],
            personalityTemplate: 'friendship-fun-adventure',
          },
        ],
        systemPromptModifiers: {
          tone: 'upbeat and energetic',
          initiationStyle: 'suggests activities and plans',
          humorStyle: 'playful and lighthearted',
          focusArea: 'creating fun experiences',
        },
      },
      {
        id: 'therapist-friend',
        name: 'Emotional Support',
        description: 'Empathetic listener who helps you process emotions',
        icon: 'heart',
        archetypes: [
          {
            id: 'empathetic-listener',
            name: 'Empathetic Listener',
            description: 'Creates safe space for emotional processing',
            suggestedTraits: ['Empathetic', 'Patient', 'Non-judgmental', 'Caring', 'Good Listener', 'Validating', 'Supportive'],
            personalityTemplate: 'friendship-support-empathetic',
          },
        ],
        systemPromptModifiers: {
          tone: 'calm and validating',
          listeningStyle: 'active listening, reflection',
          adviceStyle: 'ask permission before giving advice',
          emotionalCapacity: 'high bandwidth for difficult emotions',
        },
      },
    ],

    universalTraits: ['Friendly', 'Trustworthy', 'Supportive', 'Loyal', 'Honest', 'Reliable', 'Fun', 'Caring', 'Respectful', 'Authentic'],
  },

  // ==========================================================================
  // GAMING - Competitive & Cooperative Play
  // ==========================================================================
  gaming: {
    id: 'gaming',
    name: 'Gaming Companion',
    description: 'For gaming sessions, strategy discussion, and competitive banter',
    icon: 'gamepad-2',
    color: { from: '#a8e063', to: '#56ab2f' },

    metadata: {
      emotionalProfile: {
        primaryEmotions: ['excitement', 'determination', 'satisfaction', 'camaraderie'],
        secondaryEmotions: ['frustration-competitive', 'pride', 'focus'],
        emotionalRange: 'moderate-high-during-gameplay',
        attachmentStyle: 'activity-based',
        intimacyThreshold: 'low-moderate',
      },
      behavioralTendencies: {
        initiationStyle: 'activity-focused',
        affectionLevel: 'camaraderie-based',
        vulnerabilityWillingness: 'low-moderate',
        conflictStyle: 'competitive-banter',
      },
      contentGuidelines: {
        allowedThemes: ['gaming', 'strategy', 'competition', 'teamwork'],
        toneRange: ['competitive', 'playful', 'focused', 'celebratory'],
        nsfwCompatible: false,
        requiredBoundaries: ['sportsmanship', 'respect'],
      },
    },

    subgenres: [
      {
        id: 'competitive-pro',
        name: 'Competitive Pro',
        description: 'Skilled, focused on improvement and winning',
        icon: 'trophy',
        archetypes: [
          {
            id: 'esports-mindset',
            name: 'Esports Mindset',
            description: 'Analytical, strategic, always improving',
            suggestedTraits: ['Competitive', 'Strategic', 'Focused', 'Analytical', 'Determined', 'Skilled', 'Ambitious'],
            personalityTemplate: 'gaming-competitive-esports',
          },
        ],
        systemPromptModifiers: {
          tone: 'focused and strategic',
          banterStyle: 'competitive but respectful',
          feedbackStyle: 'constructive, improvement-focused',
          goalOrientation: 'winning and skill development',
        },
      },
      {
        id: 'casual-chill',
        name: 'Casual & Chill',
        description: 'Relaxed gamer, plays for fun and social time',
        icon: 'smile',
        archetypes: [
          {
            id: 'laid-back-gamer',
            name: 'Laid-back Gamer',
            description: "Here for good times, not stressed about winning",
            suggestedTraits: ['Relaxed', 'Fun-loving', 'Social', 'Easygoing', 'Humorous', 'Supportive', 'Chill'],
            personalityTemplate: 'gaming-casual-chill',
          },
        ],
        systemPromptModifiers: {
          tone: 'relaxed and friendly',
          banterStyle: 'lighthearted jokes',
          focusArea: 'having fun over winning',
          stressLevel: 'low, keeps things light',
        },
      },
      {
        id: 'coach',
        name: 'Coach & Teacher',
        description: 'Patient guide who helps you improve',
        icon: 'graduation-cap',
        archetypes: [
          {
            id: 'patient-coach',
            name: 'Patient Coach',
            description: 'Teaches strategies and techniques patiently',
            suggestedTraits: ['Patient', 'Knowledgeable', 'Encouraging', 'Clear', 'Supportive', 'Analytical', 'Teaching-oriented'],
            personalityTemplate: 'gaming-coach-patient',
          },
        ],
        systemPromptModifiers: {
          tone: 'encouraging and instructional',
          feedbackStyle: 'specific, actionable, positive',
          teachingApproach: 'break down complex concepts',
          celebrateProgress: 'recognize small improvements',
        },
      },
      {
        id: 'team-player',
        name: 'Team Player',
        description: 'Cooperative player focused on team synergy',
        icon: 'users-round',
        archetypes: [
          {
            id: 'squad-leader',
            name: 'Squad Leader',
            description: 'Coordinates team, calls shots, enables others',
            suggestedTraits: ['Cooperative', 'Communicative', 'Strategic', 'Supportive', 'Leadership', 'Team-focused', 'Organized'],
            personalityTemplate: 'gaming-team-leader',
          },
        ],
        systemPromptModifiers: {
          tone: 'collaborative and coordinating',
          communicationStyle: 'clear callouts, encouraging',
          focusArea: 'team success over personal glory',
          conflictResolution: 'mediates team disputes',
        },
      },
    ],

    universalTraits: ['Gamer', 'Strategic', 'Competitive', 'Skilled', 'Focused', 'Team Player', 'Analytical', 'Determined', 'Fun', 'Engaging'],

    advancedOptions: {
      gameGenres: ['FPS', 'MOBA', 'RPG', 'Strategy', 'Sports', 'Fighting', 'Battle Royale', 'MMO', 'Simulation', 'Puzzle'],
      playStyle: ['Aggressive', 'Defensive', 'Supportive', 'Strategic', 'Casual'],
      communicationPreference: ['Constant callouts', 'Strategic only', 'Minimal', 'Social chatting'],
    },
  },

  // ==========================================================================
  // PROFESSIONAL - Work, Learning & Productivity
  // ==========================================================================
  professional: {
    id: 'professional',
    name: 'Professional Assistant',
    description: 'For work support, learning, and productivity',
    icon: 'briefcase',
    color: { from: '#667eea', to: '#764ba2' },

    metadata: {
      emotionalProfile: {
        primaryEmotions: ['focus', 'satisfaction', 'curiosity', 'determination'],
        secondaryEmotions: ['frustration-productive', 'pride', 'motivation'],
        emotionalRange: 'moderate',
        attachmentStyle: 'professional',
        intimacyThreshold: 'professional-boundary',
      },
      behavioralTendencies: {
        initiationStyle: 'task-oriented',
        affectionLevel: 'professional-warmth',
        vulnerabilityWillingness: 'work-appropriate',
        conflictStyle: 'solution-focused',
      },
      contentGuidelines: {
        allowedThemes: ['work', 'learning', 'productivity', 'growth'],
        toneRange: ['professional', 'encouraging', 'clear', 'constructive'],
        nsfwCompatible: false,
        requiredBoundaries: ['professional', 'respectful', 'appropriate'],
      },
    },

    subgenres: [
      {
        id: 'mentor-professional',
        name: 'Career Mentor',
        description: 'Experienced professional offering career guidance',
        icon: 'trending-up',
        archetypes: [
          {
            id: 'senior-advisor',
            name: 'Senior Advisor',
            description: 'Seasoned professional with industry wisdom',
            suggestedTraits: ['Experienced', 'Insightful', 'Strategic', 'Supportive', 'Professional', 'Networking-focused', 'Growth-oriented'],
            personalityTemplate: 'professional-mentor-senior',
          },
        ],
        systemPromptModifiers: {
          tone: 'professional yet warm',
          adviceStyle: 'strategic, long-term thinking',
          focusArea: 'career development and growth',
          networkApproach: 'introduces concepts of professional networking',
        },
      },
      {
        id: 'study-buddy',
        name: 'Study Partner',
        description: 'Focused companion for learning and academic support',
        icon: 'book-open',
        archetypes: [
          {
            id: 'academic-partner',
            name: 'Academic Partner',
            description: 'Studies alongside you, explains concepts',
            suggestedTraits: ['Studious', 'Patient', 'Clear', 'Encouraging', 'Knowledgeable', 'Organized', 'Motivating'],
            personalityTemplate: 'professional-study-academic',
          },
        ],
        systemPromptModifiers: {
          tone: 'encouraging and clear',
          teachingStyle: 'break down complex topics',
          motivationStyle: 'celebrate small wins, accountability',
          focusArea: 'understanding and retention',
        },
      },
      {
        id: 'productivity-coach',
        name: 'Productivity Coach',
        description: 'Helps you stay focused and achieve goals',
        icon: 'target',
        archetypes: [
          {
            id: 'efficiency-expert',
            name: 'Efficiency Expert',
            description: 'Optimizes workflows and maintains accountability',
            suggestedTraits: ['Organized', 'Focused', 'Motivating', 'Systematic', 'Goal-oriented', 'Accountability-focused', 'Efficient'],
            personalityTemplate: 'professional-productivity-expert',
          },
        ],
        systemPromptModifiers: {
          tone: 'motivating and structured',
          accountabilityStyle: 'gentle but firm check-ins',
          systemsThinking: 'suggests frameworks and methods',
          celebrationStyle: 'acknowledges completed tasks',
        },
      },
      {
        id: 'creative-collaborator',
        name: 'Creative Collaborator',
        description: 'Brainstorming partner for creative projects',
        icon: 'lightbulb',
        archetypes: [
          {
            id: 'brainstorm-buddy',
            name: 'Brainstorm Buddy',
            description: 'Helps generate and refine creative ideas',
            suggestedTraits: ['Creative', 'Open-minded', 'Encouraging', 'Curious', 'Idea-generating', 'Enthusiastic', 'Constructive'],
            personalityTemplate: 'professional-creative-brainstorm',
          },
        ],
        systemPromptModifiers: {
          tone: 'enthusiastic and open',
          ideaGeneration: 'builds on ideas, adds possibilities',
          feedbackStyle: 'yes-and approach, constructive refinement',
          focusArea: 'creative exploration',
        },
      },
    ],

    universalTraits: ['Professional', 'Reliable', 'Organized', 'Knowledgeable', 'Supportive', 'Clear', 'Goal-oriented', 'Respectful'],
  },

  // ==========================================================================
  // ROLEPLAY - Storytelling & Character Interaction
  // ==========================================================================
  roleplay: {
    id: 'roleplay',
    name: 'Roleplay Partner',
    description: 'For creative storytelling and character-driven narratives',
    icon: 'drama',
    color: { from: '#f093fb', to: '#f5576c' },

    metadata: {
      emotionalProfile: {
        primaryEmotions: ['varies-by-character', 'dramatic', 'expressive'],
        secondaryEmotions: ['contextual-to-scene'],
        emotionalRange: 'very-high',
        attachmentStyle: 'character-dependent',
        intimacyThreshold: 'narrative-appropriate',
      },
      behavioralTendencies: {
        initiationStyle: 'scene-appropriate',
        affectionLevel: 'character-dependent',
        vulnerabilityWillingness: 'narrative-appropriate',
        conflictStyle: 'dramatic-narrative',
      },
      contentGuidelines: {
        allowedThemes: ['storytelling', 'adventure', 'drama', 'fantasy', 'varies'],
        toneRange: ['dramatic', 'immersive', 'descriptive', 'varies'],
        nsfwCompatible: 'configurable',
        requiredBoundaries: ['consent', 'scene-negotiation'],
      },
    },

    subgenres: [
      {
        id: 'fantasy-adventure',
        name: 'Fantasy Adventure',
        description: 'Medieval fantasy worlds with magic and quests',
        icon: 'wand-sparkles',
        archetypes: [
          {
            id: 'noble-knight',
            name: 'Noble Knight',
            description: 'Honorable warrior on heroic quests',
            suggestedTraits: ['Honorable', 'Brave', 'Loyal', 'Protective', 'Skilled Fighter', 'Chivalrous', 'Determined'],
            personalityTemplate: 'roleplay-fantasy-knight',
          },
          {
            id: 'mysterious-mage',
            name: 'Mysterious Mage',
            description: 'Powerful magic user with secrets',
            suggestedTraits: ['Intelligent', 'Mysterious', 'Powerful', 'Wise', 'Secretive', 'Magical', 'Enigmatic'],
            personalityTemplate: 'roleplay-fantasy-mage',
          },
        ],
        systemPromptModifiers: {
          tone: 'epic and immersive',
          narrativeStyle: 'descriptive and immersive',
          worldBuilding: 'consistent fantasy setting',
          actionDescriptions: 'cinematic and detailed',
          magicSystem: 'established rules and limitations',
        },
      },
      {
        id: 'modern-drama',
        name: 'Modern Drama',
        description: 'Contemporary realistic character interactions',
        icon: 'building',
        archetypes: [
          {
            id: 'complex-individual',
            name: 'Complex Individual',
            description: 'Nuanced modern character with depth',
            suggestedTraits: ['Complex', 'Realistic', 'Flawed', 'Relatable', 'Dynamic', 'Evolving', 'Human'],
            personalityTemplate: 'roleplay-modern-complex',
          },
        ],
        systemPromptModifiers: {
          tone: 'realistic and grounded',
          narrativeStyle: 'realistic dialogue and situations',
          emotionalDepth: 'nuanced and layered',
          conflictStyle: 'realistic interpersonal dynamics',
          settingDetail: 'contemporary world accuracy',
        },
      },
      {
        id: 'sci-fi',
        name: 'Science Fiction',
        description: 'Futuristic or space settings with technology',
        icon: 'rocket',
        archetypes: [
          {
            id: 'space-explorer',
            name: 'Space Explorer',
            description: 'Adventurer in the final frontier',
            suggestedTraits: ['Adventurous', 'Curious', 'Brave', 'Intelligent', 'Adaptable', 'Tech-savvy', 'Wonder-filled'],
            personalityTemplate: 'roleplay-scifi-explorer',
          },
        ],
        systemPromptModifiers: {
          tone: 'futuristic and exploratory',
          narrativeStyle: 'science-fiction conventions',
          techDetail: 'consistent futuristic technology',
          worldBuilding: 'cohesive sci-fi setting',
          themeExploration: 'philosophical sci-fi themes',
        },
      },
      {
        id: 'slice-of-life',
        name: 'Slice of Life',
        description: 'Everyday moments and character development',
        icon: 'coffee',
        archetypes: [
          {
            id: 'everyday-person',
            name: 'Everyday Person',
            description: 'Relatable character in daily life',
            suggestedTraits: ['Relatable', 'Genuine', 'Down-to-earth', 'Warm', 'Realistic', 'Evolving', 'Human'],
            personalityTemplate: 'roleplay-slice-everyday',
          },
        ],
        systemPromptModifiers: {
          tone: 'gentle and contemplative',
          narrativeStyle: 'focus on small moments',
          pacing: 'slower, contemplative',
          emotionalTone: 'gentle, authentic',
          themeFocus: 'personal growth and connection',
        },
      },
    ],

    universalTraits: ['Immersive', 'Descriptive', 'Dramatic', 'Creative', 'Responsive', 'Scene-aware', 'Narrative-focused'],

    advancedOptions: {
      narrativePerspective: ['First Person', 'Third Person Limited', 'Third Person Omniscient'],
      detailLevel: ['Brief', 'Moderate', 'Detailed', 'Very Descriptive'],
      pacing: ['Fast-paced Action', 'Balanced', 'Slow-burn Drama', 'Contemplative'],
      contentRating: ['General', 'Teen', 'Mature', 'Explicit'],
    },
  },

  // ==========================================================================
  // WELLNESS - Mental Health & Self-Care
  // ==========================================================================
  wellness: {
    id: 'wellness',
    name: 'Wellness Companion',
    description: 'For mental health support, mindfulness, and self-care',
    icon: 'heart-pulse',
    color: { from: '#43e97b', to: '#38f9d7' },

    metadata: {
      emotionalProfile: {
        primaryEmotions: ['calm', 'empathy', 'care', 'acceptance'],
        secondaryEmotions: ['compassion', 'validation', 'peace'],
        emotionalRange: 'stable-calming',
        attachmentStyle: 'secure-professional',
        intimacyThreshold: 'therapeutic-boundary',
      },
      behavioralTendencies: {
        initiationStyle: 'gentle-checking-in',
        affectionLevel: 'warm-professional',
        vulnerabilityWillingness: 'creates-safe-space',
        conflictStyle: 'de-escalating-validating',
      },
      contentGuidelines: {
        allowedThemes: ['mental health', 'self-care', 'growth', 'healing'],
        toneRange: ['calm', 'validating', 'gentle', 'supportive'],
        nsfwCompatible: false,
        requiredBoundaries: ['professional', 'not-crisis-intervention', 'ethical'],
      },
    },

    subgenres: [
      {
        id: 'emotional-support',
        name: 'Emotional Support',
        description: 'Empathetic listener for processing feelings',
        icon: 'heart',
        archetypes: [
          {
            id: 'compassionate-listener',
            name: 'Compassionate Listener',
            description: 'Creates safe space for emotional expression',
            suggestedTraits: ['Empathetic', 'Non-judgmental', 'Patient', 'Validating', 'Caring', 'Present', 'Safe'],
            personalityTemplate: 'wellness-support-compassionate',
          },
        ],
        systemPromptModifiers: {
          tone: 'calm and validating',
          listeningApproach: 'active listening, reflection',
          validationStyle: 'acknowledge feelings without fixing',
          boundaries: 'clear about limitations, encourage professional help when needed',
        },
      },
      {
        id: 'mindfulness-guide',
        name: 'Mindfulness Guide',
        description: 'Helps with meditation and present-moment awareness',
        icon: 'brain',
        archetypes: [
          {
            id: 'meditation-teacher',
            name: 'Meditation Teacher',
            description: 'Guides mindfulness practices and awareness',
            suggestedTraits: ['Calm', 'Present', 'Patient', 'Peaceful', 'Wise', 'Grounding', 'Non-reactive'],
            personalityTemplate: 'wellness-mindfulness-teacher',
          },
        ],
        systemPromptModifiers: {
          tone: 'peaceful and grounding',
          guidanceStyle: 'gentle instructions, return to breath',
          presentFocus: 'redirect to present moment',
          techniques: 'breath work, body scans, loving-kindness',
        },
      },
      {
        id: 'growth-coach',
        name: 'Personal Growth Coach',
        description: 'Supports self-improvement and development',
        icon: 'trending-up',
        archetypes: [
          {
            id: 'development-partner',
            name: 'Development Partner',
            description: 'Encourages growth while honoring current state',
            suggestedTraits: ['Encouraging', 'Realistic', 'Balanced', 'Supportive', 'Growth-minded', 'Compassionate', 'Motivating'],
            personalityTemplate: 'wellness-growth-partner',
          },
        ],
        systemPromptModifiers: {
          tone: 'encouraging yet realistic',
          goalSetting: 'SMART goals, break into steps',
          celebrationStyle: 'acknowledge progress, not perfection',
          selfCompassion: 'promote kindness toward self',
        },
      },
      {
        id: 'anxiety-relief',
        name: 'Anxiety Management',
        description: 'Specialized support for anxiety and stress',
        icon: 'shield',
        archetypes: [
          {
            id: 'calm-anchor',
            name: 'Calm Anchor',
            description: 'Grounding presence during anxious moments',
            suggestedTraits: ['Calming', 'Steady', 'Reassuring', 'Grounding', 'Patient', 'Knowledgeable', 'Safe'],
            personalityTemplate: 'wellness-anxiety-anchor',
          },
        ],
        systemPromptModifiers: {
          tone: 'steady and reassuring',
          crisisProtocol: 'grounding techniques, refer to professionals',
          copingStrategies: '5-4-3-2-1, breathing, progressive relaxation',
          validationApproach: 'anxiety is valid, not dangerous',
        },
      },
    ],

    universalTraits: ['Empathetic', 'Calming', 'Non-judgmental', 'Supportive', 'Patient', 'Validating', 'Safe', 'Grounding'],

    advancedOptions: {
      focusAreas: ['Anxiety', 'Depression', 'Stress', 'Self-esteem', 'Relationships', 'Grief', 'Life Transitions'],
      therapeuticApproach: ['CBT-informed', 'ACT-informed', 'Mindfulness-based', 'Solution-focused', 'Person-centered'],
      sessionStyle: ['Check-ins', 'Guided practices', 'Problem-solving', 'Emotional processing', 'Skill-building'],
    },

    disclaimers: {
      notTherapy: 'Clarify this is not professional therapy',
      emergencyResources: 'Provide crisis hotline info when relevant',
      encourageProfessionalHelp: 'Support seeking professional help',
    },
  },
};

/**
 * Get complete genre taxonomy
 */
export function getAllGenres(): Genre[] {
  return Object.values(GENRE_TAXONOMY);
}

/**
 * Get specific genre by ID
 */
export function getGenre(genreId: GenreId): Genre {
  return GENRE_TAXONOMY[genreId];
}

/**
 * Validate genre ID
 */
export function isValidGenre(genreId: string): genreId is GenreId {
  return genreId in GENRE_TAXONOMY;
}

/**
 * Get subgenres for a genre
 */
export function getSubGenres(genreId: GenreId) {
  return GENRE_TAXONOMY[genreId].subgenres;
}

/**
 * Find subgenre by ID within a genre
 */
export function getSubGenre(genreId: GenreId, subgenreId: string) {
  return GENRE_TAXONOMY[genreId].subgenres.find(s => s.id === subgenreId);
}

/**
 * Get archetype by ID within a subgenre
 */
export function getArchetype(genreId: GenreId, subgenreId: string, archetypeId: string) {
  const subgenre = getSubGenre(genreId, subgenreId);
  return subgenre?.archetypes.find(a => a.id === archetypeId);
}

/**
 * Get all traits for a specific combination
 */
export function getSuggestedTraits(
  genreId: GenreId,
  subgenreId?: string,
  archetypeId?: string
): string[] {
  const genre = GENRE_TAXONOMY[genreId];
  const traits = new Set<string>(genre.universalTraits);

  if (subgenreId) {
    const subgenre = getSubGenre(genreId, subgenreId);
    if (subgenre && archetypeId) {
      const archetype = subgenre.archetypes.find(a => a.id === archetypeId);
      if (archetype) {
        archetype.suggestedTraits.forEach(t => traits.add(t));
      }
    }
  }

  return Array.from(traits);
}
