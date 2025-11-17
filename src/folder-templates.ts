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
  folderStructure?: string[]; // Array of folder paths to create
  enforceTemplateStructure?: boolean; // If true, files go directly into selected template folder. If false, allows LLM to create subcategories within selected folder
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
      // ===== GENERAL FOLDERS =====
      {
        id: 'documents',
        name: 'Documents',
        description: 'General documents organized by type and date',
        basePath: '~/Documents',
        namingStructure: '{llm_category_1}/{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Documents benefit from single level sub-categorization
        folderStructure: [
          './Reports',
          './Reports/Financial',
          './Reports/Business',
          './Reports/Personal',
          './Contracts',
          './Invoices',
          './Letters',
          './Forms',
          './Receipts',
          './Certificates',
          './References',
          './Templates',
          './Archives',
        ],
      },
      {
        id: 'downloads',
        name: 'Downloads',
        description: 'Automatically organize downloaded files by type',
        basePath: '~/Downloads',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: true,
        watchForChanges: true,
        enforceTemplateStructure: true, // Simple downloads - direct placement in categorized folders
        folderStructure: [
          './Documents',
          './Images',
          './Videos',
          './Audio',
          './Archives',
          './Software',
          './Installers',
          './Temporary',
        ],
      },
      {
        id: 'desktop',
        name: 'Desktop',
        description: 'Keep desktop clean with automatic organization',
        basePath: '~/Desktop',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: true,
        watchForChanges: true,
        enforceTemplateStructure: true, // Desktop cleanup benefits from sub-categorization
        folderStructure: [
          './Work',
          './Personal',
          './Projects',
          './Temporary',
        ],
      },

      // ===== MEDIA FOLDERS =====
      {
        id: 'pictures',
        name: 'Pictures',
        description: 'Photos organized by date and type',
        basePath: '~/Pictures',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: true,
        watchForChanges: true,
        enforceTemplateStructure: true, // Photos benefit from additional sub-categorization
        folderStructure: [
          './Photos',
          './Photos/Family',
          './Photos/Friends',
          './Photos/Travel',
          './Photos/Events',
          './Photos/Nature',
          './Screenshots',
          './Wallpapers',
          './Artwork',
          './Memes',
          './Diagrams',
          './Icons',
          './Logos',
        ],
      },
      {
        id: 'videos',
        name: 'Videos',
        description: 'Video files organized by type and date',
        basePath: '~/Videos',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: true,
        watchForChanges: false,
        enforceTemplateStructure: true, // Videos benefit from sub-categorization (dates, events, etc.)
        folderStructure: [
          './Personal',
          './Family',
          './Tutorials',
          './Movies',
          './TV-Shows',
          './Recordings',
          './Projects',
          './Raw-Footage',
        ],
      },
      {
        id: 'music',
        name: 'Music',
        description: 'Music library organized by artist and album',
        basePath: '~/Music',
        namingStructure: '{music_artist}/{music_album}/{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: true,
        watchForChanges: false,
        enforceTemplateStructure: true, // Allow subcategories for music organization
        folderStructure: [
          './Library',
          './Playlists',
          './Podcasts',
          './Audiobooks',
          './Soundtracks',
          './Sound-Effects',
          './Recordings',
        ],
      },

      // ===== WORK & PRODUCTIVITY =====
      {
        id: 'work-documents',
        name: 'Work Documents',
        description: 'Professional documents organized by project and type',
        basePath: '~/Documents/Work',
        namingStructure: '{llm_category_1}/{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Work docs benefit from single level sub-categorization
        folderStructure: [
          './Projects',
          './Projects/Active',
          './Projects/Completed',
          './Projects/Archived',
          './Meetings',
          './Meetings/Notes',
          './Meetings/Agendas',
          './Reports',
          './Reports/Weekly',
          './Reports/Monthly',
          './Reports/Quarterly',
          './Reports/Annual',
          './Presentations',
          './Proposals',
          './Contracts',
          './Invoices',
          './Budgets',
          './Planning',
          './Research',
          './Training',
          './HR',
          './Templates',
        ],
      },
      {
        id: 'personal-documents',
        name: 'Personal Documents',
        description: 'Personal files organized by category',
        basePath: '~/Documents/Personal',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Personal docs benefit from sub-categorization
        folderStructure: [
          './Financial',
          './Financial/Bank-Statements',
          './Financial/Tax-Returns',
          './Financial/Investments',
          './Financial/Insurance',
          './Medical',
          './Medical/Records',
          './Medical/Prescriptions',
          './Medical/Insurance',
          './Legal',
          './Legal/Contracts',
          './Legal/Wills',
          './Legal/Property',
          './Education',
          './Education/Certificates',
          './Education/Transcripts',
          './Education/Diplomas',
          './Travel',
          './Travel/Passports',
          './Travel/Visas',
          './Travel/Itineraries',
          './Vehicle',
          './Property',
          './Letters',
          './Receipts',
        ],
      },

      // ===== DEVELOPMENT =====
      {
        id: 'development',
        name: 'Development',
        description: 'Code projects and development resources',
        basePath: '~/Development',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Development projects need hierarchical organization
        folderStructure: [
          './Projects',
          './Projects/Active',
          './Projects/Archive',
          './Projects/Learning',
          './Projects/Experiments',
          './Repositories',
          './Scripts',
          './Scripts/Automation',
          './Scripts/Utilities',
          './Scripts/Backup',
          './Snippets',
          './Snippets/JavaScript',
          './Snippets/Python',
          './Snippets/Bash',
          './Snippets/SQL',
          './Documentation',
          './Resources',
          './Resources/Libraries',
          './Resources/Templates',
          './Resources/Tutorials',
          './Databases',
          './Configs',
          './Logs',
        ],
      },

      // ===== CREATIVE WORK =====
      {
        id: 'creative-projects',
        name: 'Creative Projects',
        description: 'Design, writing, and creative work',
        basePath: '~/Creative',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Creative projects need sophisticated hierarchical organization
        folderStructure: [
          './Design',
          './Design/Graphics',
          './Design/UI-UX',
          './Design/Branding',
          './Design/Icons',
          './Design/Logos',
          './Writing',
          './Writing/Articles',
          './Writing/Blog-Posts',
          './Writing/Stories',
          './Writing/Scripts',
          './Writing/Drafts',
          './Video-Editing',
          './Video-Editing/Projects',
          './Video-Editing/Assets',
          './Video-Editing/Renders',
          './Photo-Editing',
          './Photo-Editing/Projects',
          './Photo-Editing/Presets',
          './Audio-Production',
          './Audio-Production/Projects',
          './Audio-Production/Samples',
          './3D-Modeling',
          './Assets',
          './Assets/Fonts',
          './Assets/Icons',
          './Assets/Stock-Images',
          './Assets/Templates',
        ],
      },

      // ===== RESEARCH & EDUCATION =====
      {
        id: 'research',
        name: 'Research',
        description: 'Academic and research materials',
        basePath: '~/Research',
        namingStructure: '{llm_category_1}/{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Research docs benefit from single level sub-categorization
        folderStructure: [
          './Papers',
          './Papers/Published',
          './Papers/Drafts',
          './Papers/Reviews',
          './Literature',
          './Literature/Books',
          './Literature/Articles',
          './Literature/Journals',
          './Data',
          './Data/Raw',
          './Data/Processed',
          './Data/Analysis',
          './Notes',
          './Notes/Reading',
          './Notes/Ideas',
          './Notes/Meeting',
          './Presentations',
          './References',
          './Citations',
          './Grants',
          './Ethics',
        ],
      },
      {
        id: 'learning',
        name: 'Learning',
        description: 'Educational materials and courses',
        basePath: '~/Learning',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Allow subcategories for learning organization
        folderStructure: [
          './Courses',
          './Courses/In-Progress',
          './Courses/Completed',
          './Books',
          './Books/Technical',
          './Books/Business',
          './Books/Self-Help',
          './Books/Fiction',
          './Tutorials',
          './Tutorials/Video',
          './Tutorials/Text',
          './Notes',
          './Exercises',
          './Projects',
          './Certificates',
          './Resources',
        ],
      },

      // ===== ARCHIVES & BACKUPS =====
      {
        id: 'archives',
        name: 'Archives',
        description: 'Long-term storage and archives',
        basePath: '~/Archives',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Allow subcategories for archive organization
        folderStructure: [
          './Documents',
          './Documents/2020',
          './Documents/2021',
          './Documents/2022',
          './Documents/2023',
          './Documents/2024',
          './Photos',
          './Photos/2020',
          './Photos/2021',
          './Photos/2022',
          './Photos/2023',
          './Photos/2024',
          './Projects',
          './Backups',
          './Old-Systems',
          './Migrations',
        ],
      },

      // ===== FINANCIAL =====
      {
        id: 'financial',
        name: 'Financial',
        description: 'Financial documents and records',
        basePath: '~/Documents/Financial',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Allow subcategories for financial organization
        folderStructure: [
          './Banking',
          './Banking/Statements',
          './Banking/Transfers',
          './Banking/Deposits',
          './Tax',
          './Tax/2020',
          './Tax/2021',
          './Tax/2022',
          './Tax/2023',
          './Tax/2024',
          './Tax/Receipts',
          './Tax/Forms',
          './Investments',
          './Investments/Stocks',
          './Investments/Crypto',
          './Investments/Real-Estate',
          './Investments/Retirement',
          './Insurance',
          './Insurance/Health',
          './Insurance/Life',
          './Insurance/Property',
          './Insurance/Vehicle',
          './Invoices',
          './Invoices/Sent',
          './Invoices/Received',
          './Invoices/Paid',
          './Invoices/Pending',
          './Receipts',
          './Budgets',
          './Loans',
          './Credit-Cards',
        ],
      },

      // ===== BUSINESS =====
      {
        id: 'business',
        name: 'Business',
        description: 'Business operations and management',
        basePath: '~/Business',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Allow subcategories for business organization
        folderStructure: [
          './Operations',
          './Operations/Policies',
          './Operations/Procedures',
          './Operations/Guidelines',
          './Finance',
          './Finance/Accounting',
          './Finance/Payroll',
          './Finance/Expenses',
          './Finance/Revenue',
          './HR',
          './HR/Employees',
          './HR/Recruitment',
          './HR/Training',
          './HR/Performance',
          './Legal',
          './Legal/Contracts',
          './Legal/Agreements',
          './Legal/Compliance',
          './Marketing',
          './Marketing/Campaigns',
          './Marketing/Content',
          './Marketing/Analytics',
          './Sales',
          './Sales/Leads',
          './Sales/Proposals',
          './Sales/Contracts',
          './Products',
          './Products/Development',
          './Products/Documentation',
          './Products/Support',
          './Clients',
          './Vendors',
        ],
      },

      // ===== MEDIA PRODUCTION =====
      {
        id: 'media-production',
        name: 'Media Production',
        description: 'Professional media production projects',
        basePath: '~/Media-Production',
        namingStructure: '{file_title}',
        fileNameCase: 'kebab',
        autoOrganize: false,
        watchForChanges: false,
        enforceTemplateStructure: true, // Allow subcategories for media production organization
        folderStructure: [
          './Video-Projects',
          './Video-Projects/Active',
          './Video-Projects/Completed',
          './Video-Projects/Raw-Footage',
          './Video-Projects/Edited',
          './Video-Projects/Renders',
          './Audio-Projects',
          './Audio-Projects/Podcasts',
          './Audio-Projects/Music',
          './Audio-Projects/Voiceovers',
          './Audio-Projects/Sound-Design',
          './Graphics',
          './Graphics/Thumbnails',
          './Graphics/Covers',
          './Graphics/Social-Media',
          './Assets',
          './Assets/Music',
          './Assets/SFX',
          './Assets/Graphics',
          './Assets/Fonts',
          './Scripts',
          './Storyboards',
          './Exports',
        ],
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

    // Create folder structure if defined
    if (template.folderStructure && template.folderStructure.length > 0) {
      await this.createFolderStructure(folderPath, template.folderStructure);
    }

    return folderPath;
  }

  private async createFolderStructure(basePath: string, folders: string[]): Promise<void> {
    for (const folder of folders) {
      const fullPath = path.join(basePath, folder.replace(/^\.\//, ''));
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  async importFolderStructure(
    templateId: string,
    structurePath: string
  ): Promise<void> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const content = await fs.readFile(structurePath, 'utf-8');
    const folders = this.parseFolderStructure(content);

    template.folderStructure = folders;
    await this.saveTemplates();
  }

  parseFolderStructure(content: string): string[] {
    const lines = content.split('\n');
    const folders: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle tree-style format (./folder/subfolder)
      if (trimmed.startsWith('./')) {
        folders.push(trimmed);
      }
      // Handle plain folder paths
      else if (!trimmed.includes('.')) {
        folders.push(`./${trimmed}`);
      }
    }

    return folders;
  }

  async exportTemplate(templateId: string, outputPath: string): Promise<void> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    await fs.writeFile(outputPath, JSON.stringify(template, null, 2), 'utf-8');
  }

  async importTemplate(inputPath: string): Promise<void> {
    const content = await fs.readFile(inputPath, 'utf-8');
    const template: FolderTemplate = JSON.parse(content);

    // Check if template with same ID already exists
    const existingIndex = this.templates.findIndex((t) => t.id === template.id);
    if (existingIndex !== -1) {
      this.templates[existingIndex] = template;
    } else {
      this.templates.push(template);
    }

    await this.saveTemplates();
  }

  async createTemplateWithStructure(
    id: string,
    name: string,
    description: string,
    basePath: string,
    structureFile: string
  ): Promise<void> {
    const content = await fs.readFile(structureFile, 'utf-8');
    const folderStructure = this.parseFolderStructure(content);

    const template: FolderTemplate = {
      id,
      name,
      description,
      basePath,
      namingStructure: '{file_category_1}/{file_category_2}/{file_title}',
      fileNameCase: 'kebab',
      autoOrganize: false,
      watchForChanges: false,
      folderStructure,
    };

    await this.addTemplate(template);
  }

  /**
   * Maps an AI-generated path to the closest matching folder in the template's folderStructure.
   * This ensures files are organized within the predefined folder structure.
   */
  mapPathToFolderStructure(template: FolderTemplate, aiGeneratedPath: string): string {
    if (!template.folderStructure || template.folderStructure.length === 0) {
      // No predefined structure, use the AI-generated path as-is
      return aiGeneratedPath;
    }

    // Extract the directory part from the AI-generated path (remove filename)
    const aiDirPath = path.dirname(aiGeneratedPath);

    // Remove the base path from the AI-generated directory path to get relative path
    const basePath = resolvePath(template.basePath);
    const relativeAiPath = path.relative(basePath, aiDirPath);

    // Split the AI path into components
    const aiPathParts = relativeAiPath.split(path.sep).filter(p => p && p !== '.');

    if (aiPathParts.length === 0) {
      return aiGeneratedPath;
    }

    // Get the first level folder from AI analysis (usually the main category)
    const aiMainCategory = aiPathParts[0].toLowerCase();

    // Look for exact matches in the folder structure
    const exactMatch = template.folderStructure.find(folder => {
      const folderPath = folder.replace(/^\.\//, '');
      const folderParts = folderPath.split('/').filter(p => p);
      return folderParts.length > 0 && folderParts[0].toLowerCase() === aiMainCategory;
    });

    if (exactMatch) {
      // Found exact match, use it
      const matchedPath = exactMatch.replace(/^\.\//, '');
      const remainingParts = aiPathParts.slice(1);
      const mappedDir = [matchedPath, ...remainingParts].join('/');
      const fullMappedPath = path.join(basePath, mappedDir, path.basename(aiGeneratedPath));
      return fullMappedPath;
    }

    // Look for partial matches (fuzzy matching)
    const fuzzyMatches = template.folderStructure
      .map(folder => {
        const folderPath = folder.replace(/^\.\//, '');
        const folderParts = folderPath.split('/').filter(p => p);
        if (folderParts.length === 0) return null;

        const folderMain = folderParts[0].toLowerCase();
        // Calculate similarity score
        const similarity = this.calculateSimilarity(aiMainCategory, folderMain);
        return { folder: folderPath, similarity, depth: folderParts.length };
      })
      .filter(match => match && match.similarity > 0.3) // Only consider matches with >30% similarity
      .sort((a, b) => b.similarity - a.similarity || a.depth - b.depth); // Sort by similarity, then by depth

    if (fuzzyMatches.length > 0) {
      const bestMatch = fuzzyMatches[0].folder;
      const remainingParts = aiPathParts.slice(1);
      const mappedDir = [bestMatch, ...remainingParts].join('/');
      const fullMappedPath = path.join(basePath, mappedDir, path.basename(aiGeneratedPath));
      return fullMappedPath;
    }

    // No good match found, check if we should create a new folder or use the first available
    // Only create new folders for very specific categories, otherwise use the most generic existing folder
    if (aiPathParts.length <= 2 && template.folderStructure.length > 0) {
      // For simple categorizations, use the first available folder as a catch-all
      const fallbackFolder = template.folderStructure[0].replace(/^\.\//, '');
      const remainingParts = aiPathParts.slice(1);
      const mappedDir = [fallbackFolder, ...remainingParts].join('/');
      const fullMappedPath = path.join(basePath, mappedDir, path.basename(aiGeneratedPath));
      return fullMappedPath;
    }

    // For complex categorizations, allow creating new folders but log a warning
    console.warn(`⚠️  No matching folder found in template '${template.name}' for category '${aiMainCategory}'. Creating new folder structure.`);
    return aiGeneratedPath;
  }

  /**
   * Calculate string similarity using Levenshtein distance (simple implementation)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1,     // deletion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}
