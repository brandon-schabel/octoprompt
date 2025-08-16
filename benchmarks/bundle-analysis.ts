#!/usr/bin/env bun
/**
 * Bundle Size Impact Analysis for Pattern Utilities
 * 
 * Analyzes the bundle size impact of importing pattern utilities
 * to ensure they don't significantly increase application bundle size.
 * 
 * Usage:
 *   bun run benchmarks/bundle-analysis.ts
 */

import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

interface BundleAnalysis {
  name: string
  category: string
  rawSize: number
  gzippedSize: number
  treeshakable: boolean
  imports: string[]
  dependencies: string[]
}

interface BundleReport {
  totalAnalyzed: number
  findings: BundleAnalysis[]
  summary: {
    totalRawSize: number
    totalGzippedSize: number
    averagePatternSize: number
    treeshakableCount: number
    recommendations: string[]
  }
}

class BundleAnalyzer {
  private tempDir = 'benchmarks/temp-bundle-analysis'

  constructor() {
    // Clean and create temp directory
    try {
      rmSync(this.tempDir, { recursive: true, force: true })
    } catch (e) {
      // Directory might not exist
    }
    mkdirSync(this.tempDir, { recursive: true })
  }

  async analyzePattern(
    name: string,
    category: string,
    imports: string[],
    modulePath: string
  ): Promise<BundleAnalysis> {
    // Create test file that imports the pattern
    const testContent = `
// Bundle size test for ${name}
${imports.map(imp => `import { ${imp} } from '${modulePath}'`).join('\n')}

// Ensure imports are used (prevent tree-shaking removal)
${imports.map(imp => `console.log(typeof ${imp})`).join('\n')}
`

    const testFile = join(this.tempDir, `test-${name.toLowerCase().replace(/\s+/g, '-')}.ts`)
    writeFileSync(testFile, testContent)

    // Bundle with Bun
    const bundleFile = join(this.tempDir, `bundle-${name.toLowerCase().replace(/\s+/g, '-')}.js`)
    
    try {
      execSync(`bun build ${testFile} --outfile=${bundleFile} --format=esm --minify`, {
        stdio: 'pipe'
      })
    } catch (error) {
      console.warn(`⚠️  Failed to bundle ${name}: ${error}`)
      return {
        name,
        category,
        rawSize: 0,
        gzippedSize: 0,
        treeshakable: false,
        imports,
        dependencies: []
      }
    }

    // Get bundle size
    const bundleStats = await Bun.file(bundleFile).arrayBuffer()
    const rawSize = bundleStats.byteLength

    // Gzip the bundle to get compressed size
    const gzipFile = `${bundleFile}.gz`
    try {
      execSync(`gzip -c ${bundleFile} > ${gzipFile}`, { stdio: 'pipe' })
      const gzippedStats = await Bun.file(gzipFile).arrayBuffer()
      const gzippedSize = gzippedStats.byteLength

      // Test tree-shaking by creating a bundle with only one import
      let treeshakable = true
      if (imports.length > 1) {
        const singleImportContent = `
import { ${imports[0]} } from '${modulePath}'
console.log(typeof ${imports[0]})
`
        const singleTestFile = join(this.tempDir, `single-${name.toLowerCase().replace(/\s+/g, '-')}.ts`)
        const singleBundleFile = join(this.tempDir, `single-bundle-${name.toLowerCase().replace(/\s+/g, '-')}.js`)
        
        writeFileSync(singleTestFile, singleImportContent)
        
        try {
          execSync(`bun build ${singleTestFile} --outfile=${singleBundleFile} --format=esm --minify`, {
            stdio: 'pipe'
          })
          
          const singleBundleStats = await Bun.file(singleBundleFile).arrayBuffer()
          const singleSize = singleBundleStats.byteLength
          
          // If single import is much smaller, tree-shaking is working
          treeshakable = singleSize < rawSize * 0.7
        } catch (e) {
          treeshakable = false
        }
      }

      return {
        name,
        category,
        rawSize,
        gzippedSize,
        treeshakable,
        imports,
        dependencies: this.extractDependencies(bundleFile)
      }
    } catch (error) {
      console.warn(`⚠️  Failed to analyze ${name}: ${error}`)
      return {
        name,
        category,
        rawSize,
        gzippedSize: rawSize, // Fallback
        treeshakable: false,
        imports,
        dependencies: []
      }
    }
  }

  private extractDependencies(bundleFile: string): string[] {
    try {
      const content = Bun.file(bundleFile).text()
      // This is a simplified dependency extraction
      // In a real scenario, you'd want more sophisticated analysis
      const deps: string[] = []
      
      // Look for common dependency patterns in the bundle
      if (content.includes('zod')) deps.push('zod')
      if (content.includes('react')) deps.push('react')
      if (content.includes('tanstack')) deps.push('@tanstack/react-query')
      if (content.includes('date-fns')) deps.push('date-fns')
      
      return deps
    } catch (error) {
      return []
    }
  }

  async runAnalysis(): Promise<BundleReport> {
    console.log('📦 Starting Bundle Size Analysis for Pattern Utilities')
    console.log('')

    const analyses: BundleAnalysis[] = []

    // Route Helpers Analysis
    console.log('🛤️  Analyzing Route Helpers...')
    const routeHelperAnalysis = await this.analyzePattern(
      'Route Helpers',
      'Server',
      [
        'createStandardResponses',
        'createStandardResponsesWithStatus',
        'withErrorHandling',
        'successResponse',
        'operationSuccessResponse'
      ],
      '../packages/server/src/utils/route-helpers'
    )
    analyses.push(routeHelperAnalysis)

    // Error Factory Analysis
    console.log('⚠️  Analyzing Error Factory...')
    const errorFactoryAnalysis = await this.analyzePattern(
      'Error Factory',
      'Services',
      [
        'ErrorFactory',
        'createEntityErrorFactory',
        'assertExists',
        'assertUpdateSucceeded',
        'withErrorContext'
      ],
      '../packages/services/src/utils/error-factory'
    )
    analyses.push(errorFactoryAnalysis)

    // Schema Factories Analysis
    console.log('📋 Analyzing Schema Factories...')
    const schemaFactoryAnalysis = await this.analyzePattern(
      'Schema Factories',
      'Schemas',
      [
        'createApiResponseSchema',
        'createListResponseSchema',
        'createPaginatedResponseSchema',
        'createEntitySchemas',
        'createCrudSchemas',
        'commonFields'
      ],
      '../packages/schemas/src/schema-factories'
    )
    analyses.push(schemaFactoryAnalysis)

    // Hook Factory Analysis
    console.log('🎣 Analyzing Hook Factory...')
    const hookFactoryAnalysis = await this.analyzePattern(
      'Hook Factory',
      'Client',
      [
        'createCrudHooks',
        'createQueryHook',
        'createMutationHook',
        'createOptimisticMutation'
      ],
      '../packages/client/src/hooks/utils/hook-factory'
    )
    analyses.push(hookFactoryAnalysis)

    // Column Factory Analysis
    console.log('🗂️  Analyzing Column Factory...')
    const columnFactoryAnalysis = await this.analyzePattern(
      'Column Factory',
      'UI',
      [
        'createTextColumn',
        'createDateColumn',
        'createStatusColumn',
        'createActionsColumn',
        'createDataTableColumns'
      ],
      '../packages/ui/src/components/data-table/column-factory'
    )
    analyses.push(columnFactoryAnalysis)

    // Calculate summary
    const totalRawSize = analyses.reduce((sum, a) => sum + a.rawSize, 0)
    const totalGzippedSize = analyses.reduce((sum, a) => sum + a.gzippedSize, 0)
    const averagePatternSize = totalGzippedSize / analyses.length
    const treeshakableCount = analyses.filter(a => a.treeshakable).length

    // Generate recommendations
    const recommendations: string[] = []
    
    const largeBundles = analyses.filter(a => a.gzippedSize > 5000) // >5KB
    if (largeBundles.length > 0) {
      recommendations.push(`📈 ${largeBundles.length} patterns exceed 5KB gzipped size`)
      recommendations.push('   → Consider splitting large utilities into smaller modules')
    }

    const nonTreeshakable = analyses.filter(a => !a.treeshakable)
    if (nonTreeshakable.length > 0) {
      recommendations.push(`🌳 ${nonTreeshakable.length} patterns are not tree-shakable`)
      recommendations.push('   → Ensure individual exports can be imported separately')
    }

    if (totalGzippedSize > 20000) { // >20KB total
      recommendations.push('📦 Total pattern bundle size is significant (>20KB)')
      recommendations.push('   → Consider lazy loading non-critical pattern utilities')
    } else {
      recommendations.push('✅ Total pattern bundle size is acceptable (<20KB)')
    }

    return {
      totalAnalyzed: analyses.length,
      findings: analyses,
      summary: {
        totalRawSize,
        totalGzippedSize,
        averagePatternSize,
        treeshakableCount,
        recommendations
      }
    }
  }

  formatReport(report: BundleReport): void {
    console.log('')
    console.log('📦 BUNDLE SIZE ANALYSIS RESULTS')
    console.log('='.repeat(50))
    console.log('')

    // Summary
    console.log('📊 SUMMARY')
    console.log('-'.repeat(30))
    console.log(`Total patterns analyzed: ${report.totalAnalyzed}`)
    console.log(`Total raw size: ${this.formatBytes(report.summary.totalRawSize)}`)
    console.log(`Total gzipped size: ${this.formatBytes(report.summary.totalGzippedSize)}`)
    console.log(`Average pattern size: ${this.formatBytes(report.summary.averagePatternSize)}`)
    console.log(`Tree-shakable patterns: ${report.summary.treeshakableCount}/${report.totalAnalyzed}`)
    console.log('')

    // Individual pattern analysis
    console.log('🔍 PATTERN ANALYSIS')
    console.log('-'.repeat(30))
    
    report.findings.forEach(analysis => {
      const treeshakable = analysis.treeshakable ? '🌳' : '🚫'
      const sizeStatus = analysis.gzippedSize > 5000 ? '📈' : '✅'
      
      console.log(`${sizeStatus} ${treeshakable} ${analysis.name} (${analysis.category})`)
      console.log(`   Raw: ${this.formatBytes(analysis.rawSize)}`)
      console.log(`   Gzipped: ${this.formatBytes(analysis.gzippedSize)}`)
      console.log(`   Imports: ${analysis.imports.length}`)
      
      if (analysis.dependencies.length > 0) {
        console.log(`   Dependencies: ${analysis.dependencies.join(', ')}`)
      }
      console.log('')
    })

    // Recommendations
    if (report.summary.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS')
      console.log('-'.repeat(30))
      report.summary.recommendations.forEach(rec => console.log(rec))
      console.log('')
    }

    // Bundle size targets
    console.log('🎯 BUNDLE SIZE TARGETS')
    console.log('-'.repeat(30))
    const totalTargetMet = report.summary.totalGzippedSize <= 20000
    const individualTargetMet = report.findings.every(a => a.gzippedSize <= 5000)
    const treeshakingTargetMet = report.summary.treeshakableCount >= report.totalAnalyzed * 0.8

    console.log(`${totalTargetMet ? '✅' : '❌'} Total patterns <20KB gzipped: ${totalTargetMet}`)
    console.log(`${individualTargetMet ? '✅' : '❌'} Individual patterns <5KB: ${individualTargetMet}`)
    console.log(`${treeshakingTargetMet ? '✅' : '❌'} 80%+ tree-shakable: ${treeshakingTargetMet}`)
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  cleanup(): void {
    try {
      rmSync(this.tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('⚠️  Failed to cleanup temp directory:', error)
    }
  }
}

async function main(): Promise<void> {
  const analyzer = new BundleAnalyzer()

  try {
    const report = await analyzer.runAnalysis()
    analyzer.formatReport(report)

    // Save results
    const resultsFile = 'benchmarks/results/bundle-analysis-results.json'
    const timestamp = new Date().toISOString()
    
    const output = {
      timestamp,
      report,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        bundler: 'Bun'
      }
    }

    writeFileSync(resultsFile, JSON.stringify(output, null, 2))
    console.log(`💾 Results saved to ${resultsFile}`)

    // Determine exit code
    const totalTargetMet = report.summary.totalGzippedSize <= 20000
    const individualTargetMet = report.findings.every(a => a.gzippedSize <= 5000)
    
    if (!totalTargetMet || !individualTargetMet) {
      console.log('\n❌ Bundle size targets not met')
      process.exit(1)
    } else {
      console.log('\n✅ All bundle size targets met!')
      process.exit(0)
    }

  } catch (error) {
    console.error('❌ Bundle analysis failed:', error)
    process.exit(1)
  } finally {
    analyzer.cleanup()
  }
}

if (import.meta.main) {
  main()
}

export { BundleAnalyzer, BundleReport, BundleAnalysis }