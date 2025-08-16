#!/usr/bin/env bun
/**
 * Validation script to verify the complete benchmark suite setup
 */

import { existsSync, statSync } from 'fs'
import { join } from 'path'

interface ValidationResult {
  category: string
  checks: Array<{
    name: string
    status: 'pass' | 'fail' | 'warning'
    message: string
  }>
}

class BenchmarkValidator {
  private results: ValidationResult[] = []

  addResult(category: string, name: string, status: 'pass' | 'fail' | 'warning', message: string) {
    let categoryResult = this.results.find(r => r.category === category)
    if (!categoryResult) {
      categoryResult = { category, checks: [] }
      this.results.push(categoryResult)
    }
    categoryResult.checks.push({ name, status, message })
  }

  async validateFileStructure(): Promise<void> {
    const files = [
      { path: 'benchmarks/pattern-performance.ts', desc: 'Main benchmark suite' },
      { path: 'benchmarks/regression-check.ts', desc: 'Regression detection tool' },
      { path: 'benchmarks/bundle-analysis.ts', desc: 'Bundle size analysis tool' },
      { path: 'benchmarks/run-benchmarks.sh', desc: 'Benchmark runner script' },
      { path: 'benchmarks/README.md', desc: 'Documentation' },
      { path: 'benchmarks/PERFORMANCE_RESULTS.md', desc: 'Results documentation' },
      { path: '.github/workflows/performance-benchmarks.yml', desc: 'CI/CD integration' }
    ]

    for (const file of files) {
      if (existsSync(file.path)) {
        const stats = statSync(file.path)
        this.addResult(
          'File Structure',
          file.desc,
          'pass',
          `✅ ${file.path} (${(stats.size / 1024).toFixed(1)}KB)`
        )
      } else {
        this.addResult(
          'File Structure',
          file.desc,
          'fail',
          `❌ Missing: ${file.path}`
        )
      }
    }

    // Check results directory
    if (existsSync('benchmarks/results')) {
      this.addResult(
        'File Structure',
        'Results Directory',
        'pass',
        '✅ benchmarks/results directory exists'
      )
    } else {
      this.addResult(
        'File Structure',
        'Results Directory',
        'warning',
        '⚠️ Results directory will be created on first run'
      )
    }
  }

  async validatePatternUtilities(): Promise<void> {
    const patterns = [
      { path: 'packages/server/src/utils/route-helpers.ts', name: 'Route Helpers' },
      { path: 'packages/services/src/utils/error-factory.ts', name: 'Error Factory' },
      { path: 'packages/schemas/src/schema-factories.ts', name: 'Schema Factories' },
      { path: 'packages/client/src/hooks/utils/hook-factory.ts', name: 'Hook Factory' },
      { path: 'packages/ui/src/components/data-table/column-factory.tsx', name: 'Column Factory' }
    ]

    for (const pattern of patterns) {
      if (existsSync(pattern.path)) {
        try {
          // Test import
          await import(`../${pattern.path}`)
          this.addResult(
            'Pattern Utilities',
            pattern.name,
            'pass',
            `✅ ${pattern.name} imports successfully`
          )
        } catch (error) {
          this.addResult(
            'Pattern Utilities',
            pattern.name,
            'warning',
            `⚠️ ${pattern.name} has import issues: ${error}`
          )
        }
      } else {
        this.addResult(
          'Pattern Utilities',
          pattern.name,
          'fail',
          `❌ Missing: ${pattern.path}`
        )
      }
    }
  }

  async validatePackageScripts(): Promise<void> {
    try {
      const packageJson = await import('../package.json')
      const scripts = packageJson.default?.scripts || {}

      const expectedScripts = [
        'benchmark',
        'benchmark:gc',
        'benchmark:profile',
        'benchmark:memory',
        'benchmark:patterns',
        'benchmark:regression',
        'benchmark:analyze',
        'benchmark:bundle'
      ]

      for (const script of expectedScripts) {
        if (scripts[script]) {
          this.addResult(
            'Package Scripts',
            script,
            'pass',
            `✅ ${script}: ${scripts[script]}`
          )
        } else {
          this.addResult(
            'Package Scripts',
            script,
            'fail',
            `❌ Missing script: ${script}`
          )
        }
      }
    } catch (error) {
      this.addResult(
        'Package Scripts',
        'Package.json',
        'fail',
        `❌ Failed to load package.json: ${error}`
      )
    }
  }

  async validateDependencies(): Promise<void> {
    const requiredDeps = [
      'zod',
      '@tanstack/react-query',
      'sonner',
      'date-fns'
    ]

    try {
      for (const dep of requiredDeps) {
        try {
          await import(dep)
          this.addResult(
            'Dependencies',
            dep,
            'pass',
            `✅ ${dep} available`
          )
        } catch (error) {
          this.addResult(
            'Dependencies',
            dep,
            'warning',
            `⚠️ ${dep} not available (may be dev-only dependency)`
          )
        }
      }
    } catch (error) {
      this.addResult(
        'Dependencies',
        'Import Test',
        'fail',
        `❌ Dependency validation failed: ${error}`
      )
    }
  }

  async validateExecutables(): Promise<void> {
    // Test if benchmark runner is executable
    try {
      const stats = statSync('benchmarks/run-benchmarks.sh')
      const isExecutable = !!(stats.mode & parseInt('100', 8))
      
      this.addResult(
        'Executables',
        'Benchmark Runner',
        isExecutable ? 'pass' : 'warning',
        isExecutable ? '✅ run-benchmarks.sh is executable' : '⚠️ run-benchmarks.sh may need chmod +x'
      )
    } catch (error) {
      this.addResult(
        'Executables',
        'Benchmark Runner',
        'fail',
        `❌ Cannot check run-benchmarks.sh: ${error}`
      )
    }
  }

  async runValidation(): Promise<boolean> {
    console.log('🔍 Validating Promptliano Benchmark Suite Setup')
    console.log('=' .repeat(60))
    console.log('')

    await this.validateFileStructure()
    await this.validatePatternUtilities()
    await this.validatePackageScripts()
    await this.validateDependencies()
    await this.validateExecutables()

    // Display results
    let overallPass = true
    for (const result of this.results) {
      console.log(`📂 ${result.category.toUpperCase()}`)
      console.log('-'.repeat(40))
      
      for (const check of result.checks) {
        console.log(`${check.message}`)
        if (check.status === 'fail') {
          overallPass = false
        }
      }
      console.log('')
    }

    // Summary
    const totalChecks = this.results.reduce((sum, r) => sum + r.checks.length, 0)
    const passedChecks = this.results.reduce((sum, r) => sum + r.checks.filter(c => c.status === 'pass').length, 0)
    const failedChecks = this.results.reduce((sum, r) => sum + r.checks.filter(c => c.status === 'fail').length, 0)
    const warningChecks = this.results.reduce((sum, r) => sum + r.checks.filter(c => c.status === 'warning').length, 0)

    console.log('📊 VALIDATION SUMMARY')
    console.log('-'.repeat(40))
    console.log(`Total checks: ${totalChecks}`)
    console.log(`✅ Passed: ${passedChecks}`)
    console.log(`⚠️ Warnings: ${warningChecks}`)
    console.log(`❌ Failed: ${failedChecks}`)
    console.log('')

    if (overallPass) {
      console.log('🎉 Benchmark suite setup is complete and ready to use!')
      console.log('')
      console.log('Quick start:')
      console.log('  bun run benchmark              # Run all benchmarks')
      console.log('  bun run benchmark:gc           # Run with GC analysis')
      console.log('  bun run benchmark:regression   # Check for regressions')
      console.log('  bun run benchmark:bundle       # Analyze bundle size')
    } else {
      console.log('❌ Setup validation failed. Please address the issues above.')
    }

    return overallPass
  }
}

async function main(): Promise<void> {
  const validator = new BenchmarkValidator()
  const success = await validator.runValidation()
  process.exit(success ? 0 : 1)
}

if (import.meta.main) {
  main()
}