/**
 * KNOWLEDGE COMMAND INTERCEPTOR
 *
 * Handles the flow of detection and interception of knowledge retrieval commands.
 * If the AI responds with a command, it intercepts it and resends the request with expanded context.
 */

import { detectKnowledgeCommand, getKnowledgeGroup, cleanKnowledgeCommands } from "./knowledge-retrieval";

export interface InterceptResult {
  shouldIntercept: boolean;
  command?: string;
  knowledgeContext?: string;
  cleanResponse: string; // ALWAYS returns a clean response
}

/**
 * Intercepts the AI response and detects if it contains a command
 */
export async function interceptKnowledgeCommand(
  agentId: string,
  aiResponse: string
): Promise<InterceptResult> {
  // Detect if there's a command in the response
  const command = detectKnowledgeCommand(aiResponse);

  if (!command) {
    // No command, but clean in case there are loose tags
    return {
      shouldIntercept: false,
      cleanResponse: cleanKnowledgeCommands(aiResponse),
    };
  }

  console.log(`[KnowledgeInterceptor] Command detected: ${command}`);

  // There's a command, get the corresponding knowledge group
  const knowledgeContext = await getKnowledgeGroup(agentId, command);

  console.log(`[KnowledgeInterceptor] Knowledge context obtained (${knowledgeContext.length} chars)`);

  return {
    shouldIntercept: true,
    command,
    knowledgeContext,
    cleanResponse: cleanKnowledgeCommands(aiResponse),
  };
}

/**
 * Builds an expanded prompt with the knowledge context
 */
export function buildExpandedPrompt(
  originalPrompt: string,
  knowledgeContext: string,
  command: string
): string {
  return `${originalPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL CONTEXT (You requested: ${command})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${knowledgeContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now that you have this information, answer the user's question naturally.
DO NOT mention that you "requested information" or the command system.
Respond as if you always had this information in your memory.
`;
}

/**
 * Command usage statistics (for analytics)
 */
export async function logCommandUsage(
  agentId: string,
  command: string,
  contextSize: number
): Promise<void> {
  try {
    // You could save statistics to the database here if you want
    console.log(`[KnowledgeStats] Agent ${agentId} used ${command} (${contextSize} chars)`);

    // Optional: save to an analytics table
    // await prisma.knowledgeCommandLog.create({
    //   data: { agentId, command, contextSize, timestamp: new Date() }
    // });
  } catch (error) {
    console.error("[KnowledgeStats] Error logging command usage:", error);
  }
}

/**
 * Calculates estimated token savings
 */
export function calculateTokenSavings(
  totalProfileSize: number,
  usedContextSize: number
): { savedTokens: number; savingPercentage: number } {
  const savedTokens = totalProfileSize - usedContextSize;
  const savingPercentage = (savedTokens / totalProfileSize) * 100;

  return {
    savedTokens,
    savingPercentage,
  };
}
