import { ChatOpenAI } from '@langchain/openai';
import axios, { AxiosInstance } from 'axios';
import { LangChainBaseProvider, FileSystem } from './langchain-base-provider.js';

export class DeepSeekProvider extends LangChainBaseProvider {
  name = 'DeepSeek';
  private apiKey: string;
  private modelName: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    model: string = 'deepseek-chat',
    baseUrl?: string,
    httpClient: AxiosInstance = axios,
    fs: FileSystem = { readFile: (path: string) => import('fs/promises').then(fs => fs.readFile(path)) }
  ) {
    super(httpClient, fs);
    this.apiKey = apiKey;
    this.modelName = model;
    this.baseUrl = baseUrl || 'https://api.deepseek.com/v1';
  }

  protected async initializeModel(): Promise<any> {
    return new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: this.modelName,
      configuration: {
        baseURL: this.baseUrl,
      },
      temperature: 0.7,
    });
  }

  async sendMessage(prompt: string): Promise<string> {
    if (prompt.length > 32000) {
      throw new Error('The prompt is too large for the DeepSeek API');
    }

    return super.sendMessage(prompt);
  }

  async analyzeImage(imagePath: string, prompt: string = 'Describe this image concisely'): Promise<string> {
    // DeepSeek doesn't have vision capabilities yet, so we'll use text-only description
    // But we still ensure JSON response format
    const jsonResponse = {
      description: `Image analysis not available for DeepSeek. ${prompt}`,
      note: "DeepSeek does not currently support vision capabilities"
    };
    return JSON.stringify(jsonResponse);
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple availability check with a basic HTTP request
      await this.httpClient.get(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 5000, // 5 second timeout
      });
      return true;
    } catch {
      return false;
    }
  }
}
