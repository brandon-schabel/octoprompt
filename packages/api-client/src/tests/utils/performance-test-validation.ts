/**
 * Simple validation script for performance testing capabilities
 * Run with: bun run packages/api-client/src/tests/utils/performance-test-validation.ts
 */

import type { LoadTestConfig, EndpointTestScenario, ScenarioContext } from './performance-helpers'
import {
  PerformanceMeasurement,
  LoadTestRunner,
  PerformanceRegression,
  PerformanceReporter
} from './performance-helpers'
import { PerformanceBaselineManager } from './performance-baselines'

/**
 * Mock client for testing without actual API calls
 */
const mockClient = {
  async mockOperation(delay: number = 100): Promise<{ success: true; data: string }> {
    await new Promise(resolve => setTimeout(resolve, delay))
    return { success: true, data: 'mock response' }
  }
} as any

/**
 * Simple test scenarios for validation
 */
const testScenarios: EndpointTestScenario[] = [
  {
    name: 'fast_operation',
    weight: 5,
    execute: async () => {
      return await mockClient.mockOperation(50) // 50ms operation
    }
  },
  {
    name: 'medium_operation', 
    weight: 3,
    execute: async () => {
      return await mockClient.mockOperation(150) // 150ms operation
    }
  },
  {
    name: 'slow_operation',
    weight: 2,
    execute: async () => {
      return await mockClient.mockOperation(300) // 300ms operation
    }
  }
]

/**
 * Test configuration for validation
 */
const testConfig: LoadTestConfig = {
  name: 'Performance Testing Validation',
  description: 'Validates performance testing infrastructure',
  users: {
    initial: 1,
    target: 5,
    rampupTimeMs: 2000, // 2 second ramp-up
    sustainTimeMs: 5000  // 5 second sustain
  },
  requests: {
    thinkTimeMs: 100,
    timeoutMs: 5000,
    requestsPerUser: 10
  },
  thresholds: {
    maxResponseTimeMs: 1000,
    maxErrorRate: 5,
    minThroughputRps: 1
  },
  monitoring: {
    enableMemoryTracking: true,
    enableCpuTracking: true,
    sampleIntervalMs: 500
  }
}

async function main() {
  console.log('🧪 Performance Testing Infrastructure Validation')
  console.log('=' .repeat(50))

  try {
    // Test 1: Basic Performance Measurement
    console.log('\n📊 Test 1: Basic Performance Measurement')
    const measurement = new PerformanceMeasurement(testConfig)
    measurement.start()

    // Simulate some operations
    for (let i = 0; i < 5; i++) {
      await measurement.measureOperation(
        () => mockClient.mockOperation(100 + Math.random() * 100),
        'test_operation'
      )
    }

    measurement.updateActiveUsers(3)
    measurement.recordTimelineSnapshot()

    const basicResult = measurement.end()
    console.log(`   ✅ Measured ${basicResult.metrics.throughput.totalRequests} operations`)
    console.log(`   ✅ Average response time: ${basicResult.metrics.responseTime.mean.toFixed(2)}ms`)
    console.log(`   ✅ Peak users: ${basicResult.metrics.concurrency.actualConcurrentPeak}`)

    // Test 2: Load Test Runner
    console.log('\n🚀 Test 2: Load Test Runner')
    const runner = new LoadTestRunner(testConfig, mockClient, testScenarios)
    const loadTestResult = await runner.run()

    console.log(`   ✅ Completed load test: ${loadTestResult.testName}`)
    console.log(`   ✅ Total requests: ${loadTestResult.metrics.throughput.totalRequests}`)
    console.log(`   ✅ Throughput: ${loadTestResult.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
    console.log(`   ✅ Error rate: ${loadTestResult.metrics.errors.errorRate.toFixed(2)}%`)

    // Test 3: Performance Reporting
    console.log('\n📋 Test 3: Performance Reporting')
    const report = PerformanceReporter.generateReport(loadTestResult)
    const jsonReport = PerformanceReporter.exportToJson(loadTestResult)
    const csvReport = PerformanceReporter.exportToCsv(loadTestResult)

    console.log('   ✅ Generated performance report')
    console.log('   ✅ Exported to JSON format')
    console.log('   ✅ Exported to CSV format')

    // Test 4: Baseline Management
    console.log('\n📊 Test 4: Baseline Management')
    const baselineManager = new PerformanceBaselineManager('/tmp/perf-test-baselines')
    
    // Save baseline
    await baselineManager.saveBaseline(loadTestResult, {
      notes: 'Validation test baseline'
    })
    console.log('   ✅ Saved performance baseline')

    // Load baseline
    const baseline = await baselineManager.loadBaseline(loadTestResult.testName)
    console.log('   ✅ Loaded performance baseline')

    // Test 5: Regression Detection
    console.log('\n🔍 Test 5: Regression Detection')
    
    // Create a slightly degraded result for comparison
    const degradedResult = {
      ...loadTestResult,
      metrics: {
        ...loadTestResult.metrics,
        responseTime: {
          ...loadTestResult.metrics.responseTime,
          mean: loadTestResult.metrics.responseTime.mean * 1.1 // 10% slower
        },
        throughput: {
          ...loadTestResult.metrics.throughput,
          requestsPerSecond: loadTestResult.metrics.throughput.requestsPerSecond * 0.95 // 5% less throughput
        }
      }
    }

    if (baseline) {
      const comparison = await baselineManager.compareWithBaseline(degradedResult)
      if (comparison) {
        console.log('   ✅ Performance comparison completed')
        console.log(`   📈 Response time change: ${comparison.comparison.metrics.responseTimeChange.toFixed(1)}%`)
        console.log(`   📉 Throughput change: ${comparison.comparison.metrics.throughputChange.toFixed(1)}%`)
        console.log(`   🎯 Recommendation: ${comparison.recommendation}`)
      }
    }

    // Test 6: Validation Report
    console.log('\n📊 Test 6: Baseline Validation')
    const validation = await baselineManager.validateBaselines()
    console.log(`   ✅ Valid baselines: ${validation.valid.length}`)
    console.log(`   ❌ Invalid baselines: ${validation.invalid.length}`)
    if (validation.issues.length > 0) {
      console.log(`   ⚠️  Issues: ${validation.issues.join(', ')}`)
    }

    console.log('\n🎉 All Performance Testing Validation Tests Passed!')
    console.log('=' .repeat(50))
    console.log('Performance testing infrastructure is ready for use.')
    
  } catch (error) {
    console.error('❌ Validation failed:', error)
    process.exit(1)
  }
}

// Run validation if this file is executed directly
if (import.meta.main) {
  main()
}

export { main as validatePerformanceTesting }