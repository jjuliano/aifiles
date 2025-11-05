import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

/**
 * Smoke Tests
 *
 * Quick sanity checks that all CLI commands run without crashing
 * These tests don't validate full functionality, just that commands execute
 */
describe('CLI Smoke Tests', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), 'aifiles-smoke-test-' + Date.now());
    await mkdir(testDir, { recursive: true });
    process.env.HOME = testDir;
    process.env.AIFILES_CONFIG_DIR = join(testDir, '.aifiles');
  }, 30000);

  afterAll(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  }, 30000);

  it('should display main CLI help without errors', () => {
    const result = execSync('node dist/cli.mjs --help', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    expect(result).toContain('AIFiles');
    expect(result).toContain('USAGE');
    console.log('✅ Main CLI help smoke test passed');
  }, 10000);

  it('should display templates CLI help without errors', () => {
    const result = execSync('node dist/cli-templates.mjs --help', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    expect(result).toContain('aifiles-templates');
    expect(result).toContain('Usage');
    console.log('✅ Templates CLI help smoke test passed');
  }, 10000);

  it('should handle missing file gracefully', () => {
    try {
      execSync('node dist/cli.mjs /nonexistent/file.txt --dry-run', {
        encoding: 'utf8',
        cwd: process.cwd(),
        env: { ...process.env, HOME: testDir },
      });
    } catch (error: any) {
      // Should exit with error but not crash
      expect(error.stderr || error.stdout).toBeDefined();
      console.log('✅ Missing file error handling smoke test passed');
    }
  }, 10000);

  it('should create default config if missing', async () => {
    const { createDefaultConfig } = await import('../../src/utils.js');

    await createDefaultConfig();

    // Should not throw
    expect(true).toBe(true);
    console.log('✅ Default config creation smoke test passed');
  }, 10000);

  it('should initialize database without errors', async () => {
    const { FileDatabase } = await import('../../src/database.js');

    const db = new FileDatabase();
    expect(db).toBeDefined();

    // Try basic operations
    const files = db.getFiles(10);
    expect(Array.isArray(files)).toBe(true);

    db.close();
    console.log('✅ Database initialization smoke test passed');
  }, 10000);

  it('should load templates without errors', async () => {
    const { FolderTemplateManager } = await import('../../src/folder-templates.js');

    const manager = new FolderTemplateManager();
    const templates = await manager.loadTemplates();

    expect(Array.isArray(templates)).toBe(true);
    console.log('✅ Template loading smoke test passed');
  }, 10000);

  it('should handle file watching initialization without errors', async () => {
    const { FileWatcher } = await import('../../src/file-watcher.js');

    const watcher = new FileWatcher();
    expect(watcher).toBeDefined();

    console.log('✅ File watcher initialization smoke test passed');
  }, 10000);

  it('should handle all LLM providers without crashing', async () => {
    const { ProviderFactory } = await import('../../src/providers/provider-factory.js');

    const providers = ['ollama', 'openai', 'grok', 'deepseek', 'lmstudio'];

    for (const provider of providers) {
      const llmProvider = ProviderFactory.createProvider({
        provider: provider as any,
        apiKey: 'test-key',
        model: 'test-model',
      });

      expect(llmProvider).toBeDefined();
    }

    console.log('✅ All LLM providers initialization smoke test passed');
  }, 10000);

  it('should handle file metadata operations without errors', async () => {
    const { FileMetadataManager } = await import('../../src/utils.js');

    const testFile = join(testDir, 'metadata-smoke-test.txt');
    await writeFile(testFile, 'test content');

    // Should not throw
    await FileMetadataManager.markAsOrganized(testFile, {
      organizedAt: new Date(),
      fileId: 'test-123',
    });

    const hasMetadata = await FileMetadataManager.hasAIFilesMetadata(testFile);
    expect(typeof hasMetadata).toBe('boolean');

    console.log('✅ File metadata operations smoke test passed');
  }, 10000);

  it('should handle utility functions without errors', async () => {
    const {
      fileExists,
      resolvePath,
      changeCase,
      categorizeFileByMimeType,
    } = await import('../../src/utils.js');

    // fileExists
    const exists = await fileExists(__filename);
    expect(typeof exists).toBe('boolean');

    // resolvePath
    const resolved = resolvePath('~/test.txt');
    expect(typeof resolved).toBe('string');

    // changeCase
    const kebab = changeCase('Hello World', 'kebab');
    expect(kebab).toBe('hello-world');

    // categorizeFileByMimeType
    const category = categorizeFileByMimeType('application/pdf');
    expect(typeof category).toBe('string');

    console.log('✅ Utility functions smoke test passed');
  }, 10000);
});
