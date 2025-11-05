import chokidar from 'chokidar';
import path from 'path';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { FolderTemplate } from './folder-templates.js';
import { resolvePath } from './utils.js';

export interface FileEvent {
  filePath: string;
  template: FolderTemplate;
  fileName: string;
}

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();

  async watchTemplate(template: FolderTemplate): Promise<void> {
    if (this.watchers.has(template.id)) {
      return; // Already watching
    }

    const watchPath = resolvePath(template.basePath);

    // Check if the path exists and is accessible
    try {
      await fs.access(watchPath);
    } catch (error) {
      throw new Error(`Watch path does not exist or is not accessible: ${watchPath}`);
    }

    const watcher = chokidar.watch(watchPath, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      usePolling: true, // Use polling instead of native FSEvents to avoid macOS issues
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    watcher.on('add', (filePath) => {
      const fileName = path.basename(filePath);
      this.emit('fileAdded', {
        filePath,
        template,
        fileName,
      } as FileEvent);
    });

    watcher.on('error', (error) => {
      this.emit('error', { error, template });
    });

    this.watchers.set(template.id, watcher);
  }

  unwatchTemplate(templateId: string): void {
    const watcher = this.watchers.get(templateId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(templateId);
    }
  }

  stopAll(): void {
    for (const [templateId, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        // Ignore close errors - watcher may already be closed
      }
      this.watchers.delete(templateId);
    }
  }
}
