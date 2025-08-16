# Promptliano Pattern Performance Benchmarks

This directory contains comprehensive performance benchmarking for all Promptliano pattern utilities to ensure they deliver the promised productivity gains without sacrificing runtime performance.

## Quick Start

```bash
# Run the complete benchmark suite
bun run benchmarks/pattern-performance.ts

# Run with garbage collection analysis (recommended)
bun --expose-gc run benchmarks/pattern-performance.ts

# Run with memory profiling
bun --expose-gc --max-old-space-size=4096 run benchmarks/pattern-performance.ts
```

## Performance Targets

Our pattern utilities must meet these performance criteria to ensure they improve developer productivity without degrading application performance:

| Pattern Category | Target | Measurement |
|------------------|--------|-------------|
| **Factory Functions** | <1ms | Average execution time |
| **Schema Validation** | <0.1ms | Per schema validation |
| **Memory Usage** | <10MB | For large datasets (10K items) |
| **No Memory Leaks** | 0% growth | Over 1000 iterations |
| **Operations/Second** | >10,000 | For core functions |

## Benchmark Categories

### 1. Route Helpers (`route-helpers.ts`)
Tests the performance of API route response standardization utilities:

- `createStandardResponses` - Standard response schema generation
- `createStandardResponsesWithStatus` - Custom status response schemas  
- `withErrorHandling` - Error handling wrapper performance
- `successResponse` - Response formatting
- `validateEntities` - Batch entity validation (tested with 100, 1K, 10K items)

**Expected Impact**: 75% faster route creation, 15 lines → 1 line

### 2. Error Factory (`error-factory.ts`)
Tests standardized error handling utilities:

- `ErrorFactory.*` methods - All error creation methods
- `createEntityErrorFactory` - Entity-specific error factory creation
- `assertExists`, `assertUpdateSucceeded` - Assertion helpers
- `withErrorContext` - Error context wrapping
- `handleZodError` - Zod error handling

**Expected Impact**: 80% faster error handling, 15 lines → 2 lines

### 3. Schema Factories (`schema-factories.ts`)
Tests Zod schema generation and validation performance:

- `createApiResponseSchema` - Response schema creation
- `createListResponseSchema` - List response schemas
- `createPaginatedResponseSchema` - Paginated response schemas
- `createEntitySchemas` - Complete entity schema sets
- `createCrudSchemas` - Full CRUD schema generation
- Schema validation performance (tested with 100, 1K, 10K entities)

**Expected Impact**: 70% reduction in schema duplication, 100 lines → 30 lines

### 4. Hook Factory (`hook-factory.ts`)
Tests React Query hook generation utilities:

- `createCrudHooks` - Complete CRUD hook set generation
- `createQueryHook` - Individual query hook creation
- `createMutationHook` - Individual mutation hook creation
- `createOptimisticMutation` - Optimistic update hook creation

**Expected Impact**: 85% reduction in hook boilerplate, 300 lines → 50 lines

### 5. Column Factory (`column-factory.tsx`)
Tests data table column generation utilities:

- `createTextColumn` - Text column creation
- `createDateColumn` - Date column with formatting
- `createStatusColumn` - Status badge columns
- `createActionsColumn` - Action dropdown columns
- `createDataTableColumns` - Complete column set generation
- Complex table creation (tested with varying column counts)

**Expected Impact**: 90% faster table creation, 150 lines → 30 lines

## Benchmark Results

Results are automatically saved to `benchmarks/results/pattern-performance-results.json` with:

- Individual function execution times (microseconds)
- Memory usage metrics
- Operations per second
- Dataset size impact analysis
- Performance target validation
- Historical comparison data

### Reading Results

```bash
# View latest results
cat benchmarks/results/pattern-performance-results.json | jq '.suite.baseline'

# Compare with previous runs
bun run benchmarks/compare-results.ts
```

## Memory Analysis

The benchmark suite tracks memory usage throughout execution:

- **Heap Used**: Active object memory
- **Heap Total**: Allocated heap space
- **External**: C++ objects bound to JS
- **RSS**: Resident Set Size (total memory)

### Memory Leak Detection

Runs 1000+ iterations of each function to detect memory growth patterns. Functions should maintain stable memory usage regardless of iteration count.

## Performance Optimization

If benchmarks identify performance issues:

### 1. Factory Function Optimization
- Memoize factory results where appropriate
- Avoid object recreation in hot paths
- Use efficient data structures

### 2. Schema Validation Optimization  
- Cache compiled schemas
- Use selective parsing for large objects
- Implement lazy validation where possible

### 3. Memory Optimization
- Identify memory leaks with heap analysis
- Optimize object lifecycle management
- Use weak references for caches

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/performance.yml
- name: Run Performance Benchmarks
  run: bun --expose-gc run benchmarks/pattern-performance.ts
  
- name: Check Performance Regression
  run: bun run benchmarks/regression-check.ts
```

## Benchmark Development

To add new benchmarks:

1. **Add benchmark function** to appropriate category
2. **Follow naming convention**: `benchmark{Category}Name`
3. **Include multiple dataset sizes** for scalability testing
4. **Set appropriate iteration counts** based on operation complexity
5. **Add performance targets** to validation logic

### Example New Benchmark

```typescript
// Add to benchmarkRouteHelpers function
results.push(await runner.runBenchmark(
  'newRouteHelper',
  'Route Helpers',
  () => newRouteHelper(testData),
  1000, // iterations
  testData.length // dataset size
))
```

## Performance History

Track performance over time:

```bash
# Generate performance trend report
bun run benchmarks/performance-trends.ts

# View regression analysis
bun run benchmarks/regression-analysis.ts
```

## Troubleshooting

### High Memory Usage
- Run with `--expose-gc` to enable garbage collection
- Increase heap size with `--max-old-space-size=4096`
- Check for memory leaks in new pattern implementations

### Slow Execution
- Reduce iteration counts for development
- Use profiling tools: `bun --prof run benchmarks/pattern-performance.ts`
- Identify bottlenecks with flamegraph analysis

### Failed Benchmarks
- Check console output for specific error messages
- Verify pattern utility imports are correct
- Ensure test data generators produce valid data

## Related Tools

- **Bundle Analysis**: `bun run analyze:bundle` - Analyze bundle size impact
- **Type Performance**: `bun run benchmark:types` - TypeScript compilation performance  
- **E2E Performance**: `bun run benchmark:e2e` - End-to-end pattern usage scenarios

---

**Maintaining Performance Excellence**

The goal is to ensure Promptliano patterns deliver on their productivity promises while maintaining excellent runtime performance. Regular benchmarking helps us:

- Catch performance regressions early
- Validate optimization efforts
- Provide data-driven development decisions
- Maintain confidence in pattern adoption

Run benchmarks before major releases and monitor trends over time to ensure continued performance excellence.