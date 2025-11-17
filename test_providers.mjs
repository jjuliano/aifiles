import { ProviderFactory } from './dist/providers/provider-factory.js';

// Test that providers can be instantiated without errors
const testProviders = async () => {
  console.log('Testing provider instantiation...\n');

  const providers = ['openai', 'grok', 'deepseek', 'ollama', 'lmstudio', 'gemini', 'copilot'];

  for (const provider of providers) {
    try {
      const config = {
        provider,
        apiKey: provider === 'ollama' || provider === 'lmstudio' ? undefined : 'test-key',
        baseUrl: provider === 'ollama' ? 'http://127.0.0.1:11434' :
                 provider === 'lmstudio' ? 'http://127.0.0.1:1234/v1' : undefined,
        model: provider === 'ollama' ? 'llama3.2' :
               provider === 'lmstudio' ? 'local-model' :
               provider === 'gemini' ? 'gemini-1.5-flash' :
               provider === 'copilot' ? 'gpt-4o' : 'gpt-3.5-turbo'
      };

      const llmProvider = ProviderFactory.createProvider(config);
      console.log(`✅ ${provider}: ${llmProvider.name} provider created successfully`);
    } catch (error) {
      console.log(`❌ ${provider}: ${error.message}`);
    }
  }
};

testProviders().catch(console.error);
