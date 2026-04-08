import { NextRequest, NextResponse } from "next/server";
import { getAIHordeClient } from "@/lib/visual-system/ai-horde-client";

/**
 * API endpoint for generating reference image of a character
 *
 * POST /api/agents/generate-reference-image
 *
 * Body: {
 *   name: string;
 *   personality: string;
 *   physicalAppearance?: string; // New detailed physical description
 *   gender?: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    console.log("[API] Generating reference image...");

    const body = await req.json();
    const { name, personality, physicalAppearance, gender } = body;

    if (!name || !personality) {
      return NextResponse.json(
        { error: "Name and personality are required" },
        { status: 400 }
      );
    }

    // Build prompt for reference image
    const prompt = buildReferenceImagePrompt(name, personality, physicalAppearance, gender);

    console.log("[API] Prompt generated:", prompt);

    // Generate image with AI Horde
    const aiHordeClient = getAIHordeClient();
    const result = await aiHordeClient.generateImage({
      prompt,
      negativePrompt:
        "low quality, blurry, distorted, deformed, anime, cartoon, multiple people, text, watermark, signature, low resolution, bad anatomy, ugly, duplicate, mutated",
      width: 512,
      height: 768, // Vertical for full body
      steps: 35, // More steps for better quality
      cfgScale: 7.5,
      sampler: "k_euler_a",
      seed: -1,
      nsfw: false,
      karras: true,
    });

    console.log("[API] Image generated successfully");

    return NextResponse.json({
      imageUrl: result.imageUrl,
      model: result.model,
      kudosCost: result.kudosCost,
      generationTime: result.generationTime,
    });
  } catch (error) {
    console.error("[API] Error generating reference image:", error);
    return NextResponse.json(
      {
        error: "Failed to generate reference image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Builds a detailed prompt for the reference image
 */
function buildReferenceImagePrompt(
  name: string,
  personality: string,
  physicalAppearance?: string,
  gender?: string
): string {
  // If there is physicalAppearance, use it directly (priority)
  if (physicalAppearance && physicalAppearance !== "random") {
    // Detailed physical description provided by the user
    const prompt = `Professional reference portrait photograph of ${name}.
Physical description: ${physicalAppearance}.
Full body portrait, standing position, neutral white background.
Natural lighting, high quality, photorealistic, detailed facial features,
consistent appearance for character reference, professional photography.
Clear, sharp focus, 4K quality.
Character personality: ${personality.substring(0, 100)}.`;

    return prompt;
  }

  // If physicalAppearance is "random", generate random appearance
  if (physicalAppearance === "random") {
    const prompt = `Professional reference portrait photograph of ${name}.
Unique and creative character design, randomized appearance features.
Full body portrait, standing position, neutral white background.
Natural lighting, high quality, photorealistic, detailed facial features,
consistent appearance for character reference, professional photography.
Clear, sharp focus, 4K quality.
Character personality: ${personality.substring(0, 100)}.`;

    return prompt;
  }

  // FALLBACK: Use previous method (infer from personality)
  const personalityLower = personality.toLowerCase();

  // Determine gender
  let genderPrompt = "";
  if (gender) {
    genderPrompt =
      gender.toLowerCase().includes("fem") ||
      gender.toLowerCase().includes("mujer")
        ? "female"
        : "male";
  } else {
    // Infer from personality
    if (
      personalityLower.includes("mujer") ||
      personalityLower.includes("femenin") ||
      personalityLower.includes("chica")
    ) {
      genderPrompt = "female";
    } else if (
      personalityLower.includes("hombre") ||
      personalityLower.includes("masculin") ||
      personalityLower.includes("chico")
    ) {
      genderPrompt = "male";
    } else {
      genderPrompt = "androgynous"; // Neutral by default
    }
  }

  // Extract appearance keywords
  const appearanceKeywords: string[] = [];

  if (
    personalityLower.includes("atlético") ||
    personalityLower.includes("deportista")
  ) {
    appearanceKeywords.push("athletic build, fit");
  }
  if (personalityLower.includes("elegante")) {
    appearanceKeywords.push("elegant, sophisticated");
  }
  if (
    personalityLower.includes("casual") ||
    personalityLower.includes("relajad")
  ) {
    appearanceKeywords.push("casual clothing, relaxed style");
  }
  if (
    personalityLower.includes("tímid") ||
    personalityLower.includes("reservad")
  ) {
    appearanceKeywords.push("shy expression, soft features");
  }
  if (
    personalityLower.includes("segur") ||
    personalityLower.includes("confiad")
  ) {
    appearanceKeywords.push("confident posture, strong presence");
  }

  // If no specific keywords, add defaults
  if (appearanceKeywords.length === 0) {
    appearanceKeywords.push("natural appearance, friendly expression");
  }

  const prompt = `Professional reference portrait photograph of ${name}, ${genderPrompt} character.
${appearanceKeywords.join(", ")}.
Full body portrait, standing position, neutral white background.
Natural lighting, high quality, photorealistic, detailed facial features,
consistent appearance for character reference, professional photography.
Clear, sharp focus, 4K quality.
Character personality traits: ${personality.substring(0, 100)}.`;

  return prompt;
}
