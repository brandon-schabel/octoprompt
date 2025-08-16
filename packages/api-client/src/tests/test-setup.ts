#!/usr/bin/env bun

import { existsSync, unlinkSync } from 'fs'
import { TEST_DB_PATH, TEST_ENCRYPTION_KEY } from './test-config'

/**
 * Initialize test environment with clean database
 */
export async function initializeTestEnvironment(): Promise<void> {
  console.log('🧪 Initializing test environment...')
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.TEST_DB_PATH = TEST_DB_PATH
  process.env.PROMPTLIANO_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  
  // Remove existing test database if it exists
  if (existsSync(TEST_DB_PATH)) {
    console.log(`   Removing existing test database: ${TEST_DB_PATH}`)
    unlinkSync(TEST_DB_PATH)
  }
  
  // Remove associated SQLite files
  const associatedFiles = [`${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]
  for (const file of associatedFiles) {
    if (existsSync(file)) {
      console.log(`   Removing: ${file}`)
      unlinkSync(file)
    }
  }
  
  console.log('✅ Test environment initialized')
}

/**
 * Clean up test environment
 */
export async function cleanupTestEnvironment(): Promise<void> {
  console.log('🧹 Cleaning up test environment...')
  
  // Remove test database and associated files
  const filesToRemove = [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]
  
  for (const file of filesToRemove) {
    if (existsSync(file)) {
      try {
        unlinkSync(file)
        console.log(`   Removed: ${file}`)
      } catch (error) {
        console.warn(`   Failed to remove ${file}:`, error)
      }
    }
  }
  
  console.log('✅ Test environment cleaned up')
}

/**
 * Wait for server to be ready
 */
export async function waitForServer(url: string, maxAttempts = 10): Promise<boolean> {
  console.log(`⏳ Waiting for server at ${url}...`)
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          console.log(`✅ Server is ready (attempt ${attempt}/${maxAttempts})`)
          return true
        }
      }
    } catch (error) {
      // Server not ready yet
    }
    
    if (attempt < maxAttempts) {
      console.log(`   Server not ready, waiting... (attempt ${attempt}/${maxAttempts})`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log(`❌ Server not ready after ${maxAttempts} attempts`)
  return false
}

/**
 * Initialize test database with fresh schema
 */
export async function initializeTestDatabase(): Promise<void> {
  console.log('🗄️  Initializing test database...')
  
  // The database will be created automatically when the server starts with TEST_DB_PATH
  // The migrations will run automatically on first connection
  
  console.log('✅ Test database initialization prepared')
}

// Export a function to run all setup steps
export async function setupTestSuite(): Promise<void> {
  await initializeTestEnvironment()
  await initializeTestDatabase()
}

// Export a function to run all cleanup steps  
export async function teardownTestSuite(): Promise<void> {
  await cleanupTestEnvironment()
}