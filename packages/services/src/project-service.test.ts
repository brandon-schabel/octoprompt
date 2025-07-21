import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
  deleteProject,
  getProjectFiles,
  updateFileContent,
  resummarizeAllFiles,
  removeSummariesFromFiles,
  createProjectFileRecord,
  bulkCreateProjectFiles,
  bulkUpdateProjectFiles,
  bulkDeleteProjectFiles,
  getProjectFilesByIds,
  summarizeSingleFile,
  summarizeFiles,
  type FileSyncData
} from './project-service'
import type { Project, ProjectFile, CreateProjectBody, UpdateProjectBody } from '@octoprompt/schemas'
import { ApiError } from '@octoprompt/shared'
import { z } from 'zod'

// Set test environment to use in-memory database
process.env.NODE_ENV = 'test'

// Define FileSyncData locally for tests if not easily importable or to ensure all fields are present
interface TestFileSyncData extends FileSyncData {
  meta: string | null
  summary: string | null
  summaryLastUpdated: number | null
}

// --- Mocking gen-ai-services ---
const mockGenerateStructuredData = mock(async ({ schema }: { schema: z.ZodSchema<any> }) => {
  if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
    return { object: { summary: 'Mocked AI summary' } }
  }
  // Fallback for other schemas if needed, or throw error if unexpected
  return { object: {} }
})
mock.module('./gen-ai-services', () => ({
  generateStructuredData: mockGenerateStructuredData
}))

// --- Mocking file-sync-service-unified ---
const mockSyncProject = mock(async (project: Project) => {
  // Import project service functions inside the mock to avoid circular dependencies
  const { getProjectFiles, createProjectFileRecord } = await import('./project-service')

  // Check if project has files
  const existingFiles = await getProjectFiles(project.id)

  if (!existingFiles || existingFiles.length === 0) {
    // Add a test file if none exist
    await createProjectFileRecord(project.id, 'synced-file.txt', 'console.log("synced");')
    return {
      added: ['synced-file.txt'],
      updated: [],
      removed: [],
      unchanged: [],
      log: ['Added synced-file.txt'],
      error: null
    }
  }

  // Just return a successful sync result with no changes
  return {
    added: [],
    updated: [],
    removed: [],
    unchanged: existingFiles.map((f) => f.path),
    log: [],
    error: null
  }
})
mock.module('./file-services/file-sync-service-unified', () => ({
  syncProject: mockSyncProject
}))

// Helper to generate random strings for test data
const randomString = (length = 8) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length)

describe('Project Service (File Storage)', () => {
  beforeEach(async () => {
    // Reset the database manager before each test
    const { DatabaseManager } = await import('@octoprompt/storage')
    DatabaseManager.reset()

    // Get a fresh instance and clear all data
    const db = DatabaseManager.getInstance()
    await db.clearAllTables()

    // Reset mock call counts
    mockGenerateStructuredData.mockClear()
    mockSyncProject.mockClear()
  })

  afterEach(async () => {
    // Clean up after each test
    const { DatabaseManager } = await import('@octoprompt/storage')
    const db = DatabaseManager.getInstance()
    await db.clearAllTables()
    DatabaseManager.reset()

    // Reset mocks
    mockGenerateStructuredData.mockClear()
    mockSyncProject.mockClear()
  })

  test('database initialization works', async () => {
    // Import the Database class directly to test without singleton issues
    const { Database } = await import('bun:sqlite')
    const db = new Database(':memory:')

    // Create the projects table manually
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Test basic operations
    const now = Date.now()
    const testData = { name: 'test', path: '/test' }

    // Insert a record
    const insertQuery = db.prepare(`
      INSERT INTO projects (id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    insertQuery.run('1', JSON.stringify(testData), now, now)

    // Check if it exists
    const selectQuery = db.prepare(`SELECT data FROM projects WHERE id = ?`)
    const result = selectQuery.get('1') as { data: string } | undefined

    expect(result).toBeDefined()
    expect(JSON.parse(result!.data)).toEqual(testData)

    // Test that a different ID doesn't exist
    const result2 = selectQuery.get('2')
    expect(result2).toBeNull()

    db.close()
  })

  test('simple project creation works', async () => {
    const { createProject } = await import('./project-service')

    const projectData = {
      name: 'Test Project',
      path: '/test/path',
      description: 'A test project'
    }

    const project = await createProject(projectData)

    expect(project.id).toBeDefined()
    expect(project.name).toBe(projectData.name)
    expect(project.path).toBe(projectData.path)
    expect(project.description).toBe(projectData.description)
  })

  describe('Project CRUD', () => {
    test('createProject creates a new project', async () => {
      const input: CreateProjectBody = {
        name: `TestProject_${randomString()}`,
        path: `/path/to/${randomString()}`,
        description: 'A test project'
      }
      const project = await createProject(input)

      expect(project.id).toBeDefined()
      expect(project.name).toBe(input.name)
      expect(project.path).toBe(input.path)
      expect(project.description).toBe(input.description ?? '') // Handle potentially undefined description

      // Verify project was stored in database
      const retrieved = await getProjectById(project.id)
      expect(retrieved).toEqual(project)
    })

    test('getProjectById returns project if found, throws if not', async () => {
      const input: CreateProjectBody = { name: 'GetMe', path: '/get/me' }
      const created = await createProject(input)

      const found = await getProjectById(created.id)
      expect(found).toEqual(created)

      const notFoundId = 999999999999
      await expect(getProjectById(notFoundId)).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${notFoundId}.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('listProjects returns all projects sorted by updatedAt DESC', async () => {
      let all = await listProjects()
      expect(all.length).toBe(0)

      const p1 = await createProject({ name: 'P1', path: '/p1' })
      await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure timestamp difference
      const p2 = await createProject({ name: 'P2', path: '/p2' })

      all = await listProjects()
      expect(all.length).toBe(2)
      expect(all[0].id).toBe(p2.id) // p2 is newer
      expect(all[1].id).toBe(p1.id)
    })

    test('updateProject updates fields and returns updated project', async () => {
      const created = await createProject({ name: 'Before', path: '/old' })
      const updates: UpdateProjectBody = { name: 'After', description: 'New Desc' }
      await new Promise((resolve) => setTimeout(resolve, 1))
      const updated = await updateProject(created.id, updates)

      expect(updated).toBeDefined()
      if (!updated) throw new Error('Update failed')
      expect(updated.name).toBe('After')
      expect(updated.description).toBe('New Desc')
      expect(updated.path).toBe(created.path) // Path not changed
      expect(new Date(updated.updated).getTime()).toBeGreaterThan(new Date(created.updated).getTime())
    })

    test('updateProject throws if project does not exist', async () => {
      const nonExistentId = 999999999999
      await expect(updateProject(nonExistentId, { name: 'X' })).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentId}.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('deleteProject returns true if deleted, throws if nonexistent', async () => {
      const project = await createProject({ name: 'DelMe', path: '/del/me' })

      const success = await deleteProject(project.id)
      expect(success).toBe(true)

      // Verify project is deleted
      await expect(getProjectById(project.id)).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${project.id}.`, 'PROJECT_NOT_FOUND')
      )

      const fakeProjectId = 999999999999
      await expect(deleteProject(fakeProjectId)).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${fakeProjectId} for deletion.`, 'PROJECT_NOT_FOUND')
      )
    })
  })

  describe('Project File Operations', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await createProject({ name: 'FileTestProj', path: '/file/test' })
      projectId = proj.id
    })

    test('createProjectFileRecord creates a file record', async () => {
      const filePath = 'src/app.js'
      const content = 'console.log("hello");'
      const fileRecord = await createProjectFileRecord(projectId, filePath, content)

      expect(fileRecord.id).toBeDefined()
      expect(fileRecord.projectId).toBe(projectId)
      expect(fileRecord.name).toBe('app.js')
      expect(fileRecord.path).toBe(filePath)
      expect(fileRecord.content).toBe(content)
      expect(fileRecord.size).toBe(Buffer.byteLength(content, 'utf8'))

      // Verify file was stored in database
      const files = await getProjectFiles(projectId)
      expect(files).toContainEqual(fileRecord)
    })

    test('createProjectFileRecord throws if project not found', async () => {
      const nonExistentProjectId = 999999999999
      await expect(createProjectFileRecord(nonExistentProjectId, 'file.txt', '')).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentProjectId}.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('getProjectFiles returns files for a project, or null', async () => {
      let files = await getProjectFiles(projectId)
      expect(files).toEqual([]) // Starts empty

      const file1 = await createProjectFileRecord(projectId, 'file1.txt', 'content1')
      const file2 = await createProjectFileRecord(projectId, 'file2.txt', 'content2')

      files = await getProjectFiles(projectId)
      expect(files?.length).toBe(2)
      expect(files).toEqual(expect.arrayContaining([file1, file2]))

      const noFilesForThis = await getProjectFiles(999999999999)
      expect(noFilesForThis).toBeNull()
    })

    test('updateFileContent updates content and size', async () => {
      const file = await createProjectFileRecord(projectId, 'update-me.txt', 'old content')
      const newContent = 'new fresh content'
      await new Promise((resolve) => setTimeout(resolve, 1)) // ensure updated changes

      const updatedFile = await updateFileContent(projectId, file.id, newContent)

      expect(updatedFile.content).toBe(newContent)
      expect(updatedFile.size).toBe(Buffer.byteLength(newContent, 'utf8'))
      expect(new Date(updatedFile.updated).getTime()).toBeGreaterThan(new Date(file.updated).getTime())
    })

    test('updateFileContent throws if file not found', async () => {
      const nonExistentFileId = 999999999999
      await expect(updateFileContent(projectId, nonExistentFileId, 'new content')).rejects.toThrowError(
        new ApiError(
          404,
          `File not found with ID ${nonExistentFileId} in project ${projectId} during content update.`,
          'FILE_NOT_FOUND'
        )
      )
    })

    test('getProjectFilesByIds fetches specific files', async () => {
      const file1_created = await createProjectFileRecord(projectId, 'f1.txt', 'c1')
      const file2_created = await createProjectFileRecord(projectId, 'f2.txt', 'c2')
      await createProjectFileRecord(projectId, 'f3.txt', 'c3') // Another file not fetched
      const nonExistentFileId = 999999999999

      const fetched = await getProjectFilesByIds(projectId, [file1_created.id, file2_created.id, nonExistentFileId])
      expect(fetched.length).toBe(2)
      expect(fetched).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: file1_created.id }),
          expect.objectContaining({ id: file2_created.id })
        ])
      )
    })

    test('getProjectFilesByIds throws if project not found', async () => {
      const nonExistentProjectId = 999999999999
      await expect(getProjectFilesByIds(nonExistentProjectId, [123])).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentProjectId}.`, 'PROJECT_NOT_FOUND')
      )
    })
  })

  describe('Bulk File Operations', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await createProject({ name: 'BulkTestProj', path: '/bulk/test' })
      projectId = proj.id
    })

    test('bulkCreateProjectFiles creates multiple files', async () => {
      const filesToCreate: FileSyncData[] = [
        { path: 'bulk1.js', name: 'bulk1.js', extension: '.js', content: '// bulk 1', size: 9, checksum: 'cs1' },
        { path: 'sub/bulk2.ts', name: 'bulk2.ts', extension: '.ts', content: '// bulk 2', size: 9, checksum: 'cs2' }
      ]
      const created = await bulkCreateProjectFiles(projectId, filesToCreate)
      expect(created.length).toBe(2)

      const filesInDb = await getProjectFiles(projectId)
      expect(filesInDb?.length).toBe(2)
      expect(filesInDb?.find((f) => f.path === 'bulk1.js')).toBeDefined()
      expect(filesInDb?.find((f) => f.path === 'sub/bulk2.ts')).toBeDefined()
    })

    test('bulkCreateProjectFiles skips duplicates by path', async () => {
      // Create an initial file
      const initialFile = await bulkCreateProjectFiles(projectId, [
        {
          path: 'duplicate.txt',
          name: 'duplicate.txt',
          extension: '.txt',
          content: 'original',
          size: 8,
          checksum: 'cs_orig'
        }
      ])
      expect(initialFile.length).toBe(1)

      const filesToCreate: FileSyncData[] = [
        { path: 'new.txt', name: 'new.txt', extension: '.txt', content: 'new', size: 3, checksum: 'cs_new' },
        {
          path: 'duplicate.txt',
          name: 'duplicate.txt',
          extension: '.txt',
          content: 'attempted duplicate',
          size: 20,
          checksum: 'cs_dup'
        }
      ]
      const created = await bulkCreateProjectFiles(projectId, filesToCreate)
      expect(created.length).toBe(1)
      expect(created[0].path).toBe('new.txt')

      const filesInDb = await getProjectFiles(projectId)
      expect(filesInDb?.length).toBe(2)
      const originalDup = filesInDb?.find((f) => f.path === 'duplicate.txt')
      expect(originalDup?.content).toBe('original')
    })

    test('bulkUpdateProjectFiles updates multiple files', async () => {
      const f1_created = await createProjectFileRecord(projectId, 'up1.txt', 'old1')
      const f2_created = await createProjectFileRecord(projectId, 'up2.txt', 'old2')

      const updates: Array<{ fileId: number; data: TestFileSyncData }> = [
        {
          fileId: f1_created.id,
          data: {
            path: f1_created.path,
            name: f1_created.name,
            extension: f1_created.extension,
            content: 'new1',
            size: 4,
            checksum: 'cs_new1',
            meta: null,
            summary: null,
            summaryLastUpdated: null
          }
        },
        {
          fileId: f2_created.id,
          data: {
            path: f2_created.path,
            name: f2_created.name,
            extension: f2_created.extension,
            content: 'new2',
            size: 4,
            checksum: 'cs_new2',
            meta: null,
            summary: null,
            summaryLastUpdated: null
          }
        }
      ]

      const updatedResult = await bulkUpdateProjectFiles(projectId, updates)
      expect(updatedResult.length).toBe(2)

      const filesInDb = await getProjectFiles(projectId)
      const f1InDb = filesInDb?.find((f) => f.id === f1_created.id)
      const f2InDb = filesInDb?.find((f) => f.id === f2_created.id)
      expect(f1InDb?.content).toBe('new1')
      expect(f2InDb?.checksum).toBe('cs_new2')
    })

    test('bulkDeleteProjectFiles deletes multiple files', async () => {
      const f1_created = await createProjectFileRecord(projectId, 'del1.txt', 'c1')
      const f2_created = await createProjectFileRecord(projectId, 'del2.txt', 'c2')
      const f3_created = await createProjectFileRecord(projectId, 'del3.txt', 'c3')
      const nonExistentFileId = 999999999999

      const { deletedCount } = await bulkDeleteProjectFiles(projectId, [
        f1_created.id,
        f2_created.id,
        nonExistentFileId
      ])
      expect(deletedCount).toBe(2)

      const filesInDb = await getProjectFiles(projectId)
      expect(filesInDb?.find((f) => f.id === f1_created.id)).toBeUndefined()
      expect(filesInDb?.find((f) => f.id === f2_created.id)).toBeUndefined()
      expect(filesInDb?.find((f) => f.id === f3_created.id)).toBeDefined()
    })
  })

  describe('Summarization', () => {
    let projectId: number
    let file1: ProjectFile

    beforeEach(async () => {
      const proj = await createProject({ name: 'SummarizeProj', path: '/summarize/test' })
      projectId = proj.id
      file1 = await createProjectFileRecord(projectId, 'summarize-me.js', 'function hello() { console.log("world"); }')
      // Reset mock return for generateStructuredData for each test if specific return values are needed
      mockGenerateStructuredData.mockImplementation(async ({ schema }: { schema: z.ZodSchema<any> }) => {
        if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
          return { object: { summary: 'Mocked AI summary' } }
        }
        return { object: {} }
      })
    })

    test('summarizeSingleFile successfully summarizes a file', async () => {
      const summarized = await summarizeSingleFile(file1)
      expect(summarized).toBeDefined()
      if (!summarized) throw new Error('Summarization failed')

      expect(summarized.summary).toBe('Mocked AI summary')
      expect(summarized.summaryLastUpdated).toBeDefined()
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1)
    })

    test('summarizeSingleFile returns null for empty file content', async () => {
      const emptyFile = await createProjectFileRecord(projectId, 'empty.txt', '')
      const summarized = await summarizeSingleFile(emptyFile)
      expect(summarized).toBeNull()
      expect(mockGenerateStructuredData).not.toHaveBeenCalled()
    })

    test('summarizeSingleFile throws ApiError if AI model not configured (simulated)', async () => {
      // Simulate model not configured by making generateStructuredData throw that error
      mockGenerateStructuredData.mockRejectedValueOnce(
        new ApiError(500, `AI Model not configured...`, 'AI_MODEL_NOT_CONFIGURED')
      )
      await expect(summarizeSingleFile(file1)).rejects.toThrowError(
        new ApiError(500, `AI Model not configured...`, 'AI_MODEL_NOT_CONFIGURED')
      )
    })

    test('summarizeSingleFile throws ApiError on AI failure', async () => {
      mockGenerateStructuredData.mockRejectedValueOnce(new Error('AI provider exploded'))
      await expect(summarizeSingleFile(file1)).rejects.toThrowError(
        new ApiError(
          500,
          `Failed to summarize file ${file1.path} in project ${projectId}. Reason: AI provider exploded`,
          'FILE_SUMMARIZE_FAILED'
        )
      )
    })

    test('summarizeFiles processes multiple files', async () => {
      const file1_created = await createProjectFileRecord(
        projectId,
        'summarize-me.js',
        'function hello() { console.log("world"); }'
      )
      const file2_created = await createProjectFileRecord(projectId, 'another.js', 'let x = 10;')
      const emptyFile_created = await createProjectFileRecord(projectId, 'empty-too.txt', '')

      const result = await summarizeFiles(projectId, [file1_created.id, file2_created.id, emptyFile_created.id])
      expect(result.included).toBe(2)
      expect(result.skipped).toBe(1)
      expect(result.updatedFiles.length).toBe(2)
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(2)
    })

    test('removeSummariesFromFiles clears summaries', async () => {
      const file1_created = await createProjectFileRecord(
        projectId,
        'summarize-me.js',
        'function hello() { console.log("world"); }'
      )
      await summarizeSingleFile(file1_created) // Use the created file object
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1)

      const fileWithNoSummary_created = await createProjectFileRecord(projectId, 'no-summary.txt', 'content')
      const nonExistentFileId = 999999999999

      const { removedCount, message } = await removeSummariesFromFiles(projectId, [
        file1_created.id,
        fileWithNoSummary_created.id,
        nonExistentFileId
      ])
      expect(removedCount).toBe(1)
      expect(message).toBe('Removed summaries from 1 files.')
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1)
    })

    test('resummarizeAllFiles calls sync and then summarizeFiles', async () => {
      // mockSyncProject ensures a file ('synced-file.txt') is "added" if none exist
      // We'll create an empty project for this test to ensure syncProject adds one.
      const newProj = await createProject({ name: 'ResummarizeTest', path: '/resummarize' })
      mockGenerateStructuredData.mockImplementation(async ({ schema }: { schema: z.ZodSchema<any> }) => {
        if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
          return { object: { summary: 'Mocked AI summary' } }
        }
        return { object: {} }
      })

      await resummarizeAllFiles(newProj.id)

      expect(mockSyncProject).toHaveBeenCalledWith(expect.objectContaining({ id: newProj.id }))
      // Check if summarizeSingleFile (via summarizeFiles) was called for the synced file
      // This depends on the mockSyncProject behavior. Our mock adds 'synced-file.txt'
      const syncedFileInDb = await getProjectFiles(newProj.id)
      expect(syncedFileInDb).toBeDefined()
      expect(syncedFileInDb.length).toBe(1)
      expect(syncedFileInDb[0].summary).toBe('Mocked AI summary')
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1) // For the one synced file
    })

    test('resummarizeAllFiles handles project not found', async () => {
      const nonExistentProjectIdForResummarize = 999999999999
      await expect(resummarizeAllFiles(nonExistentProjectIdForResummarize)).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentProjectIdForResummarize}.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('resummarizeAllFiles does nothing if no files after sync (and no error)', async () => {
      const newProj = await createProject({ name: 'ResummarizeEmptyTest', path: '/resummarize-empty' })
      mockSyncProject.mockImplementationOnce(async () => {
        return { added: [], updated: [], removed: [], unchanged: [], log: [], error: null }
      })

      await resummarizeAllFiles(newProj.id)

      expect(mockSyncProject).toHaveBeenCalledWith(expect.objectContaining({ id: newProj.id }))
      // summarizeFiles (and thus generateStructuredData) should not be called if no files.
      expect(mockGenerateStructuredData).not.toHaveBeenCalled()
      // Check console.warn was called (harder to test directly without spyOn console)
      // but we can assert no error was thrown and files remain empty and unsummarized.
      const filesInDb = await getProjectFiles(newProj.id)
      expect(filesInDb).toEqual([])
    })
  })
})
