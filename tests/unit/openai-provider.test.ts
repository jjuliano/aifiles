import { describe, it, expect, vi } from 'vitest';

// Mock langchain dependencies
vi.mock('@langchain/openai');

import { OpenAIProvider } from '../../src/providers/openai-provider.js';
import { ChatOpenAI } from '@langchain/openai';

const mockedChatOpenAI = vi.mocked(ChatOpenAI);

describe('OpenAIProvider', () => {
  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      const apiKey = 'test-key';
      const model = 'gpt-4';

      const provider = new OpenAIProvider(apiKey, model);

      expect(provider.name).toBe('OpenAI');
    });

    it('should use default model when not provided', () => {
      const provider = new OpenAIProvider('test-key');

      expect(provider.name).toBe('OpenAI');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully and return JSON', async () => {
      const mockResponse = { message: 'Test response' };
      const mockModel = {
        invoke: vi.fn().mockResolvedValue({ content: JSON.stringify(mockResponse) }),
      };

      mockedChatOpenAI.mockImplementation(() => mockModel as any);

      const provider = new OpenAIProvider('test-key');
      const result = await provider.sendMessage('Test prompt');

      expect(result).toBe(JSON.stringify(mockResponse));
    });

    it('should throw error for prompts too large', async () => {
      const largePrompt = 'a'.repeat(8001);

      const provider = new OpenAIProvider('test-key');
      await expect(provider.sendMessage(largePrompt)).rejects.toThrow('The prompt is too large for the OpenAI API');
    });

    it('should handle API errors', async () => {
      const mockModel = {
        invoke: vi.fn().mockRejectedValue(new Error('API Error')),
      };

      mockedChatOpenAI.mockImplementation(() => mockModel as any);

      const provider = new OpenAIProvider('test-key');

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('LangChain OpenAI API error: API Error');
    });
  });

  describe('analyzeImage', () => {
    it('should analyze image successfully and return JSON', async () => {
      const mockResponse = { description: 'A beautiful sunset' };
      const mockModel = {
        invoke: vi.fn().mockResolvedValue({ content: JSON.stringify(mockResponse) }),
      };

      mockedChatOpenAI.mockImplementation(() => mockModel as any);

      // Mock file system
      const mockFs = { readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')) };
      const provider = new OpenAIProvider('test-key', 'gpt-4', undefined, mockFs);

      const result = await provider.analyzeImage('/path/to/image.jpg', 'Describe this image');

      expect(result).toBe(JSON.stringify(mockResponse));
    });

    it('should handle file read errors', async () => {
      const mockFs = { readFile: vi.fn().mockRejectedValue(new Error('File not found')) };
      const provider = new OpenAIProvider('test-key', 'gpt-4', undefined, mockFs);

      await expect(provider.analyzeImage('/nonexistent/image.jpg')).rejects.toThrow('File not found');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is available', async () => {
      const mockHttpClient = { get: vi.fn().mockResolvedValue({ data: { models: [] } }) };
      const provider = new OpenAIProvider('test-key', 'gpt-4', mockHttpClient);

      const result = await provider.isAvailable();

      expect(result).toBe(true);
    });

    it('should return false when API is unavailable', async () => {
      const mockHttpClient = { get: vi.fn().mockRejectedValue(new Error('Network error')) };
      const provider = new OpenAIProvider('test-key', 'gpt-4', mockHttpClient);

      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });
  });
});
