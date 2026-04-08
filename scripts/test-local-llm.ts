#!/usr/bin/env tsx
/**
 * Test Local LLM Integration
 *
 * Tests if local LLM provider is properly integrated
 */

import { getLLMProvider } from '@/lib/llm/provider';
import { detectLocalLLM } from '@/lib/llm/local-provider';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('\n🧪 Testing Local LLM Integration\n');

  // Test 1: Check if local LLM is configured
  console.log('1️⃣  Checking environment configuration...');
  const localType = process.env.LOCAL_LLM_TYPE;
  const localUrl = process.env.LOCAL_LLM_URL;
  const localModel = process.env.LOCAL_LLM_MODEL;

  if (localType && localUrl && localModel) {
    console.log(`   ✅ Local LLM configured:`);
    console.log(`      Type: ${localType}`);
    console.log(`      URL: ${localUrl}`);
    console.log(`      Model: ${localModel}\n`);
  } else {
    console.log('   ⚠️  No local LLM configured\n');
  }

  // Test 2: Try to detect local LLM
  console.log('2️⃣  Detecting available local LLMs...');
  try {
    const detected = await detectLocalLLM();
    if (detected) {
      console.log(`   ✅ Detected: ${detected.type}`);
      console.log(`      URL: ${detected.url}`);
      console.log(`      Model: ${detected.model}\n`);
    } else {
      console.log('   ⚠️  No local LLM detected\n');
    }
  } catch (error) {
    console.log(`   ❌ Detection error: ${error}\n`);
  }

  // Test 3: Get provider and check type
  console.log('3️⃣  Getting LLM provider...');
  try {
    const provider = getLLMProvider();
    console.log(`   ✅ Provider loaded: ${provider.constructor.name}\n`);

    // Test 4: Try a simple chat (only if local provider)
    if (provider.constructor.name === 'LocalLLMProvider' && localType) {
      console.log('4️⃣  Testing chat with local LLM...');
      try {
        const response = await provider.chat([
          { role: 'user', content: 'Say "Hello from local LLM!" in one line.' }
        ]);
        console.log(`   ✅ Response: ${response.content.substring(0, 100)}...\n`);
        console.log(`   Model: ${response.model}\n`);
      } catch (error: any) {
        console.log(`   ❌ Chat error: ${error.message}\n`);
      }
    } else {
      console.log('4️⃣  Skipping chat test (using cloud provider)\n');
    }

    console.log('✅ All tests completed!\n');
  } catch (error: any) {
    console.log(`   ❌ Provider error: ${error.message}\n`);
  }
}

main().catch(console.error);
