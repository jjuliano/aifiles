import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LLMProvider } from './base-provider.js';
import axios, { AxiosInstance } from 'axios';

export interface FileSystem {
  readFile(path: string): Promise<Buffer>;
}

export abstract class LangChainBaseProvider implements LLMProvider {
  abstract name: string;
  protected model: BaseChatModel | undefined;
  protected httpClient: AxiosInstance;
  protected fs: FileSystem;

  constructor(
    httpClient: AxiosInstance = axios,
    fs: FileSystem = { readFile: (path: string) => import('fs/promises').then(fs => fs.readFile(path)) }
  ) {
    this.httpClient = httpClient;
    this.fs = fs;
  }

  protected abstract initializeModel(): Promise<any>;

  async sendMessage(prompt: string): Promise<string> {
    try {
      // Initialize model if not already done
      if (!this.model) {
        this.model = await this.initializeModel();
      }

      // Create a prompt that explicitly requests JSON
      const jsonPrompt = `${prompt}

Please respond with a valid JSON object. Format your response as JSON only, without any additional text or markdown formatting.`;

      // Get raw response from model
      const response = await this.model.invoke(jsonPrompt);
      const rawContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Return the raw response - let parseJson in utils handle cleaning and validation
      return rawContent;
    } catch (error) {
      // Enhanced error with raw response for debugging
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`LangChain ${this.name} API error: ${errorMsg}`);
    }
  }

  private cleanJsonResponse(response: string): string {
    let cleaned = response.trim();

    // Remove opening code fence with optional language specifier
    cleaned = cleaned.replace(/^```(?:json|jsonc)?\s*\n?/i, '');

    // Remove closing code fence
    cleaned = cleaned.replace(/\n?```\s*$/i, '');

    // Also handle backticks without language specifier
    cleaned = cleaned.replace(/^`+\s*\n?/, '');
    cleaned = cleaned.replace(/\n?`+\s*$/, '');

    // Trim again after stripping fences
    cleaned = cleaned.trim();

    // Handle LLM wrapping entire JSON in quotes: "{ ... }"
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      let inner = cleaned.slice(1, -1);
      // Only unwrap if the inner content looks like JSON
      if (inner.trim().startsWith('{') || inner.trim().startsWith('[')) {
        // Unescape any escaped quotes if present
        inner = inner.replace(/\\"/g, '"');
        cleaned = inner;
      }
    }

    // Trim one final time
    cleaned = cleaned.trim();

    // Handle extra closing braces by finding balanced JSON
    const startIndex = cleaned.indexOf('{');
    if (startIndex === -1) {
      throw new Error('No JSON object found in response');
    }

    let braceCount = 0;
    let endIndex = -1;

    for (let i = startIndex; i < cleaned.length; i++) {
      if (cleaned[i] === '{') {
        braceCount++;
      } else if (cleaned[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex === -1) {
      // If we can't find balanced braces, try to extract from first { to last }
      const lastEndIndex = cleaned.lastIndexOf('}');
      if (lastEndIndex > startIndex) {
        cleaned = cleaned.substring(startIndex, lastEndIndex + 1);
      } else {
        throw new Error('Invalid JSON structure: unbalanced braces');
      }
    } else {
      cleaned = cleaned.substring(startIndex, endIndex + 1);
    }

    // Remove any trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    return cleaned;
  }

  async analyzeImage(imagePath: string, prompt: string = 'Describe this image concisely'): Promise<string> {
    try {
      // Read image and convert to base64
      const imageBuffer = await this.fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Determine image format
      const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Use vision-capable model if available, otherwise fall back to text description
      const visionPrompt = `Analyze this image and respond with JSON: ${prompt}

Image data: data:${mimeType};base64,${base64Image}

Respond with valid JSON only.`;

      return await this.sendMessage(visionPrompt);
    } catch (error) {
      throw new Error(`${this.name} vision analysis error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.model) {
        this.model = await this.initializeModel();
      }
      // Test with a simple message
      await this.sendMessage('{"test": "availability"}');
      return true;
    } catch {
      return false;
    }
  }

  protected createJsonPrompt(template: string): PromptTemplate {
    return PromptTemplate.fromTemplate(`
${template}

IMPORTANT: Respond with valid JSON only. Do not include any explanatory text, markdown formatting, or code blocks. Return only the JSON object.
`);
  }
}
