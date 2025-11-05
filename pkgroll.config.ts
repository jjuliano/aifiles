import { defineConfig } from 'pkgroll';

export default defineConfig({
  external: [
    'music-metadata',
    'readable-web-to-node-stream',
    'readable-stream'
  ],
  rollup: {
    onLog(level, log, handler) {
      // Filter out circular dependency warnings from node_modules
      if (log.code === 'CIRCULAR_DEPENDENCY') {
        const message = log.message || '';
        if (message.includes('node_modules')) {
          return;
        }
      }
      // Pass through all other logs
      handler(level, log);
    },
    onwarn(warning, warn) {
      // Suppress circular dependency warnings from third-party packages
      if (warning.code === 'CIRCULAR_DEPENDENCY') {
        const message = warning.message || '';
        if (message.includes('node_modules')) {
          return;
        }
      }
      // Show all other warnings
      warn(warning);
    }
  }
});
