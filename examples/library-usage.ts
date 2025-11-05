/**
 * AIFiles - Library Usage Example
 *
 * This example shows how to use AIFiles as a library in your own Node.js applications.
 */

import { getConfig, fileExists, generatePromptResponse, resolvePath } from '../src/utils.js';
import { FolderTemplateManager } from '../src/folder-templates.js';
import { FileWatcher } from '../src/file-watcher.js';
import { ProviderFactory } from '../src/providers/provider-factory.js';
import { TemplateConfig } from '../src/types.js';
import { ConfigurationError, handleError } from '../src/error-handler.js';

/**
 * Example 1: Simple file analysis
 */
async function analyzeFile(filePath: string) {
  try {
    // Load configuration
    const config = await getConfig();

    // Validate file exists
    const absolutePath = resolvePath(filePath);
    if (!await fileExists(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create AI provider
    const provider = config.LLM_PROVIDER || 'openai';
    const apiKey = provider === 'openai' ? config.OPENAI_API_KEY : config.GROK_API_KEY;

    if (!apiKey && provider !== 'ollama' && provider !== 'lmstudio') {
      throw new ConfigurationError(`API key required for ${provider}`);
    }

    // Create analysis prompt
    const prompt = `Analyze this file and provide:
    1. A descriptive title
    2. Main category
    3. 3-5 relevant tags
    4. Brief summary

    Return as JSON with keys: title, category, tags, summary`;

    // Get AI analysis
    const response = await generatePromptResponse(config, prompt);
    const analysis = JSON.parse(response);

    console.log('File Analysis:', analysis);
    return analysis;

  } catch (error) {
    handleError(error);
    throw error;
  }
}

/**
 * Example 2: Automated folder watching
 */
async function setupFolderWatching() {
  try {
    const templateManager = new FolderTemplateManager();
    const fileWatcher = new FileWatcher();

    // Load existing templates
    const templates = await templateManager.loadTemplates();
    console.log(`Loaded ${templates.length} templates`);

    // Start watching enabled templates
    for (const template of templates) {
      if (template.watchForChanges) {
        console.log(`Watching: ${template.name} (${template.basePath})`);
        fileWatcher.watchTemplate(template);
      }
    }

    // Handle new files
    fileWatcher.on('fileAdded', async (event) => {
      console.log(`\n📄 New file detected:`);
      console.log(`   File: ${event.fileName}`);
      console.log(`   Template: ${event.template.name}`);
      console.log(`   Path: ${event.filePath}`);

      if (event.template.autoOrganize) {
        console.log(`   ⚡ Auto-organizing...`);
        // Your organization logic here
        await organizeFile(event.filePath, event.template);
      } else {
        console.log(`   ⏸️  Waiting for manual review`);
        // Prompt user or queue for review
      }
    });

    fileWatcher.on('error', (data) => {
      console.error(`Watch error in ${data.template.name}:`, data.error);
    });

    // Keep process running
    console.log('\n👀 File watching active. Press Ctrl+C to stop.\n');

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\nShutting down...');
      fileWatcher.stopAll();
      process.exit(0);
    });

  } catch (error) {
    handleError(error);
    throw error;
  }
}

/**
 * Example 3: Create and use a custom template
 */
async function createCustomWorkflow() {
  try {
    const templateManager = new FolderTemplateManager();

    // Define a custom template
    const customTemplate = {
      id: `custom-${Date.now()}`,
      name: 'My Custom Workflow',
      description: 'Custom file organization for my project',
      basePath: '~/Projects/MyApp/uploads',
      namingStructure: '{file_category_1}/{file_date_created}/{file_title}',
      fileNameCase: 'kebab' as const,
      autoOrganize: false,
      watchForChanges: true
    };

    // Add template
    await templateManager.addTemplate(customTemplate);
    console.log('✅ Custom template created');

    // Create the directory
    const folderPath = await templateManager.createFolderFromTemplate(customTemplate.id);
    console.log(`📁 Folder created: ${folderPath}`);

    // Start watching
    const watcher = new FileWatcher();
    watcher.watchTemplate(customTemplate);
    console.log('👀 Watching for new files...');

    return { template: customTemplate, watcher };

  } catch (error) {
    handleError(error);
    throw error;
  }
}

/**
 * Example 4: Batch file processing
 */
async function batchProcess(files: string[]) {
  const results = [];

  for (const file of files) {
    try {
      console.log(`Processing: ${file}`);
      const analysis = await analyzeFile(file);
      results.push({ file, success: true, analysis });
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
      results.push({ file, success: false, error });
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  console.log(`\nProcessed ${results.length} files (${successful} successful)`);

  return results;
}

/**
 * Example 5: Custom provider integration
 */
async function useCustomProvider() {
  // Override with custom provider
  const customProvider = ProviderFactory.createProvider({
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'llama3.2'
  });

  // Check availability
  const available = await customProvider.isAvailable();
  if (!available) {
    throw new Error('Custom provider not available');
  }

  // Use provider
  const response = await customProvider.sendMessage(
    'Categorize this file: annual_report_2024.pdf'
  );

  console.log('Provider response:', response);
  return response;
}

/**
 * Helper: Organize file based on template
 */
async function organizeFile(filePath: string, template: TemplateConfig) {
  // This is where you'd implement your organization logic
  // For now, just a placeholder
  console.log(`   Organizing ${filePath} with template ${template.name}`);

  // Example steps:
  // 1. Analyze file with AI
  // 2. Apply naming structure
  // 3. Move/copy to destination
  // 4. Add metadata

  return true;
}

// Export functions for use
export {
  analyzeFile,
  setupFolderWatching,
  createCustomWorkflow,
  batchProcess,
  useCustomProvider
};

/**
 * Main function - demonstrates usage
 */
async function main() {
  console.log('🤖 AIFiles Library Usage Examples\n');

  // Uncomment to run different examples:

  // Example 1: Analyze a single file
  // await analyzeFile('~/Documents/report.pdf');

  // Example 2: Setup folder watching
  // await setupFolderWatching();

  // Example 3: Create custom workflow
  // await createCustomWorkflow();

  // Example 4: Batch processing
  // await batchProcess([
  //   '~/Documents/file1.pdf',
  //   '~/Documents/file2.pdf',
  //   '~/Documents/file3.pdf'
  // ]);

  // Example 5: Use custom provider
  // await useCustomProvider();

  console.log('\n✅ Examples complete!');
  console.log('Uncomment functions in main() to try them out.');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
