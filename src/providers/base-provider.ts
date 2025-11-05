export interface LLMProvider {
  name: string;
  sendMessage(prompt: string): Promise<string>;
  analyzeImage?(imagePath: string, prompt: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export interface LLMConfig {
  provider: 'openai' | 'grok' | 'deepseek' | 'ollama' | 'lmstudio';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}
