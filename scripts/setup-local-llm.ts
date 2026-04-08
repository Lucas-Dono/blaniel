#!/usr/bin/env tsx
/**
 * Setup Local LLM
 *
 * Detects and configures local LLMs automatically
 */

import { detectLocalLLM } from '@/lib/llm/local-provider';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const ENV_FILE = path.join(process.cwd(), '.env');

async function main() {
  console.log('\n🤖 Local LLM Setup\n');

  // Detect local LLMs
  console.log('🔍 Detecting local LLMs...\n');

  const detected = await detectLocalLLM();

  if (detected) {
    console.log(`✅ Detected: ${detected.type}`);
    console.log(`   URL: ${detected.url}`);
    console.log(`   Model: ${detected.model}\n`);

    const rl = readline.createInterface({ input, output });
    const use = await rl.question('Use this local LLM? (y/n): ');
    rl.close();

    if (use.toLowerCase() === 'y') {
      // Add to .env
      let envContent = '';
      if (fs.existsSync(ENV_FILE)) {
        envContent = fs.readFileSync(ENV_FILE, 'utf-8');
      }

      // Remove old local configurations
      envContent = envContent
        .split('\n')
        .filter(line => !line.startsWith('LOCAL_LLM_'))
        .join('\n');

      // Add new configuration
      envContent += `\n
# Local LLM Configuration (${detected.type})
LOCAL_LLM_TYPE=${detected.type}
LOCAL_LLM_URL=${detected.url}
LOCAL_LLM_MODEL=${detected.model}
`;

      fs.writeFileSync(ENV_FILE, envContent.trim() + '\n');

      console.log('\n✅ Configuration saved to .env');
      console.log('\n📋 To use the local LLM:');
      console.log('   1. Restart the server: npm run dev');
      console.log('   2. The system will automatically use the local LLM\n');

      return;
    }
  }

  // Not detected or user doesn't want to use it
  console.log('\n📋 Supported local LLMs:\n');
  console.log('  1. Ollama (ollama.ai)');
  console.log('     - Install: curl -fsSL https://ollama.com/install.sh | sh');
  console.log('     - Start: ollama serve');
  console.log('     - Download model: ollama pull llama3\n');

  console.log('  2. LM Studio (lmstudio.ai)');
  console.log('     - Download from: https://lmstudio.ai');
  console.log('     - Start local server on port 1234\n');

  console.log('  3. LocalAI (localai.io)');
  console.log('     - Docker: docker run -p 8080:8080 localai/localai\n');

  console.log('  4. Text Generation WebUI (oobabooga)');
  console.log('     - GitHub: github.com/oobabooga/text-generation-webui\n');

  console.log('💡 Once installed, run this script again.\n');
}

main().catch(console.error);
