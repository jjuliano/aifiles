import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface LockFileData {
  pid: number;
  startTime: number;
  command: string;
}

export enum LockMode {
  NORMAL = 'normal',
  WATCH = 'watch',
  FILEMANAGER = 'filemanager'
}

export class LockFileManager {
  private lockFilePath: string;
  private mode: LockMode;

  constructor(mode: LockMode = LockMode.NORMAL) {
    this.mode = mode;
    const configDir = path.join(os.homedir(), '.aifiles');

    // Different lockfiles for different modes
    const lockFileName = mode === LockMode.WATCH
      ? '.aifiles-watch.lock'
      : mode === LockMode.FILEMANAGER
      ? '.aifiles-filemanager.lock'
      : '.aifiles.lock';

    this.lockFilePath = path.join(configDir, lockFileName);
  }

  /**
   * Check if a process is running by PID
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // Process doesn't exist
      return false;
    }
  }

  /**
   * Acquire the lock. Throws error if another instance is running.
   */
  async acquire(command: string = 'aifiles'): Promise<void> {
    // Ensure config directory exists
    const configDir = path.dirname(this.lockFilePath);
    await fs.mkdir(configDir, { recursive: true });

    // Check if lock file exists
    try {
      const lockContent = await fs.readFile(this.lockFilePath, 'utf-8');
      const lockData: LockFileData = JSON.parse(lockContent);

      // Check if the process is still running
      if (this.isProcessRunning(lockData.pid)) {
        const uptimeSeconds = Math.floor((Date.now() - lockData.startTime) / 1000);
        const uptimeMinutes = Math.floor(uptimeSeconds / 60);
        const uptimeDisplay = uptimeMinutes > 0
          ? `${uptimeMinutes} minute${uptimeMinutes > 1 ? 's' : ''}`
          : `${uptimeSeconds} second${uptimeSeconds > 1 ? 's' : ''}`;

        const modeLabel = this.mode === LockMode.WATCH
          ? 'Watch mode (daemon)'
          : this.mode === LockMode.FILEMANAGER
          ? 'File Manager'
          : 'AIFiles';

        throw new Error(
          `Another instance of ${modeLabel} is already running!\n\n` +
          `  Process ID: ${lockData.pid}\n` +
          `  Command: ${lockData.command}\n` +
          `  Running for: ${uptimeDisplay}\n\n` +
          `To stop the existing instance:\n` +
          `  1. Kill the process: kill ${lockData.pid}\n` +
          `  2. Remove the lock file: rm "${this.lockFilePath}"\n\n` +
          `Or use this command: kill ${lockData.pid} && rm "${this.lockFilePath}"`
        );
      } else {
        // Process is dead, remove stale lock file
        console.log('  🧹 Removing stale lock file from previous instance...');
        await fs.unlink(this.lockFilePath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // If error is not "file not found", check if it's our custom error
        if (error instanceof Error && error.message.includes('Another instance')) {
          throw error; // Re-throw our custom error
        }
        // For other errors (like JSON parse errors), treat as stale lock
        console.log('  🧹 Removing corrupted lock file...');
        try {
          await fs.unlink(this.lockFilePath);
        } catch {
          // Ignore errors when removing corrupted lock
        }
      }
    }

    // Create new lock file
    const lockData: LockFileData = {
      pid: process.pid,
      startTime: Date.now(),
      command: command,
    };

    await fs.writeFile(this.lockFilePath, JSON.stringify(lockData, null, 2), 'utf-8');
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    try {
      // Only remove if it's our lock
      const lockContent = await fs.readFile(this.lockFilePath, 'utf-8');
      const lockData: LockFileData = JSON.parse(lockContent);

      if (lockData.pid === process.pid) {
        await fs.unlink(this.lockFilePath);
      }
    } catch (error) {
      // Ignore errors when releasing (file might not exist)
    }
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   */
  setupCleanupHandlers(): void {
    const cleanup = async () => {
      await this.release();
    };

    // Handle normal exit
    process.on('exit', () => {
      // Synchronous version for exit event
      try {
        const lockContent = require('fs').readFileSync(this.lockFilePath, 'utf-8');
        const lockData = JSON.parse(lockContent);
        if (lockData.pid === process.pid) {
          require('fs').unlinkSync(this.lockFilePath);
        }
      } catch {
        // Ignore errors
      }
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(130); // Standard exit code for SIGINT
    });

    // Handle SIGTERM
    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(143); // Standard exit code for SIGTERM
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await cleanup();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await cleanup();
      process.exit(1);
    });
  }

  /**
   * Get current lock file path
   */
  getLockFilePath(): string {
    return this.lockFilePath;
  }

  /**
   * Check if lock exists without throwing
   */
  async isLocked(): Promise<{ locked: boolean; pid?: number; command?: string }> {
    try {
      const lockContent = await fs.readFile(this.lockFilePath, 'utf-8');
      const lockData: LockFileData = JSON.parse(lockContent);

      if (this.isProcessRunning(lockData.pid)) {
        return {
          locked: true,
          pid: lockData.pid,
          command: lockData.command,
        };
      } else {
        // Stale lock
        return { locked: false };
      }
    } catch {
      return { locked: false };
    }
  }
}
