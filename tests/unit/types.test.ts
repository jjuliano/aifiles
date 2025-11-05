import { describe, it, expect } from 'vitest';
import type {
  AIFilesConfig,
  FileAnalysis,
  FileOrganizationResult,
  FileNameCase,
  TemplateConfig,
  FileDetectedEvent,
  ProviderCapabilities,
  AIFilesErrorCode,
  ErrorDetails,
} from '../../src/types.js';

// Type guard functions for runtime type checking
function isValidFileNameCase(value: string): value is FileNameCase {
  return ['snake', 'kebab', 'camel', 'pascal', 'upper_snake', 'lower_snake'].includes(value);
}

function isValidAIFilesErrorCode(value: string): value is AIFilesErrorCode {
  return ['CONFIG_ERROR', 'PROVIDER_ERROR', 'FILE_ERROR', 'VALIDATION_ERROR', 'NETWORK_ERROR', 'UNKNOWN_ERROR'].includes(value);
}

function isValidLLMProvider(value: string): value is NonNullable<AIFilesConfig['LLM_PROVIDER']> {
  return ['openai', 'grok', 'deepseek', 'ollama', 'lmstudio'].includes(value);
}

describe('Type Definitions', () => {
  describe('AIFilesConfig', () => {
    it('should accept valid LLM provider values', () => {
      const validProviders: NonNullable<AIFilesConfig['LLM_PROVIDER']>[] = [
        'openai',
        'grok',
        'deepseek',
        'ollama',
        'lmstudio',
      ];

      validProviders.forEach((provider) => {
        expect(isValidLLMProvider(provider)).toBe(true);
      });
    });

    it('should validate configuration structure', () => {
      const config: AIFilesConfig = {
        LLM_PROVIDER: 'openai',
        LLM_MODEL: 'gpt-4',
        OPENAI_API_KEY: 'sk-test',
        BASE_DIRECTORY: '~/Documents',
        PROMPT_FILE: '~/.aifiles.json',
        MOVE_FILE_OPERATION: true,
        MAX_CONTENT_WORDS: 1000,
        PROMPT_FOR_REVISION_NUMBER: false,
      };

      expect(config.LLM_PROVIDER).toBe('openai');
      expect(config.LLM_MODEL).toBe('gpt-4');
      expect(config.MOVE_FILE_OPERATION).toBe(true);
    });

    it('should allow optional fields to be undefined', () => {
      const minimalConfig: AIFilesConfig = {
        BASE_DIRECTORY: '~/Documents',
        PROMPT_FILE: '~/.aifiles.json',
      };

      expect(minimalConfig.LLM_PROVIDER).toBeUndefined();
      expect(minimalConfig.MOVE_FILE_OPERATION).toBeUndefined();
    });
  });

  describe('FileNameCase', () => {
    it('should validate all valid file name cases', () => {
      const validCases: FileNameCase[] = [
        'snake',
        'kebab',
        'camel',
        'pascal',
        'upper_snake',
        'lower_snake',
      ];

      validCases.forEach((fileCase) => {
        expect(isValidFileNameCase(fileCase)).toBe(true);
      });
    });

    it('should reject invalid file name cases', () => {
      const invalidCases = ['invalid', 'UPPER', 'Title Case', ''];

      invalidCases.forEach((fileCase) => {
        expect(isValidFileNameCase(fileCase)).toBe(false);
      });
    });
  });

  describe('AIFilesErrorCode', () => {
    it('should validate all valid error codes', () => {
      const validCodes: AIFilesErrorCode[] = [
        'CONFIG_ERROR',
        'PROVIDER_ERROR',
        'FILE_ERROR',
        'VALIDATION_ERROR',
        'NETWORK_ERROR',
        'UNKNOWN_ERROR',
      ];

      validCodes.forEach((code) => {
        expect(isValidAIFilesErrorCode(code)).toBe(true);
      });
    });

    it('should reject invalid error codes', () => {
      const invalidCodes = ['invalid_code', 'ERROR', ''];

      invalidCodes.forEach((code) => {
        expect(isValidAIFilesErrorCode(code)).toBe(false);
      });
    });
  });

  describe('FileAnalysis', () => {
    it('should create valid FileAnalysis object', () => {
      const analysis: FileAnalysis = {
        category: 'Documents',
        title: 'My Document',
        tags: ['work', 'important'],
        summary: 'This is a summary of the document',
        metadata: {
          author: 'John Doe',
          created: '2023-01-01',
          pages: 10,
        },
      };

      expect(analysis.category).toBe('Documents');
      expect(analysis.tags).toHaveLength(2);
      expect(analysis.metadata.author).toBe('John Doe');
    });
  });

  describe('FileOrganizationResult', () => {
    it('should create valid FileOrganizationResult object', () => {
      const result: FileOrganizationResult = {
        originalPath: '/old/path/file.pdf',
        newPath: '/new/organized/path/file.pdf',
        tags: ['tag1', 'tag2'],
        summary: 'File organized successfully',
        moved: true,
      };

      expect(result.originalPath).toBe('/old/path/file.pdf');
      expect(result.newPath).toBe('/new/organized/path/file.pdf');
      expect(result.moved).toBe(true);
      expect(result.tags).toHaveLength(2);
    });
  });

  describe('TemplateConfig', () => {
    it('should create valid TemplateConfig object', () => {
      const template: TemplateConfig = {
        id: 'work-docs',
        name: 'Work Documents',
        description: 'Templates for work-related documents',
        basePath: '~/Documents/Work',
        namingStructure: '{file_category_1}/{file_title}',
        fileNameCase: 'snake',
        autoOrganize: true,
        watchForChanges: true,
      };

      expect(template.id).toBe('work-docs');
      expect(template.name).toBe('Work Documents');
      expect(template.autoOrganize).toBe(true);
      expect(template.watchForChanges).toBe(true);
      expect(isValidFileNameCase(template.fileNameCase!)).toBe(true);
    });

    it('should allow optional fields in TemplateConfig', () => {
      const minimalTemplate: TemplateConfig = {
        id: 'minimal',
        name: 'Minimal Template',
        description: 'A minimal template',
        basePath: '~/minimal',
        namingStructure: '{file_title}',
      };

      expect(minimalTemplate.fileNameCase).toBeUndefined();
      expect(minimalTemplate.autoOrganize).toBeUndefined();
      expect(minimalTemplate.watchForChanges).toBeUndefined();
    });
  });

  describe('FileDetectedEvent', () => {
    it('should create valid FileDetectedEvent object', () => {
      const event: FileDetectedEvent = {
        filePath: '/path/to/detected/file.pdf',
        fileName: 'file.pdf',
        template: {
          id: 'test-template',
          name: 'Test Template',
          description: 'For testing',
          basePath: '~/test',
          namingStructure: '{file_title}',
        },
        timestamp: new Date('2023-01-01T12:00:00Z'),
      };

      expect(event.filePath).toBe('/path/to/detected/file.pdf');
      expect(event.fileName).toBe('file.pdf');
      expect(event.template.id).toBe('test-template');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('ProviderCapabilities', () => {
    it('should create valid ProviderCapabilities object', () => {
      const capabilities: ProviderCapabilities = {
        supportsVision: true,
        supportsStreaming: false,
        maxTokens: 4000,
        requiresApiKey: true,
      };

      expect(capabilities.supportsVision).toBe(true);
      expect(capabilities.supportsStreaming).toBe(false);
      expect(capabilities.maxTokens).toBe(4000);
      expect(capabilities.requiresApiKey).toBe(true);
    });

    it('should handle different capability combinations', () => {
      const localCapabilities: ProviderCapabilities = {
        supportsVision: false,
        supportsStreaming: true,
        maxTokens: 32768,
        requiresApiKey: false,
      };

      expect(localCapabilities.supportsVision).toBe(false);
      expect(localCapabilities.requiresApiKey).toBe(false);
    });
  });

  describe('ErrorDetails', () => {
    it('should create valid ErrorDetails object', () => {
      const errorDetails: ErrorDetails = {
        code: 'CONFIG_ERROR',
        message: 'Configuration validation failed',
        details: {
          field: 'API_KEY',
          expected: 'valid key',
        },
        stack: 'Error stack trace here',
      };

      expect(errorDetails.code).toBe('CONFIG_ERROR');
      expect(errorDetails.message).toBe('Configuration validation failed');
      expect(errorDetails.details.field).toBe('API_KEY');
      expect(errorDetails.stack).toBe('Error stack trace here');
      expect(isValidAIFilesErrorCode(errorDetails.code)).toBe(true);
    });

    it('should allow optional stack in ErrorDetails', () => {
      const minimalError: ErrorDetails = {
        code: 'FILE_ERROR',
        message: 'File not found',
      };

      expect(minimalError.code).toBe('FILE_ERROR');
      expect(minimalError.stack).toBeUndefined();
      expect(minimalError.details).toBeUndefined();
    });
  });

  describe('Type Integration', () => {
    it('should ensure TemplateConfig and FolderTemplate are compatible', () => {
      // These should be the same type (re-exported)
      const template: TemplateConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test template',
        basePath: '~/test',
        namingStructure: '{file_title}',
        fileNameCase: 'snake',
        autoOrganize: true,
        watchForChanges: true,
      };

      // This assignment should work without type errors
      const folderTemplate: import('../../src/types.js').FolderTemplate = template;

      expect(folderTemplate.id).toBe(template.id);
      expect(folderTemplate.autoOrganize).toBe(template.autoOrganize);
    });

    it('should validate LLMConfig structure', () => {
      const config: import('../../src/types.js').LLMConfig = {
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4',
        baseUrl: 'https://api.openai.com/v1',
      };

      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('sk-test');
      expect(config.model).toBe('gpt-4');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
    });

    it('should validate LLMProvider interface', () => {
      const mockProvider: import('../../src/types.js').LLMProvider = {
        name: 'TestProvider',
        sendMessage: async (prompt: string) => `Response to: ${prompt}`,
        isAvailable: async () => true,
        analyzeImage: async (path: string, prompt: string) => `Analysis of ${path}: ${prompt}`,
      };

      expect(mockProvider.name).toBe('TestProvider');
      expect(typeof mockProvider.sendMessage).toBe('function');
      expect(typeof mockProvider.isAvailable).toBe('function');
      expect(typeof mockProvider.analyzeImage).toBe('function');
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify valid LLM providers', () => {
      expect(isValidLLMProvider('openai')).toBe(true);
      expect(isValidLLMProvider('grok')).toBe(true);
      expect(isValidLLMProvider('deepseek')).toBe(true);
      expect(isValidLLMProvider('ollama')).toBe(true);
      expect(isValidLLMProvider('lmstudio')).toBe(true);
      expect(isValidLLMProvider('invalid')).toBe(false);
    });

    it('should correctly identify valid error codes', () => {
      expect(isValidAIFilesErrorCode('CONFIG_ERROR')).toBe(true);
      expect(isValidAIFilesErrorCode('PROVIDER_ERROR')).toBe(true);
      expect(isValidAIFilesErrorCode('FILE_ERROR')).toBe(true);
      expect(isValidAIFilesErrorCode('VALIDATION_ERROR')).toBe(true);
      expect(isValidAIFilesErrorCode('NETWORK_ERROR')).toBe(true);
      expect(isValidAIFilesErrorCode('UNKNOWN_ERROR')).toBe(true);
      expect(isValidAIFilesErrorCode('INVALID_CODE')).toBe(false);
    });
  });
});
