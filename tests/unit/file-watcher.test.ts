import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { FileWatcher, FileEvent } from '../../src/file-watcher.js';
import { FolderTemplate } from '../../src/folder-templates.js';

// Mock dependencies
vi.mock('chokidar');
vi.mock('fs/promises');
vi.mock('../../src/utils.js');

const mockedChokidar = vi.mocked(chokidar);
const mockedFs = vi.mocked(await import('fs/promises'));
const mockedUtils = vi.mocked(await import('../../src/utils.js'));

describe('FileWatcher', () => {
  let fileWatcher: FileWatcher;
  let mockWatcher: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock resolvePath to return the path as-is for testing
    mockedUtils.resolvePath.mockImplementation((path) => path);

    // Create a mock chokidar watcher
    mockWatcher = {
      on: vi.fn(),
      close: vi.fn(),
    };
    mockedChokidar.watch.mockReturnValue(mockWatcher);

    fileWatcher = new FileWatcher();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create a FileWatcher instance', () => {
      expect(fileWatcher).toBeInstanceOf(FileWatcher);
      expect(fileWatcher).toBeInstanceOf(EventEmitter);
    });

    it('should initialize with empty watchers map', () => {
      // Access private property for testing
      expect((fileWatcher as any).watchers.size).toBe(0);
    });
  });

  describe('watchTemplate', () => {
    const mockTemplate: FolderTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      basePath: '/test/path',
      namingStructure: '{file_title}',
      autoOrganize: true,
      watchForChanges: true,
    };

    it('should create a watcher for a template', async () => {
      mockedFs.access.mockResolvedValue(undefined); // Mock path access success

      await fileWatcher.watchTemplate(mockTemplate);

      expect(mockedUtils.resolvePath).toHaveBeenCalledWith('/test/path');
      expect(mockedChokidar.watch).toHaveBeenCalledWith('/test/path', {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        usePolling: true, // Added polling option
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100,
        },
      });
      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect((fileWatcher as any).watchers.get('test-template')).toBe(mockWatcher);
    });

    it('should not create duplicate watchers for the same template', async () => {
      mockedFs.access.mockResolvedValue(undefined); // Mock path access success

      await fileWatcher.watchTemplate(mockTemplate);
      await fileWatcher.watchTemplate(mockTemplate); // Try to watch again

      expect(mockedChokidar.watch).toHaveBeenCalledTimes(1);
      expect((fileWatcher as any).watchers.size).toBe(1);
    });

    it('should emit fileAdded event when file is added', async () => {
      mockedFs.access.mockResolvedValue(undefined); // Mock path access success

      const eventSpy = vi.fn();
      fileWatcher.on('fileAdded', eventSpy);

      await fileWatcher.watchTemplate(mockTemplate);

      // Get the 'add' event handler
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')[1];

      // Simulate file addition
      addHandler('/test/path/newfile.txt');

      expect(eventSpy).toHaveBeenCalledWith({
        filePath: '/test/path/newfile.txt',
        template: mockTemplate,
        fileName: 'newfile.txt',
      });
    });

    it('should emit error event when watcher encounters an error', async () => {
      mockedFs.access.mockResolvedValue(undefined); // Mock path access success

      const eventSpy = vi.fn();
      fileWatcher.on('error', eventSpy);

      await fileWatcher.watchTemplate(mockTemplate);

      // Get the 'error' event handler
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')[1];

      // Simulate error
      const testError = new Error('Watch error');
      errorHandler(testError);

      expect(eventSpy).toHaveBeenCalledWith({
        error: testError,
        template: mockTemplate,
      });
    });

    it('should handle multiple templates', () => {
      const template2: FolderTemplate = {
        id: 'template-2',
        name: 'Template 2',
        description: 'Second template',
        basePath: '/another/path',
        namingStructure: '{file_title}',
      };

      fileWatcher.watchTemplate(mockTemplate);
      fileWatcher.watchTemplate(template2);

      expect((fileWatcher as any).watchers.size).toBe(2);
      expect((fileWatcher as any).watchers.has('test-template')).toBe(true);
      expect((fileWatcher as any).watchers.has('template-2')).toBe(true);
      expect(mockedChokidar.watch).toHaveBeenCalledTimes(2);
    });
  });

  describe('unwatchTemplate', () => {
    const mockTemplate: FolderTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      basePath: '/test/path',
      namingStructure: '{file_title}',
    };

    it('should close and remove watcher for existing template', () => {
      fileWatcher.watchTemplate(mockTemplate);

      fileWatcher.unwatchTemplate('test-template');

      expect(mockWatcher.close).toHaveBeenCalled();
      expect((fileWatcher as any).watchers.has('test-template')).toBe(false);
    });

    it('should do nothing for non-existent template', () => {
      fileWatcher.watchTemplate(mockTemplate);

      fileWatcher.unwatchTemplate('non-existent-template');

      expect(mockWatcher.close).not.toHaveBeenCalled();
      expect((fileWatcher as any).watchers.has('test-template')).toBe(true);
    });

    it('should handle unwatching multiple templates', () => {
      const template2: FolderTemplate = {
        id: 'template-2',
        name: 'Template 2',
        description: 'Second template',
        basePath: '/another/path',
        namingStructure: '{file_title}',
      };

      const mockWatcher2 = { ...mockWatcher, close: vi.fn() };
      mockedChokidar.watch.mockReturnValueOnce(mockWatcher).mockReturnValueOnce(mockWatcher2);

      fileWatcher.watchTemplate(mockTemplate);
      fileWatcher.watchTemplate(template2);

      fileWatcher.unwatchTemplate('test-template');

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(mockWatcher2.close).not.toHaveBeenCalled();
      expect((fileWatcher as any).watchers.has('test-template')).toBe(false);
      expect((fileWatcher as any).watchers.has('template-2')).toBe(true);
    });
  });

  describe('stopAll', () => {
    it('should close all watchers and clear the map', () => {
      const templates: FolderTemplate[] = [
        {
          id: 'template-1',
          name: 'Template 1',
          description: 'First template',
          basePath: '/path/1',
          namingStructure: '{file_title}',
        },
        {
          id: 'template-2',
          name: 'Template 2',
          description: 'Second template',
          basePath: '/path/2',
          namingStructure: '{file_title}',
        },
      ];

      const mockWatcher1 = { ...mockWatcher, close: vi.fn() };
      const mockWatcher2 = { ...mockWatcher, close: vi.fn() };

      mockedChokidar.watch
        .mockReturnValueOnce(mockWatcher1)
        .mockReturnValueOnce(mockWatcher2);

      fileWatcher.watchTemplate(templates[0]);
      fileWatcher.watchTemplate(templates[1]);

      fileWatcher.stopAll();

      expect(mockWatcher1.close).toHaveBeenCalled();
      expect(mockWatcher2.close).toHaveBeenCalled();
      expect((fileWatcher as any).watchers.size).toBe(0);
    });

    it('should handle empty watchers map', () => {
      expect(() => fileWatcher.stopAll()).not.toThrow();
      expect((fileWatcher as any).watchers.size).toBe(0);
    });

    it('should handle watcher close errors gracefully', () => {
      const mockWatcherWithError = {
        ...mockWatcher,
        close: vi.fn().mockImplementation(() => {
          throw new Error('Close error');
        }),
      };

      mockedChokidar.watch.mockReturnValue(mockWatcherWithError);

      const template: FolderTemplate = {
        id: 'error-template',
        name: 'Error Template',
        description: 'Template that causes close error',
        basePath: '/error/path',
        namingStructure: '{file_title}',
      };

      fileWatcher.watchTemplate(template);

      // Should not throw even if close fails
      expect(() => fileWatcher.stopAll()).not.toThrow();
      expect((fileWatcher as any).watchers.size).toBe(0);
    });
  });

  describe('EventEmitter functionality', () => {
    it('should support event listener attachment and emission', () => {
      const eventSpy = vi.fn();

      fileWatcher.on('customEvent', eventSpy);
      (fileWatcher as EventEmitter).emit('customEvent', 'test data');

      expect(eventSpy).toHaveBeenCalledWith('test data');
    });

    it('should support multiple event listeners', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();

      fileWatcher.on('testEvent', spy1);
      fileWatcher.on('testEvent', spy2);

      (fileWatcher as EventEmitter).emit('testEvent', 'shared data');

      expect(spy1).toHaveBeenCalledWith('shared data');
      expect(spy2).toHaveBeenCalledWith('shared data');
    });

    it('should support once listeners', () => {
      const eventSpy = vi.fn();

      fileWatcher.once('onceEvent', eventSpy);
      (fileWatcher as EventEmitter).emit('onceEvent', 'first call');
      (fileWatcher as EventEmitter).emit('onceEvent', 'second call');

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith('first call');
    });
  });

  describe('FileEvent interface', () => {
    it('should conform to FileEvent interface structure', () => {
      const template: FolderTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        basePath: '/test/path',
        namingStructure: '{file_title}',
      };

      const fileEvent: FileEvent = {
        filePath: '/test/path/document.pdf',
        template,
        fileName: 'document.pdf',
      };

      expect(fileEvent.filePath).toBe('/test/path/document.pdf');
      expect(fileEvent.template).toBe(template);
      expect(fileEvent.fileName).toBe('document.pdf');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle template lifecycle: watch -> event -> unwatch', () => {
      const template: FolderTemplate = {
        id: 'lifecycle-template',
        name: 'Lifecycle Template',
        description: 'Testing full lifecycle',
        basePath: '/lifecycle/path',
        namingStructure: '{file_title}',
      };

      const eventSpy = vi.fn();
      fileWatcher.on('fileAdded', eventSpy);

      // Watch template
      fileWatcher.watchTemplate(template);
      expect((fileWatcher as any).watchers.has('lifecycle-template')).toBe(true);

      // Simulate file addition
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')[1];
      addHandler('/lifecycle/path/test.txt');

      expect(eventSpy).toHaveBeenCalledWith({
        filePath: '/lifecycle/path/test.txt',
        template,
        fileName: 'test.txt',
      });

      // Unwatch template
      fileWatcher.unwatchTemplate('lifecycle-template');
      expect((fileWatcher as any).watchers.has('lifecycle-template')).toBe(false);
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should handle error scenarios gracefully', () => {
      const template: FolderTemplate = {
        id: 'error-template',
        name: 'Error Template',
        description: 'Testing error handling',
        basePath: '/error/path',
        namingStructure: '{file_title}',
      };

      const errorSpy = vi.fn();
      fileWatcher.on('error', errorSpy);

      fileWatcher.watchTemplate(template);

      // Simulate watcher error
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')[1];
      const testError = new Error('Filesystem error');
      errorHandler(testError);

      expect(errorSpy).toHaveBeenCalledWith({
        error: testError,
        template,
      });
    });
  });
});
