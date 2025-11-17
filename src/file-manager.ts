import blessed from 'blessed';
import { green, red, yellow, lightCyan, blue, cyan, magenta } from 'kolorist';
import { FileDatabase, FileRecord, FileVersion, DiscoveredFile } from './database.js';
import { ProviderFactory } from './providers/provider-factory.js';
import { generatePromptResponse, getConfig, resolvePath, FileMetadataManager, parseJson } from './utils.js';
import { FolderTemplateManager } from './folder-templates.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger class to prevent console output from interfering with TUI
class Logger {
  private logFile: string;

  constructor() {
    this.logFile = path.join(os.tmpdir(), 'aifiles-fm.log');
  }

  log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}\n`;
    // Write to log file asynchronously (fire and forget)
    fs.appendFile(this.logFile, logMessage).catch(() => {});
  }

  error(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message} ${args.map(a => {
      if (a instanceof Error) {
        return `${a.message}\n${a.stack}`;
      }
      return JSON.stringify(a);
    }).join(' ')}\n`;
    // Write to log file asynchronously (fire and forget)
    fs.appendFile(this.logFile, logMessage).catch(() => {});
  }

  getLogPath(): string {
    return this.logFile;
  }
}

export class FileManager {
  private db: FileDatabase;
  private logger: Logger;
  private screen!: blessed.Widgets.Screen;
  private initializing: boolean = false; // Flag to track initialization state
  private leftPanel!: blessed.Widgets.ListElement;
  private rightPanel!: blessed.Widgets.BoxElement;
  private statusBar!: blessed.Widgets.BoxElement;
  private commandBar!: blessed.Widgets.TextboxElement;
  private menuBar!: blessed.Widgets.BoxElement;
  private files: FileRecord[] = [];
  private discoveredFiles: DiscoveredFile[] = [];
  private selectedFileIndex = 0;
  private dialogOpen = false;  // Track if any dialog is currently open
  private currentView: 'list' | 'details' | 'edit' | 'search' | 'discovered' = 'list';
  private searchQuery = '';
  private showOrganized = false; // Toggle between organized/unorganized files (default to unorganized)
  private expandedFolders = new Set<string>(); // Track which folders are expanded
  private handlersSetup = false; // Track if event handlers have been set up

  constructor() {
    this.db = new FileDatabase();
    this.logger = new Logger();
    this.setupUI();
  }

  // Index all files in watch folders based on config setting
  private async indexFilesIfNeeded(): Promise<void> {
    const config = await getConfig();
    const indexMode = config.FILE_MANAGER_INDEX_MODE || 'on-demand'; // Default to on-demand for performance
    
    if (indexMode === 'launch') {
      // Run indexing on startup to keep database up-to-date with file system changes
      await this.indexAllFiles();
    } else {
      // on-demand mode: Only index when user expands folders
      if (!this.initializing) this.logger.log('Index mode: on-demand (folders indexed when expanded)');
    }
  }

  // Index all files in watch folders
  private async indexAllFiles(): Promise<void> {
    try {
      this.logger.log('Starting file indexing...');
      
      const templateManager = new FolderTemplateManager();
      const templates = await templateManager.loadTemplates();

      // Collect all watch paths from templates
      const watchPaths = new Set<string>();

      for (const template of templates) {
        if (template.watchForChanges) {
          watchPaths.add(resolvePath(template.basePath));
        }
      }

      // Always add default XDG directories and user-configured directories
      const config = await getConfig();
      const baseDir = resolvePath(config.BASE_DIRECTORY || '~/');

      // Start with base directory
      const allDirs = new Set([baseDir]);

      // Add all configured directories from config
      const configuredDirs = [
        config.DOWNLOADS_DIRECTORY && path.join(baseDir, config.DOWNLOADS_DIRECTORY),
        config.DESKTOP_DIRECTORY && path.join(baseDir, config.DESKTOP_DIRECTORY),
        config.DOCUMENT_DIRECTORY && path.join(baseDir, config.DOCUMENT_DIRECTORY),
        config.MUSIC_DIRECTORY && path.join(baseDir, config.MUSIC_DIRECTORY),
        config.PICTURES_DIRECTORY && path.join(baseDir, config.PICTURES_DIRECTORY),
        config.VIDEOS_DIRECTORY && path.join(baseDir, config.VIDEOS_DIRECTORY),
        config.ARCHIVES_DIRECTORY && path.join(baseDir, config.ARCHIVES_DIRECTORY),
        config.OTHERS_DIRECTORY && path.join(baseDir, config.OTHERS_DIRECTORY),
      ].filter(Boolean) as string[];

      // Add configured directories to the set
      configuredDirs.forEach(dir => allDirs.add(dir));

      let foundDirs = 0;
      for (const dir of allDirs) {
        try {
          const stat = await fs.stat(dir);
          if (stat.isDirectory()) {
            watchPaths.add(dir);
            foundDirs++;
          }
        } catch {
          // Directory doesn't exist, skip
        }
      }


      // Index files in each watch path (depth 1 only)
      let totalIndexed = 0;
      for (const watchPath of watchPaths) {
        const indexed = await this.indexFilesInPath(watchPath);
        totalIndexed += indexed;
      }

      this.logger.log(`File indexing complete. Indexed ${totalIndexed} file(s) in ${watchPaths.size} director(ies).`);

    } catch (error) {
      // Silently fail - indexing errors shouldn't break the TUI
      this.logger.error('File indexing failed:', error);
    }
  }

  // Index files in a directory (depth 1 only - no recursion)
  private async indexFilesInPath(dirPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let processedFiles = 0;

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip hidden files and directories
        if (entry.name.startsWith('.')) continue;

        // Only process files (not directories) - depth 1 only
        if (entry.isFile()) {
          try {
            // Get file stats for size and modification time
            const stats = await fs.stat(fullPath);

            // Check if file is already tracked in organized files
            const existingFile = this.db.getFileByPath(fullPath);
            if (existingFile) {
              // File is organized, update discovered status
              await this.db.recordDiscoveredFile({
                filePath: fullPath,
                fileName: entry.name,
                organizationStatus: 'organized',
                fileSize: stats.size,
                fileModified: stats.mtime,
                templateId: existingFile.templateId,
              });
            } else {
              // Check if file has AIFiles metadata
              const hasMetadata = await FileMetadataManager.hasAIFilesMetadata(fullPath);
              await this.db.recordDiscoveredFile({
                filePath: fullPath,
                fileName: entry.name,
                organizationStatus: hasMetadata ? 'organized' : 'unorganized',
                fileSize: stats.size,
                fileModified: stats.mtime,
              });
            }
            processedFiles++;
          } catch (fileError) {
            // Skip files we can't stat
          }
        }
      }

      return processedFiles;
    } catch (error) {
      // Skip directories we can't read
      return 0;
    }
  }

  private setupUI(): void {
    // Create main screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'AIFiles Manager - MC Style',
    });

    // Menu bar (top)
    this.menuBar = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: 'blue',
        fg: 'white',
      },
      content: ' F1 Help  F2 View  F3 Edit  F4 Restore  F5 Revert  F6 Reanalyze  F7 Search  F8 Toggle  F9 Delete  F10 Quit ',
    });

    // Left panel - File list
    this.leftPanel = blessed.list({
      parent: this.screen,
      top: 1,
      left: 0,
      width: '50%',
      height: '100%-3',
      border: 'line',
      label: ' 📁 Organized Files ',
      style: {
        border: { fg: 'cyan' },
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' },
      },
      keys: false,  // Disable built-in key handling to prevent double navigation
      vi: false,    // Disable vi mode to prevent conflicts
      mouse: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'blue' },
      },
      interactive: true,
    });

    // Right panel - Details/Editor
    this.rightPanel = blessed.box({
      parent: this.screen,
      top: 1,
      left: '50%',
      width: '50%',
      height: '100%-3',
      border: 'line',
      label: ' 📄 File Details ',
      style: {
        border: { fg: 'cyan' },
        fg: 'white',
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'blue' },
      },
    });

    // Status bar (bottom)
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: 'blue',
        fg: 'white',
      },
    });

    // Command bar
    this.commandBar = blessed.textbox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: 'black',
        fg: 'white',
      },
      inputOnFocus: true,
    });

    this.setupEventHandlers();
    // Note: loadFiles() will be called by showFileList() when the interface starts
  }

  private setupEventHandlers(): void {
    // Only set up handlers once to prevent duplicate bindings
    if (this.handlersSetup) {
      return;
    }
    
    this.handlersSetup = true;

    // Screen events
    this.screen.key(['escape', 'C-c'], () => {
      this.quit();
    });

    // Function keys
    this.screen.key('f1', () => this.showHelp());
    this.screen.key('f2', () => this.viewFile());
    this.screen.key('f3', () => this.editFile());
    this.screen.key('f4', () => this.restoreFile());
    this.screen.key('f5', () => this.revertFile());
    this.screen.key('f6', () => this.reanalyzeFile());
    this.screen.key('f7', () => this.searchMode());
    this.screen.key('f8', async () => {
      try {
        await this.toggleFileView();
      } catch (error) {
        this.logger.error('Toggle view error:', error);
      }
    });
    this.screen.key('f9', () => this.deleteFile());
    this.screen.key('f10', () => this.quit());

    // Navigation
    this.screen.key(['up', 'k'], () => {
      if (this.dialogOpen) return;
      this.moveSelection(-1);
    });
    this.screen.key(['down', 'j'], () => {
      if (this.dialogOpen) return;
      this.moveSelection(1);
    });
    this.screen.key('pageup', () => {
      if (this.dialogOpen) return;
      this.moveSelection(-10);
    });
    this.screen.key('pagedown', () => {
      if (this.dialogOpen) return;
      this.moveSelection(10);
    });
    this.screen.key('home', () => {
      if (this.dialogOpen) return;
      this.selectFile(0);
    });
    this.screen.key('end', () => {
      if (this.dialogOpen) return;
      this.selectFile(this.getTotalDisplayItems() - 1);
    });

    // Enter to view or organize
    this.screen.key('enter', async () => {
      if (this.dialogOpen) return;

      try {
        await this.handleEnter();
      } catch (error) {
        // Log full error with stack trace for debugging
        this.logger.error('Enter key error - Full details:', error);

        // Show user-friendly error message
        let errorMessage = 'An unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
          // Also log the stack trace
          if (error.stack) {
            this.logger.error('Stack trace:', error.stack);
          }
        } else {
          errorMessage = String(error);
        }

        this.showCommandError(`Failed to process Enter key:\n\n${errorMessage}`);
      }
    });

    // Command input
    this.screen.key(':', () => {
      this.commandBar.focus();
      this.commandBar.readInput(() => {
        const cmd = this.commandBar.value;
        this.executeCommand(cmd);
        this.commandBar.clearValue();
        this.leftPanel.focus();
      });
    });

    // Left panel events
    this.leftPanel.on('select', (item, index) => {
      this.selectedFileIndex = index;
      this.updateRightPanel();
    });

    this.leftPanel.focus();
  }

  private async loadFiles(): Promise<void> {
    if (!this.initializing) this.logger.log(`Loading files for view: ${this.currentView}`);

    // Add timeout to prevent hanging
    const loadTimeout = 15000; // 15 seconds - more aggressive timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`loadFiles timed out after ${loadTimeout}ms`)), loadTimeout);
    });

    try {
      await Promise.race([
        this.performLoadFiles(),
        timeoutPromise
      ]);
    } catch (error) {
      if (!this.initializing) this.logger.error('loadFiles failed:', error);
      // Continue with empty file lists on error to prevent complete failure
      if (this.currentView === 'discovered') {
        this.discoveredFiles = [];
      } else {
        this.files = [];
      }
      this.updateFileList();
      this.updateRightPanel();
      this.updateStatusBar();
      throw error;
    }
  }

  private async performLoadFiles(): Promise<void> {
    if (!this.initializing) console.log('🔄 performLoadFiles starting...');
    if (this.currentView === 'discovered') {
      if (!this.initializing) console.log('📊 Current view: discovered');

      // Get discovered files from database
      if (!this.initializing) console.log('🗄️ Fetching discovered files from database...');
      const startDbTime = Date.now();
      const allDiscoveredFiles = this.showOrganized
        ? this.db.getDiscoveredFilesByStatus('organized', 1000)
        : this.db.getDiscoveredFilesByStatus('unorganized', 1000);
      const dbDuration = Date.now() - startDbTime;
      if (!this.initializing) console.log(`📊 DB query took ${dbDuration}ms, found ${allDiscoveredFiles.length} discovered files`);

      // Verify files exist and clean up missing ones
      const startVerifyTime = Date.now();
      this.discoveredFiles = await this.verifyAndCleanDiscoveredFiles(allDiscoveredFiles);
      const verifyDuration = Date.now() - startVerifyTime;
      if (!this.initializing) console.log(`✅ File verification completed in ${verifyDuration}ms, ${this.discoveredFiles.length} valid files`);

      // Always add folder placeholders for directories that haven't been indexed yet
      if (!this.initializing) console.log('📁 Adding folder placeholders...');
      const startPlaceholderTime = Date.now();
      await this.addConfiguredFolderPlaceholders();
      const placeholderDuration = Date.now() - startPlaceholderTime;
      if (!this.initializing) console.log(`📁 Folder placeholders added in ${placeholderDuration}ms`);

      // Sort by folder path first, then by filename
      this.discoveredFiles.sort((a, b) => {
        const dirA = path.dirname(a.filePath);
        const dirB = path.dirname(b.filePath);
        if (dirA !== dirB) {
          return dirA.localeCompare(dirB);
        }
        return a.fileName.localeCompare(b.fileName);
      });
    } else {
      const allFiles = this.db.getFiles(100); // Load more files for browsing

      // Verify files exist and clean up missing ones
      this.files = await this.verifyAndCleanOrganizedFiles(allFiles);
    }
    this.updateFileList();
    this.updateRightPanel();
    this.updateStatusBar();
  }

  // Add placeholder entries for configured directories to ensure they're always visible
  private async addConfiguredFolderPlaceholders(): Promise<void> {
    const config = await getConfig();
    const baseDir = resolvePath(config.BASE_DIRECTORY || '~/');

    const configuredDirs = [
      config.DOWNLOADS_DIRECTORY && path.join(baseDir, config.DOWNLOADS_DIRECTORY),
      config.DESKTOP_DIRECTORY && path.join(baseDir, config.DESKTOP_DIRECTORY),
      config.DOCUMENT_DIRECTORY && path.join(baseDir, config.DOCUMENT_DIRECTORY),
      config.MUSIC_DIRECTORY && path.join(baseDir, config.MUSIC_DIRECTORY),
      config.PICTURES_DIRECTORY && path.join(baseDir, config.PICTURES_DIRECTORY),
      config.VIDEOS_DIRECTORY && path.join(baseDir, config.VIDEOS_DIRECTORY),
      config.ARCHIVES_DIRECTORY && path.join(baseDir, config.ARCHIVES_DIRECTORY),
      config.OTHERS_DIRECTORY && path.join(baseDir, config.OTHERS_DIRECTORY),
    ].filter(Boolean) as string[];

    // Ensure every configured directory is represented, even if filtered out
    for (const dir of configuredDirs) {
      try {
        // Add timeout to prevent hanging on directory access
        const stat = await Promise.race([
          fs.stat(dir),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Directory access timeout')), 1000)
          )
        ]);
        if (stat.isDirectory()) {
          // Check if this directory has any files in current view (matching filter)
          const hasVisibleFiles = this.discoveredFiles.some(f => {
            const fileDir = path.dirname(f.filePath);
            return fileDir === dir && !f.fileName.startsWith('.folder-placeholder');
          });
          
          // Always ensure the folder is represented in the list
          if (!hasVisibleFiles) {
            // Check if placeholder already exists
            const hasPlaceholder = this.discoveredFiles.some(f => {
              const fileDir = path.dirname(f.filePath);
              return fileDir === dir && f.fileName.startsWith('.folder-placeholder');
            });
            
            if (!hasPlaceholder) {
              // Add a placeholder to ensure folder appears in the list
              // Use the current view's status so placeholder appears in filtered view
              const placeholderStatus = this.showOrganized ? 'organized' : 'unorganized';
              this.discoveredFiles.push({
                id: '', // Placeholder ID (empty string)
                filePath: path.join(dir, '.folder-placeholder'),
                fileName: '.folder-placeholder',
                organizationStatus: placeholderStatus,
                discoveredAt: new Date(),
                lastChecked: new Date(),
              });
            }
          }
        }
      } catch {
        // Directory doesn't exist, skip it
      }
    }
  }

  // Verify discovered files exist and clean up missing ones
  private async verifyAndCleanDiscoveredFiles(files: DiscoveredFile[]): Promise<DiscoveredFile[]> {
    this.logger.log(`Starting verification of ${files.length} discovered files`);

    // Emergency limit: only verify the most recent 500 files to prevent hanging
    const maxFilesToVerify = 500;
    const filesToVerify = files.slice(0, maxFilesToVerify);
    if (files.length > maxFilesToVerify) {
      if (!this.initializing) console.log(`⚠️ Limiting verification to ${maxFilesToVerify} most recent files (skipping ${files.length - maxFilesToVerify} older files)`);
    }

    const validFiles: DiscoveredFile[] = [];
    const filesToRemove: string[] = [];

    // Process files in batches to avoid overwhelming the file system
    const batchSize = 20; // Reduced batch size for safety
    for (let i = 0; i < filesToVerify.length; i += batchSize) {
      const batch = filesToVerify.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file) => {
        try {
          // Add timeout to file access to prevent hanging
          await Promise.race([
            fs.access(file.filePath),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('File access timeout')), 2000)
            )
          ]);
          return { file, valid: true };
        } catch {
          // File doesn't exist or access timed out, mark for removal
          return { file, valid: false };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result.valid) {
          validFiles.push(result.file);
        } else {
          filesToRemove.push(result.file.filePath);
        }
      }
    }

    // Clean up missing files from database in batches
    const dbBatchSize = 100;
    for (let i = 0; i < filesToRemove.length; i += dbBatchSize) {
      const dbBatch = filesToRemove.slice(i, i + dbBatchSize);
      for (const filePath of dbBatch) {
        this.db.removeDiscoveredFile(filePath);
      }
      // Small delay to avoid overwhelming the database
      if (i + dbBatchSize < filesToRemove.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    if (filesToRemove.length > 0) {
      this.logger.log(`Cleaned up ${filesToRemove.length} missing discovered file(s)`);
    }

    this.logger.log(`File verification completed. Valid files: ${validFiles.length}, removed: ${filesToRemove.length}`);
    return validFiles;
  }

  // Verify organized files exist and clean up missing ones
  private async verifyAndCleanOrganizedFiles(files: FileRecord[]): Promise<FileRecord[]> {
    const validFiles: FileRecord[] = [];
    const filesToRemove: string[] = [];

    for (const file of files) {
      try {
        await fs.access(file.currentPath);
        validFiles.push(file);
      } catch {
        // File doesn't exist, mark for removal
        filesToRemove.push(file.id);
      }
    }

    // Clean up missing files from database
    for (const fileId of filesToRemove) {
      this.db.deleteFile(fileId);
    }

    if (filesToRemove.length > 0) {
      this.logger.log(`Cleaned up ${filesToRemove.length} missing organized file(s)`);
    }

    return validFiles;
  }

  private async toggleFileView(): Promise<void> {
    if (this.currentView === 'discovered') {
      // Toggle between organized and unorganized files
      this.showOrganized = !this.showOrganized;
    } else {
      // Switch to discovered view
      this.currentView = 'discovered';
    }
    this.selectedFileIndex = 0;
    await this.loadFiles();
  }

  private updateFileList(): void {
    let items: string[] = [];
    let label = '';

    if (this.currentView === 'discovered') {
      // Group files by directory
      const filesByDir = new Map<string, DiscoveredFile[]>();
      this.discoveredFiles.forEach(file => {
        const dir = path.dirname(file.filePath);
        if (!filesByDir.has(dir)) {
          filesByDir.set(dir, []);
        }
        filesByDir.get(dir)!.push(file);
      });

      // Sort directories
      const sortedDirs = Array.from(filesByDir.keys()).sort();

      // Create display items
      sortedDirs.forEach(dir => {
        const folderName = path.basename(dir) || dir;
        const isExpanded = this.expandedFolders.has(dir);
        const expandIcon = isExpanded ? '▼' : '▶';
        const selected = items.length === this.selectedFileIndex ? '>' : ' ';

        // Get all files in this directory (excluding placeholders)
        const allFiles = filesByDir.get(dir)!;
        const realFiles = allFiles.filter(f => !f.fileName.startsWith('.folder-placeholder'));
        const fileCount = realFiles.length;
        
        // Add folder header
        const countText = fileCount === 0 ? 'not indexed' : `${fileCount} file${fileCount === 1 ? '' : 's'}`;
        items.push(`${selected} ${expandIcon} 📁 ${folderName}/ (${countText})`);

        // Add files if folder is expanded
        if (isExpanded) {
          if (realFiles.length === 0) {
            // Show a message that folder needs to be indexed
            const infoSelected = items.length === this.selectedFileIndex ? '>' : ' ';
            const indent = '    ';
            items.push(`${infoSelected} ${indent}💡 Press Enter on folder to index contents`);
          } else {
            const files = realFiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
            files.forEach(file => {
              const fileSelected = items.length === this.selectedFileIndex ? '>' : ' ';
              const timeAgo = this.getTimeAgo(file.lastChecked);
              const status = file.organizationStatus === 'organized' ? '✅' : '📋';
              const indent = '    '; // Indent files under folders
              items.push(`${fileSelected} ${indent}${status} ${file.fileName} (${timeAgo})`);
            });
          }
        }
      });

      const statusText = this.showOrganized ? 'Organized' : 'Unorganized';
      const realFileCount = this.discoveredFiles.filter(f => !f.fileName.startsWith('.folder-placeholder')).length;
      label = realFileCount === 0
        ? ` 📁 ${statusText} Files - Press Enter on folders to discover`
        : ` 📁 ${statusText} Files (${realFileCount}) `;
    } else {
      items = this.files.map((file, index) => {
        const timeAgo = this.getTimeAgo(file.updatedAt);
        const selected = index === this.selectedFileIndex ? '>' : ' ';
        return `${selected} ${file.title} (${timeAgo})`;
      });

      label = this.files.length === 0
        ? ' 📁 No organized files found'
        : ` 📁 Organized Files (${this.files.length}) `;
    }

    if (items.length === 0) {
      this.leftPanel.setItems([` 📭 No files found`]);
    } else {
      this.leftPanel.setItems(items);
    }

    this.leftPanel.setLabel(label);
    this.screen.render();
  }

  private updateRightPanel(): void {
    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (!item) {
        this.rightPanel.setContent('\n\n  📭 No items found\n\n  Use F8 to toggle between organized/unorganized\n  Press F7 to search');
        this.rightPanel.setLabel(' 📄 No Selection ');
        return;
      }

      if (item.type === 'folder') {
        const folder = item.data;
        const isExpanded = this.expandedFolders.has(folder.path);

        // Count files in this folder (excluding placeholders)
        const allFolderFiles = this.discoveredFiles.filter(f => path.dirname(f.filePath) === folder.path);
        const folderFiles = allFolderFiles.filter(f => !f.fileName.startsWith('.folder-placeholder'));
        const organizedCount = folderFiles.filter(f => f.organizationStatus === 'organized').length;
        const unorganizedCount = folderFiles.filter(f => f.organizationStatus === 'unorganized').length;
        const isIndexed = folderFiles.length > 0;

        let content = `${blue('📁 FOLDER DETAILS')}\n`;
        content += '='.repeat(50) + '\n\n';

        content += `${blue('Basic Information:')}\n`;
        content += `Name: ${folder.name}\n`;
        content += `Path: ${folder.path}\n`;
        content += `Status: ${isExpanded ? 'Expanded' : 'Collapsed'}\n`;
        content += `Indexed: ${isIndexed ? 'Yes' : 'No'}\n`;
        if (isIndexed) {
          content += `Total Files: ${folderFiles.length}\n`;
          content += `Organized: ${organizedCount}\n`;
          content += `Unorganized: ${unorganizedCount}\n`;
        }
        content += '\n';

        content += `${yellow('Commands:')}\n`;
        if (!isIndexed) {
          content += `Press Enter to index this folder and discover files\n`;
        } else {
          content += `Press Enter to ${isExpanded ? 'collapse' : 'expand'} this folder\n`;
          if (isExpanded) {
            content += 'Select files below and press Enter to organize\n';
          }
        }
        content += 'Press F8 to toggle organized/unorganized view\n';

        this.rightPanel.setContent(content);
        this.rightPanel.setLabel(` 📁 ${folder.name} `);
      } else {
        const file = item.data as DiscoveredFile;
        this.showDiscoveredFileDetails(file);
      }
    } else {
      if (this.files.length === 0 || this.selectedFileIndex >= this.files.length) {
        this.rightPanel.setContent('\n\n  📭 No file selected\n\n  Use arrow keys to select a file\n  Press F2 to view details\n  Press F3 to edit\n  Press F7 to search\n  Press F8 to toggle view');
        this.rightPanel.setLabel(' 📄 No Selection ');
        return;
      }

      const file = this.files[this.selectedFileIndex];

      if (this.currentView === 'details') {
        this.showFileDetails(file);
      } else if (this.currentView === 'edit') {
        this.showEditForm(file);
      } else if (this.currentView === 'search') {
        this.showSearchResults();
      } else {
        this.showFileSummary(file);
      }
    }

    this.screen.render();
  }

  private showFileSummary(file: FileRecord): void {
    const timeAgo = this.getTimeAgo(file.updatedAt);
    const versions = this.db.getFileVersions(file.id);

    let content = `${blue('📄 Title:')} ${file.title}\n`;
    content += `${blue('📂 Path:')} ${file.currentPath}\n`;
    content += `${blue('🏷️ Category:')} ${file.category}\n`;
    content += `${blue('🏷️ Tags:')} ${file.tags.join(', ')}\n`;
    content += `${blue('📝 Summary:')} ${file.summary}\n`;
    content += `${blue('🤖 AI Provider:')} ${file.aiProvider} (${file.aiModel})\n`;
    content += `${blue('📅 Updated:')} ${timeAgo}\n`;
    content += `${blue('🔢 Version:')} ${file.version}`;
    if (versions.length > 1) {
      content += ` (${versions.length} total versions)`;
    }
    content += '\n';
    content += `${blue('🎨 Template:')} ${file.templateName}\n`;
    if (file.backupPath) {
      content += `${blue('💾 Backup:')} Available\n`;
    }
    content += '\n';

    content += `${yellow('Commands:')}\n`;
    content += 'F2 - View full details\n';
    content += 'F3 - Edit file\n';
    if (file.backupPath) {
      content += 'F4 - Restore to original location\n';
    }
    if (versions.length > 1) {
      content += 'F5 - Revert to previous version\n';
    }
    content += 'F6 - Re-analyze with AI\n';
    content += 'F7 - Search files\n';
    content += 'F8 - Delete file\n';
    content += ': - Command mode\n';

    this.rightPanel.setContent(content);
    this.rightPanel.setLabel(` 📄 ${file.title} `);
  }

  private showFileDetails(file: FileRecord): void {
    const versions = this.db.getFileVersions(file.id);

    let content = `${blue('📄 FILE DETAILS')}\n`;
    content += '='.repeat(50) + '\n\n';

    content += `${blue('Basic Information:')}\n`;
    content += `Title: ${file.title}\n`;
    content += `Path: ${file.currentPath}\n`;
    content += `Original: ${file.originalPath}\n`;
    content += `Category: ${file.category}\n`;
    content += `Tags: ${file.tags.join(', ')}\n`;
    content += `Summary: ${file.summary}\n\n`;

    content += `${blue('Metadata:')}\n`;
    content += `AI Provider: ${file.aiProvider}\n`;
    content += `AI Model: ${file.aiModel}\n`;
    content += `Template: ${file.templateName}\n`;
    content += `Version: ${file.version}\n`;
    content += `Created: ${file.createdAt.toLocaleString()}\n`;
    content += `Updated: ${file.updatedAt.toLocaleString()}\n\n`;

    if (versions.length > 1) {
      content += `${blue('Version History:')}\n`;
      versions.slice().reverse().forEach(version => {
        content += `v${version.version}: ${version.title} (${version.createdAt.toLocaleString()})\n`;
      });
    }

    this.rightPanel.setContent(content);
    this.rightPanel.setLabel(` 📄 Details: ${file.title} `);
  }

  private updateStatusBar(): void {
    const stats = this.db.getStats();
    const discoveredStats = this.db.getDiscoveredStats();

    let fileInfo = '';
    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      const statusText = this.showOrganized ? 'Organized' : 'Unorganized';
      const totalDisplayItems = this.getTotalDisplayItems();
      if (item) {
        if (item.type === 'folder') {
          fileInfo = `${item.data.name}/ (${this.selectedFileIndex + 1}/${totalDisplayItems})`;
        } else {
          const file = item.data as DiscoveredFile;
          fileInfo = `${file.fileName} (${this.selectedFileIndex + 1}/${totalDisplayItems})`;
        }
      } else {
        fileInfo = `No selection (${this.selectedFileIndex + 1}/${totalDisplayItems})`;
      }
      this.statusBar.setContent(` Organized: ${discoveredStats.organizedCount} | Unorganized: ${discoveredStats.unorganizedCount} | ${statusText} View | ${fileInfo} | F1 Help | F10 Quit `);
    } else {
      const file = this.files[this.selectedFileIndex];
      fileInfo = file ? `${file.title} (${this.selectedFileIndex + 1}/${this.files.length})` : 'No files';
      this.statusBar.setContent(` Files: ${stats.totalFiles} | Versions: ${stats.totalVersions} | ${fileInfo} | F1 Help | F10 Quit `);
    }
  }

  private getTotalDisplayItems(): number {
    if (this.currentView === 'discovered') {
      // Group files by directory
      const filesByDir = new Map<string, DiscoveredFile[]>();
      this.discoveredFiles.forEach(file => {
        const dir = path.dirname(file.filePath);
        if (!filesByDir.has(dir)) {
          filesByDir.set(dir, []);
        }
        filesByDir.get(dir)!.push(file);
      });

      let totalItems = 0;
      filesByDir.forEach((files, dir) => {
        totalItems++; // Folder header
        if (this.expandedFolders.has(dir)) {
          totalItems += files.length; // Files if expanded
        }
      });
      return totalItems;
    } else {
      return this.files.length;
    }
  }

  private getItemAtDisplayIndex(displayIndex: number): { type: 'folder' | 'file', data: any } | null {
    if (this.currentView === 'discovered') {
      // Group files by directory
      const filesByDir = new Map<string, DiscoveredFile[]>();
      this.discoveredFiles.forEach(file => {
        const dir = path.dirname(file.filePath);
        if (!filesByDir.has(dir)) {
          filesByDir.set(dir, []);
        }
        filesByDir.get(dir)!.push(file);
      });

      // Sort directories
      const sortedDirs = Array.from(filesByDir.keys()).sort();

      let currentIndex = 0;
      for (const dir of sortedDirs) {
        // Check if this is the folder header
        if (currentIndex === displayIndex) {
          return { type: 'folder', data: { path: dir, name: path.basename(dir) || dir } };
        }
        currentIndex++;

        // Check files if folder is expanded
        if (this.expandedFolders.has(dir)) {
          const files = filesByDir.get(dir)!.sort((a, b) => a.fileName.localeCompare(b.fileName));
          for (const file of files) {
            if (currentIndex === displayIndex) {
              return { type: 'file', data: file };
            }
            currentIndex++;
          }
        }
      }
    } else {
      return this.files[displayIndex] ? { type: 'file', data: this.files[displayIndex] } : null;
    }
    return null;
  }

  private moveSelection(delta: number): void {
    const totalItems = this.getTotalDisplayItems();
    if (totalItems === 0) return;

    // Calculate new index with bounds checking
    const newIndex = Math.max(0, Math.min(totalItems - 1, this.selectedFileIndex + delta));

    // Only update if the index actually changed
    if (newIndex !== this.selectedFileIndex) {
      this.selectedFileIndex = newIndex;
      this.leftPanel.select(this.selectedFileIndex);
      this.updateRightPanel();
      this.updateStatusBar();
      this.screen.render();
    }
  }

  private showDiscoveredFileDetails(file: DiscoveredFile): void {
    const timeAgo = this.getTimeAgo(file.lastChecked);

    let content = `${blue('📄 FILE DETAILS')}\n`;
    content += '='.repeat(50) + '\n\n';

    content += `${blue('Basic Information:')}\n`;
    content += `Name: ${file.fileName}\n`;
    content += `Path: ${file.filePath}\n`;
    content += `Status: ${file.organizationStatus === 'organized' ? '✅ Organized' : '📋 Unorganized'}\n`;
    content += `Discovered: ${file.discoveredAt.toLocaleString()}\n`;
    content += `Last Checked: ${file.lastChecked.toLocaleString()}\n`;

    if (file.fileSize) {
      content += `Size: ${this.formatFileSize(file.fileSize)}\n`;
    }

    if (file.fileModified) {
      content += `Modified: ${file.fileModified.toLocaleString()}\n`;
    }

    if (file.templateId) {
      content += `Template: ${file.templateId}\n`;
    }

    content += '\n';

    // Show metadata if available (loaded asynchronously)
    FileMetadataManager.getAIFilesMetadata(file.filePath).then(metadata => {
      if (metadata) {
        let metadataContent = `${blue('AIFiles Metadata:')}\n`;
        metadataContent += `Organized At: ${new Date(metadata.organizedAt).toLocaleString()}\n`;
        if (metadata.templateId) {
          metadataContent += `Template: ${metadata.templateId}\n`;
        }
        if (metadata.fileId) {
          metadataContent += `File ID: ${metadata.fileId}\n`;
        }
        metadataContent += '\n';

        // Update the panel content with metadata
        const currentContent = this.rightPanel.getContent();
        if (currentContent.includes(file.fileName)) {
          // Only update if we're still viewing the same file
          const updatedContent = currentContent.replace(
            `${yellow('Commands:')}`,
            `${metadataContent}${yellow('Commands:')}`
          );
          this.rightPanel.setContent(updatedContent);
          this.screen.render();
        }
      }
    }).catch(() => {
      // Ignore metadata read errors
    });

    content += `${yellow('Commands:')}\n`;
    if (file.organizationStatus === 'organized') {
      content += 'F4 - Restore to original location\n';
    } else {
      content += 'Organize this file with: aifiles "' + file.filePath + '"\n';
    }
    content += 'F7 - Search files\n';
    content += 'F8 - Toggle organized/unorganized view\n';

    this.rightPanel.setContent(content);
    this.rightPanel.setLabel(` 📄 ${file.fileName} `);
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private selectFile(index: number): void {
    const totalItems = this.getTotalDisplayItems();
    if (index >= 0 && index < totalItems) {
      this.selectedFileIndex = index;
      this.leftPanel.select(index);
      this.updateRightPanel();
      this.updateStatusBar();
      this.screen.render();
    }
  }

  private showHelp(): void {
    const helpContent = `
${blue('AIFiles Manager - Help')}
${'='.repeat(50)}

${yellow('Navigation:')}
  ↑/↓ or j/k    - Move selection
  PageUp/PageDown - Move by page
  Home/End      - First/Last item
  Enter         - Expand folder / organize file

${yellow('Actions:')}
  F1            - Show this help
  F2            - View file details
  F3            - Edit file organization
  F4            - Restore file to original location
  F5            - Revert to previous version
  F6            - Re-analyze file with AI
  F7            - Search files
  F8            - Toggle organized/unorganized view
  F9            - Show menu
  F10           - Quit

${yellow('Commands (press : to enter command mode):')}
  :q, :quit     - Quit
  :view         - View current file
  :edit         - Edit current file
  :restore      - Restore file to original location
  :revert       - Revert to previous version
  :reanalyze    - Re-analyze file with AI
  :search       - Search mode
  :delete       - Delete current file
  :stats        - Show statistics

${yellow('Tips:')}
  • Press Enter on folders to expand/collapse and index contents
  • Files are organized by AI analysis with automatic backups
  • Use F3 to edit titles, categories, and summaries
  • Use F4 to restore files to their original locations
  • Use F5 to revert metadata to previous versions
  • Use F6 to re-analyze files with different AI prompts
  • Use F8 to toggle between organized/unorganized file views
  • Search helps find files by content
  • Version history tracks all changes
  • Missing files are automatically removed from the database

${yellow('Configuration (~/.aifiles/config):')}
  FILE_MANAGER_INDEX_MODE=launch    - Index all files at startup
  FILE_MANAGER_INDEX_MODE=on-demand - Index folders when expanded (default)
  ORGANIZATION_TIMEOUT=180          - AI analysis timeout in seconds (default: 180)

${yellow('LLM Prompts - Actual prompts sent to AI (~/.aifiles/config):')}
  ORGANIZATION_PROMPT_TEMPLATE="..." - Master prompt wrapping field definitions
      Placeholders: {fileName}, {fileContent}, {mimeType}, {additionalPrompts}
      {additionalPrompts} = field definitions from fields.json
      Automatically appends: "Respond only with valid JSON containing exactly these fields: 
      [field_list]. Do not write an introduction or summary."
  REANALYZE_PROMPT="..."            - Prompt for F6 reanalysis
  WATCH_MODE_PROMPT="..."           - Prompt for watch mode
  IMAGE_CAPTION_PROMPT="..."        - Prompt for image analysis (vision AI)

${yellow('Field Definitions - What to extract (~/.aifiles/fields.json):')}
  NOT actual prompts, but instructions for what data to extract
  100+ fields: file_title, music_artist, picture_date_taken, etc.
  REQUIRED FIELDS (must be present and non-empty):
            • internal_file_title: Descriptive title for the file
            • llm_category_1: LLM-suggested primary category (work/personal/project/etc.)
            • internal_file_summary: Brief summary of file contents
            • internal_file_tags: Keywords/tags as comma-separated string
  Optional fields for music, pictures, videos, documents, archives, etc.

${yellow('Debug Log:')}
  Log file: ${this.logger.getLogPath()}
`;

    this.rightPanel.setContent(helpContent);
    this.rightPanel.setLabel(' ❓ Help ');
    this.screen.render();
  }

  private async handleEnter(): Promise<void> {
    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (!item) {
        throw new Error('No item selected');
      }

      if (item.type === 'folder') {
        // Toggle expand/collapse for folder
        const folderPath = item.data.path;
        const wasExpanded = this.expandedFolders.has(folderPath);

        if (wasExpanded) {
          // Collapse folder
          this.expandedFolders.delete(folderPath);
        } else {
          // Expand folder and re-index its contents
          this.expandedFolders.add(folderPath);
          // Re-index folder contents to ensure we have latest file list
          await this.indexFolderContents(folderPath);
        }

        // Update UI
        this.updateFileList();
        this.updateRightPanel();
        this.updateStatusBar();
        this.screen.render();
      } else if (item.type === 'file') {
        const file = item.data as DiscoveredFile;
        if (file.organizationStatus === 'unorganized') {
          this.promptOrganizeFile(file);
        } else {
          this.viewDiscoveredFile();
        }
      }
    } else {
      // In organized view, do nothing when pressing Enter on files (for now)
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (item && item.type === 'file') {
        // Do nothing for files in organized view
        return;
      }
      this.viewFile();
    }
  }

  // Re-index contents of a specific folder
  private async indexFolderContents(folderPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);

        // Skip hidden files
        if (entry.name.startsWith('.')) continue;

        // Only process files (depth 1)
        if (entry.isFile()) {
          try {
            // Get file stats
            const stats = await fs.stat(fullPath);

            // Check if file is already tracked in organized files
            const existingFile = this.db.getFileByPath(fullPath);
            if (existingFile) {
              // File is organized, ensure it's in discovered files
              this.db.recordDiscoveredFile({
                filePath: fullPath,
                fileName: entry.name,
                organizationStatus: 'organized',
                fileSize: stats.size,
                fileModified: stats.mtime,
                templateId: existingFile.templateId,
              });
            } else {
              // Check if file has AIFiles metadata
              const hasMetadata = await FileMetadataManager.hasAIFilesMetadata(fullPath);
              this.db.recordDiscoveredFile({
                filePath: fullPath,
                fileName: entry.name,
                organizationStatus: hasMetadata ? 'organized' : 'unorganized',
                fileSize: stats.size,
                fileModified: stats.mtime,
              });
            }
          } catch (fileError) {
            // Skip files we can't stat
          }
        }
      }

      // Refresh the discovered files list from database
      const allDiscoveredFiles = this.showOrganized
        ? this.db.getDiscoveredFilesByStatus('organized', 1000)
        : this.db.getDiscoveredFilesByStatus('unorganized', 1000);
      
      // Verify and filter
      this.discoveredFiles = await this.verifyAndCleanDiscoveredFiles(allDiscoveredFiles);
      
      // Add placeholders for other folders to keep them visible
      await this.addConfiguredFolderPlaceholders();
      
      // Sort
      this.discoveredFiles.sort((a, b) => {
        const dirA = path.dirname(a.filePath);
        const dirB = path.dirname(b.filePath);
        if (dirA !== dirB) {
          return dirA.localeCompare(dirB);
        }
        return a.fileName.localeCompare(b.fileName);
      });

    } catch (error) {
      // Log error for debugging but don't break the UI
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to index folder "${folderPath}":`, errorMsg);
      // Re-throw with better context
      throw new Error(`Cannot access folder "${folderPath}": ${errorMsg}`);
    }
  }

  private viewFile(): void {
    this.currentView = 'details';
    this.updateRightPanel();
  }

  private viewDiscoveredFile(): void {
    this.currentView = 'details';
    this.updateRightPanel();
  }

  private promptOrganizeFile(file: DiscoveredFile): void {
    // Mark dialog as open
    this.dialogOpen = true;
    
    // Disable screen-level keys that conflict with dialog
    this.disableScreenKeys();

    // Create confirmation dialog
    const confirmBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 12,
      border: 'line',
      label: ' 🤖 Organize File ',
      style: {
        border: { fg: 'green' },
        bg: 'black',
      },
      keys: true,
      vi: false,
      grabKeys: true,
      input: true,
      focusable: true,
    });

    const message = blessed.text({
      parent: confirmBox,
      top: 1,
      left: 1,
      width: '95%',
      height: 5,
      content: `Organize "${file.fileName}"?\n\nThis will analyze the file with AI and move it to an appropriate location based on its content.\n\nUse Tab/←→ to navigate, Enter to select, Esc to cancel.`,
      style: { fg: 'white' },
    });

    const organizeButton = blessed.button({
      parent: confirmBox,
      bottom: 1,
      left: 2,
      width: 12,
      height: 3,
      content: ' Organize ',
      align: 'center',
      shrink: true,
      padding: {
        left: 1,
        right: 1,
      },
      style: {
        bg: 'green',
        fg: 'white',
        bold: true,
        focus: {
          bg: 'lightgreen',
          fg: 'black',
          bold: true,
        },
      },
      keys: true,
      mouse: true,
      focusable: true,
      clickable: true,
    });

    const cancelButton = blessed.button({
      parent: confirmBox,
      bottom: 1,
      left: 17,
      width: 10,
      height: 3,
      content: ' Cancel ',
      align: 'center',
      shrink: true,
      padding: {
        left: 1,
        right: 1,
      },
      style: {
        bg: 'blue',
        fg: 'white',
        focus: {
          bg: 'lightblue',
          fg: 'black',
          bold: true,
        },
      },
      keys: true,
      mouse: true,
      focusable: true,
      clickable: true,
    });

    // Track focused button
    let currentFocus: 'organize' | 'cancel' = 'organize';

    // Update button visual state
    const updateButtonStyles = () => {
      if (currentFocus === 'organize') {
        organizeButton.style.bg = 'lightgreen';
        organizeButton.style.fg = 'black';
        cancelButton.style.bg = 'blue';
        cancelButton.style.fg = 'white';
      } else {
        organizeButton.style.bg = 'green';
        organizeButton.style.fg = 'white';
        cancelButton.style.bg = 'lightblue';
        cancelButton.style.fg = 'black';
      }
      this.screen.render();
    };

    // Close dialog handler
    const closeDialog = () => {
      this.dialogOpen = false;
      confirmBox.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    };

    // Organize action handler
    const performOrganize = () => {
      this.dialogOpen = false;
      confirmBox.destroy();
      this.restoreKeyHandlers();
      this.organizeSelectedFile(file);
      this.leftPanel.focus();
      this.screen.render();
    };

    // Create handler that will be cleaned up
    const handleTab = () => {
      currentFocus = currentFocus === 'organize' ? 'cancel' : 'organize';
      updateButtonStyles();
    };

    const handleShiftTab = () => {
      currentFocus = currentFocus === 'cancel' ? 'organize' : 'cancel';
      updateButtonStyles();
    };

    const handleEnter = () => {
      if (currentFocus === 'organize') {
        performOrganize();
      } else {
        closeDialog();
      }
    };

    const handleEscape = () => {
      closeDialog();
    };

    // Tab navigation
    confirmBox.key('tab', handleTab);
    confirmBox.key('right', handleTab);
    confirmBox.key('S-tab', handleShiftTab);
    confirmBox.key('left', handleShiftTab);

    // Enter key
    confirmBox.key('enter', handleEnter);
    confirmBox.key('return', handleEnter);

    // Escape key
    confirmBox.key('escape', handleEscape);

    // Mouse click handlers
    organizeButton.on('press', () => {
      performOrganize();
    });

    cancelButton.on('press', () => {
      closeDialog();
    });

    // Focus the dialog and set initial state
    confirmBox.setFront();  // Ensure dialog is on top
    updateButtonStyles();
    
    // Blur leftPanel explicitly
    try {
      // @ts-ignore - blessed types don't have blur but it exists
      this.leftPanel.blur?.();
    } catch (e) {
      // Ignore errors
    }
    
    // Force render first
    this.screen.render();
    
    // Focus after render with slight delay
    setImmediate(() => {
      confirmBox.focus();
      this.screen.render();
    });
  }

  private disableScreenKeys(): void {
    // Temporarily disable screen-level key handlers when dialog is open
    // The dialogOpen flag will prevent screen handlers from firing
    // This method is here for future expansion if needed
  }

  private restoreKeyHandlers(): void {
    // Nothing to do - handlers are set up once and dialogOpen flag controls them
    // We don't re-setup handlers to avoid duplicate bindings
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      const platform = os.platform();
      let command: string;

      if (platform === 'darwin') {
        // macOS
        command = 'pbcopy';
      } else if (platform === 'win32') {
        // Windows
        command = 'clip';
      } else {
        // Linux - try xclip first, fall back to xsel
        try {
          await execAsync('which xclip');
          command = 'xclip -selection clipboard';
        } catch {
          try {
            await execAsync('which xsel');
            command = 'xsel --clipboard --input';
          } catch {
            throw new Error('No clipboard utility found. Install xclip or xsel.');
          }
        }
      }

      // Execute the clipboard command
      const child = exec(command);
      if (child.stdin) {
        child.stdin.write(text);
        child.stdin.end();
      }

      await new Promise((resolve, reject) => {
        child.on('exit', (code) => {
          if (code === 0) {
            resolve(undefined);
          } else {
            reject(new Error(`Clipboard command failed with code ${code}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to copy to clipboard: ${error}`);
    }
  }

  private async organizeSelectedFile(file: DiscoveredFile): Promise<void> {
    try {
      // Get configuration including timeout
      const config = await getConfig();
      const timeoutMs = (config.ORGANIZATION_TIMEOUT || 180) * 1000; // Default 180 seconds (3 minutes)
      
      // Show progress
      const progressBox = blessed.box({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: '60%',
        height: 10,
        border: 'line',
        label: ' 🤖 Organizing File ',
        style: {
          border: { fg: 'yellow' },
          bg: 'black',
        },
        keys: true,
        vi: false,
        grabKeys: true,
        input: true,
        focusable: true,
      });

      const progressText = blessed.text({
        parent: progressBox,
        top: 1,
        left: 1,
        width: '95%',
        content: `Analyzing "${file.fileName}" with AI...\nThis may take a moment.\n\nPress Escape or C to cancel`,
        style: { fg: 'white' },
      });

      const cancelButton = blessed.button({
        parent: progressBox,
        bottom: 1,
        left: 'center',
        width: 12,
        height: 3,
        content: ' Cancel ',
        align: 'center',
        style: {
          bg: 'red',
          fg: 'white',
          focus: { bg: 'darkred', fg: 'white', bold: true },
        },
        keys: true,
        mouse: true,
        focusable: true,
        clickable: true,
      });

      let cancelled = false;
      let timeoutId: NodeJS.Timeout;
      let progressInterval: NodeJS.Timeout;

      progressBox.setFront();
      this.screen.render();

      // Call the CLI organization logic using the aifiles command
      const { spawn } = await import('child_process');

      // Use the aifiles command directly (works if installed globally or via npm link)
      // If running from source, use node with correct path to dist/cli.mjs
      let command: string;
      let args: string[];
      
      try {
        // Try to find aifiles in PATH (works if installed globally)
        await execAsync('which aifiles');
        command = 'aifiles';
        args = [file.filePath];
      } catch {
        // Fall back to running from local installation
        // When compiled, __dirname points to dist/ folder
        // So cli.mjs should be in the same directory
        const cliPath = path.join(__dirname, 'cli.mjs');
        
        command = 'node';
        args = [cliPath, file.filePath];
      }

      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const startTime = Date.now();
      let progressStage = 'Starting...';
      
      // Update progress text with realtime status
      const updateProgress = (stage: string) => {
        progressStage = stage;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        progressText.setContent(
          `${stage}\n\n` +
          `File: "${file.fileName}"\n` +
          `Elapsed: ${elapsed}s\n\n` +
          `Press Escape or C to cancel`
        );
        this.screen.render();
      };
      
      // Initialize progress
      updateProgress('🚀 Starting file organization...');
      
      // Cancel handler
      const cancelOperation = () => {
        if (!cancelled) {
          cancelled = true;
          clearTimeout(timeoutId);
          clearInterval(progressInterval);
          
          // Kill the child process
          try {
            child.kill('SIGTERM');
            // Force kill after 1 second if still running
            setTimeout(() => {
              if (!child.killed) {
                child.kill('SIGKILL');
              }
            }, 1000);
          } catch (e) {
            this.logger.error('Failed to kill child process:', e);
          }
          
          progressBox.destroy();
          this.showCommandError(`Operation cancelled for "${file.fileName}"`);
          this.leftPanel.focus();
          this.screen.render();
        }
      };

      // Set timeout from config (default 3 minutes)
      const timeoutSeconds = Math.floor(timeoutMs / 1000);
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          cancelled = true;
          clearInterval(progressInterval);
          
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 1000);
          
          progressBox.destroy();
          this.showCommandError(`Operation timed out for "${file.fileName}"\n\nThe AI analysis took too long (>${timeoutSeconds}s).\n\nLast status: ${progressStage}\n\nCheck your AI server connection and configuration.`);
          this.leftPanel.focus();
          this.screen.render();
        }
      }, timeoutMs);

      // Bind cancel keys
      progressBox.key(['escape', 'c', 'C'], cancelOperation);
      cancelButton.on('press', cancelOperation);

      // Focus the progress box so it can receive key events
      setImmediate(() => {
        progressBox.focus();
        this.screen.render();
      });
      
      // Update progress text periodically
      progressInterval = setInterval(() => {
        if (!cancelled) {
          updateProgress(progressStage);
        }
      }, 1000);
      
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        
        // Parse output for status updates
        if (text.includes('Detecting file')) {
          updateProgress('🔍 Detecting file type...');
        } else if (text.includes('ready for analysis')) {
          updateProgress('✅ File detected, connecting to AI...');
        } else if (text.includes('AI is analyzing')) {
          updateProgress('🤖 AI is analyzing your file...');
        } else if (text.includes('File analyzed')) {
          updateProgress('✅ Analysis complete, organizing...');
        }
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        
        // Check for connection-related messages
        if (text.includes('connect') || text.includes('request')) {
          updateProgress('🌐 Connecting to AI server...');
        }
      });

      child.on('close', async (code) => {
        // Clear timeout and cleanup
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        
        // If already cancelled, don't process results
        if (cancelled) {
          return;
        }
        
        progressBox.destroy();

        // Strip ANSI escape codes and spinner output
        const cleanOutput = (text: string) => {
          return text
            // Remove ANSI escape codes (including ESC[)
            .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
            // Remove cursor positioning codes
            .replace(/\[\?25[lh]/g, '')
            // Remove [999D[J type codes and similar
            .replace(/\[999D\[J/g, '')
            .replace(/\[\d+D\[J/g, '')
            // Remove spinner characters and box drawing
            .replace(/[◐◓◑◒◇│┌└]/g, '')
            // Remove entire lines with spinner/progress messages
            .split('\n')
            .filter(line => {
              const trimmed = line.trim();
              // Filter out progress indicator lines
              if (trimmed.includes('Detecting file:')) return false;
              if (trimmed.includes('The AI is analyzing')) return false;
              if (trimmed.includes('File analyzed!')) return false;
              if (trimmed.includes('ready for analysis')) return false;
              if (trimmed === 'aifiles') return false;
              if (trimmed === '') return false;
              return true;
            })
            .join('\n')
            .trim();
        };

        const cleanStdout = cleanOutput(stdout);
        const cleanStderr = cleanOutput(stderr);
        
        // Check if there's an actual error message (even if code is 0)
        const hasError = cleanStderr.includes('Error:') || cleanStderr.includes('✖') || code !== 0;

        if (!hasError && code === 0) {
          // Success - update the file status and refresh
          this.logger.log(`File organization completed successfully for: ${file.filePath}`);
          console.log('🔄 Updating database status...');
          this.db.updateDiscoveredFileStatus(file.filePath, 'organized');
          console.log('✅ Database updated, starting file list refresh...');

          console.log('🔄 Calling loadFiles()...');
          const startTime = Date.now();
          try {
            await this.loadFiles();
            const duration = Date.now() - startTime;
            console.log(`✅ loadFiles() completed in ${duration}ms`);
            this.logger.log('File list refresh completed');
          } catch (error) {
            console.log('❌ loadFiles() failed:', error);
            throw error;
          }

          // Show success message in status bar temporarily
          const originalStatus = this.statusBar.content;
          this.statusBar.setContent(`${green('✅')} "${file.fileName}" organized successfully!`);

          // Restore normal status after 3 seconds
          setTimeout(() => {
            this.updateStatusBar();
          }, 3000);
        } else {
          // Error - extract the actual error message
          const errorLines = cleanStderr.split('\n').filter(line => 
            line.includes('Error:') || 
            line.includes('✖') ||
            line.includes('Run with --help') ||
            line.trim().length > 0
          );
          
          const errorMessage = errorLines.length > 0 
            ? errorLines.join('\n')
            : cleanStderr || cleanStdout || 'Unknown error occurred';
            
          this.showCommandError(`❌ Failed to organize "${file.fileName}":\n\n${errorMessage}`);
        }

        this.leftPanel.focus();
        this.screen.render();
      });

    } catch (error) {
      this.showCommandError(`❌ Error organizing file: ${error}`);
    }
  }

  private searchMode(): void {
    this.currentView = 'search';
    this.rightPanel.setContent('\n\n  🔍 Search Mode\n\n  Press : to enter search query\n  Type your search terms...\n\n  Searches: title, category, tags, path');
    this.rightPanel.setLabel(' 🔍 Search ');
    this.screen.render();

    // Focus command bar for search input
    this.commandBar.focus();
    this.commandBar.readInput(() => {
      const query = this.commandBar.value;
      if (query) {
        this.performSearch(query);
      }
      this.commandBar.clearValue();
      this.leftPanel.focus();
    });
  }

  private performSearch(query: string): void {
    this.searchQuery = query;
    const results = this.db.searchFiles(query);

    if (results.length === 0) {
      this.rightPanel.setContent(`\n\n  🔍 No results for: "${query}"\n\n  Try different search terms...`);
    } else {
      // Update file list with search results
      this.files = results;
      this.selectedFileIndex = 0;
      this.updateFileList();
      this.currentView = 'list';
      this.rightPanel.setContent(`\n\n  🔍 Found ${results.length} files for: "${query}"\n\n  Use arrow keys to browse results`);
      this.rightPanel.setLabel(` 🔍 Results: "${query}" `);
    }

    this.screen.render();
  }

  private executeCommand(cmd: string): void {
    const command = cmd.toLowerCase().trim();

    switch (command) {
      case 'q':
      case 'quit':
        this.quit();
        break;
      case 'view':
        this.viewFile();
        break;
      case 'edit':
        this.editFile();
        break;
      case 'restore':
        this.restoreFile();
        break;
      case 'revert':
        this.revertFile();
        break;
      case 'reanalyze':
        this.reanalyzeFile();
        break;
      case 'search':
        this.searchMode();
        break;
      case 'delete':
        this.deleteFile();
        break;
      case 'stats':
        this.showStats();
        break;
      case 'help':
        this.showHelp();
        break;
      default:
        if (command.startsWith('search ')) {
          const query = command.substring(7);
          this.performSearch(query);
        } else {
          this.showCommandError(`Unknown command: ${cmd}`);
        }
    }
  }

  private showCommandError(message: string): void {
    // Mark dialog as open
    this.dialogOpen = true;
    
    // Disable screen-level keys that conflict with dialog
    this.disableScreenKeys();

    // Show error in status bar
    this.statusBar.setContent(`${red('Error:')} ${message}`);

    // Save currently focused element
    const previouslyFocused = this.screen.focused;

    // Create error dialog with high z-index and key grabbing
    const errorBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 'shrink',
      border: {
        type: 'line',
      },
      label: ' ❌ Error ',
      style: {
        border: { fg: 'red' },
        bg: 'black',
        fg: 'white',
      },
      keys: true,
      vi: false,
      mouse: true,
      tags: false,
      padding: {
        left: 2,
        right: 2,
        top: 1,
        bottom: 1,
      },
      alwaysScroll: false,
      scrollable: false,
      grabKeys: true,  // Capture all keyboard input
      input: true,
      focusable: true,
    });

    // Add content with proper line breaks
    const lines = message.split('\n');
    const contentText = lines.join('\n');

    const errorText = blessed.text({
      parent: errorBox,
      top: 0,
      left: 0,
      width: '100%-4',
      height: 'shrink',
      content: contentText,
      style: { fg: 'white', bg: 'black' },
      tags: false,
    });

    const helpText = blessed.text({
      parent: errorBox,
      top: lines.length + 1,
      left: 0,
      width: '100%',
      height: 1,
      content: 'Press Enter or Escape to close  |  Press C to copy to clipboard',
      style: { fg: 'cyan', bg: 'black' },
      align: 'center',
      tags: false,
    });

    const closeError = () => {
      // Mark dialog as closed
      this.dialogOpen = false;

      // Remove all event listeners
      errorBox.removeAllListeners();

      // Destroy the error box
      errorBox.destroy();
      
      // Restore key handlers
      this.restoreKeyHandlers();

      // Restore focus to left panel
      this.leftPanel.focus();

      // Update status bar
      setTimeout(() => this.updateStatusBar(), 100);

      // Render screen
      this.screen.render();
    };

    const copyError = async () => {
      try {
        await this.copyToClipboard(message);
        // Update help text to show success
        helpText.setContent('✅ Copied to clipboard!  |  Press Enter or Escape to close');
        this.screen.render();
        
        // Reset help text after 2 seconds
        setTimeout(() => {
          if (!errorBox.detached) {
            helpText.setContent('Press Enter or Escape to close  |  Press C to copy to clipboard');
            this.screen.render();
          }
        }, 2000);
      } catch (error) {
        // Update help text to show error
        helpText.setContent('❌ Failed to copy to clipboard  |  Press Enter or Escape to close');
        this.screen.render();
        this.logger.error('Copy to clipboard failed:', error);
      }
    };

    // Bind keyboard handlers
    errorBox.key(['enter', 'return', 'escape', 'q', 'space'], closeError);
    errorBox.key(['c', 'C'], () => {
      copyError().catch(err => {
        this.logger.error('Copy error handler failed:', err);
      });
    });

    // Bind mouse click
    errorBox.on('click', closeError);

    // Remove focus from leftPanel explicitly
    try {
      // @ts-ignore - blessed types don't have blur but it exists
      this.leftPanel.blur?.();
    } catch (e) {
      // Ignore errors
    }

    // Remove focus from all other elements
    if (previouslyFocused && previouslyFocused !== this.leftPanel) {
      try {
        // @ts-ignore - blessed types don't have blur but it exists
        previouslyFocused.blur?.();
      } catch (e) {
        // Ignore errors
      }
    }

    // Bring error box to front and focus it
    errorBox.setIndex(9999);  // Set very high z-index
    errorBox.setFront();
    
    // Force render first to ensure dialog is displayed
    this.screen.render();
    
    // Focus after render with slight delay to ensure it takes effect
    setImmediate(() => {
      errorBox.focus();
      this.screen.render();
    });
  }

  async showFileList(): Promise<void> {
    // Set initialization flag to suppress logging during startup BEFORE any operations
    this.initializing = true;

    try {
      // Run file indexing on startup to update database with latest files
      await this.indexFilesIfNeeded();

      // Default to discovered view (unorganized files)
      if (this.currentView === 'list') {
        this.currentView = 'discovered';
        await this.loadFiles();
      }
    } finally {
      // Clear initialization flag after startup
      this.initializing = false;
    }

    this.screen.render();

    // Keep the process alive until user quits
    return new Promise(() => {}); // Never resolves until quit() is called
  }

  private editFile(): void {
    // Check which view we're in
    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (!item || item.type !== 'file') {
        this.showCommandError('No file selected');
        return;
      }
      const discoveredFile = item.data as DiscoveredFile;
      if (discoveredFile.organizationStatus !== 'organized') {
        this.showCommandError('File must be organized first');
        return;
      }
      // Get the organized file record
      const organizedFile = this.db.getFileByPath(discoveredFile.filePath);
      if (!organizedFile) {
        this.showCommandError('Could not find organized file record');
        return;
      }
      this.editOrganizedFile(organizedFile);
      return;
    }

    // Regular list view
    if (this.files.length === 0 || this.selectedFileIndex >= this.files.length) {
      this.showCommandError('No file selected');
      return;
    }

    const file = this.files[this.selectedFileIndex];
    this.editOrganizedFile(file);
  }

  private editOrganizedFile(file: FileRecord): void {
    // Mark dialog as open
    this.dialogOpen = true;
    
    // Disable screen-level keys that conflict with dialog
    this.disableScreenKeys();

    // Create edit form
    const form = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '60%',
      border: 'line',
      label: ' ✏️ Edit File Organization ',
      style: {
        border: { fg: 'yellow' },
        bg: 'black',
      },
    });

    // Title input
    const titleInput = blessed.textbox({
      parent: form,
      top: 2,
      left: 2,
      width: '90%',
      height: 3,
      border: 'line',
      label: ' Title ',
      inputOnFocus: true,
      value: file.title,
    });

    // Category input
    const categoryInput = blessed.textbox({
      parent: form,
      top: 6,
      left: 2,
      width: '90%',
      height: 3,
      border: 'line',
      label: ' Category ',
      inputOnFocus: true,
      value: file.category,
    });

    // Summary textarea
    const summaryInput = blessed.textarea({
      parent: form,
      top: 10,
      left: 2,
      width: '90%',
      height: 8,
      border: 'line',
      label: ' Summary ',
      inputOnFocus: true,
      value: file.summary,
      scrollable: true,
      alwaysScroll: true,
    });

    // Buttons
    const saveButton = blessed.button({
      parent: form,
      bottom: 2,
      left: 2,
      width: 10,
      height: 3,
      content: ' Save ',
      style: {
        bg: 'green',
        fg: 'white',
        focus: { bg: 'lightgreen' },
      },
    });

    const cancelButton = blessed.button({
      parent: form,
      bottom: 2,
      left: 15,
      width: 12,
      height: 3,
      content: ' Cancel ',
      style: {
        bg: 'red',
        fg: 'white',
        focus: { bg: 'pink' },
      },
    });

    // Form event handlers
    saveButton.on('press', async () => {
      const newTitle = titleInput.value.trim();
      const newCategory = categoryInput.value.trim();
      const newSummary = summaryInput.value.trim();

      if (!newTitle || !newCategory) {
        this.showCommandError('Title and category are required');
        return;
      }

      // Update file
      this.db.updateFileOrganization(file.id, {
        title: newTitle,
        category: newCategory,
        summary: newSummary,
      });

      // Refresh display
      await this.loadFiles();
      this.currentView = 'list';

      // Close form
      this.dialogOpen = false;
      form.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    });

    cancelButton.on('press', () => {
      this.dialogOpen = false;
      form.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    });

    form.on('cancel', () => {
      this.dialogOpen = false;
      form.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    });

    // Focus management
    // Blur leftPanel explicitly
    try {
      // @ts-ignore - blessed types don't have blur but it exists
      this.leftPanel.blur?.();
    } catch (e) {
      // Ignore errors
    }
    
    // Force render first
    this.screen.render();
    
    // Focus after render with slight delay
    setImmediate(() => {
      titleInput.focus();
      this.screen.render();
    });
  }

  private restoreFile(): void {
    // Check which view we're in
    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (!item || item.type !== 'file') {
        this.showCommandError('No file selected');
        return;
      }
      const discoveredFile = item.data as DiscoveredFile;
      if (discoveredFile.organizationStatus !== 'organized') {
        this.showCommandError('File must be organized first');
        return;
      }
      // Get the organized file record
      const organizedFile = this.db.getFileByPath(discoveredFile.filePath);
      if (!organizedFile) {
        this.showCommandError('Could not find organized file record');
        return;
      }
      this.restoreOrganizedFile(organizedFile);
      return;
    }

    // Regular list view
    if (this.files.length === 0 || this.selectedFileIndex >= this.files.length) {
      this.showCommandError('No file selected');
      return;
    }

    const file = this.files[this.selectedFileIndex];
    this.restoreOrganizedFile(file);
  }

  private restoreOrganizedFile(file: FileRecord): void {
    if (!file.backupPath) {
      this.showCommandError('No backup available for this file');
      return;
    }

    // Mark dialog as open
    this.dialogOpen = true;
    
    // Disable screen-level keys that conflict with dialog
    this.disableScreenKeys();

    // Create confirmation dialog
    const confirmBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 12,
      border: 'line',
      label: ' 🔄 Restore File ',
      style: {
        border: { fg: 'yellow' },
        bg: 'black',
      },
      keys: true,
      vi: false,
      grabKeys: true,
      input: true,
      focusable: true,
    });

    const infoText = blessed.text({
      parent: confirmBox,
      top: 1,
      left: 1,
      width: '95%',
      height: 6,
      content: `File: ${file.title}\nCurrent location: ${file.currentPath}\nOriginal location: ${file.originalPath}\nBackup location: ${file.backupPath}\n\nThis will restore the file to its original location.\n\nUse Tab/←→ to navigate, Enter to select, Esc to cancel.`,
      style: { fg: 'white' },
    });

    const restoreButton = blessed.button({
      parent: confirmBox,
      bottom: 1,
      left: 2,
      width: 10,
      height: 3,
      content: ' Restore ',
      align: 'center',
      style: {
        bg: 'yellow',
        fg: 'black',
        focus: { bg: 'lightyellow' },
      },
      keys: true,
      mouse: true,
    });

    const cancelButton = blessed.button({
      parent: confirmBox,
      bottom: 1,
      left: 15,
      width: 10,
      height: 3,
      content: ' Cancel ',
      align: 'center',
      style: {
        bg: 'blue',
        fg: 'white',
        focus: { bg: 'lightblue' },
      },
      keys: true,
      mouse: true,
    });

    // Track focused button
    let currentFocus: 'restore' | 'cancel' = 'cancel'; // Default to cancel for safety

    // Update button visual state
    const updateButtonStyles = () => {
      if (currentFocus === 'restore') {
        restoreButton.style.bg = 'lightyellow';
        restoreButton.style.fg = 'black';
        cancelButton.style.bg = 'blue';
        cancelButton.style.fg = 'white';
      } else {
        restoreButton.style.bg = 'yellow';
        restoreButton.style.fg = 'black';
        cancelButton.style.bg = 'lightblue';
        cancelButton.style.fg = 'black';
      }
      this.screen.render();
    };

    // Restore action
    const performRestore = async () => {
      try {
        this.dialogOpen = false;
        confirmBox.destroy();
        this.restoreKeyHandlers();

        // Check if backup exists
        await fs.access(file.backupPath!);

        // Create original directory if it doesn't exist
        const originalDir = path.dirname(file.originalPath);
        await fs.mkdir(originalDir, { recursive: true });

        // Copy backup to original location
        await fs.copyFile(file.backupPath!, file.originalPath);

        // Remove AIFiles metadata from restored file
        await FileMetadataManager.removeAIFilesMetadata(file.originalPath);

        // Update database to reflect restoration
        this.db.updateFileOrganization(file.id, {
          currentPath: file.originalPath,
          currentName: file.originalName,
        });

        // Update discovered file status
        this.db.updateDiscoveredFileStatus(file.originalPath, 'unorganized');

        await this.loadFiles();
        this.leftPanel.focus();
        this.screen.render();

        this.showCommandError(`File restored to: ${file.originalPath}`);
      } catch (error) {
        this.showCommandError(`Failed to restore file: ${error}`);
      }
    };

    // Cancel action
    const cancelRestore = () => {
      this.dialogOpen = false;
      confirmBox.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    };

    // Keyboard navigation
    confirmBox.key(['tab', 'right'], () => {
      currentFocus = currentFocus === 'restore' ? 'cancel' : 'restore';
      updateButtonStyles();
    });

    confirmBox.key(['S-tab', 'left'], () => {
      currentFocus = currentFocus === 'cancel' ? 'restore' : 'cancel';
      updateButtonStyles();
    });

    confirmBox.key(['enter', 'return'], async () => {
      if (currentFocus === 'restore') {
        await performRestore();
      } else {
        cancelRestore();
      }
    });

    confirmBox.key(['escape'], () => {
      cancelRestore();
    });

    // Mouse handlers
    restoreButton.on('press', async () => {
      await performRestore();
    });

    cancelButton.on('press', () => {
      cancelRestore();
    });

    // Focus dialog and set initial state (cancel button)
    confirmBox.setFront();  // Ensure dialog is on top
    updateButtonStyles();
    
    // Blur leftPanel explicitly
    try {
      // @ts-ignore - blessed types don't have blur but it exists
      this.leftPanel.blur?.();
    } catch (e) {
      // Ignore errors
    }
    
    // Force render first
    this.screen.render();
    
    // Focus after render with slight delay
    setImmediate(() => {
      confirmBox.focus();
      this.screen.render();
    });
  }

  private revertFile(): void {
    // Get the current file based on view
    let file: FileRecord | null = null;

    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (!item || item.type !== 'file') {
        this.showCommandError('No file selected');
        return;
      }
      const discoveredFile = item.data as DiscoveredFile;
      if (discoveredFile.organizationStatus !== 'organized') {
        this.showCommandError('File must be organized first');
        return;
      }
      file = this.db.getFileByPath(discoveredFile.filePath);
    } else {
      if (this.files.length === 0 || this.selectedFileIndex >= this.files.length) {
        this.showCommandError('No file selected');
        return;
      }
      file = this.files[this.selectedFileIndex];
    }

    if (!file) {
      this.showCommandError('Could not find file record');
      return;
    }

    const versions = this.db.getFileVersions(file.id);

    if (versions.length < 2) {
      this.showCommandError('No previous versions available');
      return;
    }

    // Mark dialog as open
    this.dialogOpen = true;
    
    // Disable screen-level keys that conflict with dialog
    this.disableScreenKeys();

    // Create version selection dialog
    const versionBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '70%',
      border: 'line',
      label: ' ⏪ Select Version to Revert To ',
      style: {
        border: { fg: 'cyan' },
        bg: 'black',
      },
      keys: true,
      vi: false,
      grabKeys: true,
      input: true,
      focusable: true,
    });

    const versionList = blessed.list({
      parent: versionBox,
      top: 1,
      left: 1,
      width: '95%',
      height: '80%',
      border: 'line',
      label: ' Available Versions ',
      style: {
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' },
      },
      keys: true,
      mouse: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'blue' },
      },
    });

    // Get previous versions (excluding current)
    const previousVersions = versions.slice(0, -1).reverse();
    const versionItems = previousVersions.map(version => ({
      name: `v${version.version}: ${version.title}`,
      version: version.version,
      created: version.createdAt.toLocaleString(),
      data: version,
    }));

    versionList.setItems(versionItems.map(v => v.name));

    const revertButton = blessed.button({
      parent: versionBox,
      bottom: 1,
      left: 2,
      width: 10,
      height: 3,
      content: ' Revert ',
      style: {
        bg: 'green',
        fg: 'white',
        focus: { bg: 'lightgreen' },
      },
    });

    const cancelButton = blessed.button({
      parent: versionBox,
      bottom: 1,
      left: 15,
      width: 10,
      height: 3,
      content: ' Cancel ',
      style: {
        bg: 'blue',
        fg: 'white',
        focus: { bg: 'lightblue' },
      },
    });

    let selectedVersionIndex = 0;

    versionList.on('select', (item, index) => {
      selectedVersionIndex = index;
      const version = versionItems[index];
      if (version) {
        // Show version details in a separate area
        const detailsBox = blessed.box({
          parent: versionBox,
          top: '70%',
          left: 1,
          width: '95%',
          height: '15%',
          border: 'line',
          label: ' Version Details ',
          content: `Created: ${version.created}\nTitle: ${version.data.title}\nCategory: ${version.data.category}`,
          style: {
            fg: 'white',
            border: { fg: 'yellow' },
          },
        });
        versionBox.append(detailsBox);
        this.screen.render();
      }
    });

    revertButton.on('press', () => {
      if (selectedVersionIndex >= 0 && selectedVersionIndex < versionItems.length) {
        const selectedVersion = versionItems[selectedVersionIndex];

        // Confirm revert
        const confirmBox = blessed.box({
          parent: this.screen,
          top: 'center',
          left: 'center',
          width: '50%',
          height: 8,
          border: 'line',
          label: ' ⚠️ Confirm Revert ',
          style: {
            border: { fg: 'yellow' },
            bg: 'black',
          },
          keys: true,
          vi: false,
          grabKeys: true,
          input: true,
          focusable: true,
        });

        const confirmText = blessed.text({
          parent: confirmBox,
          top: 1,
          left: 1,
          content: 'Revert to this version?\nThis will create a new version.\n\nUse Tab/←→ to navigate, Enter to select, Esc to cancel',
          style: { fg: 'white' },
        });

        const yesBtn = blessed.button({
          parent: confirmBox,
          bottom: 1,
          left: 2,
          width: 6,
          content: ' Yes ',
          style: { bg: 'red', fg: 'white' },
        });

        const noBtn = blessed.button({
          parent: confirmBox,
          bottom: 1,
          left: 10,
          width: 6,
          content: ' No ',
          style: { bg: 'blue', fg: 'white' },
        });

        // Track focused button
        let currentFocus: 'yes' | 'no' = 'no'; // Default to No for safety

        // Update button visual state
        const updateButtonStyles = () => {
          if (currentFocus === 'yes') {
            yesBtn.style.bg = 'darkred';
            yesBtn.style.fg = 'white';
            noBtn.style.bg = 'blue';
            noBtn.style.fg = 'white';
          } else {
            yesBtn.style.bg = 'red';
            yesBtn.style.fg = 'white';
            noBtn.style.bg = 'lightblue';
            noBtn.style.fg = 'black';
          }
          this.screen.render();
        };

        // Define actions
        const performRevert = async () => {
          // Perform revert
          this.db.updateFileOrganization(file.id, {
            title: selectedVersion.data.title,
            category: selectedVersion.data.category,
            summary: selectedVersion.data.summary,
            tags: JSON.parse(selectedVersion.data.tags),
            aiPrompt: selectedVersion.data.aiPrompt,
            aiResponse: selectedVersion.data.aiResponse,
          });

          // Close all dialogs
          this.dialogOpen = false;
          confirmBox.destroy();
          versionBox.destroy();
          this.restoreKeyHandlers();
          await this.loadFiles();
          this.leftPanel.focus();
          this.screen.render();
        };

        const cancelRevert = () => {
          confirmBox.destroy();
          versionBox.focus();
          this.screen.render();
        };

        // Keyboard navigation
        confirmBox.key(['tab', 'right'], () => {
          currentFocus = currentFocus === 'yes' ? 'no' : 'yes';
          updateButtonStyles();
        });

        confirmBox.key(['S-tab', 'left'], () => {
          currentFocus = currentFocus === 'no' ? 'yes' : 'no';
          updateButtonStyles();
        });

        confirmBox.key(['enter', 'return'], async () => {
          if (currentFocus === 'yes') {
            await performRevert();
          } else {
            cancelRevert();
          }
        });

        confirmBox.key(['escape'], () => {
          cancelRevert();
        });

        // Mouse handlers
        yesBtn.on('press', async () => await performRevert());
        noBtn.on('press', () => cancelRevert());

        // Focus the dialog and set initial state
        confirmBox.setFront();  // Ensure dialog is on top
        updateButtonStyles();
        
        // Blur leftPanel explicitly
        try {
          // @ts-ignore - blessed types don't have blur but it exists
          this.leftPanel.blur?.();
        } catch (e) {
          // Ignore errors
        }
        
        // Force render first
        this.screen.render();
        
        // Focus after render with slight delay
        setImmediate(() => {
          confirmBox.focus();
          this.screen.render();
        });
      }
    });

    cancelButton.on('press', () => {
      this.dialogOpen = false;
      versionBox.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    });

    versionBox.on('cancel', () => {
      this.dialogOpen = false;
      versionBox.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    });

    // Blur leftPanel explicitly
    try {
      // @ts-ignore - blessed types don't have blur but it exists
      this.leftPanel.blur?.();
    } catch (e) {
      // Ignore errors
    }
    
    // Force render first
    this.screen.render();
    
    // Focus after render with slight delay
    setImmediate(() => {
      versionList.focus();
      if (versionItems.length > 0) {
        versionList.select(0);
      }
      this.screen.render();
    });
  }

  private reanalyzeFile(): void {
    // Get the current file based on view
    let file: FileRecord | null = null;

    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (!item || item.type !== 'file') {
        this.showCommandError('No file selected');
        return;
      }
      const discoveredFile = item.data as DiscoveredFile;
      if (discoveredFile.organizationStatus !== 'organized') {
        this.showCommandError('File must be organized first');
        return;
      }
      file = this.db.getFileByPath(discoveredFile.filePath);
    } else {
      if (this.files.length === 0 || this.selectedFileIndex >= this.files.length) {
        this.showCommandError('No file selected');
        return;
      }
      file = this.files[this.selectedFileIndex];
    }

    if (!file) {
      this.showCommandError('Could not find file record');
      return;
    }

    // Mark dialog as open
    this.dialogOpen = true;
    
    // Disable screen-level keys that conflict with dialog
    this.disableScreenKeys();

    // Create reanalyze dialog
    const reanalyzeBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '50%',
      border: 'line',
      label: ' 🔄 Re-analyze File ',
      style: {
        border: { fg: 'green' },
        bg: 'black',
      },
      keys: true,
      vi: false,
      grabKeys: true,
      input: true,
      focusable: true,
    });

    const infoText = blessed.text({
      parent: reanalyzeBox,
      top: 1,
      left: 1,
      width: '95%',
      height: 5,
      content: `File: ${file.title}\nPath: ${file.currentPath}\n\nEnter custom prompt (leave empty for default):\nUse Tab to navigate, Enter to select, Esc to cancel`,
      style: { fg: 'white' },
    });

    const promptInput = blessed.textarea({
      parent: reanalyzeBox,
      top: 7,
      left: 1,
      width: '95%',
      height: 8,
      border: 'line',
      label: ' Custom Prompt ',
      inputOnFocus: true,
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      mouse: true,
      focusable: true,
    });

    const analyzeButton = blessed.button({
      parent: reanalyzeBox,
      bottom: 1,
      left: 2,
      width: 12,
      height: 3,
      content: ' Analyze ',
      style: {
        bg: 'green',
        fg: 'white',
        focus: { bg: 'lightgreen', fg: 'black', bold: true },
      },
      keys: true,
      mouse: true,
      focusable: true,
      clickable: true,
    });

    const cancelButton = blessed.button({
      parent: reanalyzeBox,
      bottom: 1,
      left: 17,
      width: 10,
      height: 3,
      content: ' Cancel ',
      style: {
        bg: 'blue',
        fg: 'white',
        focus: { bg: 'lightblue', fg: 'black', bold: true },
      },
      keys: true,
      mouse: true,
      focusable: true,
      clickable: true,
    });

    analyzeButton.on('press', async () => {
      const customPrompt = promptInput.value.trim();

      // Show progress
      const progressBox = blessed.box({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: '40%',
        height: 6,
        border: 'line',
        label: ' 🔄 Analyzing ',
        style: {
          border: { fg: 'yellow' },
          bg: 'black',
        },
      });

      const progressText = blessed.text({
        parent: progressBox,
        top: 1,
        left: 1,
        content: 'Analyzing file with AI...\nThis may take a moment.',
        style: { fg: 'white' },
      });

      this.screen.render();

      try {
        const config = await getConfig();
        const provider = config.LLM_PROVIDER || 'ollama';
        const llmProvider = ProviderFactory.createProvider({
          provider,
          apiKey: provider === 'openai' ? config.OPENAI_API_KEY :
                  provider === 'grok' ? config.GROK_API_KEY :
                  provider === 'deepseek' ? config.DEEPSEEK_API_KEY :
                  provider === 'gemini' ? config.GEMINI_API_KEY :
                  provider === 'copilot' ? config.COPILOT_API_KEY : undefined,
          model: config.LLM_MODEL,
          baseUrl: config.LLM_BASE_URL,
        });

        // Use configured prompt or default
        const defaultReanalyzePrompt = `Analyze this file and provide:
1. A descriptive title
2. Main category
3. 3-5 relevant tags
4. Brief summary

Return as JSON with keys: title, category, tags, summary.

IMPORTANT:
- Start your response with { and end with }
- Include exactly these fields: title, category, tags, summary
- Do not write an introduction or summary
- Do not wrap the JSON in quotes or markdown code blocks
- Return ONLY the JSON object, nothing else`;

        const prompt = customPrompt || config.REANALYZE_PROMPT || defaultReanalyzePrompt;

        const response = await generatePromptResponse(config, prompt);
        
        if (!response) {
          progressBox.destroy();
          this.showCommandError('Failed to get response from AI provider');
          reanalyzeBox.focus();
          this.screen.render();
          return;
        }

        let analysis;
        try {
          analysis = await parseJson(response);
        } catch (parseError) {
          progressBox.destroy();
          const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
          
          // Log full details to log file
          this.logger.error('━'.repeat(80));
          this.logger.error('JSON PARSING ERROR');
          this.logger.error('━'.repeat(80));
          this.logger.error('\nPROMPT SENT TO LLM:');
          this.logger.error('─'.repeat(80));
          this.logger.error(prompt);
          this.logger.error('─'.repeat(80));
          this.logger.error('\nRAW LLM RESPONSE:');
          this.logger.error('─'.repeat(80));
          this.logger.error(response);
          this.logger.error('─'.repeat(80));
          this.logger.error('\nPARSE ERROR: ' + errorMsg);
          this.logger.error('━'.repeat(80));
          
          this.showCommandError(`Failed to parse AI response:\n\n${errorMsg}\n\nFull details logged to: ${this.logger.getLogPath()}\n\nResponse preview:\n${response.substring(0, 300)}...`);
          reanalyzeBox.focus();
          this.screen.render();
          return;
        }

        // Close progress
        progressBox.destroy();

        // Show results
        const resultsBox = blessed.box({
          parent: this.screen,
          top: 'center',
          left: 'center',
          width: '80%',
          height: '60%',
          border: 'line',
          label: ' 📊 Analysis Results ',
          style: {
            border: { fg: 'green' },
            bg: 'black',
          },
          keys: true,
          vi: false,
          grabKeys: true,
          input: true,
          focusable: true,
        });

        const resultsText = blessed.text({
          parent: resultsBox,
          top: 1,
          left: 1,
          width: '95%',
          height: '70%',
          content: `New Analysis Results:\n\nTitle: ${analysis.title}\nCategory: ${analysis.category}\nTags: ${analysis.tags?.join(', ')}\nSummary: ${analysis.summary}\n\nApply these changes?\n\nUse Tab/←→ to navigate, Enter to select, Esc to cancel`,
          style: { fg: 'white' },
          scrollable: true,
          alwaysScroll: true,
        });

        const applyButton = blessed.button({
          parent: resultsBox,
          bottom: 1,
          left: 2,
          width: 8,
          content: ' Apply ',
          style: {
            bg: 'green',
            fg: 'white',
            focus: { bg: 'lightgreen', fg: 'black', bold: true }
          },
          keys: true,
          mouse: true,
          focusable: true,
          clickable: true,
        });

        const discardButton = blessed.button({
          parent: resultsBox,
          bottom: 1,
          left: 12,
          width: 10,
          content: ' Discard ',
          style: {
            bg: 'blue',
            fg: 'white',
            focus: { bg: 'lightblue', fg: 'black', bold: true }
          },
          keys: true,
          mouse: true,
          focusable: true,
          clickable: true,
        });

        // Track focused button
        let currentFocus: 'apply' | 'discard' = 'discard'; // Default to Discard for safety

        // Update button visual state
        const updateButtonStyles = () => {
          if (currentFocus === 'apply') {
            applyButton.style.bg = 'lightgreen';
            applyButton.style.fg = 'black';
            discardButton.style.bg = 'blue';
            discardButton.style.fg = 'white';
          } else {
            applyButton.style.bg = 'green';
            applyButton.style.fg = 'white';
            discardButton.style.bg = 'lightblue';
            discardButton.style.fg = 'black';
          }
          this.screen.render();
        };

        // Define actions
        const performApply = async () => {
          this.db.updateFileOrganization(file.id, {
            title: analysis.title,
            category: analysis.category,
            tags: analysis.tags,
            summary: analysis.summary,
            aiPrompt: prompt,
            aiResponse: JSON.stringify(analysis),
          });

          this.dialogOpen = false;
          resultsBox.destroy();
          reanalyzeBox.destroy();
          this.restoreKeyHandlers();
          await this.loadFiles();
          this.leftPanel.focus();
          this.screen.render();
        };

        const performDiscard = () => {
          resultsBox.destroy();
          reanalyzeBox.focus();
          this.screen.render();
        };

        // Keyboard navigation
        resultsBox.key(['tab', 'right'], () => {
          currentFocus = currentFocus === 'apply' ? 'discard' : 'apply';
          updateButtonStyles();
        });

        resultsBox.key(['S-tab', 'left'], () => {
          currentFocus = currentFocus === 'discard' ? 'apply' : 'discard';
          updateButtonStyles();
        });

        resultsBox.key(['enter', 'return'], async () => {
          if (currentFocus === 'apply') {
            await performApply();
          } else {
            performDiscard();
          }
        });

        resultsBox.key(['escape'], () => {
          performDiscard();
        });

        // Mouse handlers
        applyButton.on('press', async () => await performApply());
        discardButton.on('press', () => performDiscard());

        // Focus the dialog and set initial state
        resultsBox.setFront();  // Ensure dialog is on top
        updateButtonStyles();
        
        // Blur leftPanel explicitly
        try {
          // @ts-ignore - blessed types don't have blur but it exists
          this.leftPanel.blur?.();
        } catch (e) {
          // Ignore errors
        }
        
        // Force render first
        this.screen.render();
        
        // Focus after render with slight delay
        setImmediate(() => {
          resultsBox.focus();
          this.screen.render();
        });

      } catch (error) {
        progressBox.destroy();
        this.showCommandError(`Analysis failed: ${error}`);
        reanalyzeBox.focus();
        this.screen.render();
      }
    });

    // Define cancel action
    const cancelAnalysis = () => {
      this.dialogOpen = false;
      reanalyzeBox.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    };

    // Keyboard navigation - Escape to cancel
    reanalyzeBox.key(['escape'], () => {
      cancelAnalysis();
    });

    // Mouse handlers (analyzeButton.on('press') is already defined above)
    cancelButton.on('press', () => {
      cancelAnalysis();
    });

    reanalyzeBox.on('cancel', () => {
      cancelAnalysis();
    });

    // Ensure reanalyzeBox is on top and focus the input
    reanalyzeBox.setFront();
    
    // Blur leftPanel explicitly
    try {
      // @ts-ignore - blessed types don't have blur but it exists
      this.leftPanel.blur?.();
    } catch (e) {
      // Ignore errors
    }
    
    // Force render first
    this.screen.render();
    
    // Focus after render with slight delay
    setImmediate(() => {
      promptInput.focus();
      this.screen.render();
    });
  }

  private deleteFile(): void {
    // Check which view we're in
    if (this.currentView === 'discovered') {
      const item = this.getItemAtDisplayIndex(this.selectedFileIndex);
      if (!item || item.type !== 'file') {
        this.showCommandError('No file selected');
        return;
      }
      const discoveredFile = item.data as DiscoveredFile;
      if (discoveredFile.organizationStatus !== 'organized') {
        this.showCommandError('File must be organized first');
        return;
      }
      // Get the organized file record
      const organizedFile = this.db.getFileByPath(discoveredFile.filePath);
      if (!organizedFile) {
        this.showCommandError('Could not find organized file record');
        return;
      }
      this.deleteOrganizedFile(organizedFile);
      return;
    }

    // Regular list view
    if (this.files.length === 0 || this.selectedFileIndex >= this.files.length) {
      this.showCommandError('No file selected');
      return;
    }

    const file = this.files[this.selectedFileIndex];
    this.deleteOrganizedFile(file);
  }

  private deleteOrganizedFile(file: FileRecord): void {
    // Mark dialog as open
    this.dialogOpen = true;
    
    // Disable screen-level keys that conflict with dialog
    this.disableScreenKeys();

    // Create confirmation dialog
    const confirmBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 10,
      border: 'line',
      label: ' 🗑️ Confirm Delete ',
      style: {
        border: { fg: 'red' },
        bg: 'black',
      },
      keys: true,
      vi: false,
      grabKeys: true,
      input: true,
      focusable: true,
    });

    const message = blessed.text({
      parent: confirmBox,
      top: 1,
      left: 1,
      width: '90%',
      height: 3,
      content: `Delete "${file.title}" from database?\n\nThis action cannot be undone.\n\nUse Tab/←→ to navigate, Enter to select, Esc to cancel.`,
      style: { fg: 'white' },
    });

    const yesButton = blessed.button({
      parent: confirmBox,
      bottom: 1,
      left: 2,
      width: 8,
      height: 3,
      content: ' Yes ',
      align: 'center',
      style: {
        bg: 'red',
        fg: 'white',
        focus: { bg: 'darkred' },
      },
      keys: true,
      mouse: true,
    });

    const noButton = blessed.button({
      parent: confirmBox,
      bottom: 1,
      left: 12,
      width: 8,
      height: 3,
      content: ' No ',
      align: 'center',
      style: {
        bg: 'blue',
        fg: 'white',
        focus: { bg: 'lightblue' },
      },
      keys: true,
      mouse: true,
    });

    // Track focused button
    let currentFocus: 'yes' | 'no' = 'no'; // Default to No for safety

    // Update button visual state
    const updateButtonStyles = () => {
      if (currentFocus === 'yes') {
        yesButton.style.bg = 'darkred';
        yesButton.style.fg = 'white';
        noButton.style.bg = 'blue';
        noButton.style.fg = 'white';
      } else {
        yesButton.style.bg = 'red';
        yesButton.style.fg = 'white';
        noButton.style.bg = 'lightblue';
        noButton.style.fg = 'black';
      }
      this.screen.render();
    };

    // Delete action
    const performDelete = async () => {
      this.dialogOpen = false;
      this.db.deleteFile(file.id);
      confirmBox.destroy();
      this.restoreKeyHandlers();
      await this.loadFiles();
      this.leftPanel.focus();
      this.screen.render();
    };

    // Cancel action
    const cancelDelete = () => {
      this.dialogOpen = false;
      confirmBox.destroy();
      this.restoreKeyHandlers();
      this.leftPanel.focus();
      this.screen.render();
    };

    // Keyboard navigation
    confirmBox.key(['tab', 'right'], () => {
      currentFocus = currentFocus === 'yes' ? 'no' : 'yes';
      updateButtonStyles();
    });

    confirmBox.key(['S-tab', 'left'], () => {
      currentFocus = currentFocus === 'no' ? 'yes' : 'no';
      updateButtonStyles();
    });

    confirmBox.key(['enter', 'return'], async () => {
      if (currentFocus === 'yes') {
        await performDelete();
      } else {
        cancelDelete();
      }
    });

    confirmBox.key(['escape'], () => {
      cancelDelete();
    });

    // Mouse handlers
    yesButton.on('press', async () => {
      await performDelete();
    });

    noButton.on('press', () => {
      cancelDelete();
    });

    // Focus dialog and set initial state (No button)
    confirmBox.setFront();  // Ensure dialog is on top
    updateButtonStyles();
    
    // Blur leftPanel explicitly
    try {
      // @ts-ignore - blessed types don't have blur but it exists
      this.leftPanel.blur?.();
    } catch (e) {
      // Ignore errors
    }
    
    // Force render first
    this.screen.render();
    
    // Focus after render with slight delay
    setImmediate(() => {
      confirmBox.focus();
      this.screen.render();
    });
  }

  private showSearchResults(): void {
    // TODO: Implement search results view
    this.rightPanel.setContent('\n\n  🔍 Search results would be shown here');
    this.screen.render();
  }

  private showEditForm(file: FileRecord): void {
    // TODO: Implement edit form in blessed UI
    this.rightPanel.setContent(`\n\n  ✏️ Edit form for: ${file.title}\n\n  Coming soon...`);
    this.screen.render();
  }

  private showMenu(): void {
    // TODO: Implement menu
    this.showCommandError('Menu functionality coming soon!');
  }

  private showStats(): void {
    const stats = this.db.getStats();
    let content = `${blue('📊 Detailed Statistics')}\n`;
    content += '='.repeat(40) + '\n\n';
    content += `📁 Total Files:        ${stats.totalFiles}\n`;
    content += `📚 Total Versions:     ${stats.totalVersions}\n`;
    content += `🕐 Recent Files (7d):  ${stats.recentFiles}\n`;
    content += `🎨 Templates Used:     ${stats.templatesUsed.length}\n`;

    if (stats.templatesUsed.length > 0) {
      content += `\n${blue('📋 Template Usage:')}\n`;
      stats.templatesUsed.forEach(template => {
        content += `  • ${template}\n`;
      });
    }

    // Show recent activity
    const recentFiles = this.db.getFiles(5);
    if (recentFiles.length > 0) {
      content += `\n${blue('🕐 Recent Activity:')}\n`;
      recentFiles.forEach(file => {
        const timeAgo = this.getTimeAgo(file.updatedAt);
        content += `  ${timeAgo}: ${file.title} (${file.category})\n`;
      });
    }

    this.rightPanel.setContent(content);
    this.rightPanel.setLabel(' 📊 Statistics ');
    this.screen.render();
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  }

  private quit(): void {
    this.screen.destroy();
    this.db.close();
    process.exit(0);
  }

  close(): void {
    if (this.screen) {
      this.screen.destroy();
    }
    this.db.close();
  }
}












