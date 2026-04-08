/**
 * Conversation Scripts System for Minecraft Groups
 *
 * Generates complete conversations with coherent structure:
 * Greeting → Development → Farewell
 */

/**
 * Phases of a conversation
 */
export enum ConversationPhase {
  GREETING = "greeting", // Initial greeting (1-2 exchanges)
  TOPIC_INTRODUCTION = "topic_introduction", // Topic introduction (2-3 exchanges)
  DEVELOPMENT = "development", // Topic development (3-5 exchanges)
  CONCLUSION = "conclusion", // Conclusion (1-2 exchanges)
  FAREWELL = "farewell", // Farewell (1-2 exchanges)
}

/**
 * Individual dialogue line
 */
export interface DialogueLine {
  agentId: string;
  agentName: string;
  message: string;
  emotion?: string;
  phase: ConversationPhase;
  lineNumber: number; // Line number in the script
}

/**
 * Complete conversation script
 */
export interface ConversationScript {
  scriptId: string; // Unique UUID
  version: number; // Version number (increments with each update)
  participants: Array<{
    agentId: string;
    name: string;
    personality: string;
  }>;
  topic: string; // Main conversation topic
  location: string;
  contextHint?: string;
  lines: DialogueLine[]; // All script lines (typically 10-15)
  duration: number; // Estimated duration in seconds
  createdAt: Date;
  updatedAt: Date; // Last update
  generatedBy: "ai" | "template"; // Script origin
}

/**
 * Script metadata (without full lines)
 * Used for version verification
 */
export interface ScriptMetadata {
  scriptId: string;
  groupHash: string;
  version: number;
  topic: string;
  totalLines: number;
  updatedAt: Date;
  generatedBy: "ai" | "template";
}

/**
 * Active conversation progress state
 */
export interface ConversationProgress {
  scriptId: string;
  groupHash: string; // Hash of participants
  currentLineIndex: number; // Current script line
  currentPhase: ConversationPhase;
  startedAt: Date;
  lastAdvanceAt: Date;
  completed: boolean;
  listeners: string[]; // IDs of players who listened
}

/**
 * Timing configuration for script progression
 */
export interface ScriptTiming {
  minDelayBetweenLines: number; // Minimum delay between lines (seconds)
  maxDelayBetweenLines: number; // Maximum delay between lines (seconds)
  pauseAtPhaseChange: number; // Pause when changing phases (seconds)
  loopAfterCompletion: boolean; // Restart after completion?
  loopDelay: number; // Delay before restarting (seconds)
}

/**
 * Pre-defined conversation template
 */
export interface ConversationTemplate {
  id: string;
  name: string;
  topic: string;
  category: "casual" | "work" | "gossip" | "planning" | "storytelling";
  minParticipants: number;
  maxParticipants: number;
  lines: Array<{
    speakerIndex: number; // 0 = first participant, 1 = second, etc.
    message: string; // Can contain placeholders: {name}, {personality}
    phase: ConversationPhase;
  }>;
}

/**
 * Options for generating a script
 */
export interface ScriptGenerationOptions {
  participants: Array<{
    agentId: string;
    name: string;
    personality: string;
  }>;
  location: string;
  contextHint?: string;
  topic?: string; // If not provided, auto-generated
  desiredLength?: number; // Desired number of lines (10-20)
  useTemplate?: boolean; // If true, try using template first
  forceAI?: boolean; // If true, force AI generation
}

/**
 * Script generation result
 */
export interface ScriptGenerationResult {
  script: ConversationScript;
  cached: boolean; // If a cached script was reused
  cost: number; // Cost in USD (if used AI)
  source: "ai" | "template" | "cache";
}
