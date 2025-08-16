import { serve } from 'bun'
import type { Server } from 'bun'
import { app } from '@promptliano/server/src/app'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { DatabaseManager } from '@promptliano/storage'
import { runMigrations } from '@promptliano/storage/src/migrations/run-migrations'

export interface TestServerConfig {
  port?: number
  databasePath?: string
  enableRateLimit?: boolean
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug'
}

export interface TestServerInstance {
  server: Server
  port: number
  baseUrl: string
  databasePath: string
  cleanup: () => Promise<void>
}

/**
 * Creates an isolated test server with its own database
 */
export async function createTestServer(config: TestServerConfig = {}): Promise<TestServerInstance> {
  // Create temporary database for this test server
  const tempDir = mkdtempSync(join(tmpdir(), 'promptliano-test-'))
  const databasePath = config.databasePath || join(tempDir, 'test.db')
  
  // Reset database instance for test isolation
  DatabaseManager.resetInstance()
  
  // Wait for migrations to complete synchronously
  await runMigrations()
  
  // Set test environment variables
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PROMPTLIANO_DB_PATH: process.env.PROMPTLIANO_DB_PATH,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    LOG_LEVEL: process.env.LOG_LEVEL
  }
  
  process.env.NODE_ENV = 'test'
  process.env.PROMPTLIANO_DB_PATH = databasePath
  process.env.RATE_LIMIT_ENABLED = config.enableRateLimit ? 'true' : 'false'
  process.env.LOG_LEVEL = config.logLevel || 'silent'
  
  // Start server on available port (0 = OS assigns)
  const port = config.port || 0
  const server = serve({
    port,
    fetch: app.fetch.bind(app),
    // Disable logs during testing unless specifically requested
    development: false
  })
  
  const actualPort = server.port
  const baseUrl = `http://localhost:${actualPort}`
  
  // Wait for server to be ready
  await waitForServer(baseUrl)
  
  const cleanup = async () => {
    // Stop the server
    server.stop(true)
    
    // Restore environment variables
    Object.assign(process.env, originalEnv)
    
    // Clean up temporary database and directory
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to clean up test directory:', tempDir, error)
    }
  }
  
  return {
    server,
    port: actualPort,
    baseUrl,
    databasePath,
    cleanup
  }
}

/**
 * Waits for the server to be ready by checking the health endpoint
 */
async function waitForServer(baseUrl: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) {
        return
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  throw new Error(`Test server failed to start within ${timeoutMs}ms`)
}

/**
 * Resets the test database to a clean state
 */
export async function resetTestDatabase(databasePath: string): Promise<void> {
  try {
    // Reset database instance to clear cached state
    DatabaseManager.resetInstance()
    // Re-run migrations to ensure tables exist
    await runMigrations()
  } catch (error) {
    throw new Error(`Failed to reset test database: ${error}`)
  }
}

/**
 * Utility function for creating isolated test environments
 */
export async function withTestServer<T>(
  testFn: (instance: TestServerInstance) => Promise<T>,
  config?: TestServerConfig
): Promise<T> {
  const testServer = await createTestServer(config)
  
  try {
    return await testFn(testServer)
  } finally {
    await testServer.cleanup()
  }
}

/**
 * Creates a test server factory for use in test suites
 */
export function createTestServerFactory() {
  const activeServers: TestServerInstance[] = []
  
  const createServer = async (config?: TestServerConfig): Promise<TestServerInstance> => {
    const instance = await createTestServer(config)
    activeServers.push(instance)
    return instance
  }
  
  const cleanupAll = async (): Promise<void> => {
    await Promise.all(activeServers.map(instance => instance.cleanup()))
    activeServers.length = 0
  }
  
  return {
    createServer,
    cleanupAll,
    getActiveServers: () => [...activeServers]
  }
}