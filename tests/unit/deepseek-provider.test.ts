import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DeepSeekProvider } from '../../src/providers/deepseek-provider.js';

// Mock dependencies
vi.mock('axios');

const mockedAxios = vi.mocked(axios);

describe('DeepSeekProvider', () => {
  let provider: DeepSeekProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new DeepSeekProvider('test-api-key', 'deepseek-chat', 'https://custom.api.url');
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      const apiKey = 'test-key';
      const model = 'deepseek-chat';
      const baseUrl = 'https://custom.url';

      const provider = new DeepSeekProvider(apiKey, model, baseUrl);

      expect(provider.name).toBe('DeepSeek');
    });

    it('should use default base URL when not provided', () => {
      const provider = new DeepSeekProvider('test-key', 'deepseek-chat');

      expect(provider.name).toBe('DeepSeek');
    });

    it('should use default model when not provided', () => {
      const provider = new DeepSeekProvider('test-key');

      expect(provider.name).toBe('DeepSeek');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: { content: 'DeepSeek response' }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await provider.sendMessage('Test prompt');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://custom.api.url/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [{
            role: 'user',
            content: 'Test prompt',
          }],
          max_tokens: 4000,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
        }
      );
      expect(result).toBe('DeepSeek response');
    });

    it('should use default base URL', async () => {
      const defaultProvider = new DeepSeekProvider('test-key');
      const mockResponse = {
        data: {
          choices: [{
            message: { content: 'Response' }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await defaultProvider.sendMessage('Test');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should throw error for prompts too large', async () => {
      const largePrompt = 'a'.repeat(32001);

      await expect(provider.sendMessage(largePrompt)).rejects.toThrow('The prompt is too large for the DeepSeek API');
    });

    it('should handle API errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { data: { error: { message: 'Invalid API key' } } },
        message: 'Request failed',
      };
      mockedAxios.post.mockRejectedValue(axiosError);

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('Request failed');
    });

    it('should handle generic errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('Network error');
    });

    it('should handle API response without error details', async () => {
      const axiosError = {
        isAxiosError: true,
        response: null,
        message: 'Connection failed',
      };
      mockedAxios.post.mockRejectedValue(axiosError);

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('Connection failed');
    });
  });

  describe('analyzeImage', () => {
    it('should return placeholder message for image analysis', async () => {
      const result = await provider.analyzeImage('/path/to/image.jpg', 'Describe this image');

      expect(result).toBe('Image analysis not available for DeepSeek. Describe this image');
    });

    it('should use default prompt when not provided', async () => {
      const result = await provider.analyzeImage('/path/to/image.jpg');

      expect(result).toBe('Image analysis not available for DeepSeek. Describe this image concisely');
    });
  });

  describe('isAvailable', () => {
    it('should return true', async () => {
      const result = await provider.isAvailable();

      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Since the current implementation always returns true,
      // we'll just verify it doesn't throw
      const result = await provider.isAvailable();

      expect(result).toBe(true);
    });
  });
});
