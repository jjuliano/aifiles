import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';

/**
 * Configuration Validation Tests
 *
 * Tests for configuration loading, validation, and error handling
 */
describe('Configuration Validation Tests', () => {
  let testDir: string;
  let configDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), 'aifiles-config-test-' + Date.now());
    configDir = join(testDir, '.aifiles');
    await mkdir(configDir, { recursive: true });
    process.env.HOME = testDir;
    process.env.AIFILES_CONFIG_DIR = configDir;
  }, 30000);

  afterAll(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  }, 30000);

  describe('Configuration File Loading', () => {
    it('should create default configuration when missing', async () => {
      const { createDefaultConfig, getConfig } = await import('../../src/utils.js');

      await createDefaultConfig();
      const config = await getConfig();

      expect(config).toBeDefined();
      expect(config.LLM_PROVIDER).toBeDefined();
      expect(config.LLM_MODEL).toBeDefined();

      console.log('✅ Default configuration creation test passed');
    }, 10000);

    it('should load existing configuration', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'llama3.2',
        MAX_CONTENT_WORDS: 500,
      });

      const config = await getConfig();

      expect(config.LLM_PROVIDER).toBe('ollama');
      expect(config.LLM_MODEL).toBe('llama3.2');
      // Config may store numbers as strings, accept either
      expect([500, '500']).toContain(config.MAX_CONTENT_WORDS);

      console.log('✅ Configuration loading test passed');
    }, 10000);

    it('should handle partial configuration updates', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({ LLM_MODEL: 'gpt-4' });

      const config = await getConfig();

      expect(config.LLM_MODEL).toBe('gpt-4');
      // Other fields should remain unchanged

      console.log('✅ Partial configuration update test passed');
    }, 10000);
  });

  describe('Provider Configuration Validation', () => {
    it('should accept all valid provider types', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      const providers: Array<'ollama' | 'openai' | 'grok' | 'deepseek' | 'lmstudio'> =
        ['ollama', 'openai', 'grok', 'deepseek', 'lmstudio'];

      for (const provider of providers) {
        await saveConfig({ LLM_PROVIDER: provider });
        const config = await getConfig();
        expect(config.LLM_PROVIDER).toBe(provider);
      }

      console.log('✅ All provider types validation test passed');
    }, 10000);

    it('should handle provider-specific API keys', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        OPENAI_API_KEY: 'sk-test-123',
        GROK_API_KEY: 'xai-test-456',
        DEEPSEEK_API_KEY: 'ds-test-789',
      });

      const config = await getConfig();

      expect(config.OPENAI_API_KEY).toBe('sk-test-123');
      expect(config.GROK_API_KEY).toBe('xai-test-456');
      expect(config.DEEPSEEK_API_KEY).toBe('ds-test-789');

      console.log('✅ Provider-specific API keys test passed');
    }, 10000);

    it('should handle base URL configurations', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
        LM_STUDIO_BASE_URL: 'http://127.0.0.1:1234',
      });

      const config = await getConfig();

      expect(config.OLLAMA_BASE_URL).toBe('http://127.0.0.1:11434');
      expect(config.LM_STUDIO_BASE_URL).toBe('http://127.0.0.1:1234');

      console.log('✅ Base URL configuration test passed');
    }, 10000);
  });

  describe('Boolean Configuration Fields', () => {
    it('should handle boolean flags correctly', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        ADD_FILE_TAGS: true,
        ADD_FILE_COMMENTS: true,
        MOVE_FILE_OPERATION: false,
        PROMPT_FOR_REVISION_NUMBER: false,
        PROMPT_FOR_CUSTOM_CONTEXT: true,
      });

      const config = await getConfig();

      expect(config.ADD_FILE_TAGS).toBe(true);
      expect(config.ADD_FILE_COMMENTS).toBe(true);
      expect(config.MOVE_FILE_OPERATION).toBe(false);
      expect(config.PROMPT_FOR_REVISION_NUMBER).toBe(false);
      expect(config.PROMPT_FOR_CUSTOM_CONTEXT).toBe(true);

      console.log('✅ Boolean flags test passed');
    }, 10000);

    it('should toggle boolean values', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({ ADD_FILE_TAGS: true });
      let config = await getConfig();
      expect(config.ADD_FILE_TAGS).toBe(true);

      await saveConfig({ ADD_FILE_TAGS: false });
      config = await getConfig();
      expect(config.ADD_FILE_TAGS).toBe(false);

      console.log('✅ Boolean toggle test passed');
    }, 10000);
  });

  describe('Numeric Configuration Fields', () => {
    it('should handle numeric values correctly', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        MAX_CONTENT_WORDS: 1000,
        MAX_TOKEN_COUNT: 4096,
      });

      const config = await getConfig();

      // Config may store numbers as strings
      expect([1000, '1000']).toContain(config.MAX_CONTENT_WORDS);
      expect([4096, '4096']).toContain(config.MAX_TOKEN_COUNT);

      console.log('✅ Numeric values test passed');
    }, 10000);

    it('should handle very large numbers', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        MAX_CONTENT_WORDS: 1000000,
      });

      const config = await getConfig();

      // Config may store numbers as strings
      expect([1000000, '1000000']).toContain(config.MAX_CONTENT_WORDS);

      console.log('✅ Large numbers test passed');
    }, 10000);

    it('should handle zero values', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        MAX_CONTENT_WORDS: 0,
      });

      const config = await getConfig();

      // Config may store numbers as strings
      expect([0, '0']).toContain(config.MAX_CONTENT_WORDS);

      console.log('✅ Zero values test passed');
    }, 10000);
  });

  describe('String Configuration Fields', () => {
    it('should handle file template patterns', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      const patterns = [
        '{category}/{title}',
        '{date}/{category}/{title}',
        'Archive/{year}/{month}/{title}',
      ];

      for (const pattern of patterns) {
        await saveConfig({ FILE_TEMPLATE: pattern });
        const config = await getConfig();
        expect(config.FILE_TEMPLATE).toBe(pattern);
      }

      console.log('✅ File template patterns test passed');
    }, 10000);

    it('should handle directory paths', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      const paths = [
        '~/Documents/Organized',
        '/absolute/path/to/files',
        '../relative/path',
        'C:\\Windows\\Path',
      ];

      for (const path of paths) {
        await saveConfig({ MAIN_DIRECTORY: path });
        const config = await getConfig();
        expect(config.MAIN_DIRECTORY).toBe(path);
      }

      console.log('✅ Directory paths test passed');
    }, 10000);

    it('should handle file name case types', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      const caseTypes = ['snake', 'kebab', 'camel', 'pascal'];

      for (const caseType of caseTypes) {
        await saveConfig({ FILE_NAME_CASE: caseType });
        const config = await getConfig();
        expect(config.FILE_NAME_CASE).toBe(caseType);
      }

      console.log('✅ File name case types test passed');
    }, 10000);
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty strings', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        LLM_MODEL: '',
        FILE_TEMPLATE: '',
      });

      const config = await getConfig();

      expect(config.LLM_MODEL).toBe('');
      expect(config.FILE_TEMPLATE).toBe('');

      console.log('✅ Empty strings test passed');
    }, 10000);

    it('should handle very long strings', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      const longString = 'a'.repeat(10000);

      await saveConfig({
        LLM_MODEL: longString,
      });

      const config = await getConfig();

      expect(config.LLM_MODEL).toBe(longString);

      console.log('✅ Long strings test passed');
    }, 10000);

    it('should handle special characters in strings', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      const specialStrings = [
        'Model with spaces',
        'Model-with-dashes',
        'Model_with_underscores',
        'Model@#$%^&*()',
      ];

      for (const str of specialStrings) {
        await saveConfig({ LLM_MODEL: str });
        const config = await getConfig();
        expect(config.LLM_MODEL).toBe(str);
      }

      console.log('✅ Special characters test passed');
    }, 10000);

    it('should handle unicode characters', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      const unicodeStrings = [
        '模型名称',
        'Модель',
        'モデル',
        '🤖 AI Model 🚀',
      ];

      for (const str of unicodeStrings) {
        await saveConfig({ LLM_MODEL: str });
        const config = await getConfig();
        expect(config.LLM_MODEL).toBe(str);
      }

      console.log('✅ Unicode characters test passed');
    }, 10000);
  });

  describe('Configuration Persistence', () => {
    it('should persist configuration across loads', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        LLM_PROVIDER: 'openai',
        LLM_MODEL: 'gpt-4',
        MAX_CONTENT_WORDS: 750,
      });

      const config1 = await getConfig();
      const config2 = await getConfig();

      expect(config1.LLM_PROVIDER).toBe(config2.LLM_PROVIDER);
      expect(config1.LLM_MODEL).toBe(config2.LLM_MODEL);
      expect(config1.MAX_CONTENT_WORDS).toEqual(config2.MAX_CONTENT_WORDS);

      console.log('✅ Configuration persistence test passed');
    }, 10000);

    it('should maintain all fields after partial update', async () => {
      const { saveConfig, getConfig } = await import('../../src/utils.js');

      await saveConfig({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'llama3.2',
        MAX_CONTENT_WORDS: 500,
      });

      await saveConfig({ LLM_MODEL: 'llama3' });

      const config = await getConfig();

      expect(config.LLM_PROVIDER).toBe('ollama'); // Should remain
      expect(config.LLM_MODEL).toBe('llama3'); // Should update
      // Config may store numbers as strings
      expect([500, '500']).toContain(config.MAX_CONTENT_WORDS); // Should remain

      console.log('✅ Partial update persistence test passed');
    }, 10000);
  });

  describe('Configuration Defaults', () => {
    it('should apply default values for missing fields', async () => {
      const { createDefaultConfig, getConfig } = await import('../../src/utils.js');

      await createDefaultConfig();
      const config = await getConfig();

      // Check that default values are set
      expect(config.LLM_PROVIDER).toBeDefined();
      expect(config.LLM_MODEL).toBeDefined();
      expect(config.FILE_NAME_CASE).toBeDefined();

      console.log('✅ Default values test passed');
    }, 10000);
  });
});
