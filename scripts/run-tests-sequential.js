#!/usr/bin/env node

import { spawn } from 'child_process';

const testFiles = [
  'tests/unit/utils.test.ts',
  'tests/unit/providers.test.ts',
  'tests/unit/openai-provider.test.ts',
  'tests/unit/deepseek-provider.test.ts',
  'tests/unit/ollama-provider.test.ts',
  'tests/unit/remaining-providers.test.ts',
  'tests/unit/folder-templates.test.ts',
  'tests/unit/error-handler.test.ts',
  'tests/unit/types.test.ts',
  'tests/unit/file-watcher.test.ts'
];

async function runTest(testFile) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Running ${testFile}...\n`);

    const child = spawn('npx', ['vitest', 'run', testFile], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testFile} passed`);
        resolve({ file: testFile, passed: true });
      } else {
        console.log(`❌ ${testFile} failed`);
        resolve({ file: testFile, passed: false });
      }
    });

    child.on('error', (error) => {
      console.error(`Error running ${testFile}:`, error);
      resolve({ file: testFile, passed: false });
    });
  });
}

async function runAllTests() {
  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    if (!result.passed) {
      console.log(`\n❌ ${result.file} failed`);
      console.log('\n🛑 Test suite stopped due to failure');
      process.exit(1);
    }
  }

  console.log('\n🎉 All tests passed!');
  process.exit(0);
}

runAllTests().catch((error) => {
  console.error('Error running test suite:', error);
  process.exit(1);
});
