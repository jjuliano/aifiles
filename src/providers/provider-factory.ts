import { LLMConfig, LLMProvider } from './base-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GrokProvider } from './grok-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { LMStudioProvider } from './lmstudio-provider.js';

export class ProviderFactory {
  static createProvider(
    config: LLMConfig,
    httpClient?: any,
    fs?: any
  ): LLMProvider {
    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        return new OpenAIProvider(config.apiKey, config.model || 'gpt-3.5-turbo', httpClient, fs);

      case 'grok':
        if (!config.apiKey) {
          throw new Error('Grok API key is required');
        }
        return new GrokProvider(config.apiKey, config.model || 'grok-beta', httpClient, fs);

      case 'deepseek':
        if (!config.apiKey) {
          throw new Error('DeepSeek API key is required');
        }
        return new DeepSeekProvider(config.apiKey, config.model || 'deepseek-chat', config.baseUrl, httpClient);

      case 'ollama':
        return new OllamaProvider(
          config.baseUrl || 'http://127.0.0.1:11434',
          config.model || 'llama3.2',
          httpClient,
          fs
        );

      case 'lmstudio':
        return new LMStudioProvider(
          config.baseUrl || 'http://127.0.0.1:1234/v1',
          config.model || 'local-model',
          httpClient,
          fs
        );

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
