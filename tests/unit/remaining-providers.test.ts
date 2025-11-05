import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { GrokProvider } from '../../src/providers/grok-provider.js';
import { LMStudioProvider } from '../../src/providers/lmstudio-provider.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('axios');

// Import mocked modules after mocking
import fs from 'fs/promises';

describe('Remaining Providers', () => {
  describe('GrokProvider', () => {
    let provider: GrokProvider;

    beforeEach(() => {
      vi.clearAllMocks();
      provider = new GrokProvider('test-grok-key', 'grok-beta');
    });

    describe('constructor', () => {
      it('should initialize with provided parameters', () => {
        const apiKey = 'test-key';
        const model = 'grok-beta';

        const provider = new GrokProvider(apiKey, model);

        expect(provider.name).toBe('Grok');
      });

      it('should use default model when not provided', () => {
        const provider = new GrokProvider('test-key');

        expect(provider.name).toBe('Grok');
      });
    });

    describe('sendMessage', () => {
      it('should send message successfully', async () => {
        const mockResponse = {
          data: {
            choices: [{
              message: { content: 'Grok response' }
            }]
          }
        };

        axios.post.mockResolvedValue(mockResponse);

        const result = await provider.sendMessage('Test prompt');

        expect(axios.post).toHaveBeenCalledWith(
          'https://api.x.ai/v1/chat/completions',
          {
            messages: [{
              role: 'user',
              content: 'Test prompt',
            }],
            model: 'grok-beta',
            temperature: 0.7,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-grok-key',
            },
          }
        );
        expect(result).toBe('Grok response');
      });

    it('should handle API errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { data: { error: { message: 'Invalid API key' } } },
        message: 'Request failed',
      };
      axios.post.mockRejectedValue(axiosError);

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('Request failed');
    });
    });

    describe('analyzeImage', () => {
      it('should throw error for vision API (not yet available)', async () => {
        const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('image-data'));
        const postSpy = vi.spyOn(axios, 'post').mockRejectedValue(new Error('API Error'));

        await expect(provider.analyzeImage('/path/to/image.jpg')).rejects.toThrow('Grok vision API not yet available');
      });
    });

    describe('isAvailable', () => {
      it('should return true when Grok API is available', async () => {
        axios.get.mockResolvedValue({});

        const result = await provider.isAvailable();

        expect(axios.get).toHaveBeenCalledWith('https://api.x.ai/v1/models', {
          headers: {
            Authorization: 'Bearer test-grok-key',
          },
        });
        expect(result).toBe(true);
      });

      it('should return false when Grok API is not available', async () => {
        axios.get.mockRejectedValue(new Error('Connection refused'));

        const result = await provider.isAvailable();

        expect(result).toBe(false);
      });
    });
  });

  describe('LMStudioProvider', () => {
    let provider: LMStudioProvider;

    beforeEach(() => {
      vi.clearAllMocks();
      provider = new LMStudioProvider('http://127.0.0.1:1234/v1', 'local-model');
    });

    describe('constructor', () => {
      it('should initialize with provided parameters', () => {
        const baseUrl = 'http://127.0.0.1:1234/v1';
        const model = 'local-model';

        const provider = new LMStudioProvider(baseUrl, model);

        expect(provider.name).toBe('LM Studio');
      });

      it('should use default parameters', () => {
        const provider = new LMStudioProvider();

        expect(provider.name).toBe('LM Studio');
      });
    });

    describe('sendMessage', () => {
      it('should send message successfully', async () => {
        const mockResponse = {
          data: {
            choices: [{
              message: { content: 'LM Studio response' }
            }]
          }
        };

        axios.post.mockResolvedValue(mockResponse);

        const result = await provider.sendMessage('Test prompt');

        expect(axios.post).toHaveBeenCalledWith(
          'http://127.0.0.1:1234/v1/chat/completions',
          expect.objectContaining({
            model: 'local-model',
            messages: [{
              role: 'user',
              content: 'Test prompt',
            }],
          }),
          expect.any(Object)
        );
        expect(result).toBe('LM Studio response');
      });

    it('should handle API errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { data: { error: { message: 'Model not found' } } },
        message: 'Request failed',
      };
      axios.post.mockRejectedValue(axiosError);

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('Request failed');
    });
    });

    describe('analyzeImage', () => {
      it('should attempt image analysis and throw error if model not available', async () => {
        const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('image-data'));
        const postSpy = vi.spyOn(axios, 'post').mockRejectedValue(new Error('Model not available'));

        await expect(provider.analyzeImage('/path/to/image.jpg', 'Describe this image')).rejects.toThrow('LM Studio vision not available');
      });
    });

    describe('isAvailable', () => {
      it('should check model availability', async () => {
        axios.get.mockResolvedValue({ data: { models: [] } });

        const result = await provider.isAvailable();

        expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/models');
        expect(result).toBe(true);
      });

      it('should return false when service unavailable', async () => {
        axios.get.mockRejectedValue(new Error('Connection failed'));

        const result = await provider.isAvailable();

        expect(result).toBe(false);
      });
    });
  });
});
