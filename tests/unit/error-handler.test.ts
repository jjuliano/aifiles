import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIFilesError,
  ConfigurationError,
  ProviderError,
  FileOperationError,
  ValidationError,
  handleError,
  validateConfig,
  validateFilePath,
  validateTemplate,
  withErrorHandler,
} from '../../src/error-handler.js';

describe('Error Classes', () => {
  describe('AIFilesError', () => {
    it('should create error with message and code', () => {
      const error = new AIFilesError('Test message', 'TEST_CODE', { extra: 'data' });

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.name).toBe('AIFilesError');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Config error', { hint: 'fix this' });

      expect(error.message).toBe('Config error');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.name).toBe('ConfigurationError');
      expect(error.details).toEqual({ hint: 'fix this' });
    });
  });

  describe('ProviderError', () => {
    it('should create provider error', () => {
      const error = new ProviderError('Provider error', { service: 'openai' });

      expect(error.message).toBe('Provider error');
      expect(error.code).toBe('PROVIDER_ERROR');
      expect(error.name).toBe('ProviderError');
      expect(error.details).toEqual({ service: 'openai' });
    });
  });

  describe('FileOperationError', () => {
    it('should create file operation error', () => {
      const error = new FileOperationError('File error', { path: '/test/file.txt' });

      expect(error.message).toBe('File error');
      expect(error.code).toBe('FILE_ERROR');
      expect(error.name).toBe('FileOperationError');
      expect(error.details).toEqual({ path: '/test/file.txt' });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Validation error', { field: 'name' });

      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual({ field: 'name' });
    });
  });
});

describe('handleError', () => {
  let consoleSpy: vi.SpyInstance;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle AIFilesError with configuration hint', () => {
    const error = new ConfigurationError('Config error', { hint: 'check settings' });

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ ConfigurationError: Config error');
    expect(consoleSpy).toHaveBeenCalledWith('\nDetails:');
    expect(consoleSpy).toHaveBeenCalledWith('{\n  "hint": "check settings"\n}');
    expect(consoleSpy).toHaveBeenCalledWith('\n💡 Hint: Check your ~/.aifiles configuration file');
    expect(consoleSpy).toHaveBeenCalledWith('   Run: aifiles-setup to reconfigure\n');
  });

  it('should handle AIFilesError with provider hint', () => {
    const error = new ProviderError('API error');

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ ProviderError: API error');
    expect(consoleSpy).toHaveBeenCalledWith('\n💡 Hint: Check your AI provider settings');
  });

  it('should handle AIFilesError with file operation hint', () => {
    const error = new FileOperationError('File not found');

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ FileOperationError: File not found');
    expect(consoleSpy).toHaveBeenCalledWith('\n💡 Hint: Check file permissions and paths');
  });

  it('should handle AIFilesError without details', () => {
    const error = new AIFilesError('Simple error', 'SIMPLE_ERROR');

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ AIFilesError: Simple error');
    expect(consoleSpy).not.toHaveBeenCalledWith('Details:');
  });

  it('should handle generic Error', () => {
    const error = new Error('Generic error');
    error.stack = 'Mock stack trace';

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ Error: Generic error');
    expect(consoleSpy).toHaveBeenCalledWith('\nStack trace:');
    expect(consoleSpy).toHaveBeenCalledWith('Mock stack trace');
  });

  it('should handle Error without stack', () => {
    const error = new Error('No stack error');

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ Error: No stack error');
    expect(consoleSpy).not.toHaveBeenCalledWith('Stack trace:');
  });

  it('should handle unknown error types', () => {
    const error = 'string error';

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ An unknown error occurred');
    expect(consoleSpy).toHaveBeenCalledWith('string error');
  });

  it('should always show help link', () => {
    const error = new Error('Test');

    handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('\n📚 For help, visit: https://github.com/jjuliano/aifiles\n');
  });
});

describe('validateConfig', () => {
  it('should pass validation for valid config', () => {
    const config = {
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
      BASE_DIRECTORY: '~',
      PROMPT_FILE: '~/.aifiles.json',
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should throw error for invalid provider', () => {
    const config = {
      LLM_PROVIDER: 'invalid_provider',
    };

    expect(() => validateConfig(config)).toThrow(ConfigurationError);
    expect(() => validateConfig(config)).toThrow('Invalid LLM_PROVIDER: invalid_provider');
  });

  it('should throw error for missing OpenAI API key', () => {
    const config = {
      LLM_PROVIDER: 'openai',
      BASE_DIRECTORY: '~',
      PROMPT_FILE: '~/.aifiles.json',
    };

    expect(() => validateConfig(config)).toThrow(ConfigurationError);
    expect(() => validateConfig(config)).toThrow('OPENAI_API_KEY is required when using OpenAI provider');
  });

  it('should throw error for missing Grok API key', () => {
    const config = {
      LLM_PROVIDER: 'grok',
      BASE_DIRECTORY: '~',
      PROMPT_FILE: '~/.aifiles.json',
    };

    expect(() => validateConfig(config)).toThrow(ConfigurationError);
    expect(() => validateConfig(config)).toThrow('GROK_API_KEY is required when using Grok provider');
  });

  it('should not require API key for Ollama', () => {
    const config = {
      LLM_PROVIDER: 'ollama',
      BASE_DIRECTORY: '~',
      PROMPT_FILE: '~/.aifiles.json',
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should throw error for missing base directory', () => {
    const config = {
      LLM_PROVIDER: 'ollama',
      PROMPT_FILE: '~/.aifiles.json',
    };

    expect(() => validateConfig(config)).toThrow(ConfigurationError);
    expect(() => validateConfig(config)).toThrow('BASE_DIRECTORY is required');
  });

  it('should throw error for missing prompt file', () => {
    const config = {
      LLM_PROVIDER: 'ollama',
      BASE_DIRECTORY: '~',
    };

    expect(() => validateConfig(config)).toThrow(ConfigurationError);
    expect(() => validateConfig(config)).toThrow('PROMPT_FILE is required');
  });

  it('should use default provider when not specified', () => {
    const config = {
      OPENAI_API_KEY: 'sk-test',
      BASE_DIRECTORY: '~',
      PROMPT_FILE: '~/.aifiles.json',
    };

    expect(() => validateConfig(config)).not.toThrow();
  });
});

describe('validateFilePath', () => {
  it('should pass validation for valid file path', () => {
    expect(() => validateFilePath('/valid/path/file.txt')).not.toThrow();
    expect(() => validateFilePath('relative/path/file.pdf')).not.toThrow();
  });

  it('should throw error for empty file path', () => {
    expect(() => validateFilePath('')).toThrow(ValidationError);
    expect(() => validateFilePath('   ')).toThrow('File path is required');
  });

  it('should throw error for path with directory traversal', () => {
    expect(() => validateFilePath('../../../etc/passwd')).toThrow(ValidationError);
    expect(() => validateFilePath('./../config.txt')).toThrow('File path cannot contain ".." for security reasons');
  });
});

describe('validateTemplate', () => {
  it('should pass validation for valid template', () => {
    const template = {
      id: 'test-template',
      name: 'Test Template',
      basePath: '~/test',
      namingStructure: '{file_title}',
      description: 'A test template',
      fileNameCase: 'snake',
    };

    expect(() => validateTemplate(template)).not.toThrow();
  });

  it('should throw error for missing required fields', () => {
    const invalidTemplates = [
      { name: 'Test', basePath: '~/test', namingStructure: '{file_title}' },
      { id: 'test', basePath: '~/test', namingStructure: '{file_title}' },
      { id: 'test', name: 'Test', namingStructure: '{file_title}' },
      { id: 'test', name: 'Test', basePath: '~/test' },
    ];

    invalidTemplates.forEach((template, index) => {
      const missingField = ['id', 'name', 'basePath', 'namingStructure'][index];
      expect(() => validateTemplate(template)).toThrow(ValidationError);
      expect(() => validateTemplate(template)).toThrow(`Template field '${missingField}' is required`);
    });
  });

  it('should throw error for naming structure without placeholders', () => {
    const template = {
      id: 'test',
      name: 'Test',
      basePath: '~/test',
      namingStructure: 'fixed-name-without-placeholders',
    };

    expect(() => validateTemplate(template)).toThrow(ValidationError);
    expect(() => validateTemplate(template)).toThrow('Naming structure must include at least one placeholder');
  });

  it('should throw error for invalid file name case', () => {
    const template = {
      id: 'test',
      name: 'Test',
      basePath: '~/test',
      namingStructure: '{file_title}',
      fileNameCase: 'invalid_case',
    };

    expect(() => validateTemplate(template)).toThrow(ValidationError);
    expect(() => validateTemplate(template)).toThrow('Invalid file name case: invalid_case');
  });

  it('should accept valid file name cases', () => {
    const validCases = ['snake', 'kebab', 'camel', 'pascal', 'upper_snake', 'lower_snake'];

    validCases.forEach((fileCase) => {
      const template = {
        id: 'test',
        name: 'Test',
        basePath: '~/test',
        namingStructure: '{file_title}',
        fileNameCase: fileCase,
      };

      expect(() => validateTemplate(template)).not.toThrow();
    });
  });

  it('should accept template without fileNameCase', () => {
    const template = {
      id: 'test',
      name: 'Test',
      basePath: '~/test',
      namingStructure: '{file_title}',
    };

    expect(() => validateTemplate(template)).not.toThrow();
  });
});

describe('withErrorHandler', () => {
  let exitSpy: vi.SpyInstance;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('should execute function successfully', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const wrappedFn = withErrorHandler(mockFn);

    await wrappedFn('arg1', 'arg2');

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should handle errors and exit process', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
    const wrappedFn = withErrorHandler(mockFn);

    await wrappedFn();

    expect(mockFn).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
  });

  it('should handle AIFilesError with proper formatting', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new ConfigurationError('Config test error');
    const mockFn = vi.fn().mockRejectedValue(error);
    const wrappedFn = withErrorHandler(mockFn);

    await wrappedFn();

    expect(consoleSpy).toHaveBeenCalledWith('\n✗ ConfigurationError: Config test error');
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
  });
});
