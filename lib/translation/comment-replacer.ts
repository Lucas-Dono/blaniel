import { CommentBlock } from './types';
import { commentParser } from './comment-parser';

export class CommentReplacer {
  replaceComments(
    content: string,
    comments: CommentBlock[],
    translations: Map<string, string>
  ): string {
    const lines = content.split('\n');
    const sortedComments = [...comments].sort((a, b) => b.startLine - a.startLine);

    for (const comment of sortedComments) {
      const translation = translations.get(comment.id);
      if (!translation) continue;

      const newComment = commentParser.reconstructComment(comment, translation);
      const newCommentLines = newComment.split('\n');

      lines.splice(comment.startLine - 1, comment.endLine - comment.startLine + 1, ...newCommentLines);
    }

    return lines.join('\n');
  }

  validateSyntax(content: string, language: 'java' | 'typescript'): boolean {
    if (language === 'typescript') {
      // Basic syntax validation
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;

      return openBraces === closeBraces && openParens === closeParens;
    }

    if (language === 'java') {
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;

      return openBraces === closeBraces;
    }

    return true;
  }
}

export const commentReplacer = new CommentReplacer();
