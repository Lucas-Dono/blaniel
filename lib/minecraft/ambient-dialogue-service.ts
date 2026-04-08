import { getVeniceClient, RECOMMENDED_MODELS } from "@/lib/emotional-system/llm/venice";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("AmbientDialogueService");

interface DialogueParticipant {
  agentId: string;
  name: string;
  personality: string; // Short personality summary
}

interface AmbientDialogueRequest {
  participants: DialogueParticipant[];
  location: string; // e.g., "minecraft:overworld"
  contextHint?: string; // e.g., "near a campfire", "in the marketplace"
  hasImportantHistory?: boolean; // If there are important previous conversations
}

interface AmbientDialogueResponse {
  dialogues: Array<{
    agentId: string;
    agentName: string;
    message: string;
    emotion?: string;
  }>;
  groupHash: string; // Hash para cache
  totalTokens: number;
}

/**
 * Ambient dialogue generation service for Minecraft
 *
 * Generates short conversations between NPCs that the player can hear
 * when passing near a group.
 */
export class AmbientDialogueService {
  /**
   * Dialogue cache by group
   * Key: hash of participants + contextHint
   * Value: array of generated dialogues
   */
  private static dialogueCache = new Map<
    string,
    Array<{ agentId: string; agentName: string; message: string }>
  >();

  /**
   * Dialogue usage history
   * Key: groupHash
   * Value: index of last used dialogue
   */
  private static usageHistory = new Map<string, number>();

  /**
   * Generate unique hash for a group of participants
   */
  private static generateGroupHash(participants: DialogueParticipant[], contextHint?: string): string {
    const ids = participants.map((p) => p.agentId).sort();
    const baseHash = ids.join("_");
    return contextHint ? `${baseHash}_${contextHint}` : baseHash;
  }

  /**
   * Pre-built dialogues
   */
  private static prebuiltDialogues: Array<{ text: string; category: string }> | null = null;

  /**
   * Load pre-built dialogues from file
   */
  private static async loadPrebuiltDialogues(): Promise<void> {
    if (this.prebuiltDialogues) return;

    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const filePath = path.join(
        process.cwd(),
        "Juego/Blaniel-MC/src/main/resources/data/ambient_dialogues.json"
      );

      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      this.prebuiltDialogues = data.dialogues;

      log.info({ count: this.prebuiltDialogues?.length || 0 }, "Loaded prebuilt dialogues");
    } catch (error) {
      log.warn({ error }, "Failed to load prebuilt dialogues, using fallback");
      this.prebuiltDialogues = [
        { text: "What a nice day, isn't it?", category: "weather" },
        { text: "Yes, nice weather today.", category: "weather" },
        { text: "Have you seen anything interesting around here?", category: "observations" },
        { text: "Not much, everything is quiet.", category: "observations" },
        { text: "I wonder what there will be for dinner.", category: "plans" },
      ];
    }
  }

  /**
   * Select random pre-built dialogue
   */
  private static selectPrebuiltDialogue(
    participants: DialogueParticipant[]
  ): AmbientDialogueResponse {
    if (!this.prebuiltDialogues || this.prebuiltDialogues.length === 0) {
      // Minimal fallback
      return {
        dialogues: [
          {
            agentId: participants[0].agentId,
            agentName: participants[0].name,
            message: "What a quiet day.",
          },
        ],
        groupHash: this.generateGroupHash(participants),
        totalTokens: 0,
      };
    }

    // Select 1-2 random dialogues
    const count = Math.random() < 0.6 ? 1 : 2; // 60% one message, 40% two messages
    const selectedDialogues = [];

    for (let i = 0; i < count && i < participants.length; i++) {
      const randomDialogue =
        this.prebuiltDialogues[Math.floor(Math.random() * this.prebuiltDialogues.length)];

      selectedDialogues.push({
        agentId: participants[i].agentId,
        agentName: participants[i].name,
        message: randomDialogue.text,
      });
    }

    return {
      dialogues: selectedDialogues,
      groupHash: this.generateGroupHash(participants),
      totalTokens: 0,
    };
  }

  /**
   * Get dialogue: pre-built or AI-generated
   *
   * Strategy:
   * - No important history: 100% pre-built
   * - With important history: 30% AI, 70% pre-built
   */
  static async getAmbientDialogue(
    request: AmbientDialogueRequest
  ): Promise<AmbientDialogueResponse> {
    // Ensure pre-built dialogues are loaded
    await this.loadPrebuiltDialogues();

    const groupHash = this.generateGroupHash(request.participants, request.contextHint);

    // Decide whether to use AI or pre-built
    const useAI = request.hasImportantHistory && Math.random() < 0.3; // 30% if history exists

    if (!useAI) {
      // Use pre-built dialogue
      log.info({
        groupHash,
        hasImportantHistory: request.hasImportantHistory || false,
      }, "Using prebuilt dialogue");

      return this.selectPrebuiltDialogue(request.participants);
    }

    // Use AI (with cache)
    log.info({
      groupHash,
      hasImportantHistory: true,
    }, "Using AI-generated dialogue");

    // Check cache (40% probability of reusing if exists)
    const cachedDialogues = this.dialogueCache.get(groupHash);
    if (cachedDialogues && Math.random() < 0.4) {
      log.info({ groupHash, count: cachedDialogues.length }, "Reusing cached AI dialogue");

      // Rotate between cached dialogues
      const lastIndex = this.usageHistory.get(groupHash) || 0;
      const nextIndex = (lastIndex + 1) % cachedDialogues.length;
      this.usageHistory.set(groupHash, nextIndex);

      return {
        dialogues: [cachedDialogues[nextIndex]],
        groupHash,
        totalTokens: 0, // Cache hit
      };
    }

    // Generate new dialogue with AI
    const dialogue = await this.generateDialogue(request);

    // Cache for future use
    if (!this.dialogueCache.has(groupHash)) {
      this.dialogueCache.set(groupHash, []);
    }
    this.dialogueCache.get(groupHash)!.push(...dialogue.dialogues);

    // Limit cache size (maximum 5 dialogues per group)
    const cache = this.dialogueCache.get(groupHash)!;
    if (cache.length > 5) {
      cache.shift(); // Remove oldest
    }

    return dialogue;
  }

  /**
   * Generate dialogue using Qwen 3 4B
   */
  private static async generateDialogue(
    request: AmbientDialogueRequest
  ): Promise<AmbientDialogueResponse> {
    const venice = getVeniceClient();

    // Build participant context
    const participantInfo = request.participants
      .map((p, i) => `${i + 1}. ${p.name}: ${p.personality}`)
      .join("\n");

    const systemPrompt = `You are a dialogue generator for a Minecraft game.

Your task is to create a SHORT conversation (1-2 lines per person) between the listed NPCs.
The dialogue should sound natural and spontaneous, as if the player overheard a casual conversation while passing by.

RULES:
- Only 1 response per NPC (2-3 NPCs maximum speak)
- VERY short messages (5-15 words)
- Casual themes: weather, recent events, plans, anecdotes
- NO epic or dramatic dialogues
- NO philosophical questions
- Use each NPC's personality
- Natural and colloquial English

PARTICIPANTS:
${participantInfo}

LOCATION: ${request.location}
${request.contextHint ? `CONTEXT: ${request.contextHint}` : ""}`;

    const userPrompt = `Generate a brief dialogue between these NPCs.

JSON Format:
{
  "dialogues": [
    { "agentId": "id1", "message": "short and natural message" },
    { "agentId": "id2", "message": "short response" }
  ]
}`;

    try {
      const response = await venice.generateJSON<{
        dialogues: Array<{ agentId: string; message: string; emotion?: string }>;
      }>(systemPrompt, userPrompt, {
        model: RECOMMENDED_MODELS.AMBIENT_DIALOGUE, // Qwen 3 4B - económico
        temperature: 0.9, // Alta creatividad
      });

      // Enrich with agent names
      const dialogues = response.dialogues.map((d: { agentId: string; message: string; emotion?: string }) => {
        const participant = request.participants.find((p) => p.agentId === d.agentId);
        return {
          ...d,
          agentName: participant?.name || "NPC",
        };
      });

      const totalTokens = 0; // generateJSON doesn't return usage

      log.info({
        dialogues: dialogues.length,
        tokens: totalTokens,
        cost: (totalTokens * 0.15) / 1_000_000, // ~$0.15 per million
      }, "Ambient dialogue generated");

      return {
        dialogues,
        groupHash: this.generateGroupHash(request.participants, request.contextHint),
        totalTokens,
      };
    } catch (error) {
      log.error({ error }, "Failed to generate ambient dialogue");

      // Fallback: generic dialogue
      return {
        dialogues: [
          {
            agentId: request.participants[0].agentId,
            agentName: request.participants[0].name,
            message: "Nice day, isn't it?",
          },
          {
            agentId: request.participants[1]?.agentId || request.participants[0].agentId,
            agentName: request.participants[1]?.name || request.participants[0].name,
            message: "Yes, lovely weather today.",
          },
        ],
        groupHash: this.generateGroupHash(request.participants, request.contextHint),
        totalTokens: 0,
      };
    }
  }

  /**
   * Get summarized agent information for dialogues
   */
  static async getParticipantInfo(agentIds: string[]): Promise<DialogueParticipant[]> {
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: {
        id: true,
        name: true,
        profile: true,
      },
    });

    return agents.map((agent) => {
      const profile = agent.profile as any;
      const personality = profile?.identity?.personalityOverview ||
        profile?.identity?.shortBio ||
        "Friendly NPC";

      return {
        agentId: agent.id,
        name: agent.name,
        personality: personality.substring(0, 100), // Máximo 100 chars
      };
    });
  }

  /**
   * Clear old cache (call periodically)
   */
  static clearOldCache(): void {
    if (this.dialogueCache.size > 100) {
      log.info({ size: this.dialogueCache.size }, "Clearing dialogue cache");
      this.dialogueCache.clear();
      this.usageHistory.clear();
    }
  }
}
