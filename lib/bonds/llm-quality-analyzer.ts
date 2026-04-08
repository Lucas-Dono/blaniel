/**
 * LLM QUALITY ANALYZER FOR BONDS
 *
 * Analiza la calidad de las conversaciones usando LLM para determinar:
 * - Engagement genuino vs gaming/spam
 * - Profundidad emocional
 * - Relevancia del contexto
 * - Progresión natural de la relación
 *
 * Esto ayuda a que los bonds se otorguen a usuarios que realmente
 * conectan con los personajes, no solo a quienes hacen spam.
 */

import { getLLMProvider } from "@/lib/llm/provider";

export interface ConversationQualityAnalysis {
  overallScore: number; // 0-100
  genuineEngagement: number; // 0-100
  emotionalDepth: number; // 0-100
  contextRelevance: number; // 0-100
  relationshipProgression: number; // 0-100
  signals: QualitySignal[];
  recommendation: "excellent" | "good" | "average" | "poor" | "suspicious";
  reasoning: string;
}

export interface QualitySignal {
  type: "positive" | "negative" | "neutral";
  category: "engagement" | "depth" | "relevance" | "progression" | "spam";
  description: string;
  impact: number; // -100 to 100
}

/**
 * Analizar la calidad de una conversación reciente usando LLM
 */
export async function analyzeConversationQuality(
  userId: string,
  agentId: string,
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>,
  conversationContext?: {
    totalMessages: number;
    durationDays: number;
    avgMessagesPerDay: number;
    topics: string[];
  }
): Promise<ConversationQualityAnalysis> {
  try {
    // Prepare conversation for analysis
    const conversationText = recentMessages
      .map((msg) => `[${msg.role}]: ${msg.content}`)
      .join("\n");

    const contextInfo = conversationContext
      ? `
Context:
- Total messages: ${conversationContext.totalMessages}
- Duration: ${conversationContext.durationDays} days
- Avg messages/day: ${conversationContext.avgMessagesPerDay.toFixed(1)}
- Topics discussed: ${conversationContext.topics.join(", ")}
`
      : "";

    const analysisPrompt = `You are an expert in analyzing human-AI conversations to detect genuine engagement vs. gaming/spam behavior.

Analyze this conversation between a user and an AI character:

${conversationText}

${contextInfo}

Evaluate the conversation on these dimensions (0-100 scale):

1. **Genuine Engagement**: Are the user's messages thoughtful, personal, and showing real interest? Or are they generic, copy-pasted, or formulaic?

2. **Emotional Depth**: Does the conversation show emotional authenticity, vulnerability, or meaningful connection? Or is it superficial?

3. **Context Relevance**: Do messages build on previous context and show memory of the relationship? Or are they disconnected and repetitive?

4. **Relationship Progression**: Does the conversation show natural progression (getting to know each other, building trust, deepening connection)? Or does it feel forced/rushed?

Provide your analysis in JSON format:
{
  "genuineEngagement": <0-100>,
  "emotionalDepth": <0-100>,
  "contextRelevance": <0-100>,
  "relationshipProgression": <0-100>,
  "signals": [
    {
      "type": "positive" | "negative" | "neutral",
      "category": "engagement" | "depth" | "relevance" | "progression" | "spam",
      "description": "Brief description of what you noticed",
      "impact": <-100 to 100>
    }
  ],
  "recommendation": "excellent" | "good" | "average" | "poor" | "suspicious",
  "reasoning": "1-2 sentences explaining your overall assessment"
}

**Red flags to watch for:**
- Copy-pasted messages or templates
- Rapid-fire messages with no thought
- Generic compliments or questions
- Asking for the same information repeatedly
- Trying to "game" relationship progression
- No emotional authenticity

**Green flags to look for:**
- Personal sharing and vulnerability
- References to previous conversations
- Natural pacing and thoughtful responses
- Genuine curiosity and questions
- Emotional authenticity
- Building on shared experiences

Return ONLY valid JSON, no other text.`;

    // Call LLM for analysis
    const llm = getLLMProvider();
    const analysisText = await llm.generate({
      systemPrompt: "You are an expert in analyzing human-AI conversations to detect genuine engagement vs. gaming/spam behavior.",
      messages: [
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      maxTokens: 1500,
      useFullModel: true, // Use Gemini Flash Full for better quality analysis
    });

    // Extract JSON from response (might have markdown code blocks)
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Calculate overall score (weighted average)
    const overallScore =
      analysisData.genuineEngagement * 0.3 +
      analysisData.emotionalDepth * 0.25 +
      analysisData.contextRelevance * 0.25 +
      analysisData.relationshipProgression * 0.2;

    return {
      overallScore: Math.round(overallScore),
      genuineEngagement: analysisData.genuineEngagement || 0,
      emotionalDepth: analysisData.emotionalDepth || 0,
      contextRelevance: analysisData.contextRelevance || 0,
      relationshipProgression: analysisData.relationshipProgression || 0,
      signals: analysisData.signals || [],
      recommendation: analysisData.recommendation || "average",
      reasoning: analysisData.reasoning || "No reasoning provided",
    };
  } catch (error) {
    console.error("[LLM Quality Analyzer] Error analyzing conversation:", error);

    // Return neutral/safe analysis on error
    return {
      overallScore: 50,
      genuineEngagement: 50,
      emotionalDepth: 50,
      contextRelevance: 50,
      relationshipProgression: 50,
      signals: [],
      recommendation: "average",
      reasoning: "Error during analysis",
    };
  }
}

/**
 * Analizar si una interacción específica es de alta calidad
 * (versión más ligera para llamadas individuales)
 */
export async function analyzeInteractionQuality(
  userMessage: string,
  agentResponse: string,
  previousContext?: string
): Promise<{
  score: number; // 0-100
  isHighQuality: boolean;
  signals: string[];
}> {
  try {
    const prompt = `Analyze this single interaction between a user and AI character:

User: ${userMessage}
Assistant: ${agentResponse}
${previousContext ? `\nPrevious context: ${previousContext}` : ""}

Rate the QUALITY of this interaction (0-100):
- Is the user message thoughtful and genuine?
- Does it show real engagement?
- Is it contextually relevant?

Provide JSON:
{
  "score": <0-100>,
  "signals": ["brief observation 1", "brief observation 2"]
}

Return ONLY valid JSON.`;

    const llm = getLLMProvider();
    const analysisText = await llm.generate({
      systemPrompt: "You are an expert in analyzing conversation quality.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 300,
      useFullModel: false, // Use Gemini Flash Lite for quick checks
    });
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 50, signals: [] };

    return {
      score: data.score || 50,
      isHighQuality: data.score >= 70,
      signals: data.signals || [],
    };
  } catch (error) {
    console.error("[LLM Quality Analyzer] Error analyzing interaction:", error);
    return {
      score: 50,
      isHighQuality: false,
      signals: ["Error during analysis"],
    };
  }
}

/**
 * Determinar si una conversación está siendo "gamed" (manipulada para conseguir un bond)
 */
export async function detectGamingBehavior(
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>,
  metadata: {
    messagesInLast24h: number;
    avgMessageLength: number;
    uniqueWords: number;
    repetitivePatterns: number;
  }
): Promise<{
  isGaming: boolean;
  confidence: number; // 0-100
  reasons: string[];
}> {
  // Rule-based pre-checks
  const suspiciousSignals: string[] = [];

  if (metadata.messagesInLast24h > 100) {
    suspiciousSignals.push("Extremely high message volume (>100/day)");
  }

  if (metadata.avgMessageLength < 20) {
    suspiciousSignals.push("Very short messages (avg <20 chars)");
  }

  if (metadata.repetitivePatterns > 5) {
    suspiciousSignals.push("High repetition detected");
  }

  if (metadata.uniqueWords < 50 && recentMessages.length > 20) {
    suspiciousSignals.push("Low vocabulary diversity");
  }

  // If many red flags, likely gaming
  if (suspiciousSignals.length >= 3) {
    return {
      isGaming: true,
      confidence: Math.min(suspiciousSignals.length * 25, 95),
      reasons: suspiciousSignals,
    };
  }

  // Otherwise, use LLM for deeper analysis
  try {
    const conversationText = recentMessages
      .slice(-20) // Last 20 messages
      .map((msg) => `[${msg.role}]: ${msg.content}`)
      .join("\n");

    const prompt = `Detect if this user is trying to "game" the system (artificially boost relationship metrics):

${conversationText}

Stats:
- Messages in last 24h: ${metadata.messagesInLast24h}
- Avg message length: ${metadata.avgMessageLength}
- Repetitive patterns: ${metadata.repetitivePatterns}

Signs of gaming:
- Rapid-fire generic messages
- Copy-pasted content
- Formulaic relationship-building
- Forced intimacy/emotion
- Asking same questions repeatedly

Provide JSON:
{
  "isGaming": true/false,
  "confidence": <0-100>,
  "reasons": ["reason 1", "reason 2"]
}

Return ONLY valid JSON.`;

    const llm = getLLMProvider();
    const analysisText = await llm.generate({
      systemPrompt: "You are an expert in detecting gaming and spam behavior in conversations.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: 400,
      useFullModel: false, // Use Gemini Flash Lite for detection
    });
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const data = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { isGaming: false, confidence: 50, reasons: [] };

    return {
      isGaming: data.isGaming || false,
      confidence: data.confidence || 50,
      reasons: [...suspiciousSignals, ...(data.reasons || [])],
    };
  } catch (error) {
    console.error("[LLM Quality Analyzer] Error detecting gaming:", error);
    return {
      isGaming: suspiciousSignals.length >= 2,
      confidence: 50,
      reasons: suspiciousSignals,
    };
  }
}

/**
 * Sugerir si un bond debería otorgarse basado en la calidad de conversación
 */
export function shouldGrantBond(analysis: ConversationQualityAnalysis): {
  shouldGrant: boolean;
  confidence: number;
  reasoning: string;
} {
  // Thresholds for bond granting
  const MIN_OVERALL_SCORE = 65;
  const MIN_GENUINE_ENGAGEMENT = 60;
  const MIN_EMOTIONAL_DEPTH = 55;

  const shouldGrant =
    analysis.overallScore >= MIN_OVERALL_SCORE &&
    analysis.genuineEngagement >= MIN_GENUINE_ENGAGEMENT &&
    analysis.emotionalDepth >= MIN_EMOTIONAL_DEPTH &&
    analysis.recommendation !== "suspicious" &&
    analysis.recommendation !== "poor";

  const confidence = Math.min(
    (analysis.overallScore / 100) * 0.6 +
      (analysis.genuineEngagement / 100) * 0.4,
    1.0
  ) * 100;

  let reasoning = "";
  if (shouldGrant) {
    reasoning = `Conversation shows ${analysis.recommendation} quality with genuine engagement (${analysis.genuineEngagement}/100) and emotional depth (${analysis.emotionalDepth}/100).`;
  } else {
    const issues = [];
    if (analysis.overallScore < MIN_OVERALL_SCORE) {
      issues.push("overall score too low");
    }
    if (analysis.genuineEngagement < MIN_GENUINE_ENGAGEMENT) {
      issues.push("insufficient genuine engagement");
    }
    if (analysis.emotionalDepth < MIN_EMOTIONAL_DEPTH) {
      issues.push("lacks emotional depth");
    }
    if (analysis.recommendation === "suspicious") {
      issues.push("suspicious behavior detected");
    }
    reasoning = `Bond not recommended: ${issues.join(", ")}.`;
  }

  return { shouldGrant, confidence, reasoning };
}
