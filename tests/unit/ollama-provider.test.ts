import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OllamaProvider } from '../../src/providers/ollama-provider.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('axios');

// Import mocked modules after mocking
import fs from 'fs/promises';
import axios from 'axios';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OllamaProvider('http://127.0.0.1:11434', 'llama3.2', axios, fs);
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      const baseUrl = 'http://127.0.0.1:11434';
      const model = 'llama3.2';

      const provider = new OllamaProvider(baseUrl, model, axios, fs);

      expect(provider.name).toBe('Ollama');
    });

    it('should use default parameters', () => {
      const provider = new OllamaProvider(undefined, undefined, axios, fs);

      expect(provider.name).toBe('Ollama');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        data: { response: 'Ollama response text' }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await provider.sendMessage('Test prompt');

      expect(axios.post).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/generate',
        {
          model: 'llama3.2',
          prompt: 'Test prompt',
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toBe('Ollama response text');
    });

    it('should handle API errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { data: { error: 'Model not found' } },
        message: 'Request failed',
      };
      axios.post.mockRejectedValue(axiosError);

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('Request failed');
    });

    it('should handle generic errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(provider.sendMessage('Test prompt')).rejects.toThrow('Network error');
    });
  });

  describe('analyzeImage', () => {
    it('should analyze image with vision model successfully', async () => {
      const imagePath = '/path/to/image.jpg';
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockResponse = {
        data: { response: 'A beautiful landscape with mountains' }
      };

      const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(mockImageBuffer);
      const postSpy = vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const result = await provider.analyzeImage(imagePath, 'Describe this image');

      expect(readFileSpy).toHaveBeenCalledWith(imagePath);
      expect(postSpy).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/generate',
        {
          model: 'llava',
          prompt: 'Describe this image',
          images: [mockImageBuffer.toString('base64')],
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toBe('A beautiful landscape with mountains');
    });

    it('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(provider.analyzeImage('/nonexistent/image.jpg')).rejects.toThrow('File not found');
    });

    it('should handle vision model not available', async () => {
      const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('image-data'));
      const postSpy = vi.spyOn(axios, 'post').mockRejectedValue({
        isAxiosError: true,
        response: { data: { error: 'model not found' } },
      });

      await expect(provider.analyzeImage('/path/to/image.jpg')).rejects.toThrow('Ollama vision not available. Install llava: ollama pull llava');
    });

    it('should use default prompt when not provided', async () => {
      fs.readFile.mockResolvedValue(Buffer.from('image-data'));
      axios.post.mockResolvedValue({
        data: { response: 'Analysis result' }
      });

      await provider.analyzeImage('/path/to/image.jpg');

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ prompt: 'Describe this image concisely' }),
        expect.any(Object)
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', async () => {
      axios.get.mockResolvedValue({});

      const result = await provider.isAvailable();

      expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags');
      expect(result).toBe(true);
    });

    it('should return false when Ollama is not available', async () => {
      axios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });
  });
});
