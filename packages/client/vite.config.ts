import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { resolve } from 'path';

// babel.config.js
const ReactCompilerConfig = {
  target: '19' // '17' | '18' | '19'
};


// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5174
  },
  plugins: [TanStackRouterVite({}), react({
    babel: {
      plugins: [
        ["babel-plugin-react-compiler", ReactCompilerConfig],
      ],
    },
  })],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // Add other entry points if necessary
      },
      // Exclude test files from the build
      external: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/tests/**',
        '**/__tests__/**',
      ],
    },
  },
});
