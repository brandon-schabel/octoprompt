// packages/server/src/services/project-service.test.ts
import { describe, test, expect, beforeEach, mock } from 'bun:test'
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
import type { ProjectsStorage, ProjectFilesStorage } from '@octoprompt/storage'
import { ApiError } from '@octoprompt/shared'
import { z } from 'zod'
import { normalizeToUnixMs } from '@octoprompt/shared'

// In-memory stores for our mocks
let mockProjectsDb: ProjectsStorage = {}
let mockProjectFilesDbPerProject: Record<number, ProjectFilesStorage> = {} // ProjectId is number

// Initialize a base for mock IDs. This will be incremented.
const BASE_TIMESTAMP = 1700000000000 // Nov 2023 as base
let mockIdCounter = BASE_TIMESTAMP + 200000 // Start with a higher offset for project/file IDs

const generateTestId = () => {
  mockIdCounter += 1000 // Increment for next ID
  return mockIdCounter
}

// Define FileSyncData locally for tests if not easily importable or to ensure all fields are present
interface TestFileSyncData extends FileSyncData {
  meta: string | null
  summary: string | null
  summaryLastUpdated: number | null
}

// --- Mocking projectStorage ---
const mockProjectStorage = {
  readProjects: async () => JSON.parse(JSON.stringify(mockProjectsDb)),
  writeProjects: async (data: ProjectsStorage) => {
    mockProjectsDb = JSON.parse(JSON.stringify(data))
    return mockProjectsDb
  },
  readProjectFiles: async (projectId: number) => {
    return JSON.parse(JSON.stringify(mockProjectFilesDbPerProject[projectId] || {}))
  },
  writeProjectFiles: async (projectId: number, data: ProjectFilesStorage) => {
    mockProjectFilesDbPerProject[projectId] = JSON.parse(JSON.stringify(data))
    return mockProjectFilesDbPerProject[projectId]
  },
  deleteProjectData: async (projectId: number) => {
    delete mockProjectFilesDbPerProject[projectId]
  },
  generateId: () => generateTestId(), // Use the new test ID generator
  updateProjectFile: async (
    projectId: number,
    fileId: number,
    fileData: Partial<Omit<ProjectFile, 'updated' | 'created' | 'id' | 'projectId'>>
  ): Promise<ProjectFile> => {
    if (!mockProjectFilesDbPerProject[projectId] || !mockProjectFilesDbPerProject[projectId][fileId]) {
      throw new Error(`File ${fileId} not found in project ${projectId} for mock updateProjectFile`)
    }
    const existingFile = mockProjectFilesDbPerProject[projectId][fileId]

    const unixMs = Date.now()
    const updatedFile: ProjectFile = {
      ...existingFile,
      ...fileData,
      summaryLastUpdated: fileData.summary !== undefined ? unixMs : existingFile.summaryLastUpdated,
      updated: unixMs
    }
    mockProjectFilesDbPerProject[projectId][fileId] = updatedFile
    return JSON.parse(JSON.stringify(updatedFile))
  }
}

mock.module('@/utils/storage/project-storage', () => ({
  projectStorage: mockProjectStorage
}))

// --- Mocking gen-ai-services ---
const mockGenerateStructuredData = mock(async ({ schema }: { schema: z.ZodSchema<any> }) => {
  if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
    return { object: { summary: 'Mocked AI summary' } }
  }
  // Fallback for other schemas if needed, or throw error if unexpected
  return { object: {} }
})
mock.module('@/services/gen-ai-services', () => ({
  generateStructuredData: mockGenerateStructuredData
}))

// --- Mocking file-sync-service-unified ---
const mockSyncProject = mock(async (project: Project) => {
  // Simulate sync: maybe add a dummy file if none exist for resummarizeAllFiles test
  if (!mockProjectFilesDbPerProject[project.id] || Object.keys(mockProjectFilesDbPerProject[project.id]).length === 0) {
    const fileId = mockProjectStorage.generateId() // No argument needed
    mockProjectFilesDbPerProject[project.id] = {
      [fileId]: {
        id: fileId,
        projectId: project.id,
        name: 'synced-file.txt',
        path: 'synced-file.txt',
        extension: '.txt',
        size: 10,
        content: 'synced content',
        summary: null,
        summaryLastUpdated: null,
        meta: '{}',
        checksum: 'checksum-synced',
        created: normalizeToUnixMs(Date.now()),
        updated: normalizeToUnixMs(Date.now())
      }
    }
  }
  return {
    added: [],
    updated: [],
    removed: [],
    unchanged: [],
    log: [],
    error: null
  }
})
mock.module('@/services/file-services/file-sync-service-unified', () => ({
  syncProject: mockSyncProject
}))

// Helper to generate random strings for test data
const randomString = (length = 8) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length)

describe('Project Service (File Storage)', () => {
  beforeEach(async () => {
    mockProjectsDb = {}
    mockProjectFilesDbPerProject = {}
    mockIdCounter = BASE_TIMESTAMP + 200000 // Reset base ID for each test for isolation
    mockGenerateStructuredData.mockClear()
    mockSyncProject.mockClear()
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
      expect(mockProjectsDb[project.id]).toEqual(project)
      expect(mockProjectFilesDbPerProject[project.id]).toEqual({}) // Initializes empty files
    })

    test('getProjectById returns project if found, null if not', async () => {
      const input: CreateProjectBody = { name: 'GetMe', path: '/get/me' }
      const created = await createProject(input)

      const found = await getProjectById(created.id)
      expect(found).toEqual(created)

      const notFoundId = generateTestId()
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
      expect(mockProjectsDb[created.id]).toEqual(updated)
    })

    test('updateProject returns null if project does not exist', async () => {
      const nonExistentId = generateTestId()
      await expect(updateProject(nonExistentId, { name: 'X' })).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentId}.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('deleteProject returns true if deleted, throws if nonexistent, and removes files data', async () => {
      const project = await createProject({ name: 'DelMe', path: '/del/me' })
      const fileIdForDeleteTest = generateTestId()
      mockProjectFilesDbPerProject[project.id] = {
        // Simulate some files
        [fileIdForDeleteTest]: {
          id: fileIdForDeleteTest,
          projectId: project.id,
          name: 'f.txt',
          path: 'f.txt',
          content: '',
          extension: '.txt',
          size: 0,
          created: normalizeToUnixMs(Date.now() - 100),
          updated: normalizeToUnixMs(Date.now() - 50),
          summary: null,
          summaryLastUpdated: null,
          meta: '{}',
          checksum: null
        }
      }

      expect(mockProjectsDb[project.id]).toBeDefined()
      expect(mockProjectFilesDbPerProject[project.id]).toBeDefined()

      const success = await deleteProject(project.id)
      expect(success).toBe(true)
      expect(mockProjectsDb[project.id]).toBeUndefined()
      expect(mockProjectFilesDbPerProject[project.id]).toBeUndefined()

      const fakeProjectIdForDelete = generateTestId()
      await expect(deleteProject(fakeProjectIdForDelete)).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${fakeProjectIdForDelete} for deletion.`, 'PROJECT_NOT_FOUND')
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
      expect(fileRecord.path).toBe(filePath) // Assuming relative path from project root
      expect(fileRecord.content).toBe(content)
      expect(fileRecord.size).toBe(Buffer.byteLength(content, 'utf8'))
      expect(mockProjectFilesDbPerProject[projectId][fileRecord.id]).toEqual(fileRecord)
    })

    test('createProjectFileRecord throws if project not found', async () => {
      const nonExistentProjectId = generateTestId()
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

      const noFilesForThis = await getProjectFiles(generateTestId() /* non-existent project ID */)
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
      expect(mockProjectFilesDbPerProject[projectId][file.id].content).toBe(newContent)
    })

    test('updateFileContent throws if file not found', async () => {
      const nonExistentFileId = generateTestId()
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
      const nonExistentFileIdForGet = generateTestId()
      // Ensure IDs passed to getProjectFilesByIds are numbers from the *actual created records*
      const fetched = await getProjectFilesByIds(projectId, [
        file1_created.id,
        file2_created.id,
        nonExistentFileIdForGet
      ])
      expect(fetched.length).toBe(2)
      expect(fetched).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: file1_created.id }),
          expect.objectContaining({ id: file2_created.id })
        ])
      )
    })

    test('getProjectFilesByIds throws if project not found', async () => {
      const nonExistentProjectIdForGetFiles = generateTestId()
      await expect(getProjectFilesByIds(nonExistentProjectIdForGetFiles, [generateTestId()])).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentProjectIdForGetFiles}.`, 'PROJECT_NOT_FOUND')
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
      const filesInDb = Object.values(mockProjectFilesDbPerProject[projectId])
      expect(filesInDb.length).toBe(2) // Check actual number in DB
      // Check that files with these paths exist, rather than relying on specific IDs from 'created' array if order is not guaranteed
      expect(filesInDb.find((f) => f.path === 'bulk1.js')).toBeDefined()
      expect(filesInDb.find((f) => f.path === 'sub/bulk2.ts')).toBeDefined()
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

      const filesInDb = Object.values(mockProjectFilesDbPerProject[projectId])
      expect(filesInDb.length).toBe(2)
      const originalDup = filesInDb.find((f) => f.path === 'duplicate.txt')
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
      // Use the *actual created IDs* for assertions
      expect(mockProjectFilesDbPerProject[projectId][f1_created.id].content).toBe('new1')
      expect(mockProjectFilesDbPerProject[projectId][f2_created.id].checksum).toBe('cs_new2')
    })

    test('bulkDeleteProjectFiles deletes multiple files', async () => {
      const f1_created = await createProjectFileRecord(projectId, 'del1.txt', 'c1')
      const f2_created = await createProjectFileRecord(projectId, 'del2.txt', 'c2')
      const f3_created = await createProjectFileRecord(projectId, 'del3.txt', 'c3')
      const nonExistentFileIdForBulkDelete = generateTestId()

      // Use the *actual created IDs* for deletion
      const { deletedCount } = await bulkDeleteProjectFiles(projectId, [
        f1_created.id,
        f2_created.id,
        nonExistentFileIdForBulkDelete
      ])
      expect(deletedCount).toBe(2)
      expect(mockProjectFilesDbPerProject[projectId][f1_created.id]).toBeUndefined()
      expect(mockProjectFilesDbPerProject[projectId][f2_created.id]).toBeUndefined()
      expect(mockProjectFilesDbPerProject[projectId][f3_created.id]).toBeDefined()
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
      expect(mockProjectFilesDbPerProject[projectId][file1.id].summary).toBe('Mocked AI summary')
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1)
    })

    test('summarizeSingleFile returns null for empty file content', async () => {
      const emptyFile = await createProjectFileRecord(projectId, 'empty.txt', '')
      const summarized = await summarizeSingleFile(emptyFile)
      expect(summarized).toBeNull()
      expect(mockProjectFilesDbPerProject[projectId][emptyFile.id].summary).toBeNull()
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
      // Use the *actual created IDs* for assertions
      expect(mockProjectFilesDbPerProject[projectId][file1_created.id].summary).toBe('Mocked AI summary')
      expect(mockProjectFilesDbPerProject[projectId][file2_created.id].summary).toBe('Mocked AI summary')
      expect(mockProjectFilesDbPerProject[projectId][emptyFile_created.id].summary).toBeNull()
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(2)
    })

    test('removeSummariesFromFiles clears summaries', async () => {
      const file1_created = await createProjectFileRecord(
        projectId,
        'summarize-me.js',
        'function hello() { console.log("world"); }'
      )
      await summarizeSingleFile(file1_created) // Use the created file object
      expect(mockProjectFilesDbPerProject[projectId][file1_created.id].summary).toBe('Mocked AI summary')
      expect(mockProjectFilesDbPerProject[projectId][file1_created.id].summaryLastUpdated).toBeDefined()

      const fileWithNoSummary_created = await createProjectFileRecord(projectId, 'no-summary.txt', 'content')
      const nonExistentFileId = generateTestId()

      // Use *actual created IDs*
      const { removedCount, message } = await removeSummariesFromFiles(projectId, [
        file1_created.id,
        fileWithNoSummary_created.id,
        nonExistentFileId
      ])
      expect(removedCount).toBe(1)
      expect(message).toBe('Removed summaries from 1 files.')
      expect(mockProjectFilesDbPerProject[projectId][file1_created.id].summary).toBeNull()
      expect(mockProjectFilesDbPerProject[projectId][file1_created.id].summaryLastUpdated).toBeNull()
      expect(mockProjectFilesDbPerProject[projectId][fileWithNoSummary_created.id].summary).toBeNull()
    })

    test('resummarizeAllFiles calls sync and then summarizeFiles', async () => {
      // mockSyncProject ensures a file ('synced-file.txt') is "added" if none exist
      // We'll create an empty project for this test to ensure syncProject adds one.
      const newProj = await createProject({ name: 'ResummarizeTest', path: '/resummarize' })
      mockProjectFilesDbPerProject[newProj.id] = {} // Ensure it's empty initially

      await resummarizeAllFiles(newProj.id)

      expect(mockSyncProject).toHaveBeenCalledWith(expect.objectContaining({ id: newProj.id }))
      // Check if summarizeSingleFile (via summarizeFiles) was called for the synced file
      // This depends on the mockSyncProject behavior. Our mock adds 'synced-file.txt'
      const syncedFileInDb = Object.values(mockProjectFilesDbPerProject[newProj.id] || {}).find(
        (f) => f.name === 'synced-file.txt'
      )
      expect(syncedFileInDb).toBeDefined()
      expect(syncedFileInDb?.summary).toBe('Mocked AI summary') // It should have been summarized
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1) // For the one synced file
    })

    test('resummarizeAllFiles handles project not found', async () => {
      const nonExistentProjectIdForResummarize = generateTestId()
      await expect(resummarizeAllFiles(nonExistentProjectIdForResummarize)).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentProjectIdForResummarize}.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('resummarizeAllFiles does nothing if no files after sync (and no error)', async () => {
      const newProj = await createProject({ name: 'ResummarizeEmptyTest', path: '/resummarize-empty' })
      mockProjectFilesDbPerProject[newProj.id] = {} // Ensure it's empty

      // Adjust mockSyncProject to simulate it finding no files
      mockSyncProject.mockImplementationOnce(async () => {
        mockProjectFilesDbPerProject[newProj.id] = {} // Ensure still empty after sync
        return { added: [], updated: [], removed: [], unchanged: [], log: [], error: null }
      })

      await resummarizeAllFiles(newProj.id)

      expect(mockSyncProject).toHaveBeenCalledWith(expect.objectContaining({ id: newProj.id }))
      // summarizeFiles (and thus generateStructuredData) should not be called if no files.
      expect(mockGenerateStructuredData).not.toHaveBeenCalled()
      // Check console.warn was called (harder to test directly without spyOn console)
      // but we can assert no error was thrown and files remain empty and unsummarized.
      expect(mockProjectFilesDbPerProject[newProj.id]).toEqual({})
    })
  })
})
