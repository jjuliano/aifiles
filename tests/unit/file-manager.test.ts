import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileManager } from '../../src/file-manager.js';
import { FileDatabase } from '../../src/database.js';
import { ProviderFactory } from '../../src/providers/provider-factory.js';
import { generatePromptResponse, getConfig } from '../../src/utils.js';

// Mock dependencies
vi.mock('blessed');
vi.mock('../../src/database.js');
vi.mock('../../src/providers/provider-factory.js');
vi.mock('../../src/utils.js');
vi.mock('@clack/prompts');

const mockedBlessed = vi.mocked(await import('blessed'));
const mockedFileDatabase = vi.mocked(FileDatabase);
const mockedProviderFactory = vi.mocked(ProviderFactory);
const mockedUtils = vi.mocked(await import('../../src/utils.js'));
const mockedPrompts = vi.mocked(await import('@clack/prompts'));

// Mock blessed components
const mockScreen = {
  key: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
};

const mockList = {
  setItems: vi.fn(),
  setLabel: vi.fn(),
  select: vi.fn(),
  focus: vi.fn(),
  on: vi.fn(),
};

const mockBox = {
  setContent: vi.fn(),
  setLabel: vi.fn(),
  append: vi.fn(),
};

const mockTextbox = {
  focus: vi.fn(),
  readInput: vi.fn(),
  clearValue: vi.fn(),
  value: '',
};

mockedBlessed.screen.mockReturnValue(mockScreen);
mockedBlessed.list.mockReturnValue(mockList);
mockedBlessed.box.mockReturnValue(mockBox);
mockedBlessed.textbox.mockReturnValue(mockTextbox);

describe('FileManager', () => {
  let fileManager: FileManager;
  let mockDb: any;
  let mockProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock process.stdout/stdin for TTY detection
    Object.defineProperty(process, 'stdout', {
      value: { isTTY: true },
      writable: true
    });
    Object.defineProperty(process, 'stdin', {
      value: { isTTY: true },
      writable: true
    });

    // Mock database
    mockDb = {
      getFiles: vi.fn().mockReturnValue([]),
      getStats: vi.fn().mockReturnValue({
        totalFiles: 0,
        totalVersions: 0,
        recentFiles: 0,
        templatesUsed: []
      }),
      getFileById: vi.fn(),
      getFileVersions: vi.fn().mockReturnValue([]),
      updateFileOrganization: vi.fn(),
      deleteFile: vi.fn(),
      searchFiles: vi.fn().mockReturnValue([]),
      close: vi.fn()
    };

    mockedFileDatabase.mockImplementation(() => mockDb);

    // Mock provider
    mockProvider = {
      sendMessage: vi.fn().mockResolvedValue('{"title":"New Title","category":"Updated","tags":["new"],"summary":"Updated summary"}')
    };

    mockedProviderFactory.createProvider.mockReturnValue(mockProvider);

    // Mock utils
    mockedUtils.getConfig.mockResolvedValue({
      LLM_PROVIDER: 'ollama',
      LLM_MODEL: 'llama3.2'
    });
    mockedUtils.generatePromptResponse.mockResolvedValue('{"title":"New Title","category":"Updated","tags":["new"],"summary":"Updated summary"}');

    // Mock prompts
    mockedPrompts.intro.mockImplementation(() => {});
    mockedPrompts.outro.mockImplementation(() => {});
    mockedPrompts.select.mockResolvedValue('exit');
    mockedPrompts.text.mockResolvedValue('');

    fileManager = new FileManager();
  });

  describe('initialization', () => {
    it('should initialize with database connection', () => {
      expect(mockedFileDatabase).toHaveBeenCalled();
      expect(fileManager).toBeDefined();
    });

    it('should detect TTY environment', () => {
      // Test with TTY
      expect((fileManager as any).isInteractive).toBe(true);
    });

    it('should detect non-TTY environment', () => {
      Object.defineProperty(process, 'stdout', {
        value: { isTTY: false },
        writable: true
      });

      const nonInteractiveManager = new FileManager();
      expect((nonInteractiveManager as any).isInteractive).toBe(false);
    });
  });

  describe('showFileList', () => {
    it('should show stats when no files exist', async () => {
      mockDb.getStats.mockReturnValue({
        totalFiles: 0,
        totalVersions: 0,
        recentFiles: 0,
        templatesUsed: []
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await fileManager.showFileList();

      expect(mockedPrompts.select).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled(); // Should not exit, should continue to menu
    });

    it('should display file list when files exist', async () => {
      const mockFiles = [
        {
          id: 'file_1',
          originalPath: '/original/path/file.txt',
          currentPath: '/path/to/file.txt',
          originalName: 'file.txt',
          currentName: 'file.txt',
          templateId: 'template-1',
          templateName: 'Documents',
          category: 'Work',
          title: 'Test Document',
          tags: ['important'],
          summary: 'A test document',
          aiProvider: 'ollama',
          aiModel: 'llama3.2',
          aiPrompt: 'Analyze this file',
          aiResponse: '{"title":"Test Document"}',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        }
      ];

      mockDb.getFiles.mockReturnValue(mockFiles);
      mockDb.getStats.mockReturnValue({
        totalFiles: 1,
        totalVersions: 1,
        recentFiles: 1,
        templatesUsed: ['Documents']
      });

      mockedPrompts.select.mockResolvedValue('exit');

      await fileManager.showFileList();

      expect(mockDb.getFiles).toHaveBeenCalledWith(20);
      expect(mockDb.getStats).toHaveBeenCalled();
    });

    it('should handle different menu actions', async () => {
      const mockFiles = [
        {
          id: 'file_1',
          title: 'Test Document',
          currentPath: '/path/to/file.txt',
          category: 'Work',
          tags: ['important'],
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        }
      ];

      mockDb.getFiles.mockReturnValue(mockFiles);

      // Test view action
      mockedPrompts.select
        .mockResolvedValueOnce('view') // First call - main menu
        .mockResolvedValueOnce('file_1') // Second call - file selection
        .mockResolvedValueOnce('exit'); // Third call - exit

      mockDb.getFileById.mockReturnValue(mockFiles[0]);
      mockDb.getFileVersions.mockReturnValue([
        {
          id: 'version_1',
          fileId: 'file_1',
          version: 1,
          path: '/path/to/file.txt',
          name: 'file.txt',
          category: 'Work',
          title: 'Test Document',
          tags: '["important"]',
          summary: 'A test document',
          aiPrompt: 'Analyze this file',
          aiResponse: '{"title":"Test Document"}',
          createdAt: new Date()
        }
      ]);

      await fileManager.showFileList();

      expect(mockDb.getFileById).toHaveBeenCalledWith('file_1');
      expect(mockedPrompts.text).toHaveBeenCalled(); // Press Enter to continue
    });

    it('should handle search functionality', async () => {
      mockDb.getFiles.mockReturnValue([]);
      mockedPrompts.select.mockResolvedValueOnce('search');
      mockedPrompts.text.mockResolvedValueOnce('test query');
      mockedPrompts.select.mockResolvedValueOnce('exit');

      mockDb.searchFiles.mockReturnValue([]);

      await fileManager.showFileList();

      expect(mockDb.searchFiles).toHaveBeenCalledWith('test query');
    });
  });

  describe('showNonInteractiveView', () => {
    it('should display non-interactive view', async () => {
      Object.defineProperty(process, 'stdout', {
        value: { isTTY: false },
        writable: true
      });

      const nonInteractiveManager = new FileManager();
      const mockFiles = [
        {
          id: 'file_1',
          originalPath: '/original/path/file.txt',
          currentPath: '/path/to/file.txt',
          originalName: 'file.txt',
          currentName: 'file.txt',
          templateId: 'template-1',
          templateName: 'Documents',
          category: 'Work',
          title: 'Test Document',
          tags: ['important'],
          summary: 'A test document',
          aiProvider: 'ollama',
          aiModel: 'llama3.2',
          aiPrompt: 'Analyze this file',
          aiResponse: '{"title":"Test Document"}',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        }
      ];

      mockDb.getFiles.mockReturnValue(mockFiles);

      await nonInteractiveManager.showFileList();

      expect(mockDb.getFiles).toHaveBeenCalled();
      expect(mockDb.getStats).toHaveBeenCalled();
    });
  });

  describe('editFile', () => {
    it('should update file organization', async () => {
      const mockFile = {
        id: 'file_1',
        originalPath: '/original/path/file.txt',
        currentPath: '/current/path/file.txt',
        originalName: 'file.txt',
        currentName: 'file.txt',
        templateId: 'template-1',
        templateName: 'Documents',
        category: 'Old Category',
        title: 'Old Title',
        tags: ['old'],
        summary: 'Old summary',
        aiProvider: 'ollama',
        aiModel: 'llama3.2',
        aiPrompt: 'old prompt',
        aiResponse: 'old response',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockDb.getFileById.mockReturnValue(mockFile);

      mockedPrompts.select.mockResolvedValue('file_1');
      mockedPrompts.text
        .mockResolvedValueOnce('New Title')
        .mockResolvedValueOnce('New Category')
        .mockResolvedValueOnce('New Summary');

      mockedPrompts.confirm.mockResolvedValue(true);

      await (fileManager as any).editFile();

      expect(mockDb.updateFileOrganization).toHaveBeenCalledWith('file_1', {
        title: 'New Title',
        category: 'New Category',
        summary: 'New Summary'
      });
    });

    it('should cancel edit when user provides empty input', async () => {
      const mockFile = {
        id: 'file_1',
        title: 'Old Title',
        category: 'Old Category',
        summary: 'Old summary'
      };

      mockDb.getFileById.mockReturnValue(mockFile);

      mockedPrompts.select.mockResolvedValue('file_1');
      mockedPrompts.text.mockResolvedValue('');

      await (fileManager as any).editFile();

      expect(mockDb.updateFileOrganization).not.toHaveBeenCalled();
    });
  });

  describe('revertFile', () => {
    it.skip('should revert file to previous version', async () => {
      const mockFile = {
        id: 'file_1',
        originalPath: '/original/path/file.txt',
        currentPath: '/current/path',
        originalName: 'file.txt',
        currentName: 'file.txt',
        templateId: 'template-1',
        templateName: 'Documents',
        category: 'Current',
        title: 'Current Title',
        tags: ['current'],
        summary: 'Current summary',
        aiProvider: 'ollama',
        aiModel: 'llama3.2',
        aiPrompt: 'current prompt',
        aiResponse: 'current response',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 2
      };

      const mockVersions = [
        {
          version: 2,
          title: 'Current Title',
          category: 'Current',
          tags: '["current"]',
          summary: 'Current summary',
          aiPrompt: 'current prompt',
          aiResponse: 'current response'
        },
        {
          version: 1,
          title: 'Previous Title',
          category: 'Previous',
          tags: '["previous"]',
          summary: 'Previous summary',
          aiPrompt: 'previous prompt',
          aiResponse: 'previous response'
        }
      ];

      mockDb.getFiles.mockReturnValue([mockFile]); // Return files with version > 1
      mockDb.getFileById.mockReturnValue(mockFile);
      mockDb.getFileVersions.mockReturnValue(mockVersions);

      mockedPrompts.select
        .mockResolvedValueOnce('file_1') // Select file
        .mockResolvedValueOnce(1); // Select version to revert to

      mockedPrompts.confirm.mockResolvedValue(true);

      await (fileManager as any).revertFile();

      expect(mockDb.updateFileOrganization).toHaveBeenCalledWith('file_1', {
        title: 'Previous Title',
        category: 'Previous',
        tags: ['previous'],
        summary: 'Previous summary',
        aiPrompt: 'previous prompt',
        aiResponse: 'previous response'
      });
    });

    it('should show error when no previous versions exist', async () => {
      const mockFile = {
        id: 'file_1',
        version: 1
      };

      mockDb.getFileById.mockReturnValue(mockFile);
      mockDb.getFileVersions.mockReturnValue([]);

      mockedPrompts.select.mockResolvedValue('file_1');

      await (fileManager as any).revertFile();

      expect(mockDb.updateFileOrganization).not.toHaveBeenCalled();
    });
  });

  describe('reanalyzeFile', () => {
    it('should reanalyze file with custom prompt', async () => {
      const mockFile = {
        id: 'file_1',
        originalPath: '/original/path/file.txt',
        currentPath: '/current/path/file.txt',
        originalName: 'file.txt',
        currentName: 'file.txt',
        templateId: 'template-1',
        templateName: 'Documents',
        category: 'Old Category',
        title: 'Old Title',
        tags: ['old'],
        summary: 'Old summary',
        aiProvider: 'ollama',
        aiModel: 'llama3.2',
        aiPrompt: 'old prompt',
        aiResponse: 'old response',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockDb.getFileById.mockReturnValue(mockFile);

    mockedPrompts.select.mockResolvedValue('file_1');
    mockedPrompts.text
      .mockResolvedValueOnce('Custom analysis prompt')
      .mockResolvedValueOnce(''); // Press Enter to continue

    mockedPrompts.confirm.mockResolvedValue(true);

    await (fileManager as any).reanalyzeFile();

    expect(mockedUtils.generatePromptResponse).toHaveBeenCalledWith(
      expect.any(Object),
      'Custom analysis prompt'
    );
      expect(mockDb.updateFileOrganization).toHaveBeenCalledWith('file_1', {
        title: 'New Title',
        category: 'Updated',
        tags: ['new'],
        summary: 'Updated summary',
        aiPrompt: 'Custom analysis prompt',
        aiResponse: '{"title":"New Title","category":"Updated","tags":["new"],"summary":"Updated summary"}'
      });
    });

    it('should use default prompt when custom prompt is empty', async () => {
      const mockFile = {
        id: 'file_1',
        originalPath: '/original/path/file.txt',
        currentPath: '/current/path/file.txt',
        originalName: 'file.txt',
        currentName: 'file.txt',
        templateId: 'template-1',
        templateName: 'Documents',
        category: 'Old Category',
        title: 'Old Title',
        tags: ['old'],
        summary: 'Old summary',
        aiProvider: 'ollama',
        aiModel: 'llama3.2',
        aiPrompt: 'old prompt',
        aiResponse: 'old response',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockDb.getFileById.mockReturnValue(mockFile);

      mockedPrompts.select.mockResolvedValue('file_1');
      mockedPrompts.text
        .mockResolvedValueOnce('') // Empty custom prompt
        .mockResolvedValueOnce(''); // Press Enter to continue

      mockedPrompts.confirm.mockResolvedValue(true);

      await (fileManager as any).reanalyzeFile();

      expect(mockedUtils.generatePromptResponse).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Analyze this file and provide:')
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file record after confirmation', async () => {
      const mockFile = {
        id: 'file_1',
        originalPath: '/original/path/file.txt',
        currentPath: '/current/path/file.txt',
        originalName: 'file.txt',
        currentName: 'file.txt',
        templateId: 'template-1',
        templateName: 'Documents',
        category: 'Work',
        title: 'Test File',
        tags: ['test'],
        summary: 'A test file',
        aiProvider: 'ollama',
        aiModel: 'llama3.2',
        aiPrompt: 'test prompt',
        aiResponse: 'test response',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockDb.getFileById.mockReturnValue(mockFile);

      mockedPrompts.select.mockResolvedValue('file_1');
      mockedPrompts.confirm.mockResolvedValue(true);

      await (fileManager as any).deleteFile();

      expect(mockDb.deleteFile).toHaveBeenCalledWith('file_1');
    });

    it('should not delete file when user cancels', async () => {
      const mockFile = {
        id: 'file_1',
        originalPath: '/original/path/file.txt',
        currentPath: '/current/path/file.txt',
        originalName: 'file.txt',
        currentName: 'file.txt',
        templateId: 'template-1',
        templateName: 'Documents',
        category: 'Work',
        title: 'Test File',
        tags: ['test'],
        summary: 'A test file',
        aiProvider: 'ollama',
        aiModel: 'llama3.2',
        aiPrompt: 'test prompt',
        aiResponse: 'test response',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockDb.getFileById.mockReturnValue(mockFile);

      mockedPrompts.select.mockResolvedValue('file_1');
      mockedPrompts.confirm.mockResolvedValue(false);

      await (fileManager as any).deleteFile();

      expect(mockDb.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('showStats', () => {
    it('should display detailed statistics', async () => {
      const mockStats = {
        totalFiles: 100,
        totalVersions: 150,
        recentFiles: 10,
        templatesUsed: ['Documents', 'Pictures', 'Music']
      };

      const mockRecentFiles = [
        {
          title: 'Recent File 1',
          category: 'Documents',
          updatedAt: new Date()
        }
      ];

      mockDb.getStats.mockReturnValue(mockStats);
      mockDb.getFiles.mockReturnValue(mockRecentFiles);

      await (fileManager as any).showStats();

      expect(mockDb.getStats).toHaveBeenCalled();
      expect(mockDb.getFiles).toHaveBeenCalledWith(5);
      expect(mockedPrompts.text).toHaveBeenCalled(); // Press Enter to continue
    });
  });

  describe('getTimeAgo', () => {
    it('should format time differences correctly', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const justNow = new Date(now.getTime() - 1000);

      expect((fileManager as any).getTimeAgo(oneDayAgo)).toBe('1d ago');
      expect((fileManager as any).getTimeAgo(oneHourAgo)).toBe('1h ago');
      expect((fileManager as any).getTimeAgo(oneMinuteAgo)).toBe('1m ago');
      expect((fileManager as any).getTimeAgo(justNow)).toBe('Just now');
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      fileManager.close();

      expect(mockDb.close).toHaveBeenCalled();
    });
  });
});

