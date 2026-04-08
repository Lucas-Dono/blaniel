import * as fs from 'fs';
import { glob } from 'glob';
import { commentParser } from './comment-parser';
import { commentReplacer } from './comment-replacer';
import { glmClient } from './glm-client';
import { TranslationProgress, CommentBlock } from './types';

export interface SafeTranslationOptions {
  fileType: 'java' | 'typescript' | 'all';
  pattern?: string;
  dryRun: boolean;
  resume: boolean;
  batchSize: number;
  createBackups?: boolean;
}

const PROGRESS_FILE = 'translation-progress.json';
const PENDING_FILE = 'PENDING_TRANSLATION.md';

export class SafeTranslationEngine {
  private progress: TranslationProgress;

  constructor() {
    this.progress = this.loadProgress();
  }

  private loadProgress(): TranslationProgress {
    if (fs.existsSync(PROGRESS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      } catch (error) {
        console.warn('Failed to load progress file, starting fresh');
      }
    }

    return {
      mode: 'safe-translate',
      startedAt: new Date().toISOString(),
      filesProcessed: [],
      filesSkipped: [],
      filesFailed: [],
      filesWithUnsafeComments: [],
      safeCommentsProcessed: 0,
      unsafeCommentsSkipped: 0,
      estimatedCost: 0,
    };
  }

  private saveProgress(): void {
    const stats = glmClient.getUsageStats();
    this.progress.estimatedCost = stats.estimatedCost;

    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(this.progress, null, 2));
  }

  async discoverFiles(options: SafeTranslationOptions): Promise<string[]> {
    let patterns: string[] = [];

    if (options.pattern) {
      patterns = [options.pattern];
    } else {
      if (options.fileType === 'java' || options.fileType === 'all') {
        patterns.push('Juego/Blaniel-MC/src/main/java/**/*.java');
      }

      if (options.fileType === 'typescript' || options.fileType === 'all') {
        patterns.push('{lib,app,components,hooks}/**/*.{ts,tsx}');
      }
    }

    const exclusions = [
      '**/node_modules/**',
      '**/.next/**',
      '**/build/**',
      '**/bin/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.d.ts',
    ];

    let files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { ignore: exclusions });
      files = files.concat(matches);
    }

    return files;
  }

  async safeTranslateMode(options: SafeTranslationOptions): Promise<void> {
    console.log('🔒 Starting SAFE translation mode (conservative approach)...\n');
    console.log('📋 Translation rules:');
    console.log('  ✅ Single-line comments (//): WILL translate');
    console.log('  ✅ Simple JSDoc/JavaDoc (<15 lines, no code): WILL translate');
    console.log('  ❌ Complex comments with code: WILL SKIP (marked for manual review)');
    console.log('  ❌ Long multi-line comments (>15 lines): WILL SKIP (marked for manual review)\n');

    const files = await this.discoverFiles(options);
    console.log(`Found ${files.length} files to process\n`);

    let totalComments = 0;
    let totalSafeComments = 0;
    let totalUnsafeComments = 0;

    for (const file of files) {
      if (options.resume && this.progress.filesProcessed.includes(file)) {
        console.log(`⏭️  Skipping already processed: ${file}`);
        continue;
      }

      try {
        const content = fs.readFileSync(file, 'utf-8');
        const allComments = commentParser.parseFile(content, file);
        const safeSpanishComments = commentParser.getSafeSpanishComments(allComments);
        const unsafeSpanishComments = commentParser.getUnsafeSpanishComments(allComments);

        totalComments += allComments.length;
        totalSafeComments += safeSpanishComments.length;
        totalUnsafeComments += unsafeSpanishComments.length;

        // Track files with unsafe comments for manual review
        if (unsafeSpanishComments.length > 0) {
          this.progress.filesWithUnsafeComments.push({
            path: file,
            unsafeComments: unsafeSpanishComments.length,
            spanishComments: unsafeSpanishComments.length + safeSpanishComments.length,
          });
        }

        if (safeSpanishComments.length === 0) {
          if (unsafeSpanishComments.length > 0) {
            console.log(`⚠️  ${file}: ${unsafeSpanishComments.length} unsafe Spanish comments (marked for manual review)`);
          }
          this.progress.filesSkipped.push(file);
          continue;
        }

        console.log(`\n📄 ${file}:`);
        console.log(`   ✅ ${safeSpanishComments.length} safe Spanish comments (will translate)`);
        if (unsafeSpanishComments.length > 0) {
          console.log(`   ⚠️  ${unsafeSpanishComments.length} unsafe Spanish comments (will skip)`);
        }

        if (options.dryRun) {
          this.previewTranslation(safeSpanishComments);
          continue;
        }

        // Translate only SAFE comments
        const translated = await this.translateComments(safeSpanishComments, options.batchSize);
        const newContent = commentReplacer.replaceComments(content, safeSpanishComments, translated);

        // Validate syntax before saving
        const language = file.endsWith('.java') ? 'java' : 'typescript';
        if (!commentReplacer.validateSyntax(newContent, language)) {
          console.log(`   ❌ Syntax validation failed! Skipping file.`);
          this.progress.filesFailed.push({ path: file, error: 'Syntax validation failed' });
          continue;
        }

        if (options.createBackups) {
          fs.writeFileSync(`${file}.bak`, content);
        }

        fs.writeFileSync(file, newContent);

        this.progress.filesProcessed.push(file);
        this.progress.safeCommentsProcessed += safeSpanishComments.length;
        this.progress.unsafeCommentsSkipped += unsafeSpanishComments.length;

        if (this.progress.filesProcessed.length % 5 === 0) {
          this.saveProgress();
        }

        console.log(`   ✅ Translated ${safeSpanishComments.length} safe comments`);
      } catch (error) {
        console.error(`❌ Failed to process ${file}:`, error);
        this.progress.filesFailed.push({ path: file, error: String(error) });
      }
    }

    this.saveProgress();
    this.generatePendingReport();

    console.log('\n' + '='.repeat(80));
    console.log('📊 SAFE TRANSLATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Files processed: ${this.progress.filesProcessed.length}`);
    console.log(`Files skipped: ${this.progress.filesSkipped.length}`);
    console.log(`Files failed: ${this.progress.filesFailed.length}`);
    console.log(`\nComments:`);
    console.log(`  ✅ Safe comments translated: ${this.progress.safeCommentsProcessed}`);
    console.log(`  ⚠️  Unsafe comments skipped: ${this.progress.unsafeCommentsSkipped}`);
    console.log(`  📝 Files needing manual review: ${this.progress.filesWithUnsafeComments.length}`);

    const stats = glmClient.getUsageStats();
    console.log(`\n💰 API Usage:`);
    console.log(`   Input tokens: ${stats.inputTokens.toLocaleString()}`);
    console.log(`   Output tokens: ${stats.outputTokens.toLocaleString()}`);
    console.log(`   Estimated cost: $${stats.estimatedCost.toFixed(4)}`);

    if (this.progress.filesWithUnsafeComments.length > 0) {
      console.log(`\n📋 Next steps:`);
      console.log(`   1. Review '${PENDING_FILE}' for files needing manual translation`);
      console.log(`   2. Manually translate complex comments in those files`);
      console.log(`   3. Run 'git diff' to review all changes`);
    }
  }

  private async translateComments(
    comments: CommentBlock[],
    batchSize: number
  ): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    const batches: CommentBlock[][] = [];

    for (let i = 0; i < comments.length; i += batchSize) {
      batches.push(comments.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const texts = batch.map(c => commentParser.extractCommentContent(c));
      const translated = await glmClient.translateBatch(texts);

      for (let i = 0; i < batch.length; i++) {
        translations.set(batch[i].id, translated[i]);
      }
    }

    return translations;
  }

  private previewTranslation(comments: CommentBlock[]): void {
    console.log('   📋 Preview (first 3 safe comments):');
    for (let i = 0; i < Math.min(3, comments.length); i++) {
      const comment = comments[i];
      const preview = comment.contentText.substring(0, 50);
      console.log(`      Line ${comment.startLine} (${comment.type}): ${preview}${preview.length < comment.contentText.length ? '...' : ''}`);
    }
  }

  private generatePendingReport(): void {
    if (this.progress.filesWithUnsafeComments.length === 0) {
      console.log('\n🎉 All Spanish comments were safe and translated!');
      return;
    }

    const report: string[] = [];
    report.push('# Pending Manual Translation');
    report.push('');
    report.push('These files contain Spanish comments that were **too complex** for automatic translation.');
    report.push('They need **manual review** because they contain:');
    report.push('- Code examples inside comments');
    report.push('- Very long multi-line comments (>15 lines)');
    report.push('- Complex nested structures');
    report.push('');
    report.push('## Files Requiring Manual Review');
    report.push('');

    const sorted = this.progress.filesWithUnsafeComments.sort((a, b) => b.unsafeComments - a.unsafeComments);

    for (const file of sorted) {
      report.push(`### \`${file.path}\``);
      report.push(`- **Unsafe comments**: ${file.unsafeComments}`);
      report.push(`- **Total Spanish comments**: ${file.spanishComments}`);
      report.push('');
    }

    report.push('## How to Translate These Manually');
    report.push('');
    report.push('### Option 1: Use an AI Assistant (Recommended)');
    report.push('1. Open the file in your IDE');
    report.push('2. Select the complex comment');
    report.push('3. Ask your AI assistant (Claude, Cursor, etc.): "Translate this comment to English"');
    report.push('4. Review and apply the translation');
    report.push('');
    report.push('### Option 2: Use GLM Directly');
    report.push('```bash');
    report.push('# For a specific file:');
    report.push('npx tsx scripts/translate-unsafe.ts <file-path>');
    report.push('```');
    report.push('');
    report.push('### Option 3: Manual Translation');
    report.push('Open each file and translate the Spanish comments yourself.');
    report.push('');
    report.push('---');
    report.push('');
    report.push(`**Total files needing review**: ${this.progress.filesWithUnsafeComments.length}`);
    report.push(`**Total unsafe comments**: ${this.progress.unsafeCommentsSkipped}`);

    fs.writeFileSync(PENDING_FILE, report.join('\n'));
    console.log(`\n📋 Generated pending translation report: ${PENDING_FILE}`);
  }

  resetProgress(): void {
    this.progress = {
      mode: 'safe-translate',
      startedAt: new Date().toISOString(),
      filesProcessed: [],
      filesSkipped: [],
      filesFailed: [],
      filesWithUnsafeComments: [],
      safeCommentsProcessed: 0,
      unsafeCommentsSkipped: 0,
      estimatedCost: 0,
    };
    this.saveProgress();
  }
}
