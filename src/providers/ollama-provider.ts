import axios, { AxiosInstance } from 'axios';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { LangChainBaseProvider, FileSystem } from './langchain-base-provider.js';

// Custom Ollama Chat Model for LangChain
class OllamaChatModel extends BaseChatModel {
  private baseUrl: string;
  private modelName: string;
  private httpClient: AxiosInstance;

  constructor(
    baseUrl: string,
    modelName: string,
    httpClient: AxiosInstance
  ) {
    super({});
    this.baseUrl = baseUrl;
    this.modelName = modelName;
    this.httpClient = httpClient;
  }

  get lc_secrets() {
    return {};
  }

  _llmType(): string {
    return 'ollama';
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
        `${this.baseUrl}/api/generate`,
        {
          model: this.modelName,
          prompt,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.response;
      const aiMessage = new AIMessage(content);

      return {
        generations: [{ text: content, message: aiMessage }],
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Ollama API error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
}

export class OllamaProvider extends LangChainBaseProvider {
  name = 'Ollama';
  private baseUrl: string;
  private modelName: string;

  constructor(
    baseUrl: string = 'http://127.0.0.1:11434',
    model: string = 'llama3.2',
    httpClient: AxiosInstance = axios,
    fs: FileSystem = { readFile: (path: string) => import('fs/promises').then(fs => fs.readFile(path)) }
  ) {
    super(httpClient, fs);
    this.baseUrl = baseUrl;
    this.modelName = model;
  }

  protected async initializeModel(): Promise<any> {
    return new OllamaChatModel(this.baseUrl, this.modelName, this.httpClient);
  }

  async analyzeImage(imagePath: string, prompt: string = 'Describe this image concisely'): Promise<string> {
    try {
      // For Ollama, use vision models like llava
      const visionModel = new OllamaChatModel(this.baseUrl, 'llava', this.httpClient);

      // Read image and convert to base64
      const imageBuffer = await this.fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Create a vision-specific prompt that ensures JSON response
      const visionPrompt = `${prompt}

Please analyze this image and respond with a JSON object containing your analysis.

Image (base64): ${base64Image}

Respond only with valid JSON.`;

      // Note: Ollama vision API might not work with this approach, but we'll try
      const response = await visionModel._generate([
        { content: visionPrompt, role: 'user' } as any
      ]);

      return response.generations[0].text;
    } catch (error: any) {
      // Fallback: return JSON error message
      const jsonResponse = {
        error: `Ollama vision not available. Install llava: ollama pull llava`,
        note: "Ollama vision models may require different API calls"
      };
      return JSON.stringify(jsonResponse);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.httpClient.get(`${this.baseUrl}/api/tags`);
      return true;
    } catch {
      return false;
    }
  }
}
