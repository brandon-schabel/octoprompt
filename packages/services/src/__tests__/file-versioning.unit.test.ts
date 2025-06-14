import { describe, test, expect, beforeEach, afterEach, mock, beforeAll, afterAll } from 'bun:test'
import { createProject, updateFileContent, bulkUpdateProjectFilesForSync, getProjectFiles } from '../project-service'
import { projectStorage } from '@octoprompt/storage'
import type { Project, ProjectFile, CreateProjectBody } from '@octoprompt/schemas'

// Store original module
let originalModule: any

beforeAll(() => {
  // Store the original module before mocking
  originalModule = require.cache[require.resolve('@octoprompt/storage')]
})

afterAll(() => {
  // Restore the original module after all tests
  if (originalModule) {
    require.cache[require.resolve('@octoprompt/storage')] = originalModule
  }
})

// Mock storage
mock.module('@octoprompt/storage', () => ({
  projectStorage: {
    generateId: mock(() => Date.now()),
    readProjects: mock(async () => ({})),
    writeProjects: mock(async () => {}),
    readProjectFiles: mock(async () => ({})),
    writeProjectFiles: mock(async () => {}),
    readProjectFile: mock(async () => undefined),
    updateProjectFile: mock(async () => ({})),
    createFileVersion: mock(async () => ({}))
  }
}))

describe('File Versioning with Sync Tracking', () => {
  let mockProjectsDb: Record<string, Project> = {}
  let mockFilesDb: Record<number, Record<number, ProjectFile>> = {}
  let currentTime = 1000000000000
  let originalDateNow: () => number

  beforeEach(() => {
    mockProjectsDb = {}
    mockFilesDb = {}
    currentTime = 1000000000000

    // Mock Date.now() to return predictable timestamps
    originalDateNow = Date.now
    Date.now = () => currentTime

    // Mock generateId to return incremental IDs
    let idCounter = 1
    ;(projectStorage.generateId as any).mockImplementation(() => {
      return currentTime + idCounter++
    })

    // Mock readProjects
    ;(projectStorage.readProjects as any).mockImplementation(async () => {
      return mockProjectsDb
    })

    // Mock writeProjects
    ;(projectStorage.writeProjects as any).mockImplementation(async (projects: Record<string, Project>) => {
      mockProjectsDb = { ...projects }
      return projects
    })

    // Mock readProjectFiles
    ;(projectStorage.readProjectFiles as any).mockImplementation(async (projectId: number) => {
      return mockFilesDb[projectId] || {}
    })

    // Mock writeProjectFiles
    ;(projectStorage.writeProjectFiles as any).mockImplementation(
      async (projectId: number, files: Record<number, ProjectFile>) => {
        mockFilesDb[projectId] = { ...files }
        return files
      }
    )

    // Mock readProjectFile
    ;(projectStorage.readProjectFile as any).mockImplementation(async (projectId: number, fileId: number) => {
      return mockFilesDb[projectId]?.[fileId]
    })

    // Mock updateProjectFile
    ;(projectStorage.updateProjectFile as any).mockImplementation(
      async (projectId: number, fileId: number, updates: Partial<ProjectFile>) => {
        const currentFile = mockFilesDb[projectId]?.[fileId]
        if (!currentFile) throw new Error(`File ${fileId} not found`)

        const updatedFile = { ...currentFile, ...updates, updated: currentTime }
        mockFilesDb[projectId][fileId] = updatedFile
        return updatedFile
      }
    )

    // Mock createFileVersion
    ;(projectStorage.createFileVersion as any).mockImplementation(
      async (projectId: number, fileId: number, content: string) => {
        const currentFile = mockFilesDb[projectId]?.[fileId]
        if (!currentFile) throw new Error(`File ${fileId} not found`)

        const newVersionId = projectStorage.generateId()
        const newVersion: ProjectFile = {
          ...currentFile,
          id: newVersionId,
          content,
          version: currentFile.version + 1,
          prevId: fileId,
          nextId: null,
          isLatest: true,
          updated: currentTime,
          originalFileId: currentFile.originalFileId || currentFile.id,
          // Preserve sync fields
          lastSyncedAt: currentFile.lastSyncedAt,
          syncVersion: currentFile.syncVersion
        }

        // Update current file to not be latest
        mockFilesDb[projectId][fileId] = {
          ...currentFile,
          isLatest: false,
          nextId: newVersionId,
          updated: currentTime
        }

        mockFilesDb[projectId][newVersionId] = newVersion
        return newVersion
      }
    )
  })

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow
  })

  test('bulkUpdateProjectFilesForSync should increment syncVersion and set lastSyncedAt', async () => {
    // Create a project
    const projectData: CreateProjectBody = {
      name: 'Test Project',
      path: '/test/project',
      description: 'Test project for versioning'
    }
    const project = await createProject(projectData)

    // Create a file
    const fileId = projectStorage.generateId()
    const initialFile: ProjectFile = {
      id: fileId,
      projectId: project.id,
      name: 'test.ts',
      path: 'src/test.ts',
      extension: '.ts',
      size: 100,
      content: 'console.log("initial")',
      summary: null,
      summaryLastUpdated: null,
      meta: '{}',
      checksum: 'abc123',
      created: currentTime,
      updated: currentTime,
      version: 1,
      prevId: null,
      nextId: null,
      isLatest: true,
      originalFileId: null,
      lastSyncedAt: currentTime,
      syncVersion: 1
    }
    mockFilesDb[project.id] = { [fileId]: initialFile }

    // Advance time
    currentTime += 1000

    // Perform sync update
    const updates = [
      {
        fileId,
        data: {
          name: 'test.ts',
          path: 'src/test.ts',
          extension: '.ts',
          content: 'console.log("synced")',
          size: 120,
          checksum: 'def456'
        }
      }
    ]

    await bulkUpdateProjectFilesForSync(project.id, updates)

    // Verify the file was updated correctly
    const updatedFile = mockFilesDb[project.id][fileId]
    expect(updatedFile.content).toBe('console.log("synced")')
    expect(updatedFile.syncVersion).toBe(2) // Should increment
    expect(updatedFile.lastSyncedAt).toBe(currentTime) // Should be current time
    expect(updatedFile.version).toBe(1) // Version should NOT change
    expect(updatedFile.isLatest).toBe(true) // Should still be latest
    expect(updatedFile.id).toBe(fileId) // ID should NOT change
  })

  test('updateFileContent should create new version but preserve sync fields', async () => {
    // Create a project
    const projectData: CreateProjectBody = {
      name: 'Test Project',
      path: '/test/project',
      description: 'Test project for versioning'
    }
    const project = await createProject(projectData)

    // Create a file that has been synced
    const fileId = projectStorage.generateId()
    const syncTime = currentTime - 5000
    const initialFile: ProjectFile = {
      id: fileId,
      projectId: project.id,
      name: 'test.ts',
      path: 'src/test.ts',
      extension: '.ts',
      size: 100,
      content: 'console.log("initial")',
      summary: null,
      summaryLastUpdated: null,
      meta: '{}',
      checksum: 'abc123',
      created: currentTime,
      updated: currentTime,
      version: 1,
      prevId: null,
      nextId: null,
      isLatest: true,
      originalFileId: null,
      lastSyncedAt: syncTime,
      syncVersion: 3
    }
    mockFilesDb[project.id] = { [fileId]: initialFile }

    // Advance time
    currentTime += 1000

    // Update content (user edit)
    const newVersion = await updateFileContent(project.id, fileId, 'console.log("user edit")')

    // Verify versioning worked correctly
    expect(newVersion.version).toBe(2)
    expect(newVersion.prevId).toBe(fileId)
    expect(newVersion.isLatest).toBe(true)
    expect(newVersion.content).toBe('console.log("user edit")')

    // Verify sync fields were preserved
    expect(newVersion.lastSyncedAt).toBe(syncTime)
    expect(newVersion.syncVersion).toBe(3)

    // Verify old version is not latest
    const oldVersion = mockFilesDb[project.id][fileId]
    expect(oldVersion.isLatest).toBe(false)
    expect(oldVersion.nextId).toBe(newVersion.id)
  })

  test('getProjectFiles should only return latest versions', async () => {
    // Create a project
    const projectData: CreateProjectBody = {
      name: 'Test Project',
      path: '/test/project',
      description: 'Test project for versioning'
    }
    const project = await createProject(projectData)

    // Create multiple versions of a file
    const fileId1 = projectStorage.generateId()
    const fileId2 = projectStorage.generateId()
    const fileId3 = projectStorage.generateId()

    mockFilesDb[project.id] = {
      [fileId1]: {
        id: fileId1,
        projectId: project.id,
        name: 'test.ts',
        path: 'src/test.ts',
        extension: '.ts',
        size: 100,
        content: 'v1',
        summary: null,
        summaryLastUpdated: null,
        meta: '{}',
        checksum: 'v1',
        created: currentTime,
        updated: currentTime,
        version: 1,
        prevId: null,
        nextId: fileId2,
        isLatest: false,
        originalFileId: null,
        lastSyncedAt: null,
        syncVersion: 0
      },
      [fileId2]: {
        id: fileId2,
        projectId: project.id,
        name: 'test.ts',
        path: 'src/test.ts',
        extension: '.ts',
        size: 100,
        content: 'v2',
        summary: null,
        summaryLastUpdated: null,
        meta: '{}',
        checksum: 'v2',
        created: currentTime + 1000,
        updated: currentTime + 1000,
        version: 2,
        prevId: fileId1,
        nextId: null,
        isLatest: true,
        originalFileId: fileId1,
        lastSyncedAt: currentTime + 1000,
        syncVersion: 1
      },
      [fileId3]: {
        id: fileId3,
        projectId: project.id,
        name: 'other.ts',
        path: 'src/other.ts',
        extension: '.ts',
        size: 100,
        content: 'other',
        summary: null,
        summaryLastUpdated: null,
        meta: '{}',
        checksum: 'other',
        created: currentTime,
        updated: currentTime,
        version: 1,
        prevId: null,
        nextId: null,
        isLatest: true,
        originalFileId: null,
        lastSyncedAt: currentTime + 2000,
        syncVersion: 2
      }
    }

    const files = await getProjectFiles(project.id)

    // Should only return latest versions
    expect(files?.length).toBe(2)
    expect(files?.find((f) => f.id === fileId1)).toBeUndefined() // v1 not included
    expect(files?.find((f) => f.id === fileId2)).toBeDefined() // v2 included
    expect(files?.find((f) => f.id === fileId3)).toBeDefined() // other file included

    // Test with includeAllVersions
    const allFiles = await getProjectFiles(project.id, true)
    expect(allFiles?.length).toBe(3) // All versions included
  })

  test('sync after user edit should update sync fields correctly', async () => {
    // Create a project
    const projectData: CreateProjectBody = {
      name: 'Test Project',
      path: '/test/project',
      description: 'Test project for versioning'
    }
    const project = await createProject(projectData)

    // Create initial file
    const fileId = projectStorage.generateId()
    const initialFile: ProjectFile = {
      id: fileId,
      projectId: project.id,
      name: 'test.ts',
      path: 'src/test.ts',
      extension: '.ts',
      size: 100,
      content: 'initial',
      summary: null,
      summaryLastUpdated: null,
      meta: '{}',
      checksum: 'initial',
      created: currentTime,
      updated: currentTime,
      version: 1,
      prevId: null,
      nextId: null,
      isLatest: true,
      originalFileId: null,
      lastSyncedAt: currentTime,
      syncVersion: 1
    }
    mockFilesDb[project.id] = { [fileId]: initialFile }

    // User edits the file (creates new version)
    currentTime += 1000
    const userEditVersion = await updateFileContent(project.id, fileId, 'user edit')

    // Sync happens after user edit
    currentTime += 1000
    const syncUpdates = [
      {
        fileId: userEditVersion.id, // Sync the latest version
        data: {
          name: 'test.ts',
          path: 'src/test.ts',
          extension: '.ts',
          content: 'user edit', // Same content, just updating sync metadata
          size: 100,
          checksum: 'user-edit-checksum'
        }
      }
    ]

    await bulkUpdateProjectFilesForSync(project.id, syncUpdates)

    // Verify sync updated the latest version
    const syncedFile = mockFilesDb[project.id][userEditVersion.id]
    expect(syncedFile.lastSyncedAt).toBe(currentTime)
    expect(syncedFile.syncVersion).toBe(2) // Should increment from 1 to 2
    expect(syncedFile.version).toBe(2) // Version should remain 2
    expect(syncedFile.isLatest).toBe(true)
  })
})
