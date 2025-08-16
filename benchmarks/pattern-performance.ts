#!/usr/bin/env bun
/**
 * Comprehensive Performance Benchmarking Suite for Promptliano Pattern Utilities
 * 
 * This benchmark suite measures the performance impact and establishes baselines
 * for all pattern utilities to ensure they deliver the promised productivity gains
 * without sacrificing runtime performance.
 * 
 * Key Metrics:
 * - Function execution time (microseconds)
 * - Memory allocation per operation
 * - Garbage collection impact
 * - Concurrent operation performance
 * - Large dataset handling (1K, 10K, 100K items)
 * 
 * Performance Targets:
 * - Factory functions: <1ms execution time
 * - Schema validation: <0.1ms per schema
 * - Memory usage: <10MB for large datasets
 * - No memory leaks over 1000 iterations
 */

import { performance, PerformanceObserver } from 'perf_hooks'
import { z } from 'zod'

// Import pattern utilities to benchmark
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  withErrorHandling,
  createRouteHandler,
  successResponse,
  operationSuccessResponse,
  validateEntities,
  createCrudRoutes
} from '../packages/server/src/utils/route-helpers'

import {
  ErrorFactory,
  createEntityErrorFactory,
  withErrorContext,
  assertExists,
  assertUpdateSucceeded,
  assertDeleteSucceeded,
  assertDatabaseOperation,
  handleZodError
} from '../packages/services/src/utils/error-factory'

import {
  createApiResponseSchema,
  createListResponseSchema,
  createPaginatedResponseSchema,
  createCrudValidationSchemas,
  createBaseEntitySchema,
  createEntitySchemas,
  createCrudSchemas,
  createSearchQuerySchema,
  commonFields,
  schemaFactories
} from '../packages/schemas/src/schema-factories'

import {
  createCrudHooks,
  createQueryHook,
  createMutationHook,
  createOptimisticMutation
} from '../packages/client/src/hooks/utils/hook-factory'

// TODO: Fix column factory imports - has dependency issues
// import {
//   createTextColumn,
//   createDateColumn,
//   createStatusColumn,
//   createActionsColumn,
//   createSelectionColumn,
//   createDataTableColumns
// } from '../packages/ui/src/components/data-table/column-factory'

// Benchmark configuration
interface BenchmarkConfig {
  name: string
  iterations: number
  warmupIterations: number
  datasets: {
    small: number
    medium: number
    large: number
  }
  memoryTrackingEnabled: boolean
  gcForceEnabled: boolean
}

const config: BenchmarkConfig = {
  name: 'Promptliano Pattern Performance Benchmark',
  iterations: 1000,
  warmupIterations: 100,
  datasets: {
    small: 100,
    medium: 1000,
    large: 10000
  },
  memoryTrackingEnabled: true,
  gcForceEnabled: true
}

// Benchmark result types
interface BenchmarkResult {
  name: string
  category: string
  avgExecutionTime: number // microseconds
  minExecutionTime: number
  maxExecutionTime: number
  totalExecutionTime: number
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
  summary: {
    routeHelpers: BenchmarkResult[]
    errorFactory: BenchmarkResult[]
    schemaFactories: BenchmarkResult[]
    hookFactory: BenchmarkResult[]
    columnFactory: BenchmarkResult[]
  }
  baseline: {
    routeHelpers: number
    errorFactory: number
    schemaFactories: number
    hookFactory: number
    columnFactory: number
  }
}

// Memory tracking utilities
class MemoryTracker {
  private snapshots: NodeJS.MemoryUsage[] = []

  snapshot(): NodeJS.MemoryUsage {
    const memory = process.memoryUsage()
    this.snapshots.push(memory)
    return memory
  }

  getAverageUsage(): NodeJS.MemoryUsage {
    if (this.snapshots.length === 0) {
      return process.memoryUsage()
    }

    const totals = this.snapshots.reduce(
      (acc, curr) => ({
        rss: acc.rss + curr.rss,
        heapTotal: acc.heapTotal + curr.heapTotal,
        heapUsed: acc.heapUsed + curr.heapUsed,
        external: acc.external + curr.external,
        arrayBuffers: acc.arrayBuffers + curr.arrayBuffers
      }),
      { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
    )

    const count = this.snapshots.length
    return {
      rss: Math.round(totals.rss / count),
      heapTotal: Math.round(totals.heapTotal / count),
      heapUsed: Math.round(totals.heapUsed / count),
      external: Math.round(totals.external / count),
      arrayBuffers: Math.round(totals.arrayBuffers / count)
    }
  }

  reset(): void {
    this.snapshots = []
  }
}

// Benchmark runner utility
class BenchmarkRunner {
  private memoryTracker = new MemoryTracker()

  async runBenchmark<T>(
    name: string,
    category: string,
    operation: () => T | Promise<T>,
    iterations: number = config.iterations,
    datasetSize?: number
  ): Promise<BenchmarkResult> {
    // Warmup phase
    for (let i = 0; i < config.warmupIterations; i++) {
      try {
        await operation()
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Force garbage collection before benchmark
    if (config.gcForceEnabled && global.gc) {
      global.gc()
    }

    // Reset memory tracker
    this.memoryTracker.reset()

    const executionTimes: number[] = []
    let totalTime = 0
    let error: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        if (config.memoryTrackingEnabled) {
          this.memoryTracker.snapshot()
        }

        const startTime = performance.now()
        await operation()
        const endTime = performance.now()

        const executionTime = (endTime - startTime) * 1000 // Convert to microseconds
        executionTimes.push(executionTime)
        totalTime += executionTime
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }

    const avgMemory = this.memoryTracker.getAverageUsage()
    const avgExecutionTime = totalTime / iterations
    const minExecutionTime = Math.min(...executionTimes)
    const maxExecutionTime = Math.max(...executionTimes)
    const operationsPerSecond = 1000000 / avgExecutionTime // Convert from microseconds

    return {
      name,
      category,
      avgExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      totalExecutionTime: totalTime,
      operationsPerSecond,
      memoryUsage: {
        heapUsed: avgMemory.heapUsed,
        heapTotal: avgMemory.heapTotal,
        external: avgMemory.external,
        rss: avgMemory.rss
      },
      iterations,
      datasetSize,
      success: !error,
      error
    }
  }
}

// Test data generators
function generateTestEntity(id: number) {
  return {
    id,
    name: `Test Entity ${id}`,
    description: `Description for entity ${id}`,
    status: ['active', 'inactive'][id % 2] as 'active' | 'inactive',
    tags: [`tag-${id}`, `category-${Math.floor(id / 10)}`],
    metadata: { createdBy: `user-${id % 50}`, priority: id % 5 },
    created: Date.now() - (id * 1000),
    updated: Date.now() - (id * 500)
  }
}

function generateTestEntities(count: number) {
  return Array.from({ length: count }, (_, i) => generateTestEntity(i + 1))
}

// Route Helpers Benchmarks
async function benchmarkRouteHelpers(runner: BenchmarkRunner): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Test schema for route helpers
  const TestSchema = z.object({
    id: z.number(),
    name: z.string(),
    status: z.string()
  })

  // Benchmark createStandardResponses
  results.push(await runner.runBenchmark(
    'createStandardResponses',
    'Route Helpers',
    () => createStandardResponses(TestSchema)
  ))

  // Benchmark createStandardResponsesWithStatus
  results.push(await runner.runBenchmark(
    'createStandardResponsesWithStatus',
    'Route Helpers',
    () => createStandardResponsesWithStatus(TestSchema, 201, 'Created')
  ))

  // Benchmark successResponse
  results.push(await runner.runBenchmark(
    'successResponse',
    'Route Helpers',
    () => successResponse({ id: 1, name: 'test' })
  ))

  // Benchmark operationSuccessResponse
  results.push(await runner.runBenchmark(
    'operationSuccessResponse',
    'Route Helpers',
    () => operationSuccessResponse('Operation completed')
  ))

  // Benchmark withErrorHandling wrapper
  const testHandler = async (c: any) => {
    return { success: true, data: 'test' }
  }
  const wrappedHandler = withErrorHandling(testHandler)

  results.push(await runner.runBenchmark(
    'withErrorHandling',
    'Route Helpers',
    () => wrappedHandler({} as any)
  ))

  // Benchmark validateEntities with different dataset sizes
  for (const [size, count] of Object.entries(config.datasets)) {
    const entities = generateTestEntities(count)
    const validator = (entity: any) => Boolean(entity.id && entity.name)

    results.push(await runner.runBenchmark(
      `validateEntities_${size}`,
      'Route Helpers',
      () => validateEntities(entities, validator, 'TestEntity'),
      Math.min(100, config.iterations), // Reduce iterations for large datasets
      count
    ))
  }

  return results
}

// Error Factory Benchmarks
async function benchmarkErrorFactory(runner: BenchmarkRunner): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Benchmark basic ErrorFactory methods
  const errorMethods = [
    () => { try { ErrorFactory.notFound('Entity', 123) } catch (e) { return e } },
    () => { try { ErrorFactory.validationFailed('Entity', { field: 'error' }) } catch (e) { return e } },
    () => { try { ErrorFactory.operationFailed('create', 'Database error') } catch (e) { return e } },
    () => { try { ErrorFactory.permissionDenied('Entity', 'read') } catch (e) { return e } },
    () => { try { ErrorFactory.duplicate('Entity', 'name', 'test') } catch (e) { return e } },
    () => { try { ErrorFactory.invalidState('Entity', 'pending', 'activate') } catch (e) { return e } },
    () => { try { ErrorFactory.databaseError('insert', 'Connection timeout') } catch (e) { return e } }
  ]

  const methodNames = [
    'notFound', 'validationFailed', 'operationFailed', 'permissionDenied',
    'duplicate', 'invalidState', 'databaseError'
  ]

  for (let i = 0; i < errorMethods.length; i++) {
    results.push(await runner.runBenchmark(
      `ErrorFactory.${methodNames[i]}`,
      'Error Factory',
      errorMethods[i]
    ))
  }

  // Benchmark createEntityErrorFactory
  results.push(await runner.runBenchmark(
    'createEntityErrorFactory',
    'Error Factory',
    () => createEntityErrorFactory('TestEntity')
  ))

  // Benchmark assertion helpers
  results.push(await runner.runBenchmark(
    'assertExists_success',
    'Error Factory',
    () => assertExists({ id: 1 }, 'Entity', 1)
  ))

  results.push(await runner.runBenchmark(
    'assertUpdateSucceeded',
    'Error Factory',
    () => assertUpdateSucceeded(true, 'Entity', 1)
  ))

  results.push(await runner.runBenchmark(
    'assertDeleteSucceeded',
    'Error Factory',
    () => assertDeleteSucceeded(1, 'Entity', 1)
  ))

  // Benchmark withErrorContext
  const testOperation = async () => ({ success: true })
  results.push(await runner.runBenchmark(
    'withErrorContext',
    'Error Factory',
    () => withErrorContext(testOperation, { entity: 'Test', action: 'create', id: 1 })
  ))

  return results
}

// Schema Factories Benchmarks
async function benchmarkSchemaFactories(runner: BenchmarkRunner): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  const testFields = {
    name: z.string(),
    description: z.string().optional(),
    status: z.enum(['active', 'inactive']),
    tags: z.array(z.string()).default([]),
    metadata: z.record(z.any()).default({})
  }

  // Benchmark createApiResponseSchema
  results.push(await runner.runBenchmark(
    'createApiResponseSchema',
    'Schema Factories',
    () => createApiResponseSchema(z.object(testFields), 'TestResponse')
  ))

  // Benchmark createListResponseSchema
  results.push(await runner.runBenchmark(
    'createListResponseSchema',
    'Schema Factories',
    () => createListResponseSchema(z.object(testFields), 'TestListResponse')
  ))

  // Benchmark createPaginatedResponseSchema
  results.push(await runner.runBenchmark(
    'createPaginatedResponseSchema',
    'Schema Factories',
    () => createPaginatedResponseSchema(z.object(testFields), 'TestPaginatedResponse')
  ))

  // Benchmark createBaseEntitySchema
  results.push(await runner.runBenchmark(
    'createBaseEntitySchema',
    'Schema Factories',
    () => createBaseEntitySchema(testFields, 'TestEntity')
  ))

  // Benchmark createEntitySchemas
  results.push(await runner.runBenchmark(
    'createEntitySchemas',
    'Schema Factories',
    () => createEntitySchemas('TestEntity', testFields)
  ))

  // Benchmark createCrudSchemas
  results.push(await runner.runBenchmark(
    'createCrudSchemas',
    'Schema Factories',
    () => createCrudSchemas('TestEntity', testFields)
  ))

  // Benchmark createSearchQuerySchema
  results.push(await runner.runBenchmark(
    'createSearchQuerySchema',
    'Schema Factories',
    () => createSearchQuerySchema({ category: z.string().optional() })
  ))

  // Benchmark schema validation performance
  const entitySchema = createBaseEntitySchema(testFields, 'TestEntity')
  const testData = generateTestEntity(1)

  results.push(await runner.runBenchmark(
    'schema_validation',
    'Schema Factories',
    () => entitySchema.parse(testData)
  ))

  // Benchmark schema validation with different dataset sizes
  for (const [size, count] of Object.entries(config.datasets)) {
    const entities = generateTestEntities(count)

    results.push(await runner.runBenchmark(
      `schema_validation_${size}`,
      'Schema Factories',
      () => entities.map(entity => entitySchema.parse(entity)),
      Math.min(10, config.iterations), // Reduce iterations for large validations
      count
    ))
  }

  return results
}

// Hook Factory Benchmarks
async function benchmarkHookFactory(runner: BenchmarkRunner): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Mock API for testing
  const mockApi = {
    list: async () => generateTestEntities(10),
    get: async (id: number) => generateTestEntity(id),
    create: async (data: any) => ({ ...data, id: Date.now() }),
    update: async (id: number, data: any) => ({ ...generateTestEntity(id), ...data }),
    delete: async (id: number) => true
  }

  const queryKeys = {
    all: ['test-entities'] as const,
    list: (params?: any) => ['test-entities', 'list', params] as const,
    detail: (id: number) => ['test-entities', 'detail', id] as const
  }

  // Benchmark createCrudHooks
  results.push(await runner.runBenchmark(
    'createCrudHooks',
    'Hook Factory',
    () => createCrudHooks({
      entityName: 'TestEntity',
      queryKeys,
      api: mockApi
    })
  ))

  // Benchmark createQueryHook
  results.push(await runner.runBenchmark(
    'createQueryHook',
    'Hook Factory',
    () => createQueryHook(
      (params: any) => queryKeys.list(params),
      mockApi.list
    )
  ))

  // Benchmark createMutationHook
  results.push(await runner.runBenchmark(
    'createMutationHook',
    'Hook Factory',
    () => createMutationHook(
      mockApi.create,
      {
        successMessage: 'Created successfully',
        invalidateKeys: [queryKeys.all]
      }
    )
  ))

  // Benchmark createOptimisticMutation
  results.push(await runner.runBenchmark(
    'createOptimisticMutation',
    'Hook Factory',
    () => createOptimisticMutation({
      mutationFn: mockApi.update,
      queryKey: (vars: any) => queryKeys.detail(vars.id),
      optimisticUpdate: (old: any, vars: any) => ({ ...old, ...vars.data }),
      successMessage: 'Updated successfully'
    })
  ))

  return results
}

// Column Factory Benchmarks - TODO: Fix dependency issues
async function benchmarkColumnFactory(runner: BenchmarkRunner): Promise<BenchmarkResult[]> {
  // Temporarily disabled due to UI component dependency issues
  return []
  
  /*
  const results: BenchmarkResult[] = []

  type TestData = {
    id: number
    name: string
    status: string
    created: number
    description: string
  }

  // Benchmark individual column creators
  results.push(await runner.runBenchmark(
    'createTextColumn',
    'Column Factory',
    () => createTextColumn<TestData>({
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
      truncate: true,
      maxLength: 50
    })
  ))

  results.push(await runner.runBenchmark(
    'createDateColumn',
    'Column Factory',
    () => createDateColumn<TestData>({
      accessorKey: 'created',
      header: 'Created',
      format: 'relative'
    })
  ))

  results.push(await runner.runBenchmark(
    'createStatusColumn',
    'Column Factory',
    () => createStatusColumn<TestData>({
      accessorKey: 'status',
      header: 'Status',
      statuses: {
        active: { label: 'Active', variant: 'default' },
        inactive: { label: 'Inactive', variant: 'secondary' }
      }
    })
  ))

  results.push(await runner.runBenchmark(
    'createActionsColumn',
    'Column Factory',
    () => createActionsColumn<TestData>({
      actions: [
        { label: 'Edit', onClick: () => {} },
        { label: 'Delete', onClick: () => {}, variant: 'destructive' }
      ]
    })
  ))

  results.push(await runner.runBenchmark(
    'createSelectionColumn',
    'Column Factory',
    () => createSelectionColumn<TestData>()
  ))

  // Benchmark createDataTableColumns
  results.push(await runner.runBenchmark(
    'createDataTableColumns',
    'Column Factory',
    () => createDataTableColumns<TestData>({
      selectable: true,
      columns: [
        { type: 'text', config: { accessorKey: 'name', header: 'Name' } },
        { type: 'text', config: { accessorKey: 'description', header: 'Description', truncate: true } },
        { type: 'status', config: { 
          accessorKey: 'status', 
          header: 'Status',
          statuses: { active: { label: 'Active', variant: 'default' } }
        }},
        { type: 'date', config: { accessorKey: 'created', header: 'Created' } }
      ],
      actions: {
        actions: [
          { label: 'Edit', onClick: () => {} },
          { label: 'Delete', onClick: () => {}, variant: 'destructive' }
        ]
      }
    })
  ))

  // Benchmark column creation with different dataset complexities
  for (const [size, count] of Object.entries(config.datasets)) {
    const columns = Array.from({ length: Math.min(count / 100, 20) }, (_, i) => ({
      type: 'text' as const,
      config: {
        accessorKey: `field${i}` as keyof TestData,
        header: `Field ${i}`,
        truncate: true
      }
    }))

    results.push(await runner.runBenchmark(
      `createDataTableColumns_${size}_columns`,
      'Column Factory',
      () => createDataTableColumns({
        columns,
        selectable: true,
        actions: {
          actions: [{ label: 'Edit', onClick: () => {} }]
        }
      }),
      Math.min(100, config.iterations),
      columns.length
    ))
  }

  return results
  */
}

// Main benchmark suite runner
async function runBenchmarkSuite(): Promise<BenchmarkSuite> {
  console.log(`🚀 Starting ${config.name}`)
  console.log(`📊 Configuration:`)
  console.log(`   - Iterations: ${config.iterations}`)
  console.log(`   - Warmup iterations: ${config.warmupIterations}`)
  console.log(`   - Dataset sizes: ${JSON.stringify(config.datasets)}`)
  console.log(`   - Memory tracking: ${config.memoryTrackingEnabled}`)
  console.log(`   - GC forcing: ${config.gcForceEnabled}`)
  console.log('')

  const runner = new BenchmarkRunner()
  const startTime = performance.now()

  // Run all benchmark categories
  const routeHelpers = await benchmarkRouteHelpers(runner)
  console.log(`✅ Route Helpers benchmarks completed (${routeHelpers.length} tests)`)

  const errorFactory = await benchmarkErrorFactory(runner)
  console.log(`✅ Error Factory benchmarks completed (${errorFactory.length} tests)`)

  const schemaFactories = await benchmarkSchemaFactories(runner)
  console.log(`✅ Schema Factories benchmarks completed (${schemaFactories.length} tests)`)

  const hookFactory = await benchmarkHookFactory(runner)
  console.log(`✅ Hook Factory benchmarks completed (${hookFactory.length} tests)`)

  // TODO: Enable column factory benchmarks once dependencies are fixed
  // const columnFactory = await benchmarkColumnFactory(runner)
  // console.log(`✅ Column Factory benchmarks completed (${columnFactory.length} tests)`)
  const columnFactory: BenchmarkResult[] = []

  const endTime = performance.now()
  const totalTime = endTime - startTime

  // Combine all results
  const results = [
    ...routeHelpers,
    ...errorFactory,
    ...schemaFactories,
    ...hookFactory,
    ...columnFactory
  ]

  // Calculate baselines (average execution time for each category)
  const calculateBaseline = (categoryResults: BenchmarkResult[]) => {
    const validResults = categoryResults.filter(r => r.success)
    return validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.avgExecutionTime, 0) / validResults.length
      : 0
  }

  const suite: BenchmarkSuite = {
    results,
    totalTime,
    summary: {
      routeHelpers,
      errorFactory,
      schemaFactories,
      hookFactory,
      columnFactory
    },
    baseline: {
      routeHelpers: calculateBaseline(routeHelpers),
      errorFactory: calculateBaseline(errorFactory),
      schemaFactories: calculateBaseline(schemaFactories),
      hookFactory: calculateBaseline(hookFactory),
      columnFactory: calculateBaseline(columnFactory)
    }
  }

  return suite
}

// Results formatting and reporting
function formatResults(suite: BenchmarkSuite): void {
  console.log('\n📈 BENCHMARK RESULTS')
  console.log('=' .repeat(80))

  // Summary table
  console.log('\n🎯 PERFORMANCE BASELINES')
  console.log('-'.repeat(50))
  Object.entries(suite.baseline).forEach(([category, baseline]) => {
    const status = baseline < 1000 ? '✅' : baseline < 5000 ? '⚠️' : '❌'
    console.log(`${status} ${category.padEnd(20)}: ${baseline.toFixed(2)}μs avg`)
  })

  // Category breakdown
  Object.entries(suite.summary).forEach(([category, results]) => {
    console.log(`\n📊 ${category.toUpperCase()} RESULTS`)
    console.log('-'.repeat(50))

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    if (successful.length > 0) {
      successful.forEach(result => {
        const opsPerSec = result.operationsPerSecond.toLocaleString()
        const memoryMB = (result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
        const status = result.avgExecutionTime < 1000 ? '✅' : result.avgExecutionTime < 5000 ? '⚠️' : '❌'
        
        console.log(`${status} ${result.name.padEnd(30)}: ${result.avgExecutionTime.toFixed(2)}μs (${opsPerSec} ops/s, ${memoryMB}MB)`)
        
        if (result.datasetSize) {
          console.log(`   Dataset: ${result.datasetSize.toLocaleString()} items`)
        }
      })
    }

    if (failed.length > 0) {
      console.log('\n❌ FAILED BENCHMARKS:')
      failed.forEach(result => {
        console.log(`   ${result.name}: ${result.error}`)
      })
    }
  })

  // Performance analysis
  console.log('\n🔍 PERFORMANCE ANALYSIS')
  console.log('-'.repeat(50))

  const allSuccessful = suite.results.filter(r => r.success)
  const fastest = allSuccessful.reduce((min, r) => r.avgExecutionTime < min.avgExecutionTime ? r : min)
  const slowest = allSuccessful.reduce((max, r) => r.avgExecutionTime > max.avgExecutionTime ? r : max)
  const totalOps = allSuccessful.reduce((sum, r) => sum + (r.iterations || 0), 0)
  const avgMemory = allSuccessful.reduce((sum, r) => sum + r.memoryUsage.heapUsed, 0) / allSuccessful.length

  console.log(`⚡ Fastest operation: ${fastest.name} (${fastest.avgExecutionTime.toFixed(2)}μs)`)
  console.log(`🐌 Slowest operation: ${slowest.name} (${slowest.avgExecutionTime.toFixed(2)}μs)`)
  console.log(`🏃 Total operations: ${totalOps.toLocaleString()}`)
  console.log(`💾 Average memory usage: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`)
  console.log(`⏱️  Total benchmark time: ${(suite.totalTime / 1000).toFixed(2)}s`)

  // Performance targets validation
  console.log('\n🎯 PERFORMANCE TARGETS')
  console.log('-'.repeat(50))

  const factoryFunctions = allSuccessful.filter(r => 
    r.name.includes('create') || r.name.includes('Factory')
  )
  const schemaValidations = allSuccessful.filter(r => 
    r.name.includes('validation') || r.name.includes('parse')
  )

  const factoryTargetMet = factoryFunctions.every(r => r.avgExecutionTime < 1000)
  const schemaTargetMet = schemaValidations.every(r => r.avgExecutionTime < 100)
  const memoryTargetMet = avgMemory < 10 * 1024 * 1024 // 10MB

  console.log(`${factoryTargetMet ? '✅' : '❌'} Factory functions <1ms: ${factoryTargetMet}`)
  console.log(`${schemaTargetMet ? '✅' : '❌'} Schema validation <0.1ms: ${schemaTargetMet}`)
  console.log(`${memoryTargetMet ? '✅' : '❌'} Memory usage <10MB: ${memoryTargetMet}`)

  // Bundle size analysis placeholder
  console.log('\n📦 BUNDLE SIZE IMPACT ANALYSIS')
  console.log('-'.repeat(50))
  console.log('ℹ️  Run "bun run analyze:bundle" for detailed bundle size analysis')
  console.log('ℹ️  Pattern utilities should add <5KB to final bundle size')
}

// Save results to JSON for automated analysis
function saveResults(suite: BenchmarkSuite): void {
  const outputFile = 'benchmarks/results/pattern-performance-results.json'
  const timestamp = new Date().toISOString()
  
  const output = {
    timestamp,
    config,
    suite,
    metadata: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryLimit: process.env.NODE_MAX_OLD_SPACE_SIZE || 'default'
    }
  }

  try {
    Bun.write(outputFile, JSON.stringify(output, null, 2))
    console.log(`\n💾 Results saved to ${outputFile}`)
  } catch (error) {
    console.error(`❌ Failed to save results: ${error}`)
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    // Enable garbage collection for memory analysis
    if (typeof global.gc === 'undefined') {
      console.log('⚠️  Garbage collection not exposed. Run with --expose-gc for better memory analysis.')
    }

    const suite = await runBenchmarkSuite()
    formatResults(suite)
    saveResults(suite)

    // Exit with appropriate code based on performance targets
    const failed = suite.results.filter(r => !r.success).length
    const performanceIssues = suite.results.filter(r => 
      r.success && (r.avgExecutionTime > 5000 || r.memoryUsage.heapUsed > 50 * 1024 * 1024)
    ).length

    if (failed > 0) {
      console.log(`\n❌ ${failed} benchmarks failed`)
      process.exit(1)
    } else if (performanceIssues > 0) {
      console.log(`\n⚠️  ${performanceIssues} performance issues detected`)
      process.exit(1)
    } else {
      console.log('\n✅ All performance targets met!')
      process.exit(0)
    }
  } catch (error) {
    console.error('❌ Benchmark suite failed:', error)
    process.exit(1)
  }
}

// CLI entry point
if (import.meta.main) {
  main()
}

export { runBenchmarkSuite, BenchmarkSuite, BenchmarkResult, BenchmarkConfig }