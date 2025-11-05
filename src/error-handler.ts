import { red, yellow } from 'kolorist';

export class AIFilesError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AIFilesError';
  }
}

export class ConfigurationError extends AIFilesError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class ProviderError extends AIFilesError {
  constructor(message: string, details?: any) {
    super(message, 'PROVIDER_ERROR', details);
    this.name = 'ProviderError';
  }
}

export class FileOperationError extends AIFilesError {
  constructor(message: string, details?: any) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileOperationError';
  }
}

export class ValidationError extends AIFilesError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof AIFilesError) {
    console.error(red(`\n✗ ${error.name}: ${error.message}`));

    if (error.details) {
      console.error(yellow('\nDetails:'));
      console.error(JSON.stringify(error.details, null, 2));
    }

    // Provide helpful hints based on error type
    if (error instanceof ConfigurationError) {
      console.error(yellow('\n💡 Hint: Check your ~/.aifiles configuration file'));
      console.error(yellow('   Run: aifiles-setup to reconfigure\n'));
    } else if (error instanceof ProviderError) {
      console.error(yellow('\n💡 Hint: Check your AI provider settings'));
      console.error(yellow('   - Verify API keys are valid'));
      console.error(yellow('   - Ensure the service is accessible'));
      console.error(yellow('   - Check LLM_PROVIDER setting in ~/.aifiles\n'));
    } else if (error instanceof FileOperationError) {
      console.error(yellow('\n💡 Hint: Check file permissions and paths'));
      console.error(yellow('   - Verify the file exists and is readable'));
      console.error(yellow('   - Check directory permissions\n'));
    }
  } else if (error instanceof Error) {
    console.error(red(`\n✗ Error: ${error.message}`));

    if (error.stack) {
      console.error(yellow('\nStack trace:'));
      console.error(error.stack);
    }
  } else {
    console.error(red('\n✗ An unknown error occurred'));
    console.error(error);
  }

  console.error(yellow('\n📚 For help, visit: https://github.com/jjuliano/aifiles\n'));
}

export function validateConfig(config: any): void {
  // Validate LLM provider
  if (config.LLM_PROVIDER) {
    const validProviders = ['openai', 'grok', 'ollama', 'lmstudio'];
    if (!validProviders.includes(config.LLM_PROVIDER)) {
      throw new ConfigurationError(
        `Invalid LLM_PROVIDER: ${config.LLM_PROVIDER}`,
        {
          validProviders,
          provided: config.LLM_PROVIDER,
        }
      );
    }
  }

  // Validate API keys based on provider
  const provider = config.LLM_PROVIDER || 'openai';

  if (provider === 'openai' && !config.OPENAI_API_KEY) {
    throw new ConfigurationError(
      'OPENAI_API_KEY is required when using OpenAI provider',
      {
        hint: 'Add OPENAI_API_KEY=sk-... to ~/.aifiles',
      }
    );
  }

  if (provider === 'grok' && !config.GROK_API_KEY) {
    throw new ConfigurationError(
      'GROK_API_KEY is required when using Grok provider',
      {
        hint: 'Add GROK_API_KEY=... to ~/.aifiles',
      }
    );
  }

  // Validate directories
  if (!config.BASE_DIRECTORY) {
    throw new ConfigurationError(
      'BASE_DIRECTORY is required',
      {
        hint: 'Add BASE_DIRECTORY=~ to ~/.aifiles',
      }
    );
  }

  // Validate fields file
  if (!config.FIELDS_FILE && !config.PROMPT_FILE) {
    throw new ConfigurationError(
      'FIELDS_FILE is required',
      {
        hint: 'Add FIELDS_FILE=~/.aifiles/fields.json to ~/.aifiles/config',
      }
    );
  }
}

export function validateFilePath(filePath: string): void {
  if (!filePath || filePath.trim() === '') {
    throw new ValidationError('File path is required');
  }

  if (filePath.includes('..')) {
    throw new ValidationError(
      'File path cannot contain ".." for security reasons',
      { provided: filePath }
    );
  }
}

export function validateTemplate(template: any): void {
  const required = ['id', 'name', 'basePath', 'namingStructure'];

  for (const field of required) {
    if (!template[field]) {
      throw new ValidationError(
        `Template field '${field}' is required`,
        { template }
      );
    }
  }

  // Validate naming structure has placeholders
  if (!template.namingStructure.includes('{')) {
    throw new ValidationError(
      'Naming structure must include at least one placeholder (e.g., {file_title})',
      { provided: template.namingStructure }
    );
  }

  // Validate file name case
  const validCases = ['snake', 'kebab', 'camel', 'pascal', 'upper_snake', 'lower_snake'];
  if (template.fileNameCase && !validCases.includes(template.fileNameCase)) {
    throw new ValidationError(
      `Invalid file name case: ${template.fileNameCase}`,
      {
        validCases,
        provided: template.fileNameCase,
      }
    );
  }
}

// Async error wrapper for CLI commands
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<void> {
  return async (...args: Parameters<T>): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  };
}
