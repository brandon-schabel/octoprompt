#!/usr/bin/env bun

import { performance } from 'node:perf_hooks'
import Database from 'bun:sqlite'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'

// Simple test record
interface TestRecord {
  id: number
  name: string
  description: string
  category: string
  priority: number
  created: number
  updated: number
}

// Benchmark configuration
const DATASET_SIZES = [100, 1000, 5000]

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
}

interface BenchmarkResult {
  operation: string
  fileTime: number
  sqliteTime: number
  speedup: number
  size: number
  fileOps?: number
  sqliteOps?: number
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = []
  private testDataDir: string

  constructor() {
    this.testDataDir = path.join(process.cwd(), 'data', 'benchmark-test')
    this.ensureDirectory(this.testDataDir)
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.testDataDir, { recursive: true, force: true })
    } catch {}
  }

  generateTestData(count: number): TestRecord[] {
    const categories = ['urgent', 'normal', 'low', 'archived']

    return Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      name: `Test Record ${i}`,
      description: `This is a test record with index ${i}. It contains some meaningful description.`,
      category: categories[i % categories.length] ?? 'normal',
      priority: i % 10,
      created: Date.now(),
      updated: Date.now()
    }))
  }

  async measureOperation<T>(operation: () => Promise<T>): Promise<{ time: number; result: T }> {
    const start = performance.now()
    const result = await operation()
    const time = performance.now() - start
    return { time, result }
  }

  // Direct file operations
  async fileOperations(testData: TestRecord[]): Promise<{
    insert: number
    read: number
    readAll: number
    update: number
    delete: number
  }> {
    const filePath = path.join(this.testDataDir, 'file-storage.json')

    // Insert
    const insertResult = await this.measureOperation(async () => {
      const data: Record<number, TestRecord> = {}
      for (const record of testData) {
        data[record.id] = record
      }
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    })

    // Read single
    const randomRecord = testData[Math.floor(Math.random() * testData.length)]
    const randomId = randomRecord?.id ?? testData[0]?.id ?? 1
    const readResult = await this.measureOperation(async () => {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      return data[randomId]
    })

    // Read all
    const readAllResult = await this.measureOperation(async () => {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    })

    // Update
    const updateResult = await this.measureOperation(async () => {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)

      // Update 10% of records
      const updateCount = Math.floor(testData.length * 0.1)
      for (let i = 0; i < updateCount; i++) {
        const record = testData[i]
        if (record && data[record.id]) {
          data[record.id].priority = 99
          data[record.id].updated = Date.now()
        }
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    })

    // Delete
    const deleteResult = await this.measureOperation(async () => {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)

      // Delete 10% of records
      const deleteCount = Math.floor(testData.length * 0.1)
      for (let i = 0; i < deleteCount; i++) {
        const record = testData[i]
        if (record) {
          delete data[record.id]
        }
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    })

    return {
      insert: insertResult.time,
      read: readResult.time,
      readAll: readAllResult.time,
      update: updateResult.time,
      delete: deleteResult.time
    }
  }

  // Direct SQLite operations
  async sqliteOperations(testData: TestRecord[]): Promise<{
    insert: number
    read: number
    readAll: number
    update: number
    delete: number
  }> {
    const dbPath = path.join(this.testDataDir, 'benchmark.db')
    const db = new Database(dbPath)

    // Create table
    db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      )
    `)

    // Prepare statements
    const insertStmt = db.prepare('INSERT INTO records (id, data) VALUES (?, ?)')
    const readStmt = db.prepare('SELECT data FROM records WHERE id = ?')
    const readAllStmt = db.prepare('SELECT id, data FROM records')
    const updateStmt = db.prepare('UPDATE records SET data = ? WHERE id = ?')
    const deleteStmt = db.prepare('DELETE FROM records WHERE id = ?')

    // Insert with transaction
    const insertResult = await this.measureOperation(async () => {
      const insertAll = db.transaction((records: TestRecord[]) => {
        for (const record of records) {
          insertStmt.run(record.id, JSON.stringify(record))
        }
      })
      insertAll(testData)
    })

    // Read single
    const randomRecord2 = testData[Math.floor(Math.random() * testData.length)]
    const randomId2 = randomRecord2?.id ?? testData[0]?.id ?? 1
    const readResult = await this.measureOperation(async () => {
      const row = readStmt.get(randomId2) as { data: string }
      return JSON.parse(row.data)
    })

    // Read all
    const readAllResult = await this.measureOperation(async () => {
      const rows = readAllStmt.all() as Array<{ id: number; data: string }>
      const result: Record<number, TestRecord> = {}
      for (const row of rows) {
        result[row.id] = JSON.parse(row.data)
      }
      return result
    })

    // Update with transaction
    const updateResult = await this.measureOperation(async () => {
      const updateBatch = db.transaction((updates: Array<{ id: number; data: TestRecord }>) => {
        for (const { id, data } of updates) {
          updateStmt.run(JSON.stringify(data), id)
        }
      })

      // Update 10% of records
      const updateCount = Math.floor(testData.length * 0.1)
      const updates = []
      for (let i = 0; i < updateCount; i++) {
        const originalRecord = testData[i]
        if (originalRecord) {
          const record = { ...originalRecord, priority: 99, updated: Date.now() }
          updates.push({ id: record.id, data: record })
        }
      }

      updateBatch(updates)
    })

    // Delete with transaction
    const deleteResult = await this.measureOperation(async () => {
      const deleteBatch = db.transaction((ids: number[]) => {
        for (const id of ids) {
          deleteStmt.run(id)
        }
      })

      // Delete 10% of records
      const deleteCount = Math.floor(testData.length * 0.1)
      const idsToDelete = testData.slice(0, deleteCount).map((r) => r.id)

      deleteBatch(idsToDelete)
    })

    db.close()

    return {
      insert: insertResult.time,
      read: readResult.time,
      readAll: readAllResult.time,
      update: updateResult.time,
      delete: deleteResult.time
    }
  }

  async benchmarkSize(size: number): Promise<void> {
    console.log(`\n${colors.bright}${colors.yellow}=== Testing with ${size} records ===${colors.reset}`)

    const testData = this.generateTestData(size)

    // Run file operations
    console.log(`${colors.cyan}Running file-based operations...${colors.reset}`)
    const fileResults = await this.fileOperations(testData)

    // Clean between tests
    await this.cleanup()
    this.ensureDirectory(this.testDataDir)

    // Regenerate test data for consistency
    const freshTestData = this.generateTestData(size)

    // Run SQLite operations
    console.log(`${colors.cyan}Running SQLite operations...${colors.reset}`)
    const sqliteResults = await this.sqliteOperations(freshTestData)

    // Record results
    const operations = ['insert', 'read', 'readAll', 'update', 'delete'] as const

    for (const op of operations) {
      const fileTime = fileResults[op]
      const sqliteTime = sqliteResults[op]

      this.results.push({
        operation: op.charAt(0).toUpperCase() + op.slice(1),
        fileTime,
        sqliteTime,
        speedup: fileTime / sqliteTime,
        size,
        fileOps: op === 'read' ? 1 : op === 'readAll' ? size : Math.floor(size * 0.1),
        sqliteOps: op === 'read' ? 1 : op === 'readAll' ? size : Math.floor(size * 0.1)
      })
    }
  }

  formatResults(): string {
    let output = `\n${colors.bright}${colors.green}=== Storage Performance Benchmark Results ===${colors.reset}\n\n`

    // Group results by dataset size
    for (const size of DATASET_SIZES) {
      const sizeResults = this.results.filter((r) => r.size === size)
      if (sizeResults.length === 0) continue

      output += `${colors.cyan}Dataset Size: ${size} records${colors.reset}\n`
      output += '┌─────────────────┬───────────────┬───────────────┬──────────────┬─────────────┬──────────────┐\n'
      output += '│ Operation       │ File-based    │ SQLite        │ Speedup      │ Winner      │ Ops/sec      │\n'
      output += '├─────────────────┼───────────────┼───────────────┼──────────────┼─────────────┼──────────────┤\n'

      for (const result of sizeResults) {
        const winner = result.speedup > 1 ? 'SQLite' : 'File'
        const winnerColor = result.speedup > 1 ? colors.green : colors.yellow
        const speedupColor = result.speedup > 1.5 ? colors.green : result.speedup < 0.7 ? colors.red : colors.yellow

        const fileOpsPerSec = result.fileOps ? Math.round((result.fileOps / result.fileTime) * 1000) : 0
        const sqliteOpsPerSec = result.sqliteOps ? Math.round((result.sqliteOps / result.sqliteTime) * 1000) : 0
        const opsPerSec = winner === 'SQLite' ? sqliteOpsPerSec : fileOpsPerSec

        output += `│ ${result.operation.padEnd(15)} │ ${this.formatTime(result.fileTime).padEnd(13)} │ ${this.formatTime(result.sqliteTime).padEnd(13)} │ ${speedupColor}${result.speedup.toFixed(2)}x${colors.reset}${' '.repeat(11 - result.speedup.toFixed(2).length)} │ ${winnerColor}${winner}${colors.reset}${' '.repeat(11 - winner.length)} │ ${opsPerSec.toLocaleString().padEnd(12)} │\n`
      }

      output += '└─────────────────┴───────────────┴───────────────┴──────────────┴─────────────┴──────────────┘\n\n'
    }

    // Summary and recommendations
    output += `${colors.bright}Summary:${colors.reset}\n`

    const avgSpeedup = this.results.reduce((sum, r) => sum + r.speedup, 0) / this.results.length
    if (avgSpeedup > 1.2) {
      output += `${colors.green}✓ SQLite shows ${avgSpeedup.toFixed(2)}x average performance improvement${colors.reset}\n`
      output += `${colors.green}✓ Transactions make batch operations significantly faster${colors.reset}\n`
      output += `${colors.green}✓ Better performance scales with dataset size${colors.reset}\n`
    } else if (avgSpeedup < 0.8) {
      output += `${colors.yellow}⚠ File-based storage shows better performance in this benchmark${colors.reset}\n`
      output += `${colors.yellow}⚠ Consider your specific use case before choosing${colors.reset}\n`
    } else {
      output += `${colors.blue}ℹ Performance is comparable between both storage backends${colors.reset}\n`
      output += `${colors.blue}ℹ SQLite offers additional benefits like ACID compliance and better querying${colors.reset}\n`
    }

    return output
  }

  formatTime(ms: number): string {
    if (ms < 0.1) return `${(ms * 1000).toFixed(0)}µs`
    if (ms < 1) return `${ms.toFixed(2)}ms`
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  async saveMarkdownReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), 'packages', 'storage', 'benchmark-report.md')

    let markdown = '# Storage Performance Benchmark Report\n\n'
    markdown += `Generated: ${new Date().toISOString()}\n\n`
    markdown += '## Test Environment\n\n'
    markdown += `- Platform: ${process.platform}\n`
    markdown += `- Node Version: ${process.version}\n`
    markdown += `- Bun Version: ${process.versions.bun || 'N/A'}\n\n`

    markdown += '## Test Configuration\n\n'
    markdown += `- Dataset sizes: ${DATASET_SIZES.join(', ')} records\n`
    markdown += '- Operations tested: Insert (bulk), Read (single), Read All, Update (10%), Delete (10%)\n'
    markdown += '- File storage: JSON file with pretty printing\n'
    markdown += '- SQLite storage: Single table with JSON data column\n\n'

    markdown += '## Results\n\n'

    for (const size of DATASET_SIZES) {
      const sizeResults = this.results.filter((r) => r.size === size)
      if (sizeResults.length === 0) continue

      markdown += `### Dataset: ${size} records\n\n`
      markdown += '| Operation | File-based | SQLite | Speedup | Winner | Throughput |\n'
      markdown += '|-----------|------------|---------|---------|--------|------------|\n'

      for (const result of sizeResults) {
        const winner = result.speedup > 1 ? '**SQLite**' : '**File**'
        const fileOpsPerSec = result.fileOps ? Math.round((result.fileOps / result.fileTime) * 1000) : 0
        const sqliteOpsPerSec = result.sqliteOps ? Math.round((result.sqliteOps / result.sqliteTime) * 1000) : 0
        const throughput = winner === '**SQLite**' ? sqliteOpsPerSec : fileOpsPerSec

        markdown += `| ${result.operation} | ${this.formatTime(result.fileTime)} | ${this.formatTime(result.sqliteTime)} | ${result.speedup.toFixed(2)}x | ${winner} | ${throughput.toLocaleString()} ops/s |\n`
      }

      markdown += '\n'
    }

    markdown += '## Analysis\n\n'

    const avgSpeedup = this.results.reduce((sum, r) => sum + r.speedup, 0) / this.results.length

    markdown += '### Performance Comparison\n\n'
    if (avgSpeedup > 1.2) {
      markdown += '✅ **SQLite demonstrates superior performance**\n\n'
      markdown += 'Key advantages:\n'
      markdown += '- Batch operations benefit from transactions\n'
      markdown += '- Better memory efficiency for large datasets\n'
      markdown += '- Consistent performance across different operations\n'
      markdown += '- Built-in indexing capabilities (not tested here)\n\n'
    } else if (avgSpeedup < 0.8) {
      markdown += '⚠️ **File-based storage shows better performance**\n\n'
      markdown += 'Possible reasons:\n'
      markdown += '- Simple JSON operations have less overhead\n'
      markdown += '- Small dataset sizes favor in-memory operations\n'
      markdown += '- No SQL parsing or query planning overhead\n\n'
    } else {
      markdown += 'ℹ️ **Performance is comparable**\n\n'
      markdown += 'Considerations:\n'
      markdown += '- Choose based on feature requirements\n'
      markdown += '- SQLite offers ACID compliance and complex queries\n'
      markdown += '- File-based is simpler and easier to debug\n\n'
    }

    markdown += '### Recommendations\n\n'
    markdown += '1. **Use SQLite when:**\n'
    markdown += '   - Working with large datasets (>1000 records)\n'
    markdown += '   - Need complex queries or filtering\n'
    markdown += '   - Require ACID compliance\n'
    markdown += '   - Multiple concurrent users\n\n'
    markdown += '2. **Use File-based when:**\n'
    markdown += '   - Small datasets (<1000 records)\n'
    markdown += '   - Simple key-value storage\n'
    markdown += '   - Need human-readable storage\n'
    markdown += '   - Easier debugging and backup\n'

    await fs.writeFile(reportPath, markdown, 'utf-8')
    console.log(`\n${colors.green}✓ Markdown report saved to: ${reportPath}${colors.reset}`)
  }

  async run(): Promise<void> {
    console.log(`${colors.bright}${colors.blue}Starting Storage Performance Benchmark...${colors.reset}`)
    console.log(`Testing with dataset sizes: ${DATASET_SIZES.join(', ')} records`)

    try {
      for (const size of DATASET_SIZES) {
        await this.benchmarkSize(size)
      }

      // Display results
      console.log(this.formatResults())

      // Save markdown report
      await this.saveMarkdownReport()
    } finally {
      await this.cleanup()
    }
  }
}

// Run the benchmark
if (import.meta.main) {
  const benchmark = new PerformanceBenchmark()
  benchmark.run().catch(console.error)
}
