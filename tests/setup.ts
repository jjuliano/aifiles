import { beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';

// Create a temporary directory for tests
let tempDir: string;

beforeAll(async () => {
  tempDir = join(tmpdir(), 'aifiles-test-' + Date.now());
  await mkdir(tempDir, { recursive: true });

  // Set up environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.TEMP_DIR = tempDir;
});

afterAll(async () => {
  // Clean up temporary directory
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up temp directory:', error);
  }
});
