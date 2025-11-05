import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileWatcher } from '../../src/file-watcher.js';
import { FolderTemplateManager } from '../../src/folder-templates.js';
import { FileDatabase } from '../../src/database.js';
import { generatePromptResponse, resolvePath, fileExists, addTagsToFile, addCommentsToFile, getConfig } from '../../src/utils.js';
import fs from 'fs/promises';
import path from 'path';

// Mock all dependencies
vi.mock('../../src/file-watcher.js');
vi.mock('../../src/folder-templates.js');
vi.mock('../../src/database.js');
vi.mock('../../src/utils.js');
vi.mock('fs/promises');
vi.mock('path');
vi.mock('kolorist', () => ({
  lightCyan: (str: string) => str,
  green: (str: string) => str,
  red: (str: string) => str,
  yellow: (str: string) => str
}));

const mockedFileWatcher = vi.mocked(FileWatcher);
const mockedFolderTemplateManager = vi.mocked(FolderTemplateManager);
const mockedFileDatabase = vi.mocked(FileDatabase);
const mockedUtils = vi.mocked(await import('../../src/utils.js'));
const mockedFs = vi.mocked(fs);
const mockedPath = vi.mocked(path);

describe('CLI Watch Daemon', () => {
  let mockTemplateManager: any;
  let mockFileWatcher: any;
  let mockDatabase: any;
  let startWatchDaemon: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    // Mock template manager
    mockTemplateManager = {
      loadTemplates: vi.fn()
    };
    mockedFolderTemplateManager.mockImplementation(() => mockTemplateManager);

    // Mock file watcher
    mockFileWatcher = {
      watchTemplate: vi.fn(),
      on: vi.fn(),
      stopAll: vi.fn()
    };
    mockedFileWatcher.mockImplementation(() => mockFileWatcher);

    // Mock database
    mockDatabase = {
      recordFileOrganization: vi.fn().mockReturnValue('file_123'),
      close: vi.fn()
    };
    mockedFileDatabase.mockImplementation(() => mockDatabase);

    // Mock utils
    mockedUtils.getConfig.mockResolvedValue({
      LLM_PROVIDER: 'ollama',
      LLM_MODEL: 'llama3.2',
      ADD_FILE_TAGS: true,
      ADD_FILE_COMMENTS: true
    });
    mockedUtils.generatePromptResponse.mockResolvedValue('{"title":"Test File","category":"Documents","tags":["test"],"summary":"A test file"}');
    mockedUtils.resolvePath.mockImplementation((p: string) => p);
    mockedUtils.fileExists.mockResolvedValue(true);
    mockedUtils.addTagsToFile.mockResolvedValue(undefined);
    mockedUtils.addCommentsToFile.mockResolvedValue(undefined);

    // Mock fs and path
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.rename.mockResolvedValue(undefined);
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    mockedPath.basename.mockImplementation((p: string) => p.split('/').pop() || '');

    // Import the function directly since it's now exported
    const { startWatchDaemon: importedStartWatchDaemon } = await import('../../src/cli.js');
    startWatchDaemon = importedStartWatchDaemon;
  });

  describe('startWatchDaemon', () => {
    it('should exit when no templates have watching enabled', async () => {

      mockTemplateManager.loadTemplates.mockResolvedValue([
        { id: '1', name: 'Documents', watchForChanges: false, autoOrganize: false, basePath: '/docs', namingStructure: '{file_title}' },
        { id: '2', name: 'Pictures', watchForChanges: false, autoOrganize: false, basePath: '/pics', namingStructure: '{file_title}' }
      ]);

      // Mock process.exit to throw so we can catch it
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code: number) => {
        throw new Error(`Exit with code ${code}`);
      });

      await expect(startWatchDaemon()).rejects.toThrow('Exit with code 1');

      expect(mockTemplateManager.loadTemplates).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No templates have watching enabled'));
    });

    it('should start watching when templates are enabled', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const enabledTemplates = [
        {
          id: '1',
          name: 'Documents',
          watchForChanges: true,
          autoOrganize: true,
          basePath: '/docs',
          namingStructure: '{file_category_1}/{file_title}'
        }
      ];

      mockTemplateManager.loadTemplates.mockResolvedValue(enabledTemplates);

      // Mock setTimeout to resolve the promise immediately for testing
      vi.useFakeTimers();
      const promise = startWatchDaemon();

      // Fast-forward timers
      vi.runAllTimers();

      // The promise should still be pending (daemon keeps running)
      expect(promise).toBeInstanceOf(Promise);

      expect(mockFileWatcher.watchTemplate).toHaveBeenCalledWith(enabledTemplates[0]);
      expect(mockFileWatcher.on).toHaveBeenCalledWith('fileAdded', expect.any(Function));
      expect(mockFileWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));

      vi.useRealTimers();
    });

    it('should handle file addition events', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const template = {
        id: '1',
        name: 'Documents',
        watchForChanges: true,
        autoOrganize: true,
        basePath: '/docs',
        namingStructure: '{file_category_1}/{file_title}'
      };

      mockTemplateManager.loadTemplates.mockResolvedValue([template]);

      // Start the daemon
      vi.useFakeTimers();
      startWatchDaemon();

      // Get the fileAdded handler
      const fileAddedCall = mockFileWatcher.on.mock.calls.find(call => call[0] === 'fileAdded');
      const fileAddedHandler = fileAddedCall[1];

      // Simulate file addition
      const event = {
        filePath: '/incoming/newfile.pdf',
        template,
        fileName: 'newfile.pdf'
      };

      await fileAddedHandler(event);

      expect(mockedUtils.generatePromptResponse).toHaveBeenCalled();
      expect(mockedFs.mkdir).toHaveBeenCalled();
      expect(mockedFs.rename).toHaveBeenCalledWith('/incoming/newfile.pdf', '/docs/Documents/Test File/newfile.pdf');
      expect(mockDatabase.recordFileOrganization).toHaveBeenCalled();
      expect(mockedUtils.addTagsToFile).toHaveBeenCalled();
      expect(mockedUtils.addCommentsToFile).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle auto-organize disabled templates', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const template = {
        id: '1',
        name: 'Documents',
        watchForChanges: true,
        autoOrganize: false, // Disabled
        basePath: '/docs',
        namingStructure: '{file_title}'
      };

      mockTemplateManager.loadTemplates.mockResolvedValue([template]);

      vi.useFakeTimers();
      startWatchDaemon();

      const fileAddedCall = mockFileWatcher.on.mock.calls.find(call => call[0] === 'fileAdded');
      const fileAddedHandler = fileAddedCall[1];

      const event = {
        filePath: '/incoming/newfile.pdf',
        template,
        fileName: 'newfile.pdf'
      };

      await fileAddedHandler(event);

      // Should not process the file when auto-organize is disabled
      expect(mockedUtils.generatePromptResponse).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Manual review required'));

      vi.useRealTimers();
    });

    it('should handle file processing errors gracefully', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const template = {
        id: '1',
        name: 'Documents',
        watchForChanges: true,
        autoOrganize: true,
        basePath: '/docs',
        namingStructure: '{file_category_1}/{file_title}'
      };

      mockTemplateManager.loadTemplates.mockResolvedValue([template]);

      // Mock fileExists to return false (file no longer exists)
      mockedUtils.fileExists.mockResolvedValue(false);

      vi.useFakeTimers();
      startWatchDaemon();

      const fileAddedCall = mockFileWatcher.on.mock.calls.find(call => call[0] === 'fileAdded');
      const fileAddedHandler = fileAddedCall[1];

      const event = {
        filePath: '/incoming/newfile.pdf',
        template,
        fileName: 'newfile.pdf'
      };

      await fileAddedHandler(event);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('File no longer exists'));
      expect(mockedUtils.generatePromptResponse).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle AI analysis errors gracefully', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const template = {
        id: '1',
        name: 'Documents',
        watchForChanges: true,
        autoOrganize: true,
        basePath: '/docs',
        namingStructure: '{file_category_1}/{file_title}'
      };

      mockTemplateManager.loadTemplates.mockResolvedValue([template]);

      // Mock generatePromptResponse to throw an error
      mockedUtils.generatePromptResponse.mockRejectedValue(new Error('AI service unavailable'));

      vi.useFakeTimers();
      startWatchDaemon();

      const fileAddedCall = mockFileWatcher.on.mock.calls.find(call => call[0] === 'fileAdded');
      const fileAddedHandler = fileAddedCall[1];

      const event = {
        filePath: '/incoming/newfile.pdf',
        template,
        fileName: 'newfile.pdf'
      };

      await fileAddedHandler(event);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Auto-organization failed'));
      expect(mockDatabase.recordFileOrganization).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle watcher errors', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const template = {
        id: '1',
        name: 'Documents',
        watchForChanges: true,
        autoOrganize: true,
        basePath: '/docs',
        namingStructure: '{file_title}'
      };

      mockTemplateManager.loadTemplates.mockResolvedValue([template]);

      vi.useFakeTimers();
      startWatchDaemon();

      const errorCall = mockFileWatcher.on.mock.calls.find(call => call[0] === 'error');
      const errorHandler = errorCall[1];

      const errorEvent = {
        template,
        error: new Error('Watcher filesystem error')
      };

      errorHandler(errorEvent);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Watcher error for Documents'));

      vi.useRealTimers();
    });

    it('should handle graceful shutdown on SIGINT', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const template = {
        id: '1',
        name: 'Documents',
        watchForChanges: true,
        autoOrganize: false,
        basePath: '/docs',
        namingStructure: '{file_title}'
      };

      mockTemplateManager.loadTemplates.mockResolvedValue([template]);

      vi.useFakeTimers();
      const daemonPromise = startWatchDaemon();

      // Simulate SIGINT
      process.emit('SIGINT');

      // Fast-forward to allow async operations
      await vi.runAllTimersAsync();

      expect(mockFileWatcher.stopAll).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Shutting down file watchers'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('All watchers stopped'));

      vi.useRealTimers();
    });

    it('should handle graceful shutdown on SIGTERM', async () => {
      const { startWatchDaemon } = await import('../../src/cli.js');

      const template = {
        id: '1',
        name: 'Documents',
        watchForChanges: true,
        autoOrganize: false,
        basePath: '/docs',
        namingStructure: '{file_title}'
      };

      mockTemplateManager.loadTemplates.mockResolvedValue([template]);

      vi.useFakeTimers();
      startWatchDaemon();

      // Simulate SIGTERM
      process.emit('SIGTERM');

      vi.runAllTimers();

      expect(mockFileWatcher.stopAll).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Received termination signal'));

      vi.useRealTimers();
    });
  });
});
