import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { FolderTemplateManager, FolderTemplate } from '../../src/folder-templates.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('os');
vi.mock('path');
vi.mock('../../src/utils.js');

// Import mocked modules after mocking
import fs from 'fs/promises';
import * as utils from '../../src/utils.js';

const mockedOs = vi.mocked(os);
const mockedPath = vi.mocked(path);
const mockedUtils = vi.mocked(utils);

describe('FolderTemplateManager', () => {
  let manager: FolderTemplateManager;
  let mockTemplatesPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTemplatesPath = '/home/user/.aifiles/templates.json';
    mockedOs.homedir.mockReturnValue('/home/user');
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    mockedUtils.fileExists.mockResolvedValue(false);
    mockedUtils.resolvePath.mockImplementation((path) => path);

    manager = new FolderTemplateManager();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize templates path correctly', () => {
      expect(mockedOs.homedir).toHaveBeenCalled();
      expect(mockedPath.join).toHaveBeenCalledWith('/home/user', '.aifiles-templates.json');
    });
  });

  describe('loadTemplates', () => {
    it('should create and return default templates when file does not exist', async () => {
      mockedUtils.fileExists.mockResolvedValue(false);
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      const templates = await manager.loadTemplates();

      expect(mockedUtils.fileExists).toHaveBeenCalledWith(mockTemplatesPath);
      expect(writeFileSpy).toHaveBeenCalled();
      expect(templates).toHaveLength(6);
      expect(templates[0].id).toBe('documents');
      expect(templates[0].name).toBe('Documents');
    });

    it('should load and parse templates from file when it exists', async () => {
      const mockTemplates: FolderTemplate[] = [
        {
          id: 'test-template',
          name: 'Test Template',
          description: 'A test template',
          basePath: '~/test',
          namingStructure: '{file_title}',
          fileNameCase: 'snake',
          autoOrganize: false,
          watchForChanges: true,
        },
      ];

      mockedUtils.fileExists.mockResolvedValue(true);
      const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(mockTemplates));

      const templates = await manager.loadTemplates();

      expect(readFileSpy).toHaveBeenCalledWith(mockTemplatesPath, 'utf-8');
      expect(templates).toEqual(mockTemplates);
    });

    it('should handle JSON parse errors', async () => {
      mockedUtils.fileExists.mockResolvedValue(true);
      const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue('invalid json');

      await expect(manager.loadTemplates()).rejects.toThrow();
    });
  });

  describe('saveTemplates', () => {
    it('should save templates to file', async () => {
      const templates: FolderTemplate[] = [
        {
          id: 'test',
          name: 'Test',
          description: 'Test template',
          basePath: '~/test',
          namingStructure: '{file_title}',
        },
      ];

      manager['templates'] = templates;
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await manager.saveTemplates();

      expect(writeFileSpy).toHaveBeenCalledWith(
        mockTemplatesPath,
        JSON.stringify(templates, null, 2),
        'utf-8'
      );
    });
  });

  describe('getDefaultTemplates', () => {
    it('should return predefined default XDG templates', () => {
      const defaults = manager.getDefaultTemplates();

      expect(defaults).toHaveLength(6);

      // Check Documents template
      expect(defaults[0]).toEqual({
        id: 'documents',
        name: 'Documents',
        description: 'General documents organized by type and date',
        basePath: '~/Documents',
        namingStructure: '{file_category_1}/{file_title}--{file_date_created}',
        fileNameCase: 'snake',
        autoOrganize: false,
        watchForChanges: false,
      });

      // Check other template IDs
      expect(defaults[1].id).toBe('downloads');
      expect(defaults[2].id).toBe('pictures');
      expect(defaults[3].id).toBe('music');
      expect(defaults[4].id).toBe('videos');
      expect(defaults[5].id).toBe('desktop');

      // Verify all use standard XDG paths
      defaults.forEach(template => {
        expect(template.basePath).toMatch(/^~\/(Documents|Downloads|Pictures|Music|Videos|Desktop)$/);
      });
    });
  });

  describe('addTemplate', () => {
    it('should add template and save', async () => {
      const template: FolderTemplate = {
        id: 'new-template',
        name: 'New Template',
        description: 'A new template',
        basePath: '~/new',
        namingStructure: '{file_title}',
      };

      manager['templates'] = [];
      const saveSpy = vi.spyOn(manager, 'saveTemplates').mockResolvedValue(undefined);

      await manager.addTemplate(template);

      expect(manager['templates']).toContain(template);
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('updateTemplate', () => {
    it('should update existing template and save', async () => {
      const existingTemplate: FolderTemplate = {
        id: 'test-template',
        name: 'Old Name',
        description: 'Old description',
        basePath: '~/old',
        namingStructure: '{file_title}',
      };

      manager['templates'] = [existingTemplate];
      const saveSpy = vi.spyOn(manager, 'saveTemplates').mockResolvedValue(undefined);

      const updates = {
        name: 'New Name',
        description: 'New description',
      };

      await manager.updateTemplate('test-template', updates);

      expect(manager['templates'][0].name).toBe('New Name');
      expect(manager['templates'][0].description).toBe('New description');
      expect(manager['templates'][0].basePath).toBe('~/old'); // Should remain unchanged
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent template', async () => {
      manager['templates'] = [];

      await expect(manager.updateTemplate('non-existent', {})).rejects.toThrow('Template non-existent not found');
    });
  });

  describe('deleteTemplate', () => {
    it('should remove template and save', async () => {
      const template1: FolderTemplate = {
        id: 'template-1',
        name: 'Template 1',
        description: 'First template',
        basePath: '~/test1',
        namingStructure: '{file_title}',
      };

      const template2: FolderTemplate = {
        id: 'template-2',
        name: 'Template 2',
        description: 'Second template',
        basePath: '~/test2',
        namingStructure: '{file_title}',
      };

      manager['templates'] = [template1, template2];
      const saveSpy = vi.spyOn(manager, 'saveTemplates').mockResolvedValue(undefined);

      await manager.deleteTemplate('template-1');

      expect(manager['templates']).toHaveLength(1);
      expect(manager['templates'][0].id).toBe('template-2');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('getTemplate', () => {
    it('should return template by id', () => {
      const template: FolderTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        basePath: '~/test',
        namingStructure: '{file_title}',
      };

      manager['templates'] = [template];

      const result = manager.getTemplate('test-template');

      expect(result).toEqual(template);
    });

    it('should return undefined for non-existent template', () => {
      manager['templates'] = [];

      const result = manager.getTemplate('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all templates', () => {
      const templates: FolderTemplate[] = [
        {
          id: 'template-1',
          name: 'Template 1',
          description: 'First',
          basePath: '~/test1',
          namingStructure: '{file_title}',
        },
        {
          id: 'template-2',
          name: 'Template 2',
          description: 'Second',
          basePath: '~/test2',
          namingStructure: '{file_title}',
        },
      ];

      manager['templates'] = templates;

      const result = manager.getAllTemplates();

      expect(result).toEqual(templates);
    });
  });

  describe('getWatchedTemplates', () => {
    it('should return only templates with watchForChanges enabled', () => {
      const templates: FolderTemplate[] = [
        {
          id: 'watched-template',
          name: 'Watched Template',
          description: 'This is watched',
          basePath: '~/watched',
          namingStructure: '{file_title}',
          watchForChanges: true,
        },
        {
          id: 'unwatched-template',
          name: 'Unwatched Template',
          description: 'This is not watched',
          basePath: '~/unwatched',
          namingStructure: '{file_title}',
          watchForChanges: false,
        },
        {
          id: 'default-template',
          name: 'Default Template',
          description: 'No watch setting',
          basePath: '~/default',
          namingStructure: '{file_title}',
        },
      ];

      manager['templates'] = templates;

      const result = manager.getWatchedTemplates();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('watched-template');
    });
  });

  describe('createFolderFromTemplate', () => {
    it('should create folder from template and return path', async () => {
      const template: FolderTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        basePath: '~/test/folder',
        namingStructure: '{file_title}',
      };

      manager['templates'] = [template];
      const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      mockedUtils.resolvePath.mockReturnValue('/home/user/test/folder');

      const result = await manager.createFolderFromTemplate('test-template');

      expect(mockedUtils.resolvePath).toHaveBeenCalledWith('~/test/folder');
      expect(mkdirSpy).toHaveBeenCalledWith('/home/user/test/folder', { recursive: true });
      expect(result).toBe('/home/user/test/folder');
    });

    it('should throw error for non-existent template', async () => {
      manager['templates'] = [];

      await expect(manager.createFolderFromTemplate('non-existent')).rejects.toThrow('Template non-existent not found');
    });
  });
});
