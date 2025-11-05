import axios, { AxiosInstance } from 'axios';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { LangChainBaseProvider, FileSystem } from './langchain-base-provider.js';

// Custom Grok Chat Model for LangChain
class GrokChatModel extends BaseChatModel {
  private apiKey: string;
  private baseUrl: string;
  private modelName: string;
  private httpClient: AxiosInstance;

  constructor(
    apiKey: string,
    baseUrl: string,
    modelName: string,
    httpClient: AxiosInstance
  ) {
    super({});
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.modelName = modelName;
    this.httpClient = httpClient;
  }

  get lc_secrets() {
    return { apiKey: this.apiKey };
  }

  _llmType(): string {
    return 'grok';
  }

  async _generate(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage.content as string;

    try {
      const response = await this.httpClient.post(
        `${this.baseUrl}/chat/completions`,
        {
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: this.modelName,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      const content = response.data.choices[0].message.content;
      const aiMessage = new AIMessage(content);

      return {
        generations: [{ text: content, message: aiMessage }],
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Grok API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }
}

export class GrokProvider extends LangChainBaseProvider {
  name = 'Grok';
  private apiKey: string;
  private baseUrl: string;
  private modelName: string;

  constructor(
    apiKey: string,
    model: string = 'grok-beta',
    httpClient: AxiosInstance = axios,
    fs: FileSystem = { readFile: (path: string) => import('fs/promises').then(fs => fs.readFile(path)) }
  ) {
    super(httpClient, fs);
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.x.ai/v1';
    this.modelName = model;
  }

  protected async initializeModel(): Promise<any> {
    return new GrokChatModel(this.apiKey, this.baseUrl, this.modelName, this.httpClient);
  }

  async analyzeImage(imagePath: string, prompt: string = 'Describe this image concisely'): Promise<string> {
    try {
      // Read image and convert to base64
      const imageBuffer = await this.fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Determine image format
      const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Create vision prompt that ensures JSON response
      const visionPrompt = `${prompt}

Please analyze this image and respond with a JSON object containing your analysis.

Image: data:${mimeType};base64,${base64Image}

Respond only with valid JSON.`;

      return await this.sendMessage(visionPrompt);
    } catch (error) {
      // Grok vision may not be available yet, throw error to trigger fallback
      throw new Error('Grok vision API not yet available. Using EXIF metadata fallback.');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.httpClient.get(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
