import { describe, test, expect } from 'bun:test'
import {
  createProject,
  updateFileContent,
  bulkUpdateProjectFilesForSync,
  getProjectFiles,
  bulkCreateProjectFiles,
  deleteProject
} from '../project-service'
import type { CreateProjectBody, FileSyncData } from '@octoprompt/schemas'

describe('File Versioning Integration Tests', () => {
  let testProjectPath: string
  let projectId: number

  // Helper to create test project
  async function createTestProject() {
    // Generate unique path for each test to avoid conflicts
    testProjectPath = '/tmp/test-versioning-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    const projectData: CreateProjectBody = {
      name: 'Version Test Project',
      path: testProjectPath,
      description: 'Testing file versioning'
    }
    const project = await createProject(projectData)
    return project.id
  }

  // Clean up after each test
  async function cleanup() {
    if (projectId) {
      try {
        await deleteProject(projectId)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  test('sync updates should increment syncVersion and set lastSyncedAt', async () => {
    projectId = await createTestProject()

    // Create initial files
    const filesToCreate: FileSyncData[] = [
      {
        name: 'test.ts',
        path: 'src/test.ts',
        extension: '.ts',
        content: 'console.log("initial")',
        size: 23,
        checksum: 'initial-checksum'
      }
    ]

    const createdFiles = await bulkCreateProjectFiles(projectId, filesToCreate)
    expect(createdFiles.length).toBe(1)

    const initialFile = createdFiles[0]
    expect(initialFile.syncVersion).toBe(1) // Initial sync version
    expect(initialFile.lastSyncedAt).toBeGreaterThan(0)

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Perform sync update
    const updates = [
      {
        fileId: initialFile.id,
        data: {
          name: 'test.ts',
          path: 'src/test.ts',
          extension: '.ts',
          content: 'console.log("synced")',
          size: 22,
          checksum: 'synced-checksum'
        }
      }
    ]

    const updatedFiles = await bulkUpdateProjectFilesForSync(projectId, updates)
    expect(updatedFiles.length).toBe(1)

    const syncedFile = updatedFiles[0]
    expect(syncedFile.id).toBe(initialFile.id) // Same file ID
    expect(syncedFile.content).toBe('console.log("synced")')
    expect(syncedFile.syncVersion).toBe(2) // Incremented
    expect(syncedFile.lastSyncedAt).toBeGreaterThan(initialFile.lastSyncedAt) // Updated timestamp
    expect(syncedFile.version).toBe(1) // Version unchanged
    expect(syncedFile.isLatest).toBe(true)

    await cleanup()
  })

  test('user edits should create new versions preserving sync fields', async () => {
    projectId = await createTestProject()

    // Create initial file with sync data
    const filesToCreate: FileSyncData[] = [
      {
        name: 'test.ts',
        path: 'src/test.ts',
        extension: '.ts',
        content: 'console.log("initial")',
        size: 23,
        checksum: 'initial-checksum'
      }
    ]

    const createdFiles = await bulkCreateProjectFiles(projectId, filesToCreate)
    const initialFile = createdFiles[0]
    const initialSyncVersion = initialFile.syncVersion
    const initialSyncTime = initialFile.lastSyncedAt

    // Wait to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10))

    // User edit creates new version
    const newVersion = await updateFileContent(projectId, initialFile.id, 'console.log("user edit")')

    expect(newVersion.id).not.toBe(initialFile.id) // New ID
    expect(newVersion.version).toBe(2) // Version incremented
    expect(newVersion.prevId).toBe(initialFile.id)
    expect(newVersion.isLatest).toBe(true)
    expect(newVersion.content).toBe('console.log("user edit")')

    // Sync fields should be preserved
    expect(newVersion.syncVersion).toBe(initialSyncVersion)
    expect(newVersion.lastSyncedAt).toBe(initialSyncTime)

    // Check that only latest version is returned
    const files = await getProjectFiles(projectId)
    expect(files?.length).toBe(1)
    expect(files?.[0].id).toBe(newVersion.id)
    expect(files?.[0].version).toBe(2)

    await cleanup()
  })

  test.skip('getProjectFiles should return only latest versions sorted by recent activity', async () => {
    projectId = await createTestProject()

    // Create multiple files
    const filesToCreate: FileSyncData[] = [
      {
        name: 'old.ts',
        path: 'src/old.ts',
        extension: '.ts',
        content: 'old file',
        size: 8,
        checksum: 'old'
      },
      {
        name: 'newer.ts',
        path: 'src/newer.ts',
        extension: '.ts',
        content: 'newer file',
        size: 10,
        checksum: 'newer'
      }
    ]

    const createdFiles = await bulkCreateProjectFiles(projectId, filesToCreate)
    const oldFile = createdFiles[0]
    const newerFile = createdFiles[1]

    // Create versions of the old file
    const oldFileV2 = await updateFileContent(projectId, oldFile.id, 'old file v2')
    await new Promise((resolve) => setTimeout(resolve, 10))
    const oldFileV3 = await updateFileContent(projectId, oldFile.id, 'old file v3')

    // Get only latest versions
    const latestFiles = await getProjectFiles(projectId)
    expect(latestFiles?.length).toBe(2) // Only 2 files (latest versions)

    const latestOldFile = latestFiles?.find((f) => f.path === 'src/old.ts')
    const latestNewerFile = latestFiles?.find((f) => f.path === 'src/newer.ts')

    expect(latestOldFile?.version).toBe(3)
    expect(latestOldFile?.content).toBe('old file v3')
    expect(latestNewerFile?.version).toBe(1)

    // Get all versions
    const allVersions = await getProjectFiles(projectId, true)
    expect(allVersions?.length).toBeGreaterThan(2) // Should include all versions

    await cleanup()
  })

  test('sync after user edit should update the latest version', async () => {
    projectId = await createTestProject()

    // Create initial file
    const filesToCreate: FileSyncData[] = [
      {
        name: 'test.ts',
        path: 'src/test.ts',
        extension: '.ts',
        content: 'initial',
        size: 7,
        checksum: 'initial'
      }
    ]

    const createdFiles = await bulkCreateProjectFiles(projectId, filesToCreate)
    const initialFile = createdFiles[0]

    // User edits
    const userVersion = await updateFileContent(projectId, initialFile.id, 'user edit')

    // Sync the latest version
    const syncUpdates = [
      {
        fileId: userVersion.id,
        data: {
          name: 'test.ts',
          path: 'src/test.ts',
          extension: '.ts',
          content: 'user edit synced',
          size: 16,
          checksum: 'synced'
        }
      }
    ]

    const syncedFiles = await bulkUpdateProjectFilesForSync(projectId, syncUpdates)
    const syncedFile = syncedFiles[0]

    expect(syncedFile.id).toBe(userVersion.id) // Same ID as user version
    expect(syncedFile.content).toBe('user edit synced')
    expect(syncedFile.syncVersion).toBe(2) // Incremented from 1
    expect(syncedFile.version).toBe(2) // Version stays same
    expect(syncedFile.isLatest).toBe(true)

    await cleanup()
  })
})
