#!/usr/bin/env node

/**
 * Test script to demonstrate lockfile functionality
 *
 * Usage:
 *   node test-lockfile.mjs          # Start first instance
 *   node test-lockfile.mjs          # Try to start second instance (should fail)
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

class LockFileManager {
  constructor(lockFileName = '.aifiles.lock') {
    const configDir = path.join(os.homedir(), '.aifiles');
    this.lockFilePath = path.join(configDir, lockFileName);
  }

  isProcessRunning(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  async acquire(command = 'aifiles') {
    const configDir = path.dirname(this.lockFilePath);
    await fs.mkdir(configDir, { recursive: true });

    try {
      const lockContent = await fs.readFile(this.lockFilePath, 'utf-8');
      const lockData = JSON.parse(lockContent);

      if (this.isProcessRunning(lockData.pid)) {
        const uptimeSeconds = Math.floor((Date.now() - lockData.startTime) / 1000);
        const uptimeMinutes = Math.floor(uptimeSeconds / 60);
        const uptimeDisplay = uptimeMinutes > 0
          ? `${uptimeMinutes} minute${uptimeMinutes > 1 ? 's' : ''}`
          : `${uptimeSeconds} second${uptimeSeconds > 1 ? 's' : ''}`;

        throw new Error(
          `❌ Another instance of AIFiles is already running!\n\n` +
          `  Process ID: ${lockData.pid}\n` +
          `  Command: ${lockData.command}\n` +
          `  Running for: ${uptimeDisplay}\n\n` +
          `To stop the existing instance:\n` +
          `  1. Kill the process: kill ${lockData.pid}\n` +
          `  2. Remove the lock file: rm "${this.lockFilePath}"\n\n` +
          `Or use this command: kill ${lockData.pid} && rm "${this.lockFilePath}"`
        );
      } else {
        console.log('🧹 Removing stale lock file from previous instance...');
        await fs.unlink(this.lockFilePath);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        if (error.message.includes('Another instance')) {
          throw error;
        }
        console.log('🧹 Removing corrupted lock file...');
        try {
          await fs.unlink(this.lockFilePath);
        } catch {
          // Ignore
        }
      }
    }

    const lockData = {
      pid: process.pid,
      startTime: Date.now(),
      command: command,
    };

    await fs.writeFile(this.lockFilePath, JSON.stringify(lockData, null, 2), 'utf-8');
    console.log(`✅ Lock acquired! PID: ${process.pid}`);
  }

  async release() {
    try {
      const lockContent = await fs.readFile(this.lockFilePath, 'utf-8');
      const lockData = JSON.parse(lockContent);

      if (lockData.pid === process.pid) {
        await fs.unlink(this.lockFilePath);
        console.log('🔓 Lock released');
      }
    } catch {
      // Ignore errors
    }
  }

  setupCleanupHandlers() {
    const cleanup = async () => {
      await this.release();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

// Main test
async function main() {
  const lockManager = new LockFileManager('.aifiles-test.lock');

  try {
    await lockManager.acquire('test-lockfile');
    lockManager.setupCleanupHandlers();

    console.log('\n📋 Lockfile Test Running');
    console.log('  Try running this script again in another terminal to see the lock in action');
    console.log('  Press Ctrl+C to exit and release the lock\n');

    // Keep the process alive
    await new Promise((resolve) => {
      // Wait forever
    });
  } catch (error) {
    console.error('\n' + error.message + '\n');
    process.exit(1);
  }
}

main();
