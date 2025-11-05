import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderFactory } from '../../src/providers/provider-factory.js';
import { LLMConfig } from '../../src/providers/base-provider.js';

// Mock all provider classes
vi.mock('../../src/providers/openai-provider.js');
vi.mock('../../src/providers/grok-provider.js');
vi.mock('../../src/providers/deepseek-provider.js');
vi.mock('../../src/providers/ollama-provider.js');
vi.mock('../../src/providers/lmstudio-provider.js');

const mockedOpenAIProvider = vi.mocked(await import('../../src/providers/openai-provider.js'));
const mockedGrokProvider = vi.mocked(await import('../../src/providers/grok-provider.js'));
const mockedDeepSeekProvider = vi.mocked(await import('../../src/providers/deepseek-provider.js'));
const mockedOllamaProvider = vi.mocked(await import('../../src/providers/ollama-provider.js'));
const mockedLMStudioProvider = vi.mocked(await import('../../src/providers/lmstudio-provider.js'));

describe('ProviderFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProvider', () => {
    it('should create OpenAI provider with API key', () => {
      const config: LLMConfig = {
        provider: 'openai',
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };

      const mockProvider = { name: 'OpenAI' };
      mockedOpenAIProvider.OpenAIProvider.mockReturnValue(mockProvider as any);

      const result = ProviderFactory.createProvider(config);

      expect(mockedOpenAIProvider.OpenAIProvider).toHaveBeenCalledWith('test-api-key', 'gpt-4', undefined, undefined);
      expect(result).toBe(mockProvider);
    });

    it('should create OpenAI provider with default model', () => {
      const config: LLMConfig = {
        provider: 'openai',
        apiKey: 'test-api-key',
      };

      const mockProvider = { name: 'OpenAI' };
      mockedOpenAIProvider.OpenAIProvider.mockReturnValue(mockProvider as any);

      ProviderFactory.createProvider(config);

      expect(mockedOpenAIProvider.OpenAIProvider).toHaveBeenCalledWith('test-api-key', 'gpt-3.5-turbo', undefined, undefined);
    });

    it('should throw error for OpenAI without API key', () => {
      const config: LLMConfig = {
        provider: 'openai',
      };

      expect(() => ProviderFactory.createProvider(config)).toThrow('OpenAI API key is required');
    });

    it('should create Grok provider with API key', () => {
      const config: LLMConfig = {
        provider: 'grok',
        apiKey: 'test-grok-key',
        model: 'grok-beta',
      };

      const mockProvider = { name: 'Grok' };
      mockedGrokProvider.GrokProvider.mockReturnValue(mockProvider as any);

      const result = ProviderFactory.createProvider(config);

      expect(mockedGrokProvider.GrokProvider).toHaveBeenCalledWith('test-grok-key', 'grok-beta', undefined, undefined);
      expect(result).toBe(mockProvider);
    });

    it('should create Grok provider with default model', () => {
      const config: LLMConfig = {
        provider: 'grok',
        apiKey: 'test-grok-key',
      };

      const mockProvider = { name: 'Grok' };
      mockedGrokProvider.GrokProvider.mockReturnValue(mockProvider as any);

      ProviderFactory.createProvider(config);

      expect(mockedGrokProvider.GrokProvider).toHaveBeenCalledWith('test-grok-key', 'grok-beta', undefined, undefined);
    });

    it('should throw error for Grok without API key', () => {
      const config: LLMConfig = {
        provider: 'grok',
      };

      expect(() => ProviderFactory.createProvider(config)).toThrow('Grok API key is required');
    });

    it('should create DeepSeek provider with API key', () => {
      const config: LLMConfig = {
        provider: 'deepseek',
        apiKey: 'test-deepseek-key',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
      };

      const mockProvider = { name: 'DeepSeek' };
      mockedDeepSeekProvider.DeepSeekProvider.mockReturnValue(mockProvider as any);

      const result = ProviderFactory.createProvider(config);

      expect(mockedDeepSeekProvider.DeepSeekProvider).toHaveBeenCalledWith('test-deepseek-key', 'deepseek-chat', 'https://api.deepseek.com', undefined);
      expect(result).toBe(mockProvider);
    });

    it('should create DeepSeek provider with defaults', () => {
      const config: LLMConfig = {
        provider: 'deepseek',
        apiKey: 'test-deepseek-key',
      };

      const mockProvider = { name: 'DeepSeek' };
      mockedDeepSeekProvider.DeepSeekProvider.mockReturnValue(mockProvider as any);

      ProviderFactory.createProvider(config);

      expect(mockedDeepSeekProvider.DeepSeekProvider).toHaveBeenCalledWith('test-deepseek-key', 'deepseek-chat', undefined, undefined);
    });

    it('should throw error for DeepSeek without API key', () => {
      const config: LLMConfig = {
        provider: 'deepseek',
      };

      expect(() => ProviderFactory.createProvider(config)).toThrow('DeepSeek API key is required');
    });

    it('should create Ollama provider with base URL and model', () => {
      const config: LLMConfig = {
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'llama3.2',
      };

      const mockProvider = { name: 'Ollama' };
      mockedOllamaProvider.OllamaProvider.mockReturnValue(mockProvider as any);

      const result = ProviderFactory.createProvider(config);

      expect(mockedOllamaProvider.OllamaProvider).toHaveBeenCalledWith('http://127.0.0.1:11434', 'llama3.2', undefined, undefined);
      expect(result).toBe(mockProvider);
    });

    it('should create Ollama provider with defaults', () => {
      const config: LLMConfig = {
        provider: 'ollama',
      };

      const mockProvider = { name: 'Ollama' };
      mockedOllamaProvider.OllamaProvider.mockReturnValue(mockProvider as any);

      ProviderFactory.createProvider(config);

      expect(mockedOllamaProvider.OllamaProvider).toHaveBeenCalledWith('http://127.0.0.1:11434', 'llama3.2', undefined, undefined);
    });

    it('should create LM Studio provider with base URL and model', () => {
      const config: LLMConfig = {
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'local-model',
      };

      const mockProvider = { name: 'LM Studio' };
      mockedLMStudioProvider.LMStudioProvider.mockReturnValue(mockProvider as any);

      const result = ProviderFactory.createProvider(config);

      expect(mockedLMStudioProvider.LMStudioProvider).toHaveBeenCalledWith('http://127.0.0.1:1234/v1', 'local-model', undefined, undefined);
      expect(result).toBe(mockProvider);
    });

    it('should create LM Studio provider with defaults', () => {
      const config: LLMConfig = {
        provider: 'lmstudio',
      };

      const mockProvider = { name: 'LM Studio' };
      mockedLMStudioProvider.LMStudioProvider.mockReturnValue(mockProvider as any);

      ProviderFactory.createProvider(config);

      expect(mockedLMStudioProvider.LMStudioProvider).toHaveBeenCalledWith('http://127.0.0.1:1234/v1', 'local-model', undefined, undefined);
    });

    it('should throw error for unknown provider', () => {
      const config: LLMConfig = {
        provider: 'unknown' as any,
      };

      expect(() => ProviderFactory.createProvider(config)).toThrow('Unknown provider: unknown');
    });
  });
});
