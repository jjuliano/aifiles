import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileExists, resolvePath } from './utils.js';

export interface FolderTemplate {
  id: string;
  name: string;
  description: string;
  basePath: string;
  namingStructure: string;
  fileNameCase?: 'camel' | 'snake' | 'kebab' | 'pascal' | 'upper_snake' | 'lower_snake';
  autoOrganize?: boolean;
  watchForChanges?: boolean;
}

export class FolderTemplateManager {
  private templatesPath: string;
  private templates: FolderTemplate[] = [];

  constructor() {
    this.templatesPath = path.join(os.homedir(), '.aifiles', 'templates.json');
    this.migrateLegacyTemplates();
  }

  private async migrateLegacyTemplates(): Promise<void> {
    const legacyPath = path.join(os.homedir(), '.aifiles-templates.json');
    const newDir = path.dirname(this.templatesPath);

    try {
      // Check if legacy file exists
      const legacyExists = await fileExists(legacyPath);
      if (legacyExists) {
        // Create new directory if it doesn't exist
        await fs.mkdir(newDir, { recursive: true });

        // Check if new file already exists
        const newExists = await fileExists(this.templatesPath);
        if (!newExists) {
          // Move legacy file to new location
          await fs.rename(legacyPath, this.templatesPath);
          console.log('✅ Migrated templates from ~/.aifiles-templates.json to ~/.aifiles/templates.json');
        }
      }
    } catch (error) {
      // Ignore migration errors, will use defaults if needed
    }
  }

  async loadTemplates(): Promise<FolderTemplate[]> {
    const exists = await fileExists(this.templatesPath);
    if (!exists) {
      // Create default templates
      this.templates = this.getDefaultTemplates();
      await this.saveTemplates();
      return this.templates;
    }

    const content = await fs.readFile(this.templatesPath, 'utf-8');
    this.templates = JSON.parse(content);

    // If templates array is empty, create defaults
    if (this.templates.length === 0) {
      this.templates = this.getDefaultTemplates();
      await this.saveTemplates();
    }

    return this.templates;
  }

  async saveTemplates(): Promise<void> {
    // Ensure the directory exists
    const dir = path.dirname(this.templatesPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      this.templatesPath,
      JSON.stringify(this.templates, null, 2),
      'utf-8'
    );
  }

  getDefaultTemplates(): FolderTemplate[] {
    return [
      {
        id: 'documents',
        name: 'Documents',
        description: 'General documents organized by type and date',
        basePath: '~/Documents',
        namingStructure: '{file_category_1}/{file_title}--{file_date_created}',
        fileNameCase: 'snake',
        autoOrganize: false,
        watchForChanges: false,
      },
      {
        id: 'downloads',
        name: 'Downloads',
        description: 'Automatically organize downloaded files',
        basePath: '~/Downloads',
        namingStructure: '{file_category_1}/{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: true,
        watchForChanges: true,
      },
      {
        id: 'pictures',
        name: 'Pictures',
        description: 'Photos and images organized by date',
        basePath: '~/Pictures',
        namingStructure: '{picture_date_taken}/{file_title}',
        fileNameCase: 'lower_snake',
        autoOrganize: true,
        watchForChanges: true,
      },
      {
        id: 'music',
        name: 'Music',
        description: 'Audio files organized by artist and album',
        basePath: '~/Music',
        namingStructure: '{music_artist}/{music_album}/{file_title}',
        fileNameCase: 'snake',
        autoOrganize: true,
        watchForChanges: false,
      },
      {
        id: 'videos',
        name: 'Videos',
        description: 'Video files organized by date and type',
        basePath: '~/Videos',
        namingStructure: '{file_category_1}/{file_date_created}/{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: true,
        watchForChanges: false,
      },
      {
        id: 'desktop',
        name: 'Desktop',
        description: 'Desktop files automatically organized',
        basePath: '~/Desktop',
        namingStructure: '{file_category_1}/{file_title}',
        fileNameCase: 'camel',
        autoOrganize: true,
        watchForChanges: true,
      },
    ];
  }

  async addTemplate(template: FolderTemplate): Promise<void> {
    this.templates.push(template);
    await this.saveTemplates();
  }

  async updateTemplate(id: string, updates: Partial<FolderTemplate>): Promise<void> {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Template ${id} not found`);
    }

    this.templates[index] = { ...this.templates[index], ...updates };
    await this.saveTemplates();
  }

  async deleteTemplate(id: string): Promise<void> {
    this.templates = this.templates.filter((t) => t.id !== id);
    await this.saveTemplates();
  }

  getTemplate(id: string): FolderTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  getAllTemplates(): FolderTemplate[] {
    return this.templates;
  }

  getWatchedTemplates(): FolderTemplate[] {
    return this.templates.filter((t) => t.watchForChanges);
  }

  async createFolderFromTemplate(templateId: string): Promise<string> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const folderPath = resolvePath(template.basePath);
    await fs.mkdir(folderPath, { recursive: true });
    return folderPath;
  }
}
