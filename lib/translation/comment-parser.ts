import { CommentBlock } from './types';

const SPANISH_CHARS_REGEX = /[áéíóúñ¿¡]/i;

// Common Spanish words for detection
const SPANISH_WORDS = [
  'obtener', 'retorna', 'devuelve', 'calcula', 'actualiza', 'elimina', 'crea',
  'genera', 'procesa', 'maneja', 'busca', 'encuentra', 'guarda', 'almacena',
  'del', 'los', 'las', 'para', 'por', 'con', 'sin',
  'estado', 'datos', 'información', 'función', 'método', 'clase',
  'diálogo', 'aldeano', 'jugador', 'servidor', 'cliente', 'usuario',
];

export class CommentParser {
  /**
   * Determines if text is in Spanish
   */
  private isSpanishText(text: string): boolean {
    // Method 1: Has Spanish special characters
    if (SPANISH_CHARS_REGEX.test(text)) {
      return true;
    }

    // Method 2: Contains Spanish words
    const lowerText = text.toLowerCase();
    const wordCount = SPANISH_WORDS.filter(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lowerText);
    }).length;

    // If it has 2+ Spanish words, probably Spanish
    return wordCount >= 2;
  }

  /**
   * Determines if a comment is "safe" for automatic translation
   * Only translates simple comments without code or complex structures
   */
  isSafeComment(comment: CommentBlock): boolean {
    const content = comment.contentText;
    const lines = content.split('\n');

    // 1. Single-line comments are always safe
    if (comment.type === 'single') {
      // Except if they contain obvious code
      if (content.includes('const ') ||
          content.includes('let ') ||
          content.includes('var ') ||
          content.includes('function ') ||
          content.includes('=>') ||
          content.includes('import ') ||
          content.includes('export ')) {
        return false;
      }
      return true;
    }

    // 2. JSDoc/JavaDoc: only if simple
    if (comment.type === 'jsdoc' || comment.type === 'javadoc') {
      // Max 15 lines
      if (lines.length > 15) return false;

      // Should not contain code blocks
      const hasCodeBlock = content.includes('```') ||
                          content.includes('const ') ||
                          content.includes('let ') ||
                          content.includes('function ') ||
                          content.includes('class ') ||
                          content.includes('interface {');

      if (hasCodeBlock) return false;

      // Should not have many braces (indicates complex code)
      const braceCount = (content.match(/\{/g) || []).length;
      if (braceCount > 3) return false;

      // Should not have nested asterisks (broken structure)
      if (content.includes('*/') && !content.endsWith('*/')) return false;

      return true;
    }

    // 3. Multi-line: only if very short and simple
    if (comment.type === 'multi') {
      if (lines.length > 5) return false;

      // Should not contain code
      if (content.includes('const ') ||
          content.includes('let ') ||
          content.includes('function ') ||
          content.includes('{')) {
        return false;
      }

      return true;
    }

    return false;
  }

  parseFile(content: string, filePath: string): CommentBlock[] {
    const language = filePath.endsWith('.java') ? 'java' : 'typescript';
    const lines = content.split('\n');
    const comments: CommentBlock[] = [];
    let commentId = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Single-line comment
      const singleLineMatch = line.match(/^(\s*)(\/\/\s*)(.*)$/);
      if (singleLineMatch) {
        const [, indentation, , commentText] = singleLineMatch;
        const comment: CommentBlock = {
          id: `${filePath}:${i + 1}:${commentId++}`,
          type: 'single',
          startLine: i + 1,
          endLine: i + 1,
          indentation,
          originalText: line,
          contentText: commentText,
          language,
          isSpanish: this.isSpanishText(commentText),
          isSafe: false, // Will be set below
        };
        comment.isSafe = this.isSafeComment(comment);
        comments.push(comment);
        continue;
      }

      // Multi-line comment start
      const multiLineStart = line.match(/^(\s*)\/\*\*?(.*)$/);
      if (multiLineStart) {
        const [, indentation, firstLineContent] = multiLineStart;
        let endLine = i;
        let commentLines = [firstLineContent];
        let foundEnd = false;

        for (let j = i + 1; j < lines.length; j++) {
          const currentLine = lines[j];
          const stripped = currentLine.trim();

          if (stripped.endsWith('*/')) {
            endLine = j;
            foundEnd = true;
            const content = stripped.slice(0, -2).replace(/^\*\s?/, '');
            if (content) commentLines.push(content);
            break;
          }

          const content = stripped.replace(/^\*\s?/, '');
          commentLines.push(content);
        }

        if (foundEnd) {
          const fullText = lines.slice(i, endLine + 1).join('\n');
          const contentText = commentLines.join('\n').trim();
          const isJavadoc = lines[i].includes('/**');

          const comment: CommentBlock = {
            id: `${filePath}:${i + 1}:${commentId++}`,
            type: isJavadoc ? (language === 'java' ? 'javadoc' : 'jsdoc') : 'multi',
            startLine: i + 1,
            endLine: endLine + 1,
            indentation,
            originalText: fullText,
            contentText,
            language,
            isSpanish: this.isSpanishText(contentText),
            isSafe: false,
          };
          comment.isSafe = this.isSafeComment(comment);
          comments.push(comment);

          i = endLine;
        }
      }
    }

    return comments;
  }

  getSpanishComments(comments: CommentBlock[]): CommentBlock[] {
    return comments.filter(c => c.isSpanish);
  }

  getSafeSpanishComments(comments: CommentBlock[]): CommentBlock[] {
    return comments.filter(c => c.isSpanish && c.isSafe);
  }

  getUnsafeSpanishComments(comments: CommentBlock[]): CommentBlock[] {
    return comments.filter(c => c.isSpanish && !c.isSafe);
  }

  extractCommentContent(comment: CommentBlock): string {
    return comment.contentText;
  }

  reconstructComment(comment: CommentBlock, translatedContent: string): string {
    const lines = translatedContent.split('\n');

    if (comment.type === 'single') {
      return `${comment.indentation}// ${lines[0] || ''}`;
    }

    if (comment.type === 'multi' || comment.type === 'javadoc' || comment.type === 'jsdoc') {
      const opener = comment.type === 'javadoc' || comment.type === 'jsdoc' ? '/**' : '/*';
      const result: string[] = [];

      if (lines.length === 1) {
        result.push(`${comment.indentation}${opener} ${lines[0]} */`);
      } else {
        result.push(`${comment.indentation}${opener}`);
        for (const line of lines) {
          result.push(`${comment.indentation} * ${line}`);
        }
        result.push(`${comment.indentation} */`);
      }

      return result.join('\n');
    }

    return comment.originalText;
  }
}

export const commentParser = new CommentParser();
