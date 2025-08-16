#!/usr/bin/env bun
/**
 * Performance Regression Detection Tool
 * 
 * Compares current benchmark results with historical baselines to detect
 * performance regressions in pattern utilities.
 * 
 * Usage:
 *   bun run benchmarks/regression-check.ts
 *   bun run benchmarks/regression-check.ts --threshold 10 --baseline-file baseline.json
 */

import { readdir, stat } from 'fs/promises'
import { join } from 'path'

interface BenchmarkResult {
  name: string
  category: string
  avgExecutionTime: number
  minExecutionTime: number
  maxExecutionTime: number
  operationsPerSecond: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
  iterations: number
  datasetSize?: number
  success: boolean
  error?: string
}

interface BenchmarkSuite {
  results: BenchmarkResult[]
  totalTime: number
  baseline: {
    routeHelpers: number
    errorFactory: number
    schemaFactories: number
    hookFactory: number
    columnFactory: number
  }
}

interface BenchmarkFile {
  timestamp: string
  suite: BenchmarkSuite
  metadata: {
    nodeVersion: string
    platform: string
    arch: string
  }
}

interface RegressionResult {
  testName: string
  category: string
  current: number
  baseline: number
  percentageChange: number
  isRegression: boolean
  severity: 'minor' | 'moderate' | 'severe'
  memoryImpact?: {
    current: number
    baseline: number
    percentageChange: number
  }
}

interface RegressionReport {
  summary: {
    totalTests: number
    regressions: number
    improvements: number
    stable: number
    overallStatus: 'pass' | 'warning' | 'fail'
  }
  regressions: RegressionResult[]
  improvements: RegressionResult[]
  categoryAnalysis: Record<string, {
    avgChange: number
    regressionCount: number
    improvementCount: number
    status: 'pass' | 'warning' | 'fail'
  }>
  recommendations: string[]
}

class RegressionAnalyzer {
  private regressionThreshold: number
  private severeThreshold: number
  private memoryThreshold: number

  constructor(
    regressionThreshold: number = 5, // 5% performance degradation
    severeThreshold: number = 25,    // 25% severe degradation
    memoryThreshold: number = 10     // 10% memory increase
  ) {
    this.regressionThreshold = regressionThreshold
    this.severeThreshold = severeThreshold
    this.memoryThreshold = memoryThreshold
  }

  async findBenchmarkFiles(resultsDir: string): Promise<string[]> {
    try {
      const files = await readdir(resultsDir)
      const benchmarkFiles = files
        .filter(file => file.startsWith('benchmark-') && file.endsWith('.json'))
        .map(file => join(resultsDir, file))
      
      // Sort by modification time (newest first)
      const fileStats = await Promise.all(
        benchmarkFiles.map(async file => ({
          file,
          mtime: (await stat(file)).mtime
        }))
      )
      
      return fileStats
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        .map(({ file }) => file)
    } catch (error) {
      throw new Error(`Failed to read benchmark files: ${error}`)
    }
  }

  async loadBenchmarkFile(filePath: string): Promise<BenchmarkFile> {
    try {
      const file = Bun.file(filePath)
      const content = await file.text()
      return JSON.parse(content)
    } catch (error) {
      throw new Error(`Failed to load benchmark file ${filePath}: ${error}`)
    }
  }

  calculatePercentageChange(current: number, baseline: number): number {
    if (baseline === 0) return 0
    return ((current - baseline) / baseline) * 100
  }

  getSeverity(percentageChange: number): 'minor' | 'moderate' | 'severe' {
    const absChange = Math.abs(percentageChange)
    if (absChange >= this.severeThreshold) return 'severe'
    if (absChange >= this.regressionThreshold * 2) return 'moderate'
    return 'minor'
  }

  analyzeRegression(
    current: BenchmarkResult,
    baseline: BenchmarkResult
  ): RegressionResult {
    const percentageChange = this.calculatePercentageChange(
      current.avgExecutionTime,
      baseline.avgExecutionTime
    )

    const memoryChange = this.calculatePercentageChange(
      current.memoryUsage.heapUsed,
      baseline.memoryUsage.heapUsed
    )

    const isRegression = percentageChange > this.regressionThreshold ||
                        Math.abs(memoryChange) > this.memoryThreshold

    return {
      testName: current.name,
      category: current.category,
      current: current.avgExecutionTime,
      baseline: baseline.avgExecutionTime,
      percentageChange,
      isRegression,
      severity: this.getSeverity(percentageChange),
      memoryImpact: {
        current: current.memoryUsage.heapUsed,
        baseline: baseline.memoryUsage.heapUsed,
        percentageChange: memoryChange
      }
    }
  }

  async generateRegressionReport(
    currentFile: string,
    baselineFile?: string
  ): Promise<RegressionReport> {
    const resultsDir = 'benchmarks/results'
    
    // Load current results
    const current = await this.loadBenchmarkFile(currentFile)
    
    // Find baseline file
    let baseline: BenchmarkFile
    if (baselineFile) {
      baseline = await this.loadBenchmarkFile(baselineFile)
    } else {
      // Find the most recent file before current
      const allFiles = await this.findBenchmarkFiles(resultsDir)
      const currentFileName = currentFile.split('/').pop()
      const baselineFiles = allFiles.filter(file => 
        !file.endsWith(currentFileName || '')
      )
      
      if (baselineFiles.length === 0) {
        throw new Error('No baseline file found for comparison')
      }
      
      baseline = await this.loadBenchmarkFile(baselineFiles[0])
    }

    console.log(`📊 Comparing results:`)
    console.log(`   Current:  ${current.timestamp}`)
    console.log(`   Baseline: ${baseline.timestamp}`)
    console.log('')

    // Create lookup maps for comparison
    const currentResults = new Map<string, BenchmarkResult>()
    const baselineResults = new Map<string, BenchmarkResult>()

    current.suite.results
      .filter(r => r.success)
      .forEach(result => currentResults.set(result.name, result))

    baseline.suite.results
      .filter(r => r.success)
      .forEach(result => baselineResults.set(result.name, result))

    // Analyze regressions
    const regressions: RegressionResult[] = []
    const improvements: RegressionResult[] = []
    const categoryStats = new Map<string, { changes: number[], regressions: number, improvements: number }>()

    for (const [testName, currentResult] of currentResults) {
      const baselineResult = baselineResults.get(testName)
      if (!baselineResult) continue

      const analysis = this.analyzeRegression(currentResult, baselineResult)

      // Track category statistics
      if (!categoryStats.has(analysis.category)) {
        categoryStats.set(analysis.category, { changes: [], regressions: 0, improvements: 0 })
      }
      const catStats = categoryStats.get(analysis.category)!
      catStats.changes.push(analysis.percentageChange)

      if (analysis.isRegression && analysis.percentageChange > this.regressionThreshold) {
        regressions.push(analysis)
        catStats.regressions++
      } else if (analysis.percentageChange < -this.regressionThreshold) {
        improvements.push(analysis)
        catStats.improvements++
      }
    }

    // Build category analysis
    const categoryAnalysis: Record<string, any> = {}
    for (const [category, stats] of categoryStats) {
      const avgChange = stats.changes.reduce((sum, change) => sum + change, 0) / stats.changes.length
      const status = stats.regressions > 0 
        ? (stats.regressions > stats.changes.length * 0.5 ? 'fail' : 'warning')
        : 'pass'

      categoryAnalysis[category] = {
        avgChange,
        regressionCount: stats.regressions,
        improvementCount: stats.improvements,
        status
      }
    }

    // Generate recommendations
    const recommendations: string[] = []
    const severeRegressions = regressions.filter(r => r.severity === 'severe')
    
    if (severeRegressions.length > 0) {
      recommendations.push(`🚨 ${severeRegressions.length} severe performance regressions detected`)
      recommendations.push('   → Run profiling analysis: bun --prof run benchmarks/pattern-performance.ts')
      recommendations.push('   → Check for algorithmic changes in affected patterns')
    }

    const memoryRegressions = regressions.filter(r => 
      r.memoryImpact && Math.abs(r.memoryImpact.percentageChange) > this.memoryThreshold
    )
    
    if (memoryRegressions.length > 0) {
      recommendations.push(`💾 ${memoryRegressions.length} memory usage regressions detected`)
      recommendations.push('   → Run with --expose-gc for detailed memory analysis')
      recommendations.push('   → Check for memory leaks in recent changes')
    }

    if (improvements.length > regressions.length) {
      recommendations.push(`🎉 Performance improvements detected in ${improvements.length} tests`)
      recommendations.push('   → Document optimization techniques for future reference')
    }

    // Determine overall status
    let overallStatus: 'pass' | 'warning' | 'fail' = 'pass'
    if (severeRegressions.length > 0 || regressions.length > currentResults.size * 0.2) {
      overallStatus = 'fail'
    } else if (regressions.length > 0) {
      overallStatus = 'warning'
    }

    return {
      summary: {
        totalTests: currentResults.size,
        regressions: regressions.length,
        improvements: improvements.length,
        stable: currentResults.size - regressions.length - improvements.length,
        overallStatus
      },
      regressions: regressions.sort((a, b) => b.percentageChange - a.percentageChange),
      improvements: improvements.sort((a, b) => a.percentageChange - b.percentageChange),
      categoryAnalysis,
      recommendations
    }
  }

  formatReport(report: RegressionReport): void {
    const statusIcon = {
      pass: '✅',
      warning: '⚠️',
      fail: '❌'
    }

    console.log(`${statusIcon[report.summary.overallStatus]} PERFORMANCE REGRESSION ANALYSIS`)
    console.log('='.repeat(60))
    console.log(`Total Tests: ${report.summary.totalTests}`)
    console.log(`Regressions: ${report.summary.regressions}`)
    console.log(`Improvements: ${report.summary.improvements}`)
    console.log(`Stable: ${report.summary.stable}`)
    console.log('')

    // Category analysis
    console.log('📊 CATEGORY ANALYSIS')
    console.log('-'.repeat(40))
    Object.entries(report.categoryAnalysis).forEach(([category, analysis]) => {
      const icon = statusIcon[analysis.status]
      const avgChange = analysis.avgChange >= 0 ? `+${analysis.avgChange.toFixed(1)}` : analysis.avgChange.toFixed(1)
      console.log(`${icon} ${category}: ${avgChange}% avg change (${analysis.regressionCount} regressions, ${analysis.improvementCount} improvements)`)
    })
    console.log('')

    // Regressions
    if (report.regressions.length > 0) {
      console.log('🔴 PERFORMANCE REGRESSIONS')
      console.log('-'.repeat(40))
      report.regressions.forEach(regression => {
        const severityIcon = {
          minor: '🟡',
          moderate: '🟠',
          severe: '🔴'
        }
        
        const currentMs = (regression.current / 1000).toFixed(2)
        const baselineMs = (regression.baseline / 1000).toFixed(2)
        const change = regression.percentageChange >= 0 ? `+${regression.percentageChange.toFixed(1)}` : regression.percentageChange.toFixed(1)
        
        console.log(`${severityIcon[regression.severity]} ${regression.testName} (${regression.category})`)
        console.log(`   Time: ${baselineMs}ms → ${currentMs}ms (${change}%)`)
        
        if (regression.memoryImpact && Math.abs(regression.memoryImpact.percentageChange) > 5) {
          const memChange = regression.memoryImpact.percentageChange >= 0 ? `+${regression.memoryImpact.percentageChange.toFixed(1)}` : regression.memoryImpact.percentageChange.toFixed(1)
          const currentMemMB = (regression.memoryImpact.current / 1024 / 1024).toFixed(1)
          const baselineMemMB = (regression.memoryImpact.baseline / 1024 / 1024).toFixed(1)
          console.log(`   Memory: ${baselineMemMB}MB → ${currentMemMB}MB (${memChange}%)`)
        }
        console.log('')
      })
    }

    // Improvements
    if (report.improvements.length > 0) {
      console.log('🟢 PERFORMANCE IMPROVEMENTS')
      console.log('-'.repeat(40))
      report.improvements.slice(0, 5).forEach(improvement => {
        const currentMs = (improvement.current / 1000).toFixed(2)
        const baselineMs = (improvement.baseline / 1000).toFixed(2)
        const change = improvement.percentageChange.toFixed(1)
        
        console.log(`✨ ${improvement.testName} (${improvement.category})`)
        console.log(`   Time: ${baselineMs}ms → ${currentMs}ms (${change}%)`)
      })
      
      if (report.improvements.length > 5) {
        console.log(`   ... and ${report.improvements.length - 5} more improvements`)
      }
      console.log('')
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS')
      console.log('-'.repeat(40))
      report.recommendations.forEach(rec => console.log(rec))
      console.log('')
    }

    // Final status
    const statusMessages = {
      pass: 'All performance targets met! 🎉',
      warning: 'Some performance regressions detected. Review recommended. ⚠️',
      fail: 'Significant performance regressions detected. Action required! ❌'
    }
    
    console.log(statusMessages[report.summary.overallStatus])
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  let currentFile = ''
  let baselineFile = ''
  let threshold = 5
  let help = false

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--current':
        currentFile = args[++i]
        break
      case '--baseline':
        baselineFile = args[++i]
        break
      case '--threshold':
        threshold = parseFloat(args[++i])
        break
      case '--help':
      case '-h':
        help = true
        break
    }
  }

  if (help) {
    console.log('Performance Regression Check Tool')
    console.log('')
    console.log('Usage:')
    console.log('  bun run benchmarks/regression-check.ts [options]')
    console.log('')
    console.log('Options:')
    console.log('  --current FILE     Current benchmark results file')
    console.log('  --baseline FILE    Baseline benchmark results file')
    console.log('  --threshold NUM    Regression threshold percentage (default: 5)')
    console.log('  --help, -h         Show this help message')
    console.log('')
    console.log('Examples:')
    console.log('  bun run benchmarks/regression-check.ts')
    console.log('  bun run benchmarks/regression-check.ts --threshold 10')
    console.log('  bun run benchmarks/regression-check.ts --current latest.json --baseline baseline.json')
    return
  }

  const analyzer = new RegressionAnalyzer(threshold)

  try {
    // If no current file specified, use the most recent results
    if (!currentFile) {
      const resultsDir = 'benchmarks/results'
      const files = await analyzer.findBenchmarkFiles(resultsDir)
      
      if (files.length === 0) {
        throw new Error('No benchmark result files found. Run benchmarks first.')
      }
      
      currentFile = files[0]
    }

    console.log('🔍 Running Performance Regression Analysis')
    console.log('')

    const report = await analyzer.generateRegressionReport(currentFile, baselineFile)
    analyzer.formatReport(report)

    // Exit with appropriate code
    if (report.summary.overallStatus === 'fail') {
      process.exit(1)
    } else if (report.summary.overallStatus === 'warning') {
      process.exit(1) // Also exit with error for warnings in CI
    } else {
      process.exit(0)
    }

  } catch (error) {
    console.error('❌ Regression analysis failed:', error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}

export { RegressionAnalyzer, RegressionReport, RegressionResult }