#!/usr/bin/env tsx

import { Command } from 'commander';
import { SafeTranslationEngine } from '../../lib/translation/safe-translation-engine';
import * as dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('translate-safe')
  .description('🔒 SAFE Spanish-to-English translation (conservative approach - only simple comments)')
  .version('1.0.0');

program
  .option('-t, --type <type>', 'File type: java, typescript, or all', 'all')
  .option('-d, --dry-run', 'Preview changes without modifying files', false)
  .option('-r, --resume', 'Resume from last checkpoint', false)
  .option('-p, --pattern <glob>', 'Custom glob pattern for files')
  .option('-b, --batch-size <number>', 'Comments per API call', '5')
  .option('--backup', 'Create .bak backup files', false)
  .option('--reset', 'Reset progress and start fresh', false);

program.parse(process.argv);

const options = program.opts();

async function main() {
  console.log('🔒 === SAFE Spanish Comment Translator ===\n');
  console.log('This conservative approach only translates SIMPLE comments.');
  console.log('Complex comments with code will be marked for manual review.\n');

  if (!process.env.GLM_API_KEY_1) {
    console.error('❌ GLM_API_KEY_1 not found in environment variables');
    console.error('Please add GLM_API_KEY_1 to your .env file');
    process.exit(1);
  }

  const engine = new SafeTranslationEngine();

  if (options.reset) {
    console.log('🔄 Resetting progress...\n');
    engine.resetProgress();
  }

  const fileType = options.type as 'java' | 'typescript' | 'all';
  if (!['java', 'typescript', 'all'].includes(fileType)) {
    console.error('❌ Error: --type must be one of: java, typescript, all');
    process.exit(1);
  }

  console.log('⚙️  Configuration:');
  console.log(`  Mode: SAFE Translation (Conservative)`);
  console.log(`  File type: ${fileType}`);
  console.log(`  Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`  Resume: ${options.resume ? 'Yes' : 'No'}`);
  console.log(`  Batch size: ${options.batchSize}`);
  console.log(`  Backups: ${options.backup ? 'Yes' : 'No'}`);
  if (options.pattern) {
    console.log(`  Custom pattern: ${options.pattern}`);
  }
  console.log('');

  try {
    await engine.safeTranslateMode({
      fileType,
      pattern: options.pattern,
      dryRun: options.dryRun,
      resume: options.resume,
      batchSize: parseInt(options.batchSize),
      createBackups: options.backup,
    });

    if (!options.dryRun) {
      console.log('\n✅ SAFE translation complete!');
      console.log('\n📋 Next steps:');
      console.log('  1. Review: git diff');
      console.log('  2. Check PENDING_TRANSLATION.md for files needing manual review');
      console.log('  3. Test build: npm run build');
      console.log('  4. Commit: git add . && git commit -m "docs: translate safe Spanish comments to English"');
    } else {
      console.log('\n✅ Dry run complete!');
      console.log('\nTo apply changes, run without --dry-run flag');
    }
  } catch (error) {
    console.error('\n❌ Translation failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
