import {
  MinecraftPlayer,
  MinecraftAgent,
  MinecraftPosition,
  ProximityContext,
  AgentProximityInfo,
  DEFAULT_MINECRAFT_CHAT_CONFIG,
} from "@/types/minecraft-chat";

/**
 * Proximity Detector for Minecraft
 *
 * Detects which agents are near the player and calculates confidence scores
 * to determine if the message is individual or group.
 *
 * Scoring system:
 * - Distance: Closer = higher score (max 40 pts)
 * - Visibility: In line of sight = +20 pts
 * - Direction: Looking directly = +30 pts
 * - Mentions: Name mentioned = +100 pts
 *
 * Scores:
 * - 80-100: Almost certainly the main target
 * - 60-79: Probably included in conversation
 * - 40-59: Possibly listening
 * - 0-39: Probably not part of conversation
 */

export class ProximityDetector {
  private readonly config = DEFAULT_MINECRAFT_CHAT_CONFIG;

  /**
   * Analyzes player proximity context
   */
  async analyzeProximity(
    player: MinecraftPlayer,
    nearbyAgents: MinecraftAgent[],
    message: string
  ): Promise<ProximityContext> {
    // 1. Filter agents within proximity radius
    const agentsInRange = this.filterByProximity(
      player.position,
      nearbyAgents,
      this.config.proximityRadius
    );

    if (agentsInRange.length === 0) {
      return {
        player,
        nearbyAgents: [],
        primaryTarget: null,
        isGroupConversation: false,
        detectedAt: new Date(),
      };
    }

    // 2. Calculate scores for each agent
    const proximityInfos = agentsInRange.map((agent) =>
      this.calculateProximityScore(player, agent, message)
    );

    // 3. Sort by score descending
    const sorted = proximityInfos.sort(
      (a, b) => b.confidenceScore - a.confidenceScore
    );

    // 4. Determine primary target
    const primaryTarget = sorted[0];

    // 5. Determine if it's group or individual conversation
    const isGroupConversation = this.determineConversationType(
      sorted,
      message
    );

    return {
      player,
      nearbyAgents: sorted,
      primaryTarget: primaryTarget || null,
      isGroupConversation,
      detectedAt: new Date(),
    };
  }

  /**
   * Filter agents within proximity radius
   */
  private filterByProximity(
    playerPos: MinecraftPosition,
    agents: MinecraftAgent[],
    radius: number
  ): MinecraftAgent[] {
    return agents.filter((agent) => {
      const distance = this.calculateDistance3D(
        playerPos,
        agent.position
      );
      return distance <= radius && agent.isActive;
    });
  }

  /**
   * Calculate proximity score for an agent
   */
  private calculateProximityScore(
    player: MinecraftPlayer,
    agent: MinecraftAgent,
    message: string
  ): AgentProximityInfo {
    const reasons: string[] = [];
    let score = 0;

    // 1. Calculate distance (0-40 pts)
    const distance = this.calculateDistance3D(
      player.position,
      agent.position
    );
    const distanceScore = Math.max(
      0,
      40 * (1 - distance / this.config.proximityRadius)
    );
    score += distanceScore;

    if (distance <= 5) {
      reasons.push("very close (< 5 blocks)");
    } else if (distance <= 10) {
      reasons.push("close (< 10 blocks)");
    }

    // 2. Visibility - line of sight (0 or 20 pts)
    const isVisible = this.checkLineOfSight(
      player.position,
      agent.position
    );
    if (isVisible) {
      score += 20;
      reasons.push("in line of sight");
    }

    // 3. Direction - is the player facing the agent? (0 or 30 pts)
    const isFacing = this.isPlayerFacing(
      player.position,
      agent.position,
      this.config.facingAngleThreshold
    );
    if (isFacing) {
      score += 30;
      reasons.push("player facing directly");
    }

    // 4. Mentions in message (+100 pts if mentioned)
    const isMentioned = this.isAgentMentioned(agent.name, message);
    if (isMentioned) {
      score += 100;
      reasons.push("mentioned by name");
    }

    return {
      agent,
      distance,
      isVisible,
      isFacing,
      confidenceScore: Math.min(100, score), // Cap a 100
      reasons,
    };
  }

  /**
   * Calculate 3D Euclidean distance
   */
  private calculateDistance3D(
    pos1: MinecraftPosition,
    pos2: MinecraftPosition
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Check line of sight
   *
   * Simplification: Assumes that if height difference is < 3 blocks
   * and there are no obvious obstructions, there is line of sight.
   *
   * In production, this should do raycast on the Minecraft server.
   */
  private checkLineOfSight(
    playerPos: MinecraftPosition,
    agentPos: MinecraftPosition
  ): boolean {
    // Simplification: if height difference > 3 blocks, probably no LoS
    const heightDiff = Math.abs(playerPos.y - agentPos.y);
    if (heightDiff > 3) {
      return false;
    }

    // TODO: In production, request raycast from Minecraft server
    // For now, we assume LoS if they are at similar heights
    return true;
  }

  /**
   * Check if the player is facing the agent
   *
   * Calculates the angle between the player's direction (yaw/pitch)
   * and the vector towards the agent.
   */
  private isPlayerFacing(
    playerPos: MinecraftPosition,
    agentPos: MinecraftPosition,
    angleThreshold: number
  ): boolean {
    // If there is no orientation data, we cannot determine
    if (playerPos.yaw === undefined || playerPos.pitch === undefined) {
      return false;
    }

    // Vector from player to agent
    const dx = agentPos.x - playerPos.x;
    const dy = agentPos.y - playerPos.y;
    const dz = agentPos.z - playerPos.z;

    // Calculate yaw of vector (horizontal angle)
    let targetYaw = Math.atan2(dz, dx) * (180 / Math.PI);
    targetYaw = (targetYaw + 360) % 360; // Normalize 0-360

    // Calculate pitch of vector (vertical angle)
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const targetPitch = -Math.atan2(dy, horizontalDist) * (180 / Math.PI);

    // Calculate angular difference
    const yawDiff = this.getAngularDifference(playerPos.yaw, targetYaw);
    const pitchDiff = Math.abs(playerPos.pitch - targetPitch);

    // Check if within threshold
    return yawDiff <= angleThreshold && pitchDiff <= angleThreshold;
  }

  /**
   * Calculate shortest angular difference (considering 0-360 wrap-around)
   */
  private getAngularDifference(angle1: number, angle2: number): number {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  }

  /**
   * Check if agent is mentioned in message
   */
  private isAgentMentioned(agentName: string, message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    const normalizedName = agentName.toLowerCase();

    // Search for mentions: "@name", "name", or parts of name
    const patterns = [
      `@${normalizedName}`,
      normalizedName,
      ...this.getNameVariations(normalizedName),
    ];

    return patterns.some((pattern) => normalizedMessage.includes(pattern));
  }

  /**
   * Generate name variations for flexible detection
   */
  private getNameVariations(name: string): string[] {
    const variations: string[] = [];

    // First name if it has spaces
    if (name.includes(" ")) {
      variations.push(name.split(" ")[0]);
    }

    // Common nicknames (first 4 letters)
    if (name.length >= 4) {
      variations.push(name.substring(0, 4));
    }

    return variations;
  }

  /**
   * Determine if it's group or individual conversation
   *
   * Criteria:
   * - If multiple agents with score > 60 → group
   * - If multiple mentions → group
   * - If first score > 80 and others < 50 → individual
   * - Group keywords ("everyone", "guys", "team") → group
   */
  private determineConversationType(
    sortedProximities: AgentProximityInfo[],
    message: string
  ): boolean {
    if (sortedProximities.length === 0) return false;
    if (sortedProximities.length === 1) return false;

    // Count agents with significant score (> 60)
    const highScoreAgents = sortedProximities.filter(
      (p) => p.confidenceScore > 60
    );

    if (highScoreAgents.length >= 2) {
      return true; // Multiple clear targets → group
    }

    // Check group keywords
    const groupKeywords = [
      "everyone",
      "you all",
      "guys",
      "girls",
      "team",
      "group",
      "friends",
      "you all",
      "all of you",
      "hey all",
      "everyone",
      "guys",
    ];

    const normalizedMessage = message.toLowerCase();
    const hasGroupKeyword = groupKeywords.some((keyword) =>
      normalizedMessage.includes(keyword)
    );

    if (hasGroupKeyword) {
      return true;
    }

    // If first has very high score (> 80) and others low (< 50) → individual
    const first = sortedProximities[0];
    const others = sortedProximities.slice(1);

    if (
      first.confidenceScore > 80 &&
      others.every((p) => p.confidenceScore < 50)
    ) {
      return false; // Clearly individual
    }

    // By default, if multiple nearby agents → group
    return sortedProximities.length >= 2;
  }

  /**
   * Filter agents that should respond based on scores
   */

  /**
   * Filtra agentes que deberían responder basado en scores
   */
  public selectRespondingAgents(
    proximityInfos: AgentProximityInfo[],
    maxResponders: number = this.config.maxResponders
  ): MinecraftAgent[] {
    // Filter only agents with significant score (> 40)
    const candidates = proximityInfos.filter(
      (p) => p.confidenceScore > 40
    );

    // Sort by score and take top N
    const sorted = candidates.sort(
      (a, b) => b.confidenceScore - a.confidenceScore
    );

    return sorted
      .slice(0, maxResponders)
      .map((p) => p.agent);
  }

  /**
   * Utility: Convert blocks to meters (1 block ≈ 2 meters)
   */
  public static blocksToMeters(blocks: number): number {
    return blocks * 2;
  }

  /**
   * Utility: Convert meters to blocks
   */
  public static metersToBlocks(meters: number): number {
    return meters / 2;
  }
}

// Exportar instancia singleton
export const proximityDetector = new ProximityDetector();
