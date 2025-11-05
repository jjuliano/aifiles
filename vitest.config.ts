/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    bail: true,
    maxThreads: 1,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'src-tauri/',
        'target/',
        'release/',
        'build.rs',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'examples/',
        'scripts/',
        'pkgroll.config.ts',
        'tauri.conf.json',
        'Cargo.*',
      ],
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
