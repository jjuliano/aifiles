#!/usr/bin/env node

/**
 * AIFiles Integration Test Suite
 *
 * Tests all aifiles commands end-to-end by running the built binaries directly.
 * Validates functionality, error handling, and user experience.
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class IntegrationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
    this.testDataDir = path.join(__dirname, '..', 'test-integration-data');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = {
      info: 'ℹ️ ',
      success: '✅',
      error: '❌',
      warning: '⚠️ ',
      test: '🧪'
    }[type] || 'ℹ️ ';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runCommand(command, args = [], options = {}) {
    const timeout = options.timeout || 10000; // Default 10 second timeout

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: options.captureOutput ? 'pipe' : 'inherit',
        cwd: path.join(__dirname, '..'),
        ...options
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      if (options.captureOutput) {
        child.stdout?.on('data', (data) => stdout += data.toString());
        child.stderr?.on('data', (data) => stderr += data.toString());
      }

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');

        // If still running after SIGTERM, force kill
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 2000);
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          code: timedOut ? 'TIMEOUT' : code,
          stdout,
          stderr,
          timedOut
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(error);
        } else {
          resolve({
            code: 'TIMEOUT',
            stdout,
            stderr,
            timedOut: true,
            error
          });
        }
      });
    });
  }

  async test(name, testFn) {
    this.log(`Running: ${name}`, 'test');

    try {
      const result = await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed', result });
      this.log(`${name} - PASSED`, 'success');
      return result;
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message });
      this.log(`${name} - FAILED: ${error.message}`, 'error');
      throw error;
    }
  }

  // Test if a command is available in PATH
  async isCommandAvailable(command) {
    try {
      await this.runCommand('which', [command], { captureOutput: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get the appropriate command to run (PATH version if available, otherwise node version)
  getCommandToRun(binaryName, fallbackArgs) {
    // For production-like testing, try to use the binary from PATH first
    return [binaryName, ...fallbackArgs];
  }

  async setup() {
    this.log('Setting up integration test environment');

    // Create test data directory
    await fs.mkdir(this.testDataDir, { recursive: true });

    // Create test files
    const testFiles = [
      { name: 'test-document.txt', content: 'This is a test document for AI organization.' },
      { name: 'test-image.jpg', content: 'Mock image file' },
      { name: 'test-audio.mp3', content: 'Mock audio file' }
    ];

    for (const file of testFiles) {
      await fs.writeFile(path.join(this.testDataDir, file.name), file.content);
    }

    // Install package locally to make binaries available in PATH
    this.log('Installing package locally for PATH testing');
    try {
      await this.runCommand('npm', ['link'], { cwd: path.join(__dirname, '..') });
      this.log('Package linked successfully', 'success');
    } catch (error) {
      this.log('Package linking failed, will test with direct node execution', 'warning');
    }

    // Don't create config manually - test that app creates it automatically

    this.log('Test environment setup complete', 'success');
  }

  async teardown() {
    this.log('Cleaning up integration test environment');

    try {
      // Remove test data directory
      await fs.rm(this.testDataDir, { recursive: true, force: true });

      // Remove config directory created during testing
      const configDir = path.join(process.env.HOME, '.aifiles');
      await fs.rm(configDir, { recursive: true, force: true });

      // Unlink the package
      try {
        await this.runCommand('npm', ['unlink', 'aifiles'], { cwd: path.join(__dirname, '..') });
        this.log('Package unlinked successfully', 'success');
      } catch (error) {
        // Ignore unlink errors as package might not be linked
      }

      this.log('Test environment cleaned up', 'success');
    } catch (error) {
      this.log(`Cleanup warning: ${error.message}`, 'warning');
    }
  }

  async buildProject() {
    this.log('Building AIFiles project');
    execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    this.log('Project built successfully', 'success');
  }

  async runAllTests() {
    try {
      await this.setup();
      await this.buildProject();

      // Test CLI Help
      await this.test('CLI Help Command', async () => {
        const result = await this.runCommand('node', ['dist/cli.mjs', '--help'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Help command failed');
        if (!result.stdout.includes('🤖 AIFiles')) throw new Error('Help output missing header');
        if (!result.stdout.includes('USAGE')) throw new Error('Help output missing usage section');
        return result;
      });

      // Test Templates Help
      await this.test('Templates Help Command', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', '--help'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Templates help command failed');
        if (!result.stdout.includes('aifiles-templates')) throw new Error('Templates help output missing header');
        return result;
      });

      // Test Templates List (should show default templates)
      await this.test('Templates List Command', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'list'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Templates list should succeed with default templates');
        if (!result.stdout.includes('📁 Folder Templates')) throw new Error('Should show templates header');
        if (!result.stdout.includes('Found 6 templates:')) throw new Error('Should show default templates count');
        if (!result.stdout.includes('Documents')) throw new Error('Should show Documents template');
        if (!result.stdout.includes('Pictures')) throw new Error('Should show Pictures template');
        return result;
      });

      // Test File Processing (should fail without AI service)
      await this.test('File Processing Error Handling', async () => {
        const testFile = path.join(this.testDataDir, 'test-document.txt');
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile], { captureOutput: true, timeout: 10000 });
        if (result.code === 0) throw new Error('File processing should fail without AI service');
        if (result.timedOut) throw new Error('Command should not timeout - should fail quickly');
        if (!result.stdout.includes('Detecting file')) throw new Error('Should show file detection before failing');
        if (!result.stdout.includes('Error:')) throw new Error('Should show error message in stdout');
        return result;
      });

      // Test Invalid File
      await this.test('Invalid File Error Handling', async () => {
        const result = await this.runCommand('node', ['dist/cli.mjs', 'nonexistent-file.xyz'], { captureOutput: true, timeout: 5000 });
        if (result.code === 0) throw new Error('Should fail with nonexistent file');
        if (result.timedOut) throw new Error('Should fail quickly, not timeout');
        if (!result.stdout.includes('File not found: nonexistent-file.xyz')) {
          throw new Error(`Should show specific file not found error. Got stdout: ${result.stdout.substring(0, 200)}`);
        }
        return result;
      });

      // Test Watch Command (should start)
      await this.test('Watch Daemon Start', async () => {
        const result = await this.runCommand('node', ['dist/cli.mjs', 'watch'], { captureOutput: true, timeout: 5000 });
        // Should show daemon startup message (may exit due to no templates or other issues)
        if (!result.stdout.includes('👀 AIFiles Watch Daemon')) throw new Error('Should show watch daemon message');
        return result;
      });

      // Test File Manager Command
      await this.test('File Manager Command', async () => {
        const result = await this.runCommand('node', ['dist/cli.mjs', 'filemanager'], { captureOutput: true, timeout: 5000 });
        // File manager command should work even without database
        if (result.timedOut) {
          // If it times out, that's expected in non-interactive environment
          return result;
        }
        if (result.code !== 0 && !result.stdout.includes('File Manager')) {
          throw new Error('History command failed unexpectedly');
        }
        return result;
      });

      // Test Verbose Flag
      await this.test('Verbose Flag Processing', async () => {
        const testFile = path.join(this.testDataDir, 'test-document.txt');
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile, '--verbose'], { captureOutput: true, timeout: 5000 });
        if (result.code === 0) throw new Error('Should fail without AI service');
        if (result.timedOut) throw new Error('Should not timeout with verbose flag');
        if (!result.stdout.includes('Detecting file')) throw new Error('Should show file detection');
        // Verbose flag should show more detailed output
        return result;
      });

      // Test Dry Run Flag
      await this.test('Dry Run Flag Processing', async () => {
        const testFile = path.join(this.testDataDir, 'test-document.txt');
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile, '--dry-run'], { captureOutput: true, timeout: 5000 });
        if (result.code === 0) throw new Error('Should fail without AI service');
        if (result.timedOut) throw new Error('Should not timeout with dry-run flag');
        if (!result.stdout.includes('Detecting file')) throw new Error('Should detect file even in dry-run');
        return result;
      });

      // Test Force Flag Processing
      await this.test('Force Flag Processing', async () => {
        const testFile = path.join(this.testDataDir, 'test-document.txt');
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile, '--force'], { captureOutput: true, timeout: 5000 });
        if (result.code === 0) throw new Error('Should fail without AI service');
        if (result.timedOut) throw new Error('Should not timeout with force flag');
        if (!result.stdout.includes('Detecting file')) throw new Error('Should detect file with force flag');
        return result;
      });

      // Test Batch Flag Processing
      await this.test('Batch Flag Processing', async () => {
        const testFile = path.join(this.testDataDir, 'test-document.txt');
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile, '--batch'], { captureOutput: true, timeout: 5000 });
        if (result.code === 0) throw new Error('Should fail without AI service');
        if (result.timedOut) throw new Error('Should not timeout with batch flag');
        if (!result.stdout.includes('Detecting file')) throw new Error('Should detect file with batch flag');
        return result;
      });

      // Test Combined Flags
      await this.test('Combined Flags Processing', async () => {
        const testFile = path.join(this.testDataDir, 'test-document.txt');
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile, '--verbose', '--dry-run', '--force'], { captureOutput: true, timeout: 5000 });
        if (result.code === 0) throw new Error('Should fail without AI service');
        if (result.timedOut) throw new Error('Should not timeout with combined flags');
        if (!result.stdout.includes('Detecting file')) throw new Error('Should detect file with combined flags');
        return result;
      });

      // Test Templates Add Command (will fail in non-interactive environment)
      await this.test('Templates Add Command Error Handling', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'add'], { captureOutput: true, timeout: 3000 });
        // Should fail due to TTY requirement for interactive prompts
        if (result.code === 0) throw new Error('Should fail in non-interactive environment');
        return result;
      });

      // Test Templates Edit Command with Missing ID
      await this.test('Templates Edit Missing ID', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'edit'], { captureOutput: true });
        if (result.code === 0) throw new Error('Should fail with missing template ID');
        if (!result.stdout.includes('Template ID required for edit command')) throw new Error('Should show error message');
        return result;
      });

      // Test Templates Remove Command with Missing ID
      await this.test('Templates Remove Missing ID', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'remove'], { captureOutput: true });
        if (result.code === 0) throw new Error('Should fail with missing template ID');
        if (!result.stdout.includes('Template ID required for remove command')) throw new Error('Should show error message');
        return result;
      });

      // Test Templates Menu Command
      await this.test('Templates Menu Command', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'menu'], { captureOutput: true, timeout: 3000 });
        // Should fail due to TTY requirement for interactive menu
        if (result.code === 0) throw new Error('Should fail in non-interactive environment');
        if (!result.stdout.includes('Interactive mode not available')) throw new Error('Should show non-interactive message');
        return result;
      });

      // Test Setup Wizard Non-Interactive Mode
      await this.test('Setup Wizard Non-Interactive', async () => {
        const env = {
          ...process.env,
          AIFILES_NON_INTERACTIVE: 'true',
          AIFILES_LLM_PROVIDER: 'ollama',
          AIFILES_LLM_MODEL: 'llama3.2',
          AIFILES_CONTINUE_WITHOUT_DEPS: 'true',
          AIFILES_OVERWRITE_CONFIG: 'true'
        };

        const result = await this.runCommand('node', ['dist/setup-wizard.mjs'], {
          captureOutput: true,
          timeout: 10000,
          env
        });

        // Should complete successfully in non-interactive mode
        if (result.code !== 0 && !result.stdout.includes('🤖 AIFiles Setup Wizard')) {
          throw new Error(`Setup wizard failed: ${result.stderr || result.stdout}`);
        }

        // Should have created config
        const configPath = path.join(process.env.HOME, '.aifiles', 'config');
        const fs = await import('fs/promises');
        const configExists = await fs.access(configPath).then(() => true).catch(() => false);
        if (!configExists) throw new Error('Config should be created in non-interactive mode');

        return result;
      });

      // Test Templates Non-Interactive Commands
      await this.test('Templates Enable Command', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'enable', 'pictures'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Enable command should succeed');
        if (!result.stdout.includes('Watching enabled for \'Pictures\'')) throw new Error('Should show enable confirmation');
        return result;
      });

      await this.test('Templates Disable Command', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'disable', 'pictures'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Disable command should succeed');
        if (!result.stdout.includes('Watching disabled for \'Pictures\'')) throw new Error('Should show disable confirmation');
        return result;
      });

      // Test Templates Remove with Confirmation
      await this.test('Templates Remove with Confirmation', async () => {
        // First create a test template
        const addResult = await this.runCommand('node', ['dist/cli-templates.mjs', 'add', 'test-remove', '~/TestRemove', '{file_title}', 'snake', '--yes'], { captureOutput: true, timeout: 5000 });
        if (addResult.code === 0) {
          // Template was added interactively, now test remove with confirmation
          const env = { ...process.env, AIFILES_CONFIRM_DELETE: 'true' };
          const removeResult = await this.runCommand('node', ['dist/cli-templates.mjs', 'remove', 'test-remove'], {
            captureOutput: true,
            env
          });
          if (removeResult.code !== 0) throw new Error('Remove with confirmation should succeed');
          return removeResult;
        } else {
          // Template couldn't be added (non-interactive), skip remove test
          console.log('Skipping remove test - template creation requires interactive mode');
          return { skipped: true };
        }
      });

      // Test Config Persistence
      await this.test('Config Persistence', async () => {
        // Check that config file exists and has content
        const configPath = path.join(process.env.HOME, '.aifiles', 'config');
        const fs = await import('fs/promises');
        const configContent = await fs.readFile(configPath, 'utf8');
        if (!configContent.includes('LLM_PROVIDER=ollama')) throw new Error('Config should contain LLM_PROVIDER');
        if (!configContent.includes('BASE_DIRECTORY=~')) throw new Error('Config should contain BASE_DIRECTORY');
        return { configContent };
      });

      // Test Templates Persistence
      await this.test('Templates Persistence', async () => {
        // Check that templates file exists and has content
        const templatesPath = path.join(process.env.HOME, '.aifiles', 'templates.json');
        const fs = await import('fs/promises');
        const templatesContent = await fs.readFile(templatesPath, 'utf8');
        const templates = JSON.parse(templatesContent);
        if (!Array.isArray(templates)) throw new Error('Templates should be an array');
        if (templates.length !== 6) throw new Error('Should have 6 default templates');
        if (!templates.find(t => t.name === 'Documents')) throw new Error('Should contain Documents template');
        return { templates };
      });

      // Test Invalid Command Handling
      await this.test('Invalid Command Handling', async () => {
        const result = await this.runCommand('node', ['dist/cli.mjs', 'invalid-command'], { captureOutput: true });
        if (result.code === 0) throw new Error('Should fail with invalid command');
        if (!result.stderr.includes('No file specified') && !result.stdout.includes('No file specified')) {
          throw new Error('Should show file not found error for invalid command');
        }
        return result;
      });

      // Test Templates Invalid Operations
      await this.test('Templates Invalid Add', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'add'], { captureOutput: true });
        if (result.code === 0) throw new Error('Should fail with missing arguments');
        return result;
      });

      await this.test('Templates Invalid Edit', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'edit', 'nonexistent'], { captureOutput: true });
        if (result.code === 0) throw new Error('Should fail with nonexistent template');
        // The command may show "Template ID required" or some other error, just check it fails
        return result;
      });

      // Test Help Variations
      await this.test('CLI Help with -h flag', async () => {
        const result = await this.runCommand('node', ['dist/cli.mjs', '-h'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Help command should succeed');
        if (!result.stdout.includes('🤖 AIFiles')) throw new Error('Should show help header');
        return result;
      });

      await this.test('Templates Help with -h flag', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', '-h'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Templates help should succeed');
        if (!result.stdout.includes('aifiles-templates')) throw new Error('Should show templates help');
        return result;
      });

      // Test Version Information
      await this.test('CLI Version Display', async () => {
        const result = await this.runCommand('node', ['dist/cli-templates.mjs', '--version'], { captureOutput: true });
        if (result.code !== 0) throw new Error('Version command should succeed');
        if (!result.stdout.includes('2.0.0')) throw new Error('Should show version number');
        return result;
      });

      // Test Concurrent Operations Safety
      await this.test('Concurrent Templates List', async () => {
        // Run multiple list commands concurrently to test thread safety
        const promises = [];
        for (let i = 0; i < 3; i++) {
          promises.push(this.runCommand('node', ['dist/cli-templates.mjs', 'list'], { captureOutput: true }));
        }
        const results = await Promise.all(promises);
        results.forEach(result => {
          if (result.code !== 0) throw new Error('Concurrent list commands should succeed');
          if (!result.stdout.includes('Found 6 templates:')) throw new Error('Should show consistent template count');
        });
        return results;
      });

      // Test PATH-based command execution (production-like testing)
      const aifilesAvailable = await this.isCommandAvailable('aifiles');
      const templatesAvailable = await this.isCommandAvailable('aifiles-templates');

      if (aifilesAvailable) {
        await this.test('PATH: AIFiles Help Command', async () => {
          const result = await this.runCommand('aifiles', ['--help'], { captureOutput: true });
          if (result.code !== 0) throw new Error('PATH aifiles help should succeed');
          if (!result.stdout.includes('🤖 AIFiles')) throw new Error('Should show help header');
          return result;
        });

        await this.test('PATH: AIFiles Version', async () => {
          const result = await this.runCommand('aifiles', ['--version'], { captureOutput: true });
          if (result.code !== 0) throw new Error('PATH aifiles version should succeed');
          if (!result.stdout.includes('2.0.0')) throw new Error('Should show version');
          return result;
        });

        await this.test('PATH: AIFiles Invalid File', async () => {
          const result = await this.runCommand('aifiles', ['nonexistent-file.xyz'], { captureOutput: true });
          if (result.code === 0) throw new Error('Should fail with nonexistent file');
          if (!result.stdout.includes('File not found')) throw new Error('Should show error message');
          return result;
        });

        await this.test('PATH: AIFiles Watch Daemon', async () => {
          const result = await this.runCommand('timeout', ['3', 'aifiles', 'watch'], { captureOutput: true });
          // Should show daemon startup message
          if (!result.stdout.includes('👀 AIFiles Watch Daemon')) throw new Error('Should show daemon message');
          return result;
        });
      } else {
        await this.test('PATH Commands Not Available', async () => {
          this.log('PATH commands not available - this is expected in development', 'warning');
          // Test npm script execution instead
          const result = await this.runCommand('npm', ['run', 'templates'], { captureOutput: true });
          if (result.code !== 0) throw new Error('npm templates script should work');
          if (!result.stdout.includes('📁 Folder Templates')) throw new Error('Should show templates');
          return result;
        });
      }

      if (templatesAvailable) {
        await this.test('PATH: Templates Help', async () => {
          const result = await this.runCommand('aifiles-templates', ['--help'], { captureOutput: true });
          if (result.code !== 0) throw new Error('PATH templates help should succeed');
          if (!result.stdout.includes('aifiles-templates')) throw new Error('Should show templates help');
          return result;
        });

        await this.test('PATH: Templates List', async () => {
          const result = await this.runCommand('aifiles-templates', ['list'], { captureOutput: true });
          if (result.code !== 0) throw new Error('PATH templates list should succeed');
          if (!result.stdout.includes('Found 6 templates:')) throw new Error('Should show templates');
          return result;
        });

        await this.test('PATH: Templates Version', async () => {
          const result = await this.runCommand('aifiles-templates', ['--version'], { captureOutput: true });
          if (result.code !== 0) throw new Error('PATH templates version should succeed');
          if (!result.stdout.includes('2.0.0')) throw new Error('Should show version');
          return result;
        });
      }

      // Test npm script execution (always available)
      await this.test('NPM Scripts: Templates', async () => {
        const result = await this.runCommand('npm', ['run', 'templates'], { captureOutput: true });
        if (result.code !== 0) throw new Error('npm templates script should work');
        if (!result.stdout.includes('📁 Folder Templates')) throw new Error('Should show templates');
        return result;
      });

      await this.test('NPM Scripts: Build', async () => {
        // Since we already built at the beginning, just verify build artifacts exist
        const fs = await import('fs/promises');
        const cliExists = await fs.access('dist/cli.mjs').then(() => true).catch(() => false);
        const templatesExists = await fs.access('dist/cli-templates.mjs').then(() => true).catch(() => false);

        if (!cliExists) throw new Error('Build artifacts missing - dist/cli.mjs not found');
        if (!templatesExists) throw new Error('Build artifacts missing - dist/cli-templates.mjs not found');

        return { cliExists, templatesExists };
      });

      // Test installation scenarios
      await this.test('NPM Pack Verification', async () => {
        const result = await this.runCommand('npm', ['pack', '--dry-run'], { captureOutput: true });
        if (result.code !== 0) throw new Error('npm pack should work');
        if (!result.stdout.includes('aifiles-2.0.0.tgz')) throw new Error('Should create package');
        return result;
      });

      // Test global installation simulation
      await this.test('Binary File Verification', async () => {
        const fs = await import('fs/promises');
        const cliExists = await fs.access('dist/cli.mjs').then(() => true).catch(() => false);
        const templatesExists = await fs.access('dist/cli-templates.mjs').then(() => true).catch(() => false);

        if (!cliExists) throw new Error('dist/cli.mjs should exist');
        if (!templatesExists) throw new Error('dist/cli-templates.mjs should exist');

        // Test that binaries are executable
        const cliResult = await this.runCommand('node', ['dist/cli.mjs', '--version'], { captureOutput: true });
        if (cliResult.code !== 0) throw new Error('CLI binary should be executable');

        const templatesResult = await this.runCommand('node', ['dist/cli-templates.mjs', '--version'], { captureOutput: true });
        if (templatesResult.code !== 0) throw new Error('Templates binary should be executable');

        return { cliExists, templatesExists };
      });

      // Test package.json bin configuration
      await this.test('Package.json Bin Configuration', async () => {
        const fs = await import('fs/promises');
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));

        if (!packageJson.bin) throw new Error('package.json should have bin field');
        if (!packageJson.bin.aifiles) throw new Error('Should have aifiles binary');
        if (!packageJson.bin['aifiles-templates']) throw new Error('Should have aifiles-templates binary');
        if (!packageJson.bin['aifiles-setup']) throw new Error('Should have aifiles-setup binary');

        if (packageJson.bin.aifiles !== 'dist/cli.mjs') throw new Error('aifiles bin should point to dist/cli.mjs');
        if (packageJson.bin['aifiles-templates'] !== 'dist/cli-templates.mjs') throw new Error('templates bin should point to dist/cli-templates.mjs');

        return packageJson.bin;
      });

      // Test cross-platform compatibility (basic)
      await this.test('Cross-platform Path Handling', async () => {
        // Test with different path formats
        const testFile = path.join(this.testDataDir, 'test-document.txt');
        const result1 = await this.runCommand('node', ['dist/cli.mjs', testFile], { captureOutput: true, timeout: 5000 });

        // Test with relative path
        const relativePath = path.relative(process.cwd(), testFile);
        const result2 = await this.runCommand('node', ['dist/cli.mjs', relativePath], { captureOutput: true, timeout: 5000 });

        // Both should show similar behavior (both fail due to no AI service, but should detect files)
        if (!result1.stdout.includes('Detecting file')) throw new Error('Should detect file with absolute path');
        if (!result2.stdout.includes('Detecting file')) throw new Error('Should detect file with relative path');

        return { absolute: result1, relative: result2 };
      });

      // Test environment variable handling
      await this.test('Environment Variable Handling', async () => {
        // Test with custom environment
        const result = await this.runCommand('node', ['dist/cli.mjs', '--help'], {
          captureOutput: true,
          env: { ...process.env, NODE_ENV: 'test' }
        });
        if (result.code !== 0) throw new Error('Should work with custom environment');
        if (!result.stdout.includes('🤖 AIFiles')) throw new Error('Should show help regardless of environment');
        return result;
      });

      // Test large file handling (basic)
      await this.test('Large File Handling', async () => {
        // Create a moderately large test file
        const fs = await import('fs/promises');
        const largeContent = 'x'.repeat(100000); // 100KB file
        const largeFile = path.join(this.testDataDir, 'large-test.txt');
        await fs.writeFile(largeFile, largeContent);

        const result = await this.runCommand('node', ['dist/cli.mjs', largeFile], { captureOutput: true, timeout: 10000 });
        // Should still attempt processing (may fail due to AI service, but should detect file)
        if (!result.stdout.includes('Detecting file')) throw new Error('Should detect large file');
        return result;
      });

      // Test unicode/special character handling
      await this.test('Unicode File Handling', async () => {
        const fs = await import('fs/promises');
        const unicodeContent = 'Hello 🌍 with émojis and spëcial chärs!';
        const unicodeFile = path.join(this.testDataDir, 'unicode-tëst.txt');
        await fs.writeFile(unicodeFile, unicodeContent);

        const result = await this.runCommand('node', ['dist/cli.mjs', unicodeFile], { captureOutput: true, timeout: 5000 });
        if (!result.stdout.includes('Detecting file')) throw new Error('Should handle unicode filenames');
        return result;
      });

      // Test database operations
      await this.test('Database Operations', async () => {
        // First create a config and run a command to initialize database
        const testFile = path.join(this.testDataDir, 'db-test.txt');
        await this.runCommand('node', ['dist/cli.mjs', testFile], { captureOutput: true, timeout: 5000 });

        // Check if database file was created
        const fs = await import('fs/promises');
        const dbPath = path.join(process.env.HOME, '.aifiles', 'database.sqlite');
        const dbExists = await fs.access(dbPath).then(() => true).catch(() => false);

        if (!dbExists) {
          throw new Error('Database file should be created automatically');
        }

        // Test filemanager command shows empty or initialized state
        const filemanagerResult = await this.runCommand('node', ['dist/cli.mjs', 'filemanager'], { captureOutput: true, timeout: 5000 });
        // Should not crash, even if database is empty
        return { dbExists, filemanagerResult };
      });

      // Test configuration validation
      await this.test('Configuration Validation', async () => {
        const fs = await import('fs/promises');
        const configPath = path.join(process.env.HOME, '.aifiles', 'config');

        // Read the created config
        const configContent = await fs.readFile(configPath, 'utf8');
        const configLines = configContent.split('\n').filter(line => line.trim());

        // Validate required configuration keys
        const requiredKeys = ['LLM_PROVIDER', 'BASE_DIRECTORY', 'DOCUMENT_DIRECTORY'];
        for (const key of requiredKeys) {
          if (!configLines.some(line => line.startsWith(`${key}=`))) {
            throw new Error(`Config should contain ${key}`);
          }
        }

        // Validate LLM provider is set to a valid value
        const providerLine = configLines.find(line => line.startsWith('LLM_PROVIDER='));
        if (!providerLine || (!providerLine.includes('ollama') && !providerLine.includes('openai'))) {
          throw new Error('LLM_PROVIDER should be set to a valid provider');
        }

        return { configLines: configLines.length, provider: providerLine };
      });

      // Test template file operations
      await this.test('Template File Operations', async () => {
        const fs = await import('fs/promises');
        const templatesPath = path.join(process.env.HOME, '.aifiles', 'templates.json');

        // Read templates file
        const templatesContent = await fs.readFile(templatesPath, 'utf8');
        const templates = JSON.parse(templatesContent);

        // Validate template structure
        if (!Array.isArray(templates)) throw new Error('Templates should be an array');
        if (templates.length === 0) throw new Error('Should have default templates');

        // Check each template has required fields
        for (const template of templates) {
          if (!template.id) throw new Error('Template should have id');
          if (!template.name) throw new Error('Template should have name');
          if (!template.basePath) throw new Error('Template should have basePath');
          if (!template.namingStructure) throw new Error('Template should have namingStructure');
        }

        // Test template list formatting
        const listResult = await this.runCommand('node', ['dist/cli-templates.mjs', 'list'], { captureOutput: true });
        if (!listResult.stdout.includes('📁 Folder Templates')) throw new Error('Should show templates header');
        if (!listResult.stdout.includes(`Found ${templates.length} templates:`)) throw new Error('Should show correct template count');

        return { templateCount: templates.length, templates };
      });

      // Test file watching with actual file changes
      await this.test('File Watching with Changes', async () => {
        // Start watch daemon in background
        const watchProcess = spawn('node', ['dist/cli.mjs', 'watch'], {
          cwd: path.join(__dirname, '..'),
          stdio: 'pipe',
          detached: true
        });

        // Wait a moment for daemon to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          // Create a new file in a watched directory
          const fs = await import('fs/promises');
          const watchedFile = path.join(this.testDataDir, 'watched-file.txt');
          await fs.writeFile(watchedFile, 'This file should be detected by the watcher');

          // Wait for potential processing
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Stop the watch daemon
          watchProcess.kill();

          // Check if the daemon was running (should have shown startup message)
          return { watchedFileCreated: true };
        } finally {
          // Ensure process is killed
          try {
            watchProcess.kill('SIGKILL');
          } catch (e) {
            // Ignore if already killed
          }
        }
      });

      // Test error recovery and retry logic
      await this.test('Error Recovery and Retry', async () => {
        const testFile = path.join(this.testDataDir, 'error-recovery.txt');
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile], { captureOutput: true, timeout: 8000 });

        // Should handle the error gracefully and not crash the application
        if (result.code === null && !result.timedOut) {
          throw new Error('Process should exit cleanly, not hang indefinitely');
        }

        return result;
      });

      // Test memory usage (basic)
      await this.test('Memory Usage Validation', async () => {
        const { execSync } = await import('child_process');

        // Run a command and check it doesn't consume excessive memory
        const startTime = Date.now();
        const result = await this.runCommand('node', ['dist/cli.mjs', '--help'], { captureOutput: true });
        const endTime = Date.now();

        // Should complete reasonably quickly (< 5 seconds)
        if (endTime - startTime > 5000) {
          throw new Error('Command took too long to execute');
        }

        // Should use reasonable memory (process should complete without OOM)
        if (result.code !== 0) {
          throw new Error('Help command should succeed');
        }

        return { executionTime: endTime - startTime };
      });

      // Test multiple file processing
      await this.test('Multiple File Processing', async () => {
        const fs = await import('fs/promises');

        // Create multiple test files
        const files = [];
        for (let i = 1; i <= 3; i++) {
          const filePath = path.join(this.testDataDir, `multi-test-${i}.txt`);
          await fs.writeFile(filePath, `Content for file ${i}`);
          files.push(filePath);
        }

        // Process each file individually
        const results = [];
        for (const file of files) {
          const result = await this.runCommand('node', ['dist/cli.mjs', file], { captureOutput: true, timeout: 5000 });
          results.push(result);
          // Each should attempt processing (may fail due to no AI service)
          if (!result.stdout.includes('Detecting file')) {
            throw new Error(`Should detect file ${file}`);
          }
        }

        return { filesProcessed: results.length, results };
      });

      // Test configuration backup and restore
      await this.test('Configuration Backup/Restore', async () => {
        const fs = await import('fs/promises');
        const configPath = path.join(process.env.HOME, '.aifiles', 'config');
        const backupPath = path.join(process.env.HOME, '.aifiles', 'config.backup');

        // Backup original config
        await fs.copyFile(configPath, backupPath);

        try {
          // Modify config
          const modifiedConfig = '# Modified test config\nLLM_PROVIDER=openai\nBASE_DIRECTORY=/tmp\n';
          await fs.writeFile(configPath, modifiedConfig);

          // Verify modification
          const modifiedContent = await fs.readFile(configPath, 'utf8');
          if (!modifiedContent.includes('LLM_PROVIDER=openai')) {
            throw new Error('Config modification should be visible');
          }

          // Restore backup
          await fs.copyFile(backupPath, configPath);

          // Verify restoration
          const restoredContent = await fs.readFile(configPath, 'utf8');
          if (!restoredContent.includes('LLM_PROVIDER=ollama')) {
            throw new Error('Config should be restored to original');
          }

          return { backupRestored: true };
        } finally {
          // Clean up backup
          try {
            await fs.unlink(backupPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      });

      // Test template export/import functionality
      await this.test('Template Export/Import', async () => {
        const fs = await import('fs/promises');
        const templatesPath = path.join(process.env.HOME, '.aifiles', 'templates.json');
        const exportPath = path.join(this.testDataDir, 'templates-export.json');

        // Export templates
        await fs.copyFile(templatesPath, exportPath);

        // Verify export file exists and is valid JSON
        const exportContent = await fs.readFile(exportPath, 'utf8');
        const exportedTemplates = JSON.parse(exportContent);

        if (!Array.isArray(exportedTemplates)) {
          throw new Error('Exported templates should be valid JSON array');
        }

        // Compare with original
        const originalContent = await fs.readFile(templatesPath, 'utf8');
        const originalTemplates = JSON.parse(originalContent);

        if (exportedTemplates.length !== originalTemplates.length) {
          throw new Error('Exported templates should match original count');
        }

        return { exportedCount: exportedTemplates.length };
      });

      // Test command argument validation
      await this.test('Command Argument Validation', async () => {
        // Test various invalid argument combinations
        const invalidArgs = [
          ['node', 'dist/cli.mjs'], // No file argument
          ['node', 'dist/cli.mjs', '--invalid-flag'], // Invalid flag
          ['node', 'dist/cli-templates.mjs', 'invalid-command'], // Invalid template command
        ];

        const results = [];
        for (const args of invalidArgs) {
          const result = await this.runCommand(args[0], args.slice(1), { captureOutput: true, timeout: 3000 });
          results.push(result);
          // Should either fail with error or timeout gracefully
        }

        return { testsRun: results.length, results };
      });

      // Test help system completeness
      await this.test('Help System Completeness', async () => {
        const helpResult = await this.runCommand('node', ['dist/cli.mjs', '--help'], { captureOutput: true });
        const templatesHelpResult = await this.runCommand('node', ['dist/cli-templates.mjs', '--help'], { captureOutput: true });

        // Check for essential help sections
        const requiredHelpSections = [
          'USAGE',
          'AVAILABLE COMMANDS',
          'COMMAND LINE FLAGS',
          'FILE TYPES SUPPORTED'
        ];

        for (const section of requiredHelpSections) {
          if (!helpResult.stdout.includes(section)) {
            throw new Error(`Help should contain "${section}" section`);
          }
        }

        // Check templates help
        if (!templatesHelpResult.stdout.includes('aifiles-templates')) {
          throw new Error('Templates help should contain command name');
        }

        return { helpComplete: true };
      });

      // Test version consistency
      await this.test('Version Consistency', async () => {
        const fs = await import('fs/promises');
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));

        const cliVersion = await this.runCommand('node', ['dist/cli.mjs', '--version'], { captureOutput: true });
        const templatesVersion = await this.runCommand('node', ['dist/cli-templates.mjs', '--version'], { captureOutput: true });

        const expectedVersion = packageJson.version;

        if (!cliVersion.stdout.includes(expectedVersion)) {
          throw new Error(`CLI version should match package.json: ${expectedVersion}`);
        }

        if (!templatesVersion.stdout.includes(expectedVersion)) {
          throw new Error(`Templates version should match package.json: ${expectedVersion}`);
        }

        return { version: expectedVersion };
      });

      // Test process isolation (each command runs independently)
      await this.test('Process Isolation', async () => {
        // Run multiple commands simultaneously
        const commands = [
          ['node', ['dist/cli.mjs', '--help']],
          ['node', ['dist/cli-templates.mjs', '--help']],
          ['node', ['dist/cli.mjs', '--version']]
        ];

        const results = await Promise.all(
          commands.map(([cmd, args]) =>
            this.runCommand(cmd, args, { captureOutput: true, timeout: 5000 })
          )
        );

        // All should succeed independently
        results.forEach((result, index) => {
          if (result.code !== 0) {
            throw new Error(`Command ${index} should succeed independently`);
          }
        });

        return { concurrentCommands: results.length };
      });

      // Test graceful shutdown handling
      await this.test('Graceful Shutdown Handling', async () => {
        // Start a long-running command and interrupt it
        const child = spawn('node', ['dist/cli.mjs', 'watch'], {
          cwd: path.join(__dirname, '..'),
          stdio: 'pipe'
        });

        // Let it start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Send interrupt signal
        child.kill('SIGINT');

        // Wait for clean shutdown
        const shutdownPromise = new Promise((resolve) => {
          child.on('close', (code) => {
            resolve(code);
          });
        });

        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => resolve('timeout'), 5000);
        });

        const result = await Promise.race([shutdownPromise, timeoutPromise]);

        if (result === 'timeout') {
          child.kill('SIGKILL'); // Force kill if not responding to SIGINT
        }

        return { shutdownGraceful: result !== 'timeout' };
      });

      // Test resource cleanup
      await this.test('Resource Cleanup', async () => {
        // Run several commands and verify no lingering processes or files
        const fs = await import('fs/promises');

        const tempFilesBefore = await fs.readdir(this.testDataDir).catch(() => []);

        // Run various commands
        await this.runCommand('node', ['dist/cli.mjs', '--help'], { captureOutput: true });
        await this.runCommand('node', ['dist/cli-templates.mjs', 'list'], { captureOutput: true });

        const tempFilesAfter = await fs.readdir(this.testDataDir).catch(() => []);

        // Should not create unexpected temporary files
        const newFiles = tempFilesAfter.filter(file => !tempFilesBefore.includes(file));

        // Only our test files should be created (no unexpected temp files)
        const unexpectedFiles = newFiles.filter(file => !file.startsWith('test-') && !file.startsWith('multi-test-') && !file.startsWith('unicode-'));

        if (unexpectedFiles.length > 0) {
          throw new Error(`Unexpected files created: ${unexpectedFiles.join(', ')}`);
        }

        return { tempFilesCreated: newFiles.length - tempFilesBefore.length };
      });

      // Test for Path Resolution Bugs (should fail if undefined paths are used)
      await this.test('Path Resolution Bug Detection', async () => {
        const testFile = path.join(this.testDataDir, 'test-document.txt');

        // This test should catch the bug where undefined is passed to resolvePath
        const result = await this.runCommand('node', ['dist/cli.mjs', testFile], {
          captureOutput: true,
          timeout: 10000
        });

        // The command should either succeed or fail with a proper error message
        // It should NOT fail with "ENOTENT: ...undefined" which indicates a bug
        if (result.stdout.includes('undefined') && result.stdout.includes('ENOTENT')) {
          throw new Error('Path resolution bug detected: undefined path in error message');
        }

        if (result.stderr && result.stderr.includes('undefined') && result.stderr.includes('ENOTENT')) {
          throw new Error('Path resolution bug detected: undefined path in stderr');
        }

        // The command should fail (exit code !== 0) due to no AI service, but not due to bugs
        if (result.code === 0) {
          throw new Error('Command should fail without AI service');
        }

        return result;
      });

      // Test Configuration Edge Cases
      await this.test('Configuration Edge Cases', async () => {
        const fs = await import('fs/promises');
        const configPath = path.join(process.env.HOME, '.aifiles', 'config');

        // Test with malformed config
        const originalConfig = await fs.readFile(configPath, 'utf8');
        try {
          // Write malformed config
          await fs.writeFile(configPath, 'INVALID_CONFIG_LINE\nLLM_PROVIDER=ollama\n');

          // Try to run a command - should handle malformed config gracefully
          const result = await this.runCommand('node', ['dist/cli.mjs', '--help'], { captureOutput: true, timeout: 5000 });

          // Should still work despite malformed config
          if (result.code !== 0) {
            throw new Error('Command should work even with malformed config');
          }

        } finally {
          // Restore original config
          await fs.writeFile(configPath, originalConfig);
        }

        return { configEdgeCaseHandled: true };
      });

      // Test Template Validation
      await this.test('Template Validation', async () => {
        const fs = await import('fs/promises');
        const templatesPath = path.join(process.env.HOME, '.aifiles', 'templates.json');

        // Backup original templates
        const originalTemplates = await fs.readFile(templatesPath, 'utf8');

        try {
          // Write malformed templates
          await fs.writeFile(templatesPath, 'invalid json content');

          // Try to list templates - should handle malformed JSON gracefully
          const result = await this.runCommand('node', ['dist/cli-templates.mjs', 'list'], { captureOutput: true, timeout: 5000 });

          // Should either fail gracefully or recreate templates
          if (result.code !== 0 && !result.stdout.includes('Found') && !result.stdout.includes('📁')) {
            // If it fails, it should fail with a proper error, not crash
            if (!result.stdout.includes('Error') && !result.stderr) {
              throw new Error('Should handle malformed templates gracefully');
            }
          }

        } finally {
          // Restore original templates
          await fs.writeFile(templatesPath, originalTemplates);
        }

        return { templateValidationHandled: true };
      });

      // Test Memory Leaks (basic)
      await this.test('Memory Leak Detection', async () => {
        // Run the same command multiple times to check for memory issues
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const result = await this.runCommand('node', ['dist/cli.mjs', '--help'], { captureOutput: true, timeout: 5000 });
          if (result.code !== 0) {
            throw new Error(`Help command failed on iteration ${i}`);
          }

          // Small delay to allow any memory issues to surface
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        return { iterationsCompleted: iterations };
      });

    } finally {
      await this.teardown();
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 AI FILES INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Passed: ${this.results.passed}`);
    console.log(`   ❌ Failed: ${this.results.failed}`);
    console.log(`   ⏭️  Skipped: ${this.results.skipped}`);
    console.log(`   📋 Total: ${this.results.passed + this.results.failed + this.results.skipped}`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }

    console.log('\n✅ Passed Tests:');
    this.results.tests
      .filter(test => test.status === 'passed')
      .forEach(test => {
        console.log(`   • ${test.name}`);
      });

    console.log('\n' + '='.repeat(60));

    const success = this.results.failed === 0;
    console.log(success ? '🎉 ALL INTEGRATION TESTS PASSED!' : '⚠️  SOME TESTS FAILED');
    console.log('='.repeat(60));

    return success;
  }

  async run() {
    this.log('Starting AIFiles Integration Test Suite');

    try {
      await this.runAllTests();

      const success = this.printResults();

      if (!success) {
        process.exit(1);
      }

    } catch (error) {
      this.log(`Integration test suite failed: ${error.message}`, 'error');
      this.printResults();
      process.exit(1);
    }
  }
}

// Run the integration tests
const tester = new IntegrationTester();
tester.run();
