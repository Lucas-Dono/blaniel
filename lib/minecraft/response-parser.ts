import {
  ResponsePart,
  AgentCommand,
  MinecraftAgentResponse,
} from "@/types/minecraft-chat";
import { nanoid } from "nanoid";

/**
 * Response Parser
 *
 * Parses structured LLM responses and converts them into
 * MinecraftAgentResponse objects with separated parts.
 *
 * Supports:
 * - Simple messages (speech only)
 * - Messages with commands (speech + command + continuation)
 * - Redirects (speech + redirect_question)
 */
export class ResponseParser {
  /**
   * Parses structured LLM response
   */
  parseStructuredResponse(
    llmResponse: any,
    agentId: string,
    agentName: string,
    turnNumber: number
  ): MinecraftAgentResponse {
    const parts = llmResponse.parts || [];

    // Extract full content (for backward compatibility)
    const fullContent = parts
      .filter((p: any) => p.type === "speech" || p.type === "continuation")
      .map((p: any) => p.content)
      .join(" ");

    // Extract emotion and animation from first speech part
    const firstSpeech = parts.find((p: any) => p.type === "speech");
    const emotion = firstSpeech?.emotion || "neutral";
    const animationHint = firstSpeech?.animationHint || "talking";

    return {
      messageId: nanoid(),
      agentId,
      agentName,
      content: fullContent,
      parts: parts as ResponsePart[],
      emotion,
      emotionalIntensity: this.estimateEmotionalIntensity(emotion),
      timestamp: new Date(),
      turnNumber,
      animationHint: animationHint as any,
    };
  }

  /**
   * Extracts commands from a response
   */
  extractCommands(response: MinecraftAgentResponse): AgentCommand[] {
    if (!response.parts) return [];

    return response.parts
      .filter((p) => p.type === "command")
      .map((p) => (p as any).command as AgentCommand);
  }

  /**
   * Check if response has commands that pause the message
   */
  hasPausingCommands(response: MinecraftAgentResponse): boolean {
    const commands = this.extractCommands(response);
    return commands.some((cmd) => cmd.pauseMessage);
  }

  /**
   * Get continuation message (after commands)
   */
  getContinuationMessage(response: MinecraftAgentResponse): string | null {
    if (!response.parts) return null;

    const continuation = response.parts.find((p) => p.type === "continuation");
    return continuation ? (continuation as any).content : null;
  }

  /**
   * Separate response into phases (pre-command, post-command)
   */
  splitResponsePhases(response: MinecraftAgentResponse): {
    beforeCommand: string;
    command: AgentCommand | null;
    afterCommand: string | null;
  } {
    if (!response.parts) {
      return {
        beforeCommand: response.content,
        command: null,
        afterCommand: null,
      };
    }

    const parts = response.parts;
    const commandIndex = parts.findIndex((p) => p.type === "command");

    if (commandIndex === -1) {
      return {
        beforeCommand: response.content,
        command: null,
        afterCommand: null,
      };
    }

    // Content before command
    const beforeParts = parts.slice(0, commandIndex);
    const beforeCommand = beforeParts
      .filter((p) => p.type === "speech")
      .map((p) => (p as any).content)
      .join(" ");

    // Command
    const command = (parts[commandIndex] as any).command as AgentCommand;

    // Content after command
    const afterParts = parts.slice(commandIndex + 1);
    const afterCommand =
      afterParts.length > 0
        ? afterParts
            .filter((p) => p.type === "speech" || p.type === "continuation")
            .map((p) => (p as any).content)
            .join(" ")
        : null;

    return {
      beforeCommand,
      command,
      afterCommand,
    };
  }

  /**
   * Convert structured response to simple format (for compatibility)
   */
  toSimpleResponse(response: MinecraftAgentResponse): {
    agentId: string;
    agentName: string;
    content: string;
    animationHint: string;
  } {
    return {
      agentId: response.agentId,
      agentName: response.agentName,
      content: response.content,
      animationHint: response.animationHint || "talking",
    };
  }

  /**
   * Estimate emotional intensity based on emotion
   */
  private estimateEmotionalIntensity(emotion: string): number {
    const intensityMap: Record<string, number> = {
      neutral: 0.3,
      happy: 0.7,
      sad: 0.6,
      angry: 0.9,
      surprised: 0.8,
      thinking: 0.4,
      curious: 0.5,
      friendly: 0.6,
    };

    return intensityMap[emotion] || 0.5;
  }

  /**
   * Validate that a structured response has the correct format
   */
  validateStructuredResponse(llmResponse: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!llmResponse.parts || !Array.isArray(llmResponse.parts)) {
      errors.push("Missing or invalid 'parts' array");
      return { valid: false, errors };
    }

    if (llmResponse.parts.length === 0) {
      errors.push("'parts' array is empty");
      return { valid: false, errors };
    }

    // Validate each part
    llmResponse.parts.forEach((part: any, index: number) => {
      if (!part.type) {
        errors.push(`Part ${index}: missing 'type' field`);
      } else if (!["speech", "command", "continuation"].includes(part.type)) {
        errors.push(`Part ${index}: invalid type '${part.type}'`);
      }

      if (part.type === "speech" && !part.content) {
        errors.push(`Part ${index}: speech part missing 'content'`);
      }

      if (part.type === "command" && !part.command) {
        errors.push(`Part ${index}: command part missing 'command' object`);
      }

      if (part.type === "continuation" && !part.content) {
        errors.push(`Part ${index}: continuation part missing 'content'`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Exportar instancia singleton
export const responseParser = new ResponseParser();
