/**
 * POST /api/v2/characters/suggest
 *
 * Generate AI suggestions for character fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeWithRetry } from '@/lib/ai/gemini-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SuggestRequest {
  type: 'traits' | 'personality' | 'purpose' | 'backstory';
  context?: {
    name?: string;
    age?: number;
    gender?: string;
    location?: string;
    occupation?: string;
    existingText?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SuggestRequest = await request.json();
    const { type, context = {} } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required' },
        { status: 400 }
      );
    }

    let prompt = '';
    let _responseFormat = '';

    switch (type) {
      case 'traits':
        prompt = generateTraitsPrompt(context);
        _responseFormat = 'Array of 5-8 personality trait strings (one word each)';
        break;

      case 'personality':
        prompt = generatePersonalityPrompt(context);
        _responseFormat = 'A 2-3 sentence personality description';
        break;

      case 'purpose':
        prompt = generatePurposePrompt(context);
        _responseFormat = 'A 2-3 sentence purpose/role description';
        break;

      case 'backstory':
        prompt = generateBackstoryPrompt(context);
        _responseFormat = 'A 3-4 sentence backstory';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid type' },
          { status: 400 }
        );
    }

    // Use executeWithRetry for automatic API key rotation on quota errors
    const result = await executeWithRetry(async (client) => {
      const model = client.getGenerativeModel({
        model: process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite'
      });

      return await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
          responseMimeType: type === 'traits' ? 'application/json' : 'text/plain',
        },
      });
    });

    const response = result.response;
    let suggestion: string | string[] = response.text();

    // Parse JSON for traits
    if (type === 'traits') {
      try {
        const parsed = JSON.parse(suggestion);
        suggestion = parsed;
      } catch {
        // Fallback if JSON parsing fails
        suggestion = ['Creative', 'Empathetic', 'Curious', 'Resilient', 'Thoughtful'];
      }
    }

    return NextResponse.json({
      type,
      suggestion,
      context: context,
    });
  } catch (error) {
    console.error('AI suggestion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Prompt generators

function generateTraitsPrompt(context: any): string {
  const { name, age, gender, location, occupation, existingText } = context;

  return `Generate 5-8 personality traits for a character with these details:
${name ? `Name: ${name}` : ''}
${age ? `Age: ${age}` : ''}
${gender ? `Gender: ${gender}` : ''}
${location ? `Location: ${location}` : ''}
${occupation ? `Occupation: ${occupation}` : ''}
${existingText ? `Current description: ${existingText}` : ''}

Requirements:
- Return ONLY a JSON array of trait strings
- Each trait should be 1-2 words
- Traits should be diverse and interesting
- Make them feel authentic to the character's context
- Mix positive and complex traits (not all perfect)

Example format: ["Curious", "Empathetic", "Stubborn", "Creative", "Resilient"]

Return ONLY the JSON array, no explanation.`;
}

function generatePersonalityPrompt(context: any): string {
  const { name, age, gender, location, occupation, existingText } = context;

  return `Write a compelling 2-3 sentence personality description for a character:
${name ? `Name: ${name}` : ''}
${age ? `Age: ${age}` : ''}
${gender ? `Gender: ${gender}` : ''}
${location ? `Location: ${location}` : ''}
${occupation ? `Occupation: ${occupation}` : ''}
${existingText ? `\nExpand on this: ${existingText}` : ''}

Requirements:
- Be SPECIFIC, not generic
- Show personality through behavior, not just adjectives
- Make it feel like a real person
- 2-3 sentences maximum
- Focus on how they think, feel, and interact

Return ONLY the description, no labels or explanation.`;
}

function generatePurposePrompt(context: any): string {
  const { name, age, gender, location, occupation, existingText } = context;

  return `Describe the purpose/role this AI character will serve:
${name ? `Name: ${name}` : ''}
${age ? `Age: ${age}` : ''}
${gender ? `Gender: ${gender}` : ''}
${location ? `Location: ${location}` : ''}
${occupation ? `Occupation: ${occupation}` : ''}
${existingText ? `\nExpand on this: ${existingText}` : ''}

Requirements:
- 2-3 sentences
- Explain what role they'll play for the user
- Be specific about how they can help
- Make it feel warm and engaging

Return ONLY the description, no labels or explanation.`;
}

function generateBackstoryPrompt(context: any): string {
  const { name, age, gender, location, occupation, existingText } = context;

  return `Create a brief backstory for this character:
${name ? `Name: ${name}` : ''}
${age ? `Age: ${age}` : ''}
${gender ? `Gender: ${gender}` : ''}
${location ? `Location: ${location}` : ''}
${occupation ? `Occupation: ${occupation}` : ''}
${existingText ? `\nExpand on this: ${existingText}` : ''}

Requirements:
- 3-4 sentences
- Include formative experiences
- Be specific to their location/culture
- Make it feel authentic
- Explain how they became who they are

Return ONLY the backstory, no labels or explanation.`;
}
