import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: 'src/routes',
      generatedRouteTree: 'src/routeTree.gen.ts',
      autoCodeSplitting: true
    }),
    react(),
    tsconfigPaths(),
    // Bundle visualization
    ...(process.env.ANALYZE
      ? [visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true
      })]
      : []),
    // Compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      deleteOriginFile: false
    }),
    // PWA
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Promptliano',
        short_name: 'Promptliano',
        description: 'AI Project Management Platform',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  base: process.env.VITE_BASE_URL || '/',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.info'] : []
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React dependencies
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor'
          }
          // Router
          if (id.includes('@tanstack/react-router')) {
            return 'router'
          }
          // UI Components
          if (id.includes('@radix-ui') || id.includes('class-variance-authority') || id.includes('clsx')) {
            return 'ui'
          }
          // Animation
          if (id.includes('framer-motion')) {
            return 'animation'
          }
          // Markdown & Syntax highlighting
          if (id.includes('react-markdown') || id.includes('react-syntax-highlighter') || id.includes('rehype')) {
            return 'markdown'
          }
          // Forms & validation
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
            return 'forms'
          }
          // Data fetching
          if (id.includes('@tanstack/react-query')) {
            return 'query'
          }
          // Utilities
          if (id.includes('tailwind-merge') || id.includes('lucide-react')) {
            return 'utils'
          }
        },
        // Optimize chunk names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk'
          return `assets/js/${chunkInfo.name || facadeModuleId}-[hash].js`
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || 'asset'
          const info = name.split('.')
          const ext = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`
          } else if (/woff2?|ttf|otf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`
          } else if (ext === 'css') {
            return `assets/css/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      },
      // Tree shaking
      treeshake: {
        preset: 'recommended',
        manualPureFunctions: ['console.log', 'console.info']
      }
    },
    // CSS optimization
    cssCodeSplit: true,
    cssMinify: true,
    // Performance
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000
  },
  // Optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-query', 'framer-motion']
  },
  // Resolve
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
