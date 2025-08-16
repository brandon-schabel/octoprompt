import type { LoadTestResult } from './performance-helpers'
import * as path from 'path'

/**
 * Performance baseline management for regression detection
 */

export interface PerformanceBaseline {
  testName: string
  version: string
  timestamp: number
  environment: {
    nodeVersion: string
    platform: string
    cpuCount: number
    totalMemory: number
  }
  result: LoadTestResult
  metadata: {
    branch?: string
    commit?: string
    buildNumber?: string
    tester?: string
    notes?: string
  }
}

export interface BaselineComparison {
  current: LoadTestResult
  baseline: PerformanceBaseline
  comparison: {
    passed: boolean
    issues: string[]
    improvements: string[]
    metrics: {
      responseTimeChange: number
      throughputChange: number
      errorRateChange: number
      memoryChange?: number
    }
  }
  recommendation: 'accept' | 'investigate' | 'reject'
  summary: string
}

/**
 * Manages performance baselines for regression testing
 */
export class PerformanceBaselineManager {
  private baselineDir: string

  constructor(baselineDir: string = path.join(process.cwd(), '.performance-baselines')) {
    this.baselineDir = baselineDir
  }

  /**
   * Saves a new performance baseline
   */
  async saveBaseline(
    result: LoadTestResult,
    metadata: PerformanceBaseline['metadata'] = {}
  ): Promise<PerformanceBaseline> {
    const baseline: PerformanceBaseline = {
      testName: result.testName,
      version: this.getCurrentVersion(),
      timestamp: Date.now(),
      environment: this.getEnvironmentInfo(),
      result,
      metadata: {
        ...metadata,
        branch: metadata.branch || this.getCurrentBranch(),
        commit: metadata.commit || this.getCurrentCommit(),
        tester: metadata.tester || 'automated'
      }
    }

    await this.ensureBaselineDir()
    const filename = this.getBaselineFilename(result.testName)
    const filepath = path.join(this.baselineDir, filename)

    try {
      const fs = await import('fs/promises')
      await fs.writeFile(filepath, JSON.stringify(baseline, null, 2))
      console.log(`✅ Performance baseline saved: ${filepath}`)
    } catch (error) {
      console.warn('❌ Failed to save performance baseline:', error)
      throw error
    }

    return baseline
  }

  /**
   * Loads a performance baseline
   */
  async loadBaseline(testName: string): Promise<PerformanceBaseline | null> {
    const filename = this.getBaselineFilename(testName)
    const filepath = path.join(this.baselineDir, filename)

    try {
      const fs = await import('fs/promises')
      const data = await fs.readFile(filepath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.warn(`⚠️  No baseline found for test: ${testName}`)
      return null
    }
  }

  /**
   * Lists all available baselines
   */
  async listBaselines(): Promise<string[]> {
    try {
      const fs = await import('fs/promises')
      const files = await fs.readdir(this.baselineDir)
      return files
        .filter(file => file.endsWith('.baseline.json'))
        .map(file => file.replace('.baseline.json', ''))
    } catch (error) {
      return []
    }
  }

  /**
   * Compares current result with baseline
   */
  async compareWithBaseline(
    currentResult: LoadTestResult,
    thresholds: {
      responseTimeDegradation?: number
      throughputDegradation?: number
      errorRateIncrease?: number
      memoryIncrease?: number
    } = {}
  ): Promise<BaselineComparison | null> {
    const baseline = await this.loadBaseline(currentResult.testName)
    if (!baseline) {
      console.warn(`⚠️  No baseline found for ${currentResult.testName}`)
      return null
    }

    const defaultThresholds = {
      responseTimeDegradation: 25, // 25% response time increase
      throughputDegradation: -20, // 20% throughput decrease
      errorRateIncrease: 3, // 3 percentage point error rate increase
      memoryIncrease: 50 // 50% memory increase
    }

    const effectiveThresholds = { ...defaultThresholds, ...thresholds }
    const issues: string[] = []
    const improvements: string[] = []

    // Calculate metric changes
    const currentMetrics = currentResult.metrics
    const baselineMetrics = baseline.result.metrics

    const responseTimeChange = ((currentMetrics.responseTime.mean - baselineMetrics.responseTime.mean) / baselineMetrics.responseTime.mean) * 100
    const throughputChange = ((currentMetrics.throughput.requestsPerSecond - baselineMetrics.throughput.requestsPerSecond) / baselineMetrics.throughput.requestsPerSecond) * 100
    const errorRateChange = currentMetrics.errors.errorRate - baselineMetrics.errors.errorRate

    // Check for regressions
    if (responseTimeChange > effectiveThresholds.responseTimeDegradation) {
      issues.push(`Response time increased by ${responseTimeChange.toFixed(1)}% (threshold: ${effectiveThresholds.responseTimeDegradation}%)`)
    } else if (responseTimeChange < -10) {
      improvements.push(`Response time improved by ${Math.abs(responseTimeChange).toFixed(1)}%`)
    }

    if (throughputChange < effectiveThresholds.throughputDegradation) {
      issues.push(`Throughput decreased by ${Math.abs(throughputChange).toFixed(1)}% (threshold: ${Math.abs(effectiveThresholds.throughputDegradation)}%)`)
    } else if (throughputChange > 15) {
      improvements.push(`Throughput improved by ${throughputChange.toFixed(1)}%`)
    }

    if (errorRateChange > effectiveThresholds.errorRateIncrease) {
      issues.push(`Error rate increased by ${errorRateChange.toFixed(1)} percentage points (threshold: ${effectiveThresholds.errorRateIncrease})`)
    } else if (errorRateChange < -1) {
      improvements.push(`Error rate improved by ${Math.abs(errorRateChange).toFixed(1)} percentage points`)
    }

    // Check memory usage if available
    let memoryChange: number | undefined
    if (currentMetrics.resources.memoryUsage && baselineMetrics.resources.memoryUsage) {
      const currentMemory = currentMetrics.resources.memoryUsage.heapUsed
      const baselineMemory = baselineMetrics.resources.memoryUsage.heapUsed
      memoryChange = ((currentMemory - baselineMemory) / baselineMemory) * 100

      if (memoryChange > effectiveThresholds.memoryIncrease) {
        issues.push(`Memory usage increased by ${memoryChange.toFixed(1)}% (threshold: ${effectiveThresholds.memoryIncrease}%)`)
      } else if (memoryChange < -10) {
        improvements.push(`Memory usage improved by ${Math.abs(memoryChange).toFixed(1)}%`)
      }
    }

    // Determine recommendation
    let recommendation: 'accept' | 'investigate' | 'reject'
    if (issues.length === 0) {
      recommendation = 'accept'
    } else if (issues.length <= 2 && !issues.some(issue => issue.includes('Error rate'))) {
      recommendation = 'investigate'
    } else {
      recommendation = 'reject'
    }

    // Generate summary
    const summary = this.generateComparisonSummary(issues, improvements, recommendation, baseline)

    return {
      current: currentResult,
      baseline,
      comparison: {
        passed: issues.length === 0,
        issues,
        improvements,
        metrics: {
          responseTimeChange,
          throughputChange,
          errorRateChange,
          memoryChange
        }
      },
      recommendation,
      summary
    }
  }

  /**
   * Archives old baselines
   */
  async archiveOldBaselines(keepCount: number = 5): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const baselines = await this.listBaselines()
      
      for (const testName of baselines) {
        const baseline = await this.loadBaseline(testName)
        if (!baseline) continue

        // For now, we only keep the latest baseline per test
        // In a more sophisticated implementation, we'd keep the last N baselines
        console.log(`📦 Baseline for ${testName} is current (timestamp: ${new Date(baseline.timestamp).toISOString()})`)
      }
    } catch (error) {
      console.warn('Failed to archive old baselines:', error)
    }
  }

  /**
   * Generates a performance trend report
   */
  async generateTrendReport(): Promise<string> {
    const baselines = await this.listBaselines()
    
    if (baselines.length === 0) {
      return '📊 Performance Trend Report\n\nNo baselines available for trend analysis.'
    }

    let report = '📊 Performance Trend Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n`
    report += `Total Tests: ${baselines.length}\n\n`

    for (const testName of baselines) {
      const baseline = await this.loadBaseline(testName)
      if (!baseline) continue

      const metrics = baseline.result.metrics
      report += `## ${testName}\n`
      report += `- **Version**: ${baseline.version}\n`
      report += `- **Date**: ${new Date(baseline.timestamp).toISOString()}\n`
      report += `- **Throughput**: ${metrics.throughput.requestsPerSecond.toFixed(2)} RPS\n`
      report += `- **P95 Response Time**: ${metrics.responseTime.p95.toFixed(2)}ms\n`
      report += `- **Error Rate**: ${metrics.errors.errorRate.toFixed(2)}%\n`
      
      if (metrics.resources.memoryUsage) {
        const memoryMB = metrics.resources.memoryUsage.heapUsed / 1024 / 1024
        report += `- **Memory Usage**: ${memoryMB.toFixed(2)} MB\n`
      }
      
      report += `- **Environment**: ${baseline.environment.platform} (${baseline.environment.nodeVersion})\n`
      
      if (baseline.metadata.commit) {
        report += `- **Commit**: ${baseline.metadata.commit}\n`
      }
      
      report += '\n'
    }

    return report
  }

  /**
   * Validates baseline data integrity
   */
  async validateBaselines(): Promise<{ valid: string[], invalid: string[], issues: string[] }> {
    const baselines = await this.listBaselines()
    const valid: string[] = []
    const invalid: string[] = []
    const issues: string[] = []

    for (const testName of baselines) {
      try {
        const baseline = await this.loadBaseline(testName)
        if (!baseline) {
          invalid.push(testName)
          issues.push(`${testName}: Failed to load baseline`)
          continue
        }

        // Validate required fields
        if (!baseline.testName || !baseline.version || !baseline.timestamp) {
          invalid.push(testName)
          issues.push(`${testName}: Missing required fields`)
          continue
        }

        // Validate metrics structure
        const metrics = baseline.result.metrics
        if (!metrics.responseTime || !metrics.throughput || !metrics.errors) {
          invalid.push(testName)
          issues.push(`${testName}: Invalid metrics structure`)
          continue
        }

        // Validate data ranges
        if (metrics.responseTime.mean < 0 || metrics.throughput.requestsPerSecond < 0 || metrics.errors.errorRate < 0) {
          invalid.push(testName)
          issues.push(`${testName}: Invalid metric values`)
          continue
        }

        valid.push(testName)
      } catch (error) {
        invalid.push(testName)
        issues.push(`${testName}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { valid, invalid, issues }
  }

  private async ensureBaselineDir(): Promise<void> {
    try {
      const fs = await import('fs/promises')
      await fs.mkdir(this.baselineDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  }

  private getBaselineFilename(testName: string): string {
    // Sanitize test name for filesystem
    const sanitized = testName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
    
    return `${sanitized}.baseline.json`
  }

  private getCurrentVersion(): string {
    try {
      const packageJson = require(path.join(process.cwd(), 'package.json'))
      return packageJson.version || '0.0.0'
    } catch {
      return '0.0.0'
    }
  }

  private getCurrentBranch(): string {
    try {
      const { execSync } = require('child_process')
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    } catch {
      return 'unknown'
    }
  }

  private getCurrentCommit(): string {
    try {
      const { execSync } = require('child_process')
      return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    } catch {
      return 'unknown'
    }
  }

  private getEnvironmentInfo(): PerformanceBaseline['environment'] {
    const os = require('os')
    
    return {
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.release()}`,
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem()
    }
  }

  private generateComparisonSummary(
    issues: string[],
    improvements: string[],
    recommendation: 'accept' | 'investigate' | 'reject',
    baseline: PerformanceBaseline
  ): string {
    let summary = `Performance comparison against baseline from ${new Date(baseline.timestamp).toISOString()}\n\n`
    
    if (recommendation === 'accept') {
      summary += '✅ **ACCEPT**: Performance is within acceptable thresholds\n'
    } else if (recommendation === 'investigate') {
      summary += '🔍 **INVESTIGATE**: Minor performance issues detected\n'
    } else {
      summary += '❌ **REJECT**: Significant performance regressions detected\n'
    }

    if (issues.length > 0) {
      summary += '\n**Issues Found:**\n'
      issues.forEach(issue => summary += `- ${issue}\n`)
    }

    if (improvements.length > 0) {
      summary += '\n**Improvements:**\n'
      improvements.forEach(improvement => summary += `- ${improvement}\n`)
    }

    summary += '\n**Recommendation Actions:**\n'
    if (recommendation === 'accept') {
      summary += '- Performance is acceptable, proceed with confidence\n'
      if (improvements.length > 0) {
        summary += '- Consider updating baseline to capture improvements\n'
      }
    } else if (recommendation === 'investigate') {
      summary += '- Review code changes that might impact performance\n'
      summary += '- Run additional performance tests to confirm results\n'
      summary += '- Consider optimization if patterns persist\n'
    } else {
      summary += '- Investigate performance regressions immediately\n'
      summary += '- Review recent code changes for performance impact\n'
      summary += '- Do not proceed until issues are resolved\n'
      summary += '- Consider reverting changes that caused regressions\n'
    }

    return summary
  }
}

/**
 * Automated baseline management for CI/CD
 */
export class AutomatedBaselineManager extends PerformanceBaselineManager {
  /**
   * Automatically manages baselines in CI/CD environment
   */
  async autoManageBaseline(
    result: LoadTestResult,
    options: {
      updateOnImprovement?: boolean
      requireApprovalForUpdate?: boolean
      autoArchive?: boolean
    } = {}
  ): Promise<{
    action: 'updated' | 'kept' | 'created'
    reason: string
    comparison?: BaselineComparison
  }> {
    const {
      updateOnImprovement = true,
      requireApprovalForUpdate = false,
      autoArchive = true
    } = options

    const comparison = await this.compareWithBaseline(result)
    
    if (!comparison) {
      // No baseline exists, create one
      await this.saveBaseline(result, {
        notes: 'Initial baseline created automatically'
      })
      
      return {
        action: 'created',
        reason: 'No existing baseline found, created initial baseline'
      }
    }

    const { recommendation, comparison: comp } = comparison

    if (recommendation === 'accept') {
      if (updateOnImprovement && comp.improvements.length > 0 && !requireApprovalForUpdate) {
        // Performance improved, update baseline
        await this.saveBaseline(result, {
          notes: `Baseline updated due to improvements: ${comp.improvements.join(', ')}`
        })
        
        if (autoArchive) {
          await this.archiveOldBaselines()
        }
        
        return {
          action: 'updated',
          reason: `Performance improvements detected: ${comp.improvements.join(', ')}`,
          comparison
        }
      } else {
        return {
          action: 'kept',
          reason: 'Performance within acceptable range, baseline unchanged',
          comparison
        }
      }
    } else {
      // Performance issues detected, keep existing baseline
      return {
        action: 'kept',
        reason: `Performance issues detected, baseline preserved for comparison: ${comp.issues.join(', ')}`,
        comparison
      }
    }
  }

  /**
   * Generates CI/CD performance report
   */
  async generateCIReport(result: LoadTestResult): Promise<string> {
    const comparison = await this.compareWithBaseline(result)
    
    if (!comparison) {
      return `
# Performance Test Report

**Test**: ${result.testName}
**Status**: ✅ PASS (New baseline created)
**Duration**: ${(result.totalDuration / 1000).toFixed(1)}s

## Metrics
- **Throughput**: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS
- **P95 Response Time**: ${result.metrics.responseTime.p95.toFixed(2)}ms  
- **Error Rate**: ${result.metrics.errors.errorRate.toFixed(2)}%

*No baseline available for comparison. This result has been saved as the initial baseline.*
      `.trim()
    }

    const { recommendation, comparison: comp } = comparison
    const statusIcon = recommendation === 'accept' ? '✅' : recommendation === 'investigate' ? '⚠️' : '❌'
    const status = recommendation === 'accept' ? 'PASS' : recommendation === 'investigate' ? 'WARN' : 'FAIL'

    return `
# Performance Test Report

**Test**: ${result.testName}
**Status**: ${statusIcon} ${status}
**Duration**: ${(result.totalDuration / 1000).toFixed(1)}s
**Baseline**: ${new Date(comparison.baseline.timestamp).toISOString()}

## Current vs Baseline
- **Throughput**: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS (${comp.metrics.throughputChange >= 0 ? '+' : ''}${comp.metrics.throughputChange.toFixed(1)}%)
- **P95 Response Time**: ${result.metrics.responseTime.p95.toFixed(2)}ms (${comp.metrics.responseTimeChange >= 0 ? '+' : ''}${comp.metrics.responseTimeChange.toFixed(1)}%)
- **Error Rate**: ${result.metrics.errors.errorRate.toFixed(2)}% (${comp.metrics.errorRateChange >= 0 ? '+' : ''}${comp.metrics.errorRateChange.toFixed(1)}pp)

${comp.issues.length > 0 ? `## ❌ Issues\n${comp.issues.map(issue => `- ${issue}`).join('\n')}\n` : ''}
${comp.improvements.length > 0 ? `## ✅ Improvements\n${comp.improvements.map(improvement => `- ${improvement}`).join('\n')}\n` : ''}

## Summary
${comparison.summary}
    `.trim()
  }
}