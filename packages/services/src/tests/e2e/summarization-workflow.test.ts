import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import {
  createProject,
  deleteProject,
  syncProject,
  getProjectFiles,
  summarizeFiles,
  getProjectById
} from '../../project-service'
import { getCompactProjectSummary } from '../../utils/project-summary-service'
import type { Project, ProjectFile } from '@promptliano/schemas'
import { LOCAL_MODEL_TEST_CONFIG, isLMStudioAvailable, requireLMStudio } from '../local-model-test-config'
import { PerformanceTracker } from '../utils/ai-test-helpers'
import { validateSummary } from '../validators/summary-quality'
import * as fs from 'fs/promises'
import * as path from 'path'

// Set test environment
process.env.NODE_ENV = 'test'
process.env.LMSTUDIO_BASE_URL = LOCAL_MODEL_TEST_CONFIG.baseUrl

describe('End-to-End Summarization Workflow', () => {
  let lmstudioAvailable = false
  let testProject: Project | null = null
  const testProjectPath = '/tmp/test-e2e-project-' + Date.now()

  beforeAll(async () => {
    // Check if LMStudio is available
    if (!requireLMStudio()) {
      console.log('⚠️  LMStudio tests disabled')
      return
    }

    lmstudioAvailable = await isLMStudioAvailable()
    console.log(lmstudioAvailable ? '✅ Running E2E tests with LMStudio' : '⚠️  Running E2E tests with mock responses')

    // Create test project directory
    await fs.mkdir(testProjectPath, { recursive: true })
    await fs.mkdir(path.join(testProjectPath, 'src'), { recursive: true })
    await fs.mkdir(path.join(testProjectPath, 'src', 'services'), { recursive: true })
    await fs.mkdir(path.join(testProjectPath, 'src', 'models'), { recursive: true })
    await fs.mkdir(path.join(testProjectPath, 'tests'), { recursive: true })

    // Create test files
    await createTestFiles()
  })

  afterAll(async () => {
    // Cleanup
    if (testProject) {
      try {
        await deleteProject(testProject.id)
      } catch (error) {
        console.error('Failed to delete test project:', error)
      }
    }

    // Remove test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to remove test directory:', error)
    }
  })

  async function createTestFiles() {
    // Create a realistic project structure
    const files = [
      {
        path: 'src/index.ts',
        content: `import { App } from './App'
import { ConfigService } from './services/ConfigService'

const config = new ConfigService()
const app = new App(config)

app.start().then(() => {
  console.log('Application started')
}).catch(error => {
  console.error('Failed to start:', error)
  process.exit(1)
})

export { App, ConfigService }`
      },
      {
        path: 'src/App.ts',
        content: `import { ConfigService } from './services/ConfigService'
import { UserService } from './services/UserService'
import { Database } from './models/Database'

export class App {
  private config: ConfigService
  private userService: UserService
  private db: Database
  
  constructor(config: ConfigService) {
    this.config = config
    this.db = new Database(config.getDatabaseConfig())
    this.userService = new UserService(this.db)
  }
  
  async start(): Promise<void> {
    await this.db.connect()
    await this.userService.initialize()
    console.log('App initialized')
  }
  
  async stop(): Promise<void> {
    await this.db.disconnect()
  }
}`
      },
      {
        path: 'src/services/UserService.ts',
        content: `import { Database } from '../models/Database'
import { User } from '../models/User'

export class UserService {
  constructor(private db: Database) {}
  
  async initialize(): Promise<void> {
    await this.db.createTable('users')
  }
  
  async createUser(data: Partial<User>): Promise<User> {
    const user = new User(data)
    await this.db.insert('users', user)
    return user
  }
  
  async getUser(id: string): Promise<User | null> {
    const data = await this.db.findById('users', id)
    return data ? new User(data) : null
  }
  
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    await this.db.update('users', id, updates)
    const user = await this.getUser(id)
    if (!user) throw new Error('User not found')
    return user
  }
}`
      },
      {
        path: 'src/services/ConfigService.ts',
        content: `export interface DatabaseConfig {
  host: string
  port: number
  database: string
}

export class ConfigService {
  private config: Map<string, any> = new Map()
  
  constructor() {
    this.loadDefaults()
  }
  
  private loadDefaults(): void {
    this.config.set('database', {
      host: 'localhost',
      port: 5432,
      database: 'test_db'
    })
  }
  
  getDatabaseConfig(): DatabaseConfig {
    return this.config.get('database')
  }
  
  get(key: string): any {
    return this.config.get(key)
  }
  
  set(key: string, value: any): void {
    this.config.set(key, value)
  }
}`
      },
      {
        path: 'src/models/User.ts',
        content: `export interface UserData {
  id?: string
  name: string
  email: string
  createdAt?: Date
  updatedAt?: Date
}

export class User {
  id: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
  
  constructor(data: Partial<UserData>) {
    this.id = data.id || this.generateId()
    this.name = data.name || ''
    this.email = data.email || ''
    this.createdAt = data.createdAt || new Date()
    this.updatedAt = data.updatedAt || new Date()
  }
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
  
  toJSON(): UserData {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}`
      },
      {
        path: 'src/models/Database.ts',
        content: `export class Database {
  private connected: boolean = false
  private tables: Map<string, any[]> = new Map()
  
  constructor(private config: any) {}
  
  async connect(): Promise<void> {
    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 100))
    this.connected = true
  }
  
  async disconnect(): Promise<void> {
    this.connected = false
  }
  
  async createTable(name: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected')
    this.tables.set(name, [])
  }
  
  async insert(table: string, data: any): Promise<void> {
    const tableData = this.tables.get(table) || []
    tableData.push(data)
    this.tables.set(table, tableData)
  }
  
  async findById(table: string, id: string): Promise<any | null> {
    const tableData = this.tables.get(table) || []
    return tableData.find(item => item.id === id) || null
  }
  
  async update(table: string, id: string, updates: any): Promise<void> {
    const tableData = this.tables.get(table) || []
    const index = tableData.findIndex(item => item.id === id)
    if (index >= 0) {
      tableData[index] = { ...tableData[index], ...updates }
    }
  }
}`
      },
      {
        path: 'tests/UserService.test.ts',
        content: `import { describe, test, expect } from 'bun:test'
import { UserService } from '../src/services/UserService'
import { Database } from '../src/models/Database'

describe('UserService', () => {
  test('should create user', async () => {
    const db = new Database({ host: 'localhost' })
    await db.connect()
    
    const service = new UserService(db)
    await service.initialize()
    
    const user = await service.createUser({
      name: 'Test User',
      email: 'test@example.com'
    })
    
    expect(user.name).toBe('Test User')
    expect(user.email).toBe('test@example.com')
    expect(user.id).toBeDefined()
  })
})`
      },
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: 'test-e2e-project',
            version: '1.0.0',
            scripts: {
              test: 'bun test',
              start: 'bun run src/index.ts'
            },
            dependencies: {
              bun: '^1.0.0'
            }
          },
          null,
          2
        )
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
*.log
.env`
      }
    ]

    // Write all files
    for (const file of files) {
      const filePath = path.join(testProjectPath, file.path)
      await fs.writeFile(filePath, file.content)
    }
  }

  test(
    'Complete workflow: Create → Sync → Summarize → Validate',
    async () => {
      const tracker = new PerformanceTracker()
      tracker.start()

      // Step 1: Create project
      console.log('Step 1: Creating project...')
      testProject = await createProject({
        name: 'E2E Test Project',
        path: testProjectPath,
        description: 'End-to-end test for file summarization workflow'
      })
      expect(testProject).toBeDefined()
      expect(testProject.id).toBeDefined()
      console.log(`✓ Project created with ID: ${testProject.id}`)

      // Step 2: Sync project files
      console.log('Step 2: Syncing project files...')
      const syncResult = await syncProject(testProject)
      expect(syncResult.added.length).toBeGreaterThan(0)
      console.log(`✓ Synced ${syncResult.added.length} files`)

      // Step 3: Get project files
      console.log('Step 3: Retrieving project files...')
      const files = await getProjectFiles(testProject.id)
      expect(files).toBeDefined()
      expect(files!.length).toBeGreaterThan(0)

      // Filter TypeScript files for summarization
      const tsFiles = files!.filter((f) => f.extension === '.ts')
      console.log(`✓ Found ${tsFiles.length} TypeScript files`)

      // Step 4: Summarize files
      console.log('Step 4: Summarizing files...')
      const summarizeResult = await summarizeFiles(
        testProject.id,
        tsFiles.map((f) => f.id),
        false
      )

      expect(summarizeResult.included).toBeGreaterThan(0)
      console.log(`✓ Summarized ${summarizeResult.included} files`)

      // Step 5: Validate summaries
      console.log('Step 5: Validating summaries...')
      let validCount = 0
      let totalScore = 0

      for (const file of summarizeResult.updatedFiles) {
        if (file.summary) {
          const validation = validateSummary(file.summary, file)
          if (validation.valid) validCount++
          totalScore += validation.score

          if (!validation.valid) {
            console.warn(`  ⚠️  Invalid summary for ${file.name}:`)
            validation.issues.forEach((issue) => {
              console.warn(`     - ${issue.message}`)
            })
          }
        }
      }

      const avgScore = totalScore / summarizeResult.updatedFiles.length
      console.log(`✓ Validation complete: ${validCount}/${summarizeResult.updatedFiles.length} valid`)
      console.log(`  Average quality score: ${avgScore.toFixed(1)}/100`)

      // Expect at least 70% valid summaries
      expect(validCount / summarizeResult.updatedFiles.length).toBeGreaterThan(0.7)

      // Step 6: Generate project summary
      console.log('Step 6: Generating project summary...')
      const projectSummary = await getCompactProjectSummary(testProject.id)
      expect(projectSummary).toBeDefined()
      expect(projectSummary.length).toBeGreaterThan(100)
      console.log('✓ Project summary generated')

      tracker.end()
      const metrics = tracker.getMetrics(tsFiles.length * 500)

      console.log('\n📊 Workflow Performance Metrics:')
      console.log(`  Total time: ${(metrics.responseTime / 1000).toFixed(2)}s`)
      console.log(`  Files processed: ${tsFiles.length}`)
      console.log(`  Average per file: ${(metrics.responseTime / tsFiles.length).toFixed(0)}ms`)
      console.log(`  Valid summaries: ${validCount}/${tsFiles.length}`)
      console.log(`  Quality score: ${avgScore.toFixed(1)}/100`)

      // Performance assertions
      expect(metrics.responseTime).toBeLessThan(LOCAL_MODEL_TEST_CONFIG.timeouts.projectSummary)
    },
    LOCAL_MODEL_TEST_CONFIG.timeouts.projectSummary
  )

  test(
    'Incremental updates workflow',
    async () => {
      if (!testProject) {
        console.log('Skipping incremental test (no project)')
        return
      }

      // Add a new file
      const newFilePath = path.join(testProjectPath, 'src', 'services', 'NewService.ts')
      await fs.writeFile(
        newFilePath,
        `export class NewService {
  constructor() {}
  
  process(): string {
    return 'New service processing'
  }
}`
      )

      // Sync again
      const syncResult = await syncProject(testProject)
      expect(syncResult.added).toContain('src/services/NewService.ts')

      // Get the new file
      const files = await getProjectFiles(testProject.id)
      const newFile = files?.find((f) => f.name === 'NewService.ts')
      expect(newFile).toBeDefined()

      if (newFile) {
        // Summarize just the new file
        const result = await summarizeFiles(testProject.id, [newFile.id], false)
        expect(result.included).toBe(1)

        // Validate the summary
        if (result.updatedFiles[0]?.summary) {
          const validation = validateSummary(result.updatedFiles[0].summary, newFile)
          expect(validation.valid).toBe(true)
        }
      }
    },
    LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile * 2
  )

  test(
    'Cache effectiveness in workflow',
    async () => {
      if (!testProject) {
        console.log('Skipping cache test (no project)')
        return
      }

      const files = await getProjectFiles(testProject.id)
      const testFiles = files?.slice(0, 3) || []

      if (testFiles.length === 0) {
        console.log('No files to test cache')
        return
      }

      const tracker1 = new PerformanceTracker()
      const tracker2 = new PerformanceTracker()

      // First summarization (cold cache)
      tracker1.start()
      const result1 = await summarizeFiles(
        testProject.id,
        testFiles.map((f) => f.id),
        true // Force to ensure fresh summaries
      )
      tracker1.end()

      // Second summarization (warm cache)
      tracker2.start()
      const result2 = await summarizeFiles(
        testProject.id,
        testFiles.map((f) => f.id),
        false // Don't force, should use cache
      )
      tracker2.end()

      const metrics1 = tracker1.getMetrics(testFiles.length * 500)
      const metrics2 = tracker2.getMetrics(testFiles.length * 500, true)

      console.log('Cache Performance:')
      console.log(`  Cold cache: ${metrics1.responseTime}ms`)
      console.log(`  Warm cache: ${metrics2.responseTime}ms`)
      console.log(`  Speedup: ${(metrics1.responseTime / metrics2.responseTime).toFixed(2)}x`)

      // Second run should be much faster due to caching
      if (lmstudioAvailable) {
        expect(metrics2.responseTime).toBeLessThan(metrics1.responseTime * 0.5)
      }
    },
    LOCAL_MODEL_TEST_CONFIG.timeouts.batchFiles * 2
  )
})

// Export for use in other tests
export { LOCAL_MODEL_TEST_CONFIG }
