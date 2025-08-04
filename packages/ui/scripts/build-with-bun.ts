import { build, type BuildConfig, type BunPlugin } from 'bun'
import { watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'

const EXTERNAL_PACKAGES = [
  'react',
  'react-dom',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
  '@radix-ui/react-accordion',
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-aspect-ratio',
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-hover-card',
  '@radix-ui/react-icons',
  '@radix-ui/react-label',
  '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu',
  '@radix-ui/react-popover',
  '@radix-ui/react-progress',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slider',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toast',
  '@radix-ui/react-toggle',
  '@radix-ui/react-toggle-group',
  '@radix-ui/react-tooltip',
  '@tanstack/react-table',
  'cmdk',
  'date-fns',
  'lucide-react',
  'react-day-picker',
  'react-hook-form',
  'react-resizable-panels',
  'recharts',
  'sonner',
  'tailwindcss-animate',
  'vaul',
  '@hookform/resolvers',
  'zod',
  'framer-motion',
  'react-markdown',
  'react-syntax-highlighter',
  'remark-gfm',
  'react-syntax-highlighter/dist/esm/languages/hljs/typescript',
  'react-syntax-highlighter/dist/esm/languages/hljs/javascript',
  'react-syntax-highlighter/dist/esm/languages/hljs',
  'react-syntax-highlighter/dist/esm/styles/hljs'
]

const isWatchMode = process.argv.includes('--watch')
const isProduction = process.env.NODE_ENV === 'production'

// Bundle size reporting plugin
const bundleSizePlugin: BunPlugin = {
  name: 'bundle-size-reporter',
  setup(build) {
    const sizes: Map<string, number> = new Map()

    build.onStart(() => {
      sizes.clear()
    })

    // Note: Bun's plugin API is still evolving
    // This is a simplified version that will report sizes after build
  }
}

async function reportBundleSizes(distDir: string) {
  const files = await $`find ${distDir} -name "*.js" -o -name "*.mjs"`.text()
  const filePaths = files.trim().split('\n').filter(Boolean)

  console.log('\n📊 Bundle Size Report:')
  console.log('─'.repeat(50))

  let totalSize = 0
  for (const filePath of filePaths) {
    if (filePath) {
      const stats = await stat(filePath)
      const sizeInKB = (stats.size / 1024).toFixed(2)
      const relativePath = filePath.replace(distDir + '/', '')
      console.log(`${relativePath.padEnd(30)} ${sizeInKB.padStart(10)} KB`)
      totalSize += stats.size
    }
  }

  console.log('─'.repeat(50))
  console.log(`${'Total'.padEnd(30)} ${(totalSize / 1024).toFixed(2).padStart(10)} KB`)

  // Check if gzip is available and report gzipped sizes
  try {
    console.log('\n📦 Gzipped Sizes:')
    console.log('─'.repeat(50))

    for (const filePath of filePaths) {
      if (filePath && filePath.endsWith('.js')) {
        const gzipResult = await $`gzip -c ${filePath} | wc -c`.text()
        const gzipSize = parseInt(gzipResult.trim())
        const sizeInKB = (gzipSize / 1024).toFixed(2)
        const relativePath = filePath.replace(distDir + '/', '')
        console.log(`${relativePath.padEnd(30)} ${sizeInKB.padStart(10)} KB (gzip)`)
      }
    }
  } catch (error) {
    // gzip not available, skip gzipped size reporting
  }
}

async function buildPackage() {
  console.log('🔨 Building @promptliano/ui with Bun...')
  const startTime = performance.now()

  try {
    // Clean dist directory
    await $`rm -rf dist`
    await $`mkdir -p dist`

    // Build configurations
    const baseConfig: Partial<BuildConfig> = {
      target: 'browser',
      minify: isProduction,
      sourcemap: isProduction ? 'external' : 'inline',
      external: EXTERNAL_PACKAGES,
      define: {
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      },
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'css',
        '.module.css': 'css'
      }
    }

    // Build ESM format
    console.log('📦 Building ESM format...')
    const esmResult = await build({
      ...baseConfig,
      entrypoints: ['./src/index.ts'],
      outdir: './dist',
      format: 'esm',
      splitting: false,
      naming: '[name].js'
    })

    if (!esmResult.success) {
      console.error('❌ ESM build failed')
      for (const log of esmResult.logs) {
        console.error(log)
      }
      return false
    }

    // Skip CJS build - modern ESM only

    // Generate TypeScript declarations
    console.log('🔤 Generating TypeScript declarations...')
    const tscResult = await $`tsc --project tsconfig.build.json`.quiet()

    if (tscResult.exitCode !== 0) {
      console.error('❌ TypeScript declaration generation failed')
      console.error(tscResult.stderr.toString())
      return false
    }

    const endTime = performance.now()
    const totalSeconds = ((endTime - startTime) / 1000).toFixed(2)
    console.log(`✨ Build completed in ${totalSeconds}s`)

    // Log output files
    const files = await $`find dist -type f -name "*.js" -o -name "*.d.ts" | sort`.text()
    console.log('\n📄 Output files:')
    console.log(files.trim())

    // Report bundle sizes
    await reportBundleSizes('./dist')

    return true
  } catch (error) {
    console.error('❌ Build failed:', error)
    return false
  }
}

// Watch mode implementation
async function watchAndBuild() {
  console.log('👀 Watching for changes...')

  // Initial build
  await buildPackage()

  // Watch src directory
  const srcDir = join(process.cwd(), 'src')
  let buildTimeout: Timer | null = null

  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'))) {
      console.log(`\n🔄 Change detected in ${filename}`)

      // Debounce builds
      if (buildTimeout) {
        clearTimeout(buildTimeout)
      }

      buildTimeout = setTimeout(async () => {
        await buildPackage()
      }, 300)
    }
  })

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watch mode...')
    watcher.close()
    process.exit(0)
  })
}

// Main execution
if (isWatchMode) {
  await watchAndBuild()
} else {
  const success = await buildPackage()
  process.exit(success ? 0 : 1)
}
