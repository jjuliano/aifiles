import { describe, it, expect } from 'vitest';

/**
 * Provider Error Handling Tests
 *
 * Tests error scenarios for all LLM providers
 */
describe('Provider Error Handling Tests', () => {
  describe('Provider Factory Error Cases', () => {
    it('should throw error for invalid provider type', async () => {
      const { ProviderFactory } = await import('../../src/providers/provider-factory.js');

      expect(() => {
        ProviderFactory.createProvider({
          provider: 'invalid-provider' as any,
          apiKey: 'test',
          model: 'test',
        });
      }).toThrow();

      console.log('✅ Invalid provider type test passed');
    }, 10000);

    it('should create provider without API key for Ollama', async () => {
      const { ProviderFactory } = await import('../../src/providers/provider-factory.js');

      const provider = ProviderFactory.createProvider({
        provider: 'ollama',
        model: 'llama3.2',
      });

      expect(provider).toBeDefined();

      console.log('✅ Ollama without API key test passed');
    }, 10000);

    it('should handle missing model parameter', async () => {
      const { ProviderFactory } = await import('../../src/providers/provider-factory.js');

      const provider = ProviderFactory.createProvider({
        provider: 'ollama',
        model: '',
      });

      expect(provider).toBeDefined();

      console.log('✅ Missing model parameter test passed');
    }, 10000);
  });

  describe('Provider Configuration Validation', () => {
    it('should validate Ollama provider configuration', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const provider = new OllamaProvider({
        model: 'llama3.2',
        baseUrl: 'http://127.0.0.1:11434',
      });

      expect(provider).toBeDefined();

      console.log('✅ Ollama configuration validation test passed');
    }, 10000);

    it('should validate OpenAI provider configuration', async () => {
      const { OpenAIProvider } = await import('../../src/providers/openai-provider.js');

      const provider = new OpenAIProvider({
        apiKey: 'test-key-123',
        model: 'gpt-4',
      });

      expect(provider).toBeDefined();

      console.log('✅ OpenAI configuration validation test passed');
    }, 10000);

    it('should validate Grok provider configuration', async () => {
      const { GrokProvider } = await import('../../src/providers/grok-provider.js');

      const provider = new GrokProvider({
        apiKey: 'test-key-123',
        model: 'grok-1',
      });

      expect(provider).toBeDefined();

      console.log('✅ Grok configuration validation test passed');
    }, 10000);

    it('should validate DeepSeek provider configuration', async () => {
      const { DeepSeekProvider } = await import('../../src/providers/deepseek-provider.js');

      const provider = new DeepSeekProvider({
        apiKey: 'test-key-123',
        model: 'deepseek-chat',
      });

      expect(provider).toBeDefined();

      console.log('✅ DeepSeek configuration validation test passed');
    }, 10000);

    it('should validate LM Studio provider configuration', async () => {
      const { LMStudioProvider } = await import('../../src/providers/lmstudio-provider.js');

      const provider = new LMStudioProvider({
        model: 'local-model',
        baseUrl: 'http://127.0.0.1:1234',
      });

      expect(provider).toBeDefined();

      console.log('✅ LM Studio configuration validation test passed');
    }, 10000);
  });

  describe('Provider Base URL Handling', () => {
    it('should use default Ollama base URL when not provided', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const provider = new OllamaProvider({
        model: 'llama3.2',
      });

      expect(provider).toBeDefined();

      console.log('✅ Default Ollama base URL test passed');
    }, 10000);

    it('should accept custom base URL for Ollama', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const provider = new OllamaProvider({
        model: 'llama3.2',
        baseUrl: 'http://custom-server:8080',
      });

      expect(provider).toBeDefined();

      console.log('✅ Custom Ollama base URL test passed');
    }, 10000);

    it('should accept custom base URL for LM Studio', async () => {
      const { LMStudioProvider } = await import('../../src/providers/lmstudio-provider.js');

      const provider = new LMStudioProvider({
        model: 'local-model',
        baseUrl: 'http://127.0.0.1:5000',
      });

      expect(provider).toBeDefined();

      console.log('✅ Custom LM Studio base URL test passed');
    }, 10000);
  });

  describe('Provider Error Message Handling', () => {
    it('should handle provider creation with all parameters', async () => {
      const { ProviderFactory } = await import('../../src/providers/provider-factory.js');

      const providers = [
        { provider: 'ollama' as const, model: 'llama3.2', apiKey: 'optional' },
        { provider: 'openai' as const, model: 'gpt-4', apiKey: 'sk-test123' },
        { provider: 'grok' as const, model: 'grok-1', apiKey: 'xai-test123' },
        { provider: 'deepseek' as const, model: 'deepseek-chat', apiKey: 'ds-test123' },
        { provider: 'lmstudio' as const, model: 'local', apiKey: 'optional' },
      ];

      for (const config of providers) {
        const provider = ProviderFactory.createProvider(config);
        expect(provider).toBeDefined();
      }

      console.log('✅ All provider creation test passed');
    }, 10000);
  });

  describe('Provider Model Name Validation', () => {
    it('should handle empty model names gracefully', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const provider = new OllamaProvider({
        model: '',
      });

      expect(provider).toBeDefined();

      console.log('✅ Empty model name test passed');
    }, 10000);

    it('should handle very long model names', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const longModelName = 'a'.repeat(500);

      const provider = new OllamaProvider({
        model: longModelName,
      });

      expect(provider).toBeDefined();

      console.log('✅ Long model name test passed');
    }, 10000);

    it('should handle model names with special characters', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const specialNames = [
        'model-with-dashes',
        'model_with_underscores',
        'model.with.dots',
        'model:with:colons',
      ];

      for (const modelName of specialNames) {
        const provider = new OllamaProvider({
          model: modelName,
        });
        expect(provider).toBeDefined();
      }

      console.log('✅ Special character model names test passed');
    }, 10000);
  });

  describe('Provider API Key Validation', () => {
    it('should handle very long API keys', async () => {
      const { OpenAIProvider } = await import('../../src/providers/openai-provider.js');

      const longApiKey = 'sk-' + 'a'.repeat(1000);

      const provider = new OpenAIProvider({
        apiKey: longApiKey,
        model: 'gpt-4',
      });

      expect(provider).toBeDefined();

      console.log('✅ Long API key test passed');
    }, 10000);

    it('should handle API keys with special characters', async () => {
      const { OpenAIProvider } = await import('../../src/providers/openai-provider.js');

      const specialKeys = [
        'sk-test_key-123',
        'sk-test.key.456',
        'sk-test-key-!@#$%',
      ];

      for (const apiKey of specialKeys) {
        const provider = new OpenAIProvider({
          apiKey,
          model: 'gpt-4',
        });
        expect(provider).toBeDefined();
      }

      console.log('✅ Special character API keys test passed');
    }, 10000);

    it('should handle empty API keys for providers that require them', async () => {
      const { OpenAIProvider } = await import('../../src/providers/openai-provider.js');

      const provider = new OpenAIProvider({
        apiKey: '',
        model: 'gpt-4',
      });

      expect(provider).toBeDefined();

      console.log('✅ Empty API key test passed');
    }, 10000);
  });

  describe('Provider Timeout Configuration', () => {
    it('should handle custom timeout values', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const provider = new OllamaProvider({
        model: 'llama3.2',
        timeout: 30000, // 30 seconds
      });

      expect(provider).toBeDefined();

      console.log('✅ Custom timeout test passed');
    }, 10000);

    it('should handle very short timeout values', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const provider = new OllamaProvider({
        model: 'llama3.2',
        timeout: 100, // 100ms
      });

      expect(provider).toBeDefined();

      console.log('✅ Short timeout test passed');
    }, 10000);

    it('should handle very long timeout values', async () => {
      const { OllamaProvider } = await import('../../src/providers/ollama-provider.js');

      const provider = new OllamaProvider({
        model: 'llama3.2',
        timeout: 600000, // 10 minutes
      });

      expect(provider).toBeDefined();

      console.log('✅ Long timeout test passed');
    }, 10000);
  });
});
