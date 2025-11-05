import { ChatOpenAI } from '@langchain/openai';
import axios, { AxiosInstance } from 'axios';
import { LangChainBaseProvider, FileSystem } from './langchain-base-provider.js';

export class LMStudioProvider extends LangChainBaseProvider {
  name = 'LM Studio';
  private baseUrl: string;
  private modelName: string;

  constructor(
    baseUrl: string = 'http://127.0.0.1:1234/v1',
    model: string = 'local-model',
    httpClient: AxiosInstance = axios,
    fs: FileSystem = { readFile: (path: string) => import('fs/promises').then(fs => fs.readFile(path)) }
  ) {
    super(httpClient, fs);
    this.baseUrl = baseUrl;
    this.modelName = model;
  }

  protected async initializeModel(): Promise<any> {
    return new ChatOpenAI({
      openAIApiKey: 'lm-studio', // LM Studio doesn't require API key
      modelName: this.modelName,
      configuration: {
        baseURL: this.baseUrl,
      },
      temperature: 0.7,
    });
  }

  async sendMessage(prompt: string): Promise<string> {
    return super.sendMessage(prompt);
  }

  async analyzeImage(imagePath: string, prompt: string = 'Describe this image concisely'): Promise<string> {
    try {
      // Check if the loaded model supports vision
      // LM Studio supports vision models like LLaVA
      const imageBuffer = await this.fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Create a vision-specific prompt that ensures JSON response
      const visionPrompt = `${prompt}

Please analyze this image and respond with a JSON object containing your analysis.

Image: data:${mimeType};base64,${base64Image}

Respond only with valid JSON.`;

      return await this.sendMessage(visionPrompt);
    } catch (error) {
      // Vision may not be supported by current model
      const jsonResponse = {
        error: 'LM Studio vision not available. Load a vision-capable model (e.g., LLaVA) or use EXIF metadata fallback.',
        note: "Current model may not support vision capabilities"
      };
      return JSON.stringify(jsonResponse);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.httpClient.get(`${this.baseUrl}/models`);
      return true;
    } catch {
      return false;
    }
  }
}
