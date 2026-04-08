export interface CommentBlock {
  id: string;
  type: 'single' | 'multi' | 'javadoc' | 'jsdoc';
  startLine: number;
  endLine: number;
  indentation: string;
  originalText: string;
  contentText: string;
  language: 'java' | 'typescript';
  isSpanish: boolean;
  isSafe: boolean; // NEW: Is safe for automatic translation
}

export interface TranslationProgress {
  mode: 'safe-translate';
  startedAt: string;
  filesProcessed: string[];
  filesSkipped: string[];
  filesFailed: Array<{ path: string; error: string }>;
  filesWithUnsafeComments: Array<{ // NEW: Files with comments that need manual review
    path: string;
    unsafeComments: number;
    spanishComments: number;
  }>;
  safeCommentsProcessed: number;
  unsafeCommentsSkipped: number;
  estimatedCost: number;
}

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMRequest {
  model: string;
  messages: GLMMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface GLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
