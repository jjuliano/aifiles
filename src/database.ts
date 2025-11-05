import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileExists } from './utils.js';

export interface FileRecord {
  id: string;
  originalPath: string;
  currentPath: string;
  backupPath?: string; // Path to backup copy of original file
  originalName: string;
  currentName: string;
  templateId?: string;
  templateName?: string;
  category: string;
  title: string;
  tags: string[];
  summary: string;
  aiProvider: string;
  aiModel: string;
  aiPrompt: string;
  aiResponse: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  path: string;
  name: string;
  category: string;
  title: string;
  tags: string;
  summary: string;
  aiPrompt: string;
  aiResponse: string;
  createdAt: Date;
}

export interface DiscoveredFile {
  id: string;
  filePath: string;
  fileName: string;
  organizationStatus: 'organized' | 'unorganized';
  discoveredAt: Date;
  lastChecked: Date;
  fileSize?: number;
  fileModified?: Date;
  templateId?: string;
}

export class FileDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(os.homedir(), '.aifiles', 'database.sqlite');
    // Note: migrateLegacyDatabase is async but called synchronously here
    // This is acceptable for initialization as the migration is not critical for basic operation
    this.migrateLegacyDatabase().catch(err => {
      // Silently ignore migration errors to not break initialization
      console.warn('Database migration failed:', err);
    });
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  private async migrateLegacyDatabase(): Promise<void> {
    const legacyPath = path.join(os.homedir(), '.aifiles.sqlite');
    const newDir = path.dirname(this.dbPath);

    try {
      // Check if legacy file exists
      const legacyExists = await fileExists(legacyPath);
      if (legacyExists) {
        // Create new directory if it doesn't exist
        await fs.mkdir(newDir, { recursive: true });

        // Check if new file already exists
        const newExists = await fileExists(this.dbPath);
        if (!newExists) {
          // Move legacy file to new location
          await fs.rename(legacyPath, this.dbPath);
          console.log('✅ Migrated database from ~/.aifiles.sqlite to ~/.aifiles/database.sqlite');
        }
      }
    } catch (error) {
      // Ignore migration errors
    }
  }

  private initializeDatabase(): void {
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        original_path TEXT NOT NULL,
        current_path TEXT NOT NULL,
        backup_path TEXT, -- Path to backup copy of original file
        original_name TEXT NOT NULL,
        current_name TEXT NOT NULL,
        template_id TEXT, -- Optional - not all files use templates
        template_name TEXT, -- Optional - not all files use templates
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        tags TEXT NOT NULL, -- JSON array
        summary TEXT NOT NULL,
        ai_provider TEXT NOT NULL,
        ai_model TEXT NOT NULL,
        ai_prompt TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS file_versions (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        tags TEXT NOT NULL,
        summary TEXT NOT NULL,
        ai_prompt TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files (id)
      );

      CREATE TABLE IF NOT EXISTS discovered_files (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        organization_status TEXT NOT NULL DEFAULT 'unorganized', -- 'organized' or 'unorganized'
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_size INTEGER,
        file_modified DATETIME,
        template_id TEXT -- If organized, which template (no FK constraint)
      );

      CREATE INDEX IF NOT EXISTS idx_files_current_path ON files (current_path);
      CREATE INDEX IF NOT EXISTS idx_files_template ON files (template_id);
      CREATE INDEX IF NOT EXISTS idx_files_created ON files (created_at);
      CREATE INDEX IF NOT EXISTS idx_versions_file_id ON file_versions (file_id);
      CREATE INDEX IF NOT EXISTS idx_discovered_files_path ON discovered_files (file_path);
      CREATE INDEX IF NOT EXISTS idx_discovered_files_status ON discovered_files (organization_status);
    `);

    // Add backup_path column if it doesn't exist (migration for existing databases)
    try {
      this.db.exec(`ALTER TABLE files ADD COLUMN backup_path TEXT;`);
    } catch (error) {
      // Column might already exist, ignore error
    }
  }

  // Record a new file organization
  recordFileOrganization(fileData: {
    originalPath: string;
    currentPath: string;
    backupPath?: string;
    originalName: string;
    currentName: string;
    templateId?: string;
    templateName?: string;
    category: string;
    title: string;
    tags: string[];
    summary: string;
    aiProvider: string;
    aiModel: string;
    aiPrompt: string;
    aiResponse: string;
  }): string {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const insert = this.db.prepare(`
      INSERT INTO files (
        id, original_path, current_path, backup_path, original_name, current_name,
        template_id, template_name, category, title, tags, summary,
        ai_provider, ai_model, ai_prompt, ai_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id,
      fileData.originalPath,
      fileData.currentPath,
      fileData.backupPath || null,
      fileData.originalName,
      fileData.currentName,
      fileData.templateId || null,
      fileData.templateName || null,
      fileData.category,
      fileData.title,
      JSON.stringify(fileData.tags),
      fileData.summary,
      fileData.aiProvider,
      fileData.aiModel,
      fileData.aiPrompt,
      fileData.aiResponse
    );

    // Create initial version record
    this.recordVersion(id, 1, fileData);

    return id;
  }

  // Record a version of file changes
  private recordVersion(fileId: string, version: number, fileData: any): void {
    const id = `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const insert = this.db.prepare(`
      INSERT INTO file_versions (
        id, file_id, version, path, name, category, title, tags, summary, ai_prompt, ai_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id,
      fileId,
      version,
      fileData.currentPath,
      fileData.currentName,
      fileData.category,
      fileData.title,
      JSON.stringify(fileData.tags),
      fileData.summary,
      fileData.aiPrompt,
      fileData.aiResponse
    );
  }

  // Update file record with new organization
  updateFileOrganization(fileId: string, updates: {
    currentPath?: string;
    currentName?: string;
    backupPath?: string;
    category?: string;
    title?: string;
    tags?: string[];
    summary?: string;
    aiPrompt?: string;
    aiResponse?: string;
  }): void {
    // Get current version
    const current = this.getFileById(fileId);
    if (!current) return;

    const newVersion = current.version + 1;

    // Record current state as version before updating
    this.recordVersion(fileId, current.version, {
      currentPath: current.currentPath,
      currentName: current.currentName,
      category: current.category,
      title: current.title,
      tags: current.tags,
      summary: current.summary,
      aiPrompt: current.aiPrompt,
      aiResponse: current.aiResponse,
    });

    // Update the main record
    const setParts = [];
    const values = [];

    if (updates.currentPath !== undefined) {
      setParts.push('current_path = ?');
      values.push(updates.currentPath);
    }
    if (updates.currentName !== undefined) {
      setParts.push('current_name = ?');
      values.push(updates.currentName);
    }
    if (updates.backupPath !== undefined) {
      setParts.push('backup_path = ?');
      values.push(updates.backupPath);
    }
    if (updates.category !== undefined) {
      setParts.push('category = ?');
      values.push(updates.category);
    }
    if (updates.title !== undefined) {
      setParts.push('title = ?');
      values.push(updates.title);
    }
    if (updates.tags !== undefined) {
      setParts.push('tags = ?');
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.summary !== undefined) {
      setParts.push('summary = ?');
      values.push(updates.summary);
    }
    if (updates.aiPrompt !== undefined) {
      setParts.push('ai_prompt = ?');
      values.push(updates.aiPrompt);
    }
    if (updates.aiResponse !== undefined) {
      setParts.push('ai_response = ?');
      values.push(updates.aiResponse);
    }

    setParts.push('version = ?, updated_at = CURRENT_TIMESTAMP');
    values.push(newVersion, fileId);

    const updateQuery = `UPDATE files SET ${setParts.join(', ')} WHERE id = ?`;
    this.db.prepare(updateQuery).run(...values);

    // Record new version
    const updated = this.getFileById(fileId);
    if (updated) {
      this.recordVersion(fileId, newVersion, {
        currentPath: updated.currentPath,
        currentName: updated.currentName,
        category: updated.category,
        title: updated.title,
        tags: updated.tags,
        summary: updated.summary,
        aiPrompt: updated.aiPrompt,
        aiResponse: updated.aiResponse,
      });
    }
  }

  // Get file by ID
  getFileById(id: string): FileRecord | null {
    const query = this.db.prepare(`
      SELECT * FROM files WHERE id = ?
    `);

    const row = query.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      originalPath: row.original_path,
      currentPath: row.current_path,
      backupPath: row.backup_path || undefined,
      originalName: row.original_name,
      currentName: row.current_name,
      templateId: row.template_id,
      templateName: row.template_name,
      category: row.category,
      title: row.title,
      tags: JSON.parse(row.tags),
      summary: row.summary,
      aiProvider: row.ai_provider,
      aiModel: row.ai_model,
      aiPrompt: row.ai_prompt,
      aiResponse: row.ai_response,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
    };
  }

  // Get file by current path
  getFileByPath(currentPath: string): FileRecord | null {
    const query = this.db.prepare(`
      SELECT * FROM files WHERE current_path = ?
    `);

    const row = query.get(currentPath) as any;
    if (!row) return null;

    return {
      id: row.id,
      originalPath: row.original_path,
      currentPath: row.current_path,
      originalName: row.original_name,
      currentName: row.current_name,
      templateId: row.template_id,
      templateName: row.template_name,
      category: row.category,
      title: row.title,
      tags: JSON.parse(row.tags),
      summary: row.summary,
      aiProvider: row.ai_provider,
      aiModel: row.ai_model,
      aiPrompt: row.ai_prompt,
      aiResponse: row.ai_response,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
    };
  }

  // Get all files with pagination
  getFiles(limit: number = 50, offset: number = 0): FileRecord[] {
    const query = this.db.prepare(`
      SELECT * FROM files
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = query.all(limit, offset) as any[];
    return rows.map(row => ({
      id: row.id,
      originalPath: row.original_path,
      currentPath: row.current_path,
      originalName: row.original_name,
      currentName: row.current_name,
      templateId: row.template_id,
      templateName: row.template_name,
      category: row.category,
      title: row.title,
      tags: JSON.parse(row.tags),
      summary: row.summary,
      aiProvider: row.ai_provider,
      aiModel: row.ai_model,
      aiPrompt: row.ai_prompt,
      aiResponse: row.ai_response,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
    }));
  }

  // Get file versions
  getFileVersions(fileId: string): FileVersion[] {
    const query = this.db.prepare(`
      SELECT * FROM file_versions
      WHERE file_id = ?
      ORDER BY version ASC
    `);

    const rows = query.all(fileId) as any[];
    return rows.map(row => ({
      id: row.id,
      fileId: row.file_id,
      version: row.version,
      path: row.path,
      name: row.name,
      category: row.category,
      title: row.title,
      tags: JSON.parse(row.tags),
      summary: row.summary,
      aiPrompt: row.ai_prompt,
      aiResponse: row.ai_response,
      createdAt: new Date(row.created_at),
    }));
  }

  // Delete file record
  deleteFile(fileId: string): void {
    // Delete versions first
    this.db.prepare('DELETE FROM file_versions WHERE file_id = ?').run(fileId);
    // Delete main record
    this.db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
  }

  // Search files
  searchFiles(query: string, limit: number = 20): FileRecord[] {
    const searchQuery = this.db.prepare(`
      SELECT * FROM files
      WHERE title LIKE ? OR summary LIKE ? OR category LIKE ? OR current_name LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const searchTerm = `%${query}%`;
    const rows = searchQuery.all(searchTerm, searchTerm, searchTerm, searchTerm, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      originalPath: row.original_path,
      currentPath: row.current_path,
      originalName: row.original_name,
      currentName: row.current_name,
      templateId: row.template_id,
      templateName: row.template_name,
      category: row.category,
      title: row.title,
      tags: JSON.parse(row.tags),
      summary: row.summary,
      aiProvider: row.ai_provider,
      aiModel: row.ai_model,
      aiPrompt: row.ai_prompt,
      aiResponse: row.ai_response,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
    }));
  }

  // Get statistics
  getStats(): {
    totalFiles: number;
    totalVersions: number;
    recentFiles: number;
    templatesUsed: string[];
  } {
    const totalFiles = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as any;
    const totalVersions = this.db.prepare('SELECT COUNT(*) as count FROM file_versions').get() as any;
    const recentFiles = this.db.prepare('SELECT COUNT(*) as count FROM files WHERE created_at >= datetime(\'now\', \'-7 days\')').get() as any;
    const templates = this.db.prepare('SELECT DISTINCT template_name FROM files').all() as any[];

    return {
      totalFiles: totalFiles.count,
      totalVersions: totalVersions.count,
      recentFiles: recentFiles.count,
      templatesUsed: templates.map(t => t.template_name),
    };
  }

  // Discovered files management

  // Record or update a discovered file
  recordDiscoveredFile(fileData: {
    filePath: string;
    fileName: string;
    organizationStatus: 'organized' | 'unorganized';
    fileSize?: number;
    fileModified?: Date;
    templateId?: string;
  }): string {
    const id = `discovered_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO discovered_files (
        id, file_path, file_name, organization_status, file_size, file_modified, template_id, last_checked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    insert.run(
      id,
      fileData.filePath,
      fileData.fileName,
      fileData.organizationStatus,
      fileData.fileSize || null,
      fileData.fileModified?.toISOString() || null,
      fileData.templateId || null
    );

    return id;
  }

  // Get discovered files by organization status
  getDiscoveredFilesByStatus(status: 'organized' | 'unorganized', limit: number = 100): DiscoveredFile[] {
    const query = this.db.prepare(`
      SELECT * FROM discovered_files
      WHERE organization_status = ?
      ORDER BY last_checked DESC
      LIMIT ?
    `);

    const rows = query.all(status, limit) as any[];
    return rows.map(row => ({
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      organizationStatus: row.organization_status,
      discoveredAt: new Date(row.discovered_at),
      lastChecked: new Date(row.last_checked),
      fileSize: row.file_size,
      fileModified: row.file_modified ? new Date(row.file_modified) : undefined,
      templateId: row.template_id,
    }));
  }

  // Get all discovered files
  getAllDiscoveredFiles(limit: number = 1000): DiscoveredFile[] {
    const query = this.db.prepare(`
      SELECT * FROM discovered_files
      ORDER BY last_checked DESC
      LIMIT ?
    `);

    const rows = query.all(limit) as any[];
    return rows.map(row => ({
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      organizationStatus: row.organization_status,
      discoveredAt: new Date(row.discovered_at),
      lastChecked: new Date(row.last_checked),
      fileSize: row.file_size,
      fileModified: row.file_modified ? new Date(row.file_modified) : undefined,
      templateId: row.template_id,
    }));
  }

  // Get discovered file by path
  getDiscoveredFileByPath(filePath: string): DiscoveredFile | null {
    const query = this.db.prepare(`
      SELECT * FROM discovered_files WHERE file_path = ?
    `);

    const row = query.get(filePath) as any;
    if (!row) return null;

    return {
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      organizationStatus: row.organization_status,
      discoveredAt: new Date(row.discovered_at),
      lastChecked: new Date(row.last_checked),
      fileSize: row.file_size,
      fileModified: row.file_modified ? new Date(row.file_modified) : undefined,
      templateId: row.template_id,
    };
  }

  // Update discovered file status
  updateDiscoveredFileStatus(filePath: string, status: 'organized' | 'unorganized', templateId?: string): void {
    const update = this.db.prepare(`
      UPDATE discovered_files
      SET organization_status = ?, template_id = ?, last_checked = CURRENT_TIMESTAMP
      WHERE file_path = ?
    `);

    update.run(status, templateId || null, filePath);
  }

  // Remove discovered file (when file is deleted)
  removeDiscoveredFile(filePath: string): void {
    const deleteQuery = this.db.prepare(`
      DELETE FROM discovered_files WHERE file_path = ?
    `);
    deleteQuery.run(filePath);
  }

  // Get discovered files statistics
  getDiscoveredStats(): {
    totalDiscovered: number;
    organizedCount: number;
    unorganizedCount: number;
    recentDiscoveries: number;
  } {
    const totalDiscovered = this.db.prepare('SELECT COUNT(*) as count FROM discovered_files').get() as any;
    const organizedCount = this.db.prepare('SELECT COUNT(*) as count FROM discovered_files WHERE organization_status = \'organized\'').get() as any;
    const unorganizedCount = this.db.prepare('SELECT COUNT(*) as count FROM discovered_files WHERE organization_status = \'unorganized\'').get() as any;
    const recentDiscoveries = this.db.prepare('SELECT COUNT(*) as count FROM discovered_files WHERE discovered_at >= datetime(\'now\', \'-7 days\')').get() as any;

    return {
      totalDiscovered: totalDiscovered.count,
      organizedCount: organizedCount.count,
      unorganizedCount: unorganizedCount.count,
      recentDiscoveries: recentDiscoveries.count,
    };
  }

  // Close database connection
  close(): void {
    this.db.close();
  }
}

