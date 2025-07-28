#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { gzipSync } from 'zlib'

interface BundleInfo {
  name: string
  size: number
  gzipSize: number
  brotliSize?: number
  type: string
}

const DIST_DIR = join(process.cwd(), 'dist')
const SIZE_LIMITS = {
  js: 250 * 1024, // 250KB per JS chunk
  css: 50 * 1024, // 50KB per CSS file
  total: 1024 * 1024 // 1MB total
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  const kb = bytes / 1024
  if (kb < 1024) return kb.toFixed(2) + ' KB'
  const mb = kb / 1024
  return mb.toFixed(2) + ' MB'
}

function getBrotliSize(content: Buffer): number {
  try {
    const brotliCompressed = execSync('brotli', {
      input: content,
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024
    })
    return brotliCompressed.length
  } catch {
    return 0
  }
}

function analyzeFile(filePath: string): BundleInfo | null {
  const ext = extname(filePath).toLowerCase()
  if (!['.js', '.css', '.html'].includes(ext)) return null

  const content = readFileSync(filePath)
  const size = content.length
  const gzipSize = gzipSync(content).length
  const brotliSize = getBrotliSize(content)

  return {
    name: filePath.replace(DIST_DIR + '/', ''),
    size,
    gzipSize,
    brotliSize,
    type: ext.slice(1)
  }
}

function getAllFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files)
    } else if (stat.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

function analyzeBundle() {
  console.log('🔍 Analyzing bundle size...\n')

  const files = getAllFiles(DIST_DIR)
  const bundles: BundleInfo[] = []

  for (const file of files) {
    const info = analyzeFile(file)
    if (info) bundles.push(info)
  }

  // Sort by size
  bundles.sort((a, b) => b.size - a.size)

  // Group by type
  const byType = bundles.reduce(
    (acc, bundle) => {
      if (!acc[bundle.type]) acc[bundle.type] = []
      acc[bundle.type].push(bundle)
      return acc
    },
    {} as Record<string, BundleInfo[]>
  )

  // Display results
  console.log('📦 Bundle Analysis Report\n')
  console.log('='.repeat(80))

  let totalSize = 0
  let totalGzipSize = 0
  let totalBrotliSize = 0

  for (const [type, typeBundles] of Object.entries(byType)) {
    console.log(`\n${type.toUpperCase()} Files:`)
    console.log('-'.repeat(80))
    console.log('File'.padEnd(50), 'Size'.padEnd(10), 'Gzip'.padEnd(10), 'Brotli'.padEnd(10))
    console.log('-'.repeat(80))

    for (const bundle of typeBundles) {
      const sizeStr = formatBytes(bundle.size)
      const gzipStr = formatBytes(bundle.gzipSize)
      const brotliStr = bundle.brotliSize ? formatBytes(bundle.brotliSize) : 'N/A'

      console.log(bundle.name.padEnd(50), sizeStr.padEnd(10), gzipStr.padEnd(10), brotliStr.padEnd(10))

      totalSize += bundle.size
      totalGzipSize += bundle.gzipSize
      totalBrotliSize += bundle.brotliSize || 0
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('TOTALS:')
  console.log('-'.repeat(80))
  console.log(`Total Size:        ${formatBytes(totalSize)}`)
  console.log(`Total Gzip Size:   ${formatBytes(totalGzipSize)}`)
  console.log(`Total Brotli Size: ${formatBytes(totalBrotliSize)}`)
  console.log('='.repeat(80))

  // Check size limits
  console.log('\n📏 Size Limit Checks:')
  console.log('-'.repeat(80))

  let hasViolations = false

  // Check individual JS chunks
  const jsFiles = byType.js || []
  for (const file of jsFiles) {
    if (file.size > SIZE_LIMITS.js) {
      console.log(`❌ ${file.name}: ${formatBytes(file.size)} (limit: ${formatBytes(SIZE_LIMITS.js)})`)
      hasViolations = true
    }
  }

  // Check individual CSS files
  const cssFiles = byType.css || []
  for (const file of cssFiles) {
    if (file.size > SIZE_LIMITS.css) {
      console.log(`❌ ${file.name}: ${formatBytes(file.size)} (limit: ${formatBytes(SIZE_LIMITS.css)})`)
      hasViolations = true
    }
  }

  // Check total size
  if (totalSize > SIZE_LIMITS.total) {
    console.log(`❌ Total bundle size: ${formatBytes(totalSize)} (limit: ${formatBytes(SIZE_LIMITS.total)})`)
    hasViolations = true
  }

  if (!hasViolations) {
    console.log('✅ All size limits passed!')
  }

  // Recommendations
  console.log('\n💡 Optimization Recommendations:')
  console.log('-'.repeat(80))

  const largestFiles = bundles.slice(0, 5)
  if (largestFiles.length > 0) {
    console.log('\nLargest files to optimize:')
    for (const file of largestFiles) {
      const savings = file.size - file.gzipSize
      const savingsPercent = ((savings / file.size) * 100).toFixed(1)
      console.log(`- ${file.name}: ${formatBytes(file.size)} (${savingsPercent}% compression savings)`)
    }
  }

  // Detect common issues
  const vendorChunks = bundles.filter((b) => b.name.includes('vendor') || b.name.includes('node_modules'))
  if (vendorChunks.length > 3) {
    console.log('\n⚠️  Multiple vendor chunks detected. Consider consolidating.')
  }

  const duplicatePatterns = ['react', 'lodash', 'moment']
  for (const pattern of duplicatePatterns) {
    const matches = bundles.filter((b) => b.name.includes(pattern))
    if (matches.length > 1) {
      console.log(`\n⚠️  Multiple chunks containing "${pattern}". Check for duplicate imports.`)
    }
  }

  console.log('\n✨ Run "npm run build -- --analyze" for detailed visualization')
}

// Run analysis
analyzeBundle()
