import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false
  },
  plugins: [
    // TanStackRouterVite automatically generates routeTree.gen.ts during dev and build
    tanstackRouter(),
    react({}),
    tsconfigPaths(),
    // AGGRESSIVE BACKEND BLOCKING PLUGIN
    {
      name: 'block-backend-packages',
      resolveId(id, importer) {
        // Aggressively block any attempt to import backend packages
        if (id.includes('@promptliano/storage') || 
            id.includes('@promptliano/services') ||
            id.includes('@promptliano/config') ||
            id.includes('encryptionKeyStorage') ||
            id.includes('crypto.ts') ||
            id === '@swc/core') {
          console.warn(`🚫 BLOCKED backend import attempt: ${id} from ${importer}`)
          return { id: 'data:text/javascript,export default {}', external: false }
        }
        return null
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Block ALL backend packages completely - ABSOLUTE NO BACKEND PACKAGES
      '@promptliano/services': false,
      '@promptliano/storage': false,
      '@promptliano/config': false,
      '@promptliano/services/*': false,
      '@promptliano/storage/*': false,
      '@promptliano/config/*': false
    }
  },
  optimizeDeps: {
    exclude: ['fsevents', '@swc/core', '@promptliano/services', '@promptliano/storage', '@promptliano/config']
  },
  build: {
    outDir: resolve(__dirname, '../server/client-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
        // Add other entry points if necessary
      },
      // Exclude test files from the build and native modules + ALL backend packages
      external: [
        '**/*.test.ts', 
        '**/*.test.tsx', 
        '**/*.spec.ts', 
        '**/*.spec.tsx', 
        '**/tests/**', 
        '**/__tests__/**',
        'fsevents',
        '@swc/core',
        '@promptliano/services',
        '@promptliano/services/**',
        '@promptliano/storage',
        '@promptliano/storage/**',
        '@promptliano/config',
        '@promptliano/config/**'
      ]
    }
  }
})
