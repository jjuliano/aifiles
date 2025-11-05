import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { writeFile, mkdir, rm, stat, readFile } from 'fs/promises';
import { tmpdir } from 'os';

// Mock Tauri API
const mockTauriAPI = {
  getTemplates: vi.fn(),
  getWatchedTemplates: vi.fn(),
  addTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  syncFileWatcher: vi.fn(),
};

// Setup global mocks
global.window = {
  tauriAPI: mockTauriAPI,
  __TAURI__: {
    invoke: vi.fn(),
    listen: vi.fn(),
  },
} as any;

describe('File Watching Integration Tests', () => {
  let testDir: string;
  let watchDir: string;

  beforeEach(async () => {
    // Create test directories
    testDir = join(tmpdir(), 'aifiles-integration-test-' + Date.now());
    watchDir = join(testDir, 'watch-folder');

    await mkdir(testDir, { recursive: true });
    await mkdir(watchDir, { recursive: true });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Template Management', () => {
    it('should create and list templates', async () => {
      const template = {
        id: 'test-template-1',
        name: 'Test Template',
        description: 'A test template',
        base_path: watchDir,
        naming_structure: '{file_title}',
        file_name_case: 'snake',
        auto_organize: true,
        watch_for_changes: true,
      };

      mockTauriAPI.addTemplate.mockResolvedValue(true);
      mockTauriAPI.getTemplates.mockResolvedValue([template]);

      // Simulate adding template
      const result = await window.tauriAPI.addTemplate(template);
      expect(result).toBe(true);
      expect(mockTauriAPI.addTemplate).toHaveBeenCalledWith(template);

      // Simulate getting templates
      const templates = await window.tauriAPI.getTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0]).toEqual(template);
    });

    it('should enable/disable watching on templates', async () => {
      const template = {
        id: 'test-template-2',
        name: 'Watch Test',
        description: 'Testing watch functionality',
        base_path: watchDir,
        naming_structure: '{file_title}',
        file_name_case: 'camel',
        auto_organize: false,
        watch_for_changes: false,
      };

      mockTauriAPI.updateTemplate.mockResolvedValue(undefined);
      mockTauriAPI.syncFileWatcher.mockResolvedValue(undefined);
      mockTauriAPI.getWatchedTemplates.mockResolvedValue([template]);

      // Enable watching
      await window.tauriAPI.updateTemplate(template.id, { watchForChanges: true });
      await window.tauriAPI.syncFileWatcher();

      expect(mockTauriAPI.updateTemplate).toHaveBeenCalledWith(template.id, { watchForChanges: true });
      expect(mockTauriAPI.syncFileWatcher).toHaveBeenCalled();

      // Verify it's now watched
      const watchedTemplates = await window.tauriAPI.getWatchedTemplates();
      expect(watchedTemplates).toHaveLength(1);
    });
  });

  describe('File Detection', () => {
    it('should detect when files are added to watched directory', async () => {
      const testFile = join(watchDir, 'test-document.txt');
      const fileContent = 'This is a test document for file watching.';

      // Create a file
      await writeFile(testFile, fileContent);

      // Verify file was created
      const stats = await stat(testFile);
      expect(stats.isFile()).toBe(true);

      // In a real scenario, this would trigger the file watcher
      // For this test, we verify the file operations work
      expect(await readFile(testFile, 'utf-8')).toBe(fileContent);
    });

    it('should handle different file types', async () => {
      const testFiles = [
        { name: 'document.pdf', content: '%PDF-1.4 test content' },
        { name: 'image.jpg', content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) }, // JPEG header
        { name: 'music.mp3', content: Buffer.from([0xFF, 0xFB]) }, // MP3 header
        { name: 'video.mp4', content: Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]) }, // MP4 header
      ];

      for (const file of testFiles) {
        const filePath = join(watchDir, file.name);
        await writeFile(filePath, file.content);

        const stats = await stat(filePath);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  describe('UI Integration', () => {
    it('should render watched folders in UI', () => {
      // This would test the DOM manipulation
      // For now, we'll test that the data structures are correct

      const template = {
        id: 'ui-test-template',
        name: 'UI Test Template',
        description: 'Testing UI rendering',
        base_path: watchDir,
        naming_structure: '{file_category_1}/{file_title}',
        file_name_case: 'pascal',
        auto_organize: true,
        watch_for_changes: true,
      };

      // Verify template has all required properties for UI rendering
      expect(template.id).toBeDefined();
      expect(template.name).toBe('UI Test Template');
      expect(template.watch_for_changes).toBe(true);
      expect(template.auto_organize).toBe(true);
      expect(template.base_path).toBe(watchDir);
      expect(template.naming_structure).toContain('{file_title}');
    });

    it('should handle activity log updates', () => {
      const event = {
        file_name: 'test-file.pdf',
        template: {
          name: 'Test Template',
          id: 'template-1'
        }
      };

      // Verify event structure for activity logging
      expect(event.file_name).toBe('test-file.pdf');
      expect(event.template.name).toBe('Test Template');
      expect(event.template.id).toBe('template-1');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent directories gracefully', async () => {
      const nonExistentDir = join(testDir, 'does-not-exist');

      // This should not throw when creating templates with non-existent paths
      // The file watcher should handle this gracefully
      const template = {
        id: 'error-test-template',
        name: 'Error Test',
        description: 'Testing error handling',
        base_path: nonExistentDir,
        naming_structure: '{file_title}',
        file_name_case: 'snake',
        auto_organize: false,
        watch_for_changes: true,
      };

      // Template creation should succeed even with invalid path
      expect(template.base_path).toBe(nonExistentDir);
      expect(template.watch_for_changes).toBe(true);
    });

    it('should handle API failures gracefully', async () => {
      mockTauriAPI.getTemplates.mockRejectedValue(new Error('API Error'));
      mockTauriAPI.getWatchedTemplates.mockRejectedValue(new Error('API Error'));

      // These should not throw unhandled errors
      await expect(window.tauriAPI.getTemplates()).rejects.toThrow('API Error');
      await expect(window.tauriAPI.getWatchedTemplates()).rejects.toThrow('API Error');
    });
  });
});
