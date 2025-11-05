import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import axios, { AxiosInstance } from 'axios';
import { LangChainBaseProvider, FileSystem } from './langchain-base-provider.js';

export class OpenAIProvider extends LangChainBaseProvider {
  name = 'OpenAI';
  private apiKey: string;
  private modelName: string;

  constructor(
    apiKey: string,
    model: string = 'gpt-3.5-turbo',
    httpClient: AxiosInstance = axios,
    fs: FileSystem = { readFile: (path: string) => import('fs/promises').then(fs => fs.readFile(path)) }
  ) {
    super(httpClient, fs);
    this.apiKey = apiKey;
    this.modelName = model;
  }

  protected async initializeModel(): Promise<any> {
    return new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: this.modelName,
      temperature: 0.7,
    });
  }

  async sendMessage(prompt: string): Promise<string> {
    if (prompt.length > 8000) {
      throw new Error('The prompt is too large for the OpenAI API');
    }

    return super.sendMessage(prompt);
  }

  async analyzeImage(imagePath: string, prompt: string = 'Describe this image concisely'): Promise<string> {
    try {
      const imageBuffer = await this.fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.determineMimeType(imagePath);

      // Create a vision-specific prompt that ensures JSON output
      const visionPrompt = `${prompt}

Please analyze this image and respond with a JSON object containing your analysis.

Image: data:${mimeType};base64,${base64Image}

Respond only with valid JSON.`;

      return await this.sendMessage(visionPrompt);
    } catch (error) {
      throw new Error(`OpenAI Vision API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private determineMimeType(imagePath: string): string {
    const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
    return ext === 'png' ? 'image/png' : 'image/jpeg';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test basic connectivity by making a minimal API call
      await this.httpClient.get('https://api.openai.com/v1/models', {
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
