import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';



// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5173
  },
  plugins: [TanStackRouterVite({}), react({

  }),
  tsconfigPaths()

  ],
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
