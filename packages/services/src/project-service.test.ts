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
  createProjectFileRecord,
  bulkCreateProjectFiles,
  bulkUpdateProjectFiles,
  getFileVersions,
  getFileVersion,
  revertFileToVersion,
  type FileSyncData
} from '@octoprompt/services'
import { summarizeSingleFile, summarizeFiles } from './agents/summarize-files-agent'
import type { Project, ProjectFile, CreateProjectBody, UpdateProjectBody, FileVersion } from '@octoprompt/schemas'
import type { ProjectsStorage, ProjectFilesStorage } from '@octoprompt/storage'
import { ApiError } from '@octoprompt/shared'
import { z } from 'zod'
import { normalizeToUnixMs } from '@octoprompt/shared'

// In-memory stores for our mocks
let mockProjectsDb: ProjectsStorage = {}
let mockProjectFilesDbPerProject: Record<number, ProjectFilesStorage> = {}

// Initialize a base for mock IDs
const BASE_TIMESTAMP = 1700000000000
let mockIdCounter = BASE_TIMESTAMP + 200000

const generateTestId = () => {
  mockIdCounter += 1000
  return mockIdCounter
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
  generateId: () => generateTestId(),
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
  },

  // NEW: Mock versioning methods
  createFileVersion: async (
    projectId: number,
    currentFileId: number,
    newContent: string,
    additionalData?: Partial<
      Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated' | 'version' | 'prevId' | 'nextId' | 'isLatest'>
    >
  ): Promise<ProjectFile> => {
    const files = mockProjectFilesDbPerProject[projectId] || {}
    const currentFile = files[currentFileId]

    if (!currentFile) {
      throw new Error(`File not found: ${currentFileId} in project ${projectId}`)
    }

    if (!currentFile.isLatest) {
      throw new Error(`Cannot create version from non-latest file: ${currentFileId}`)
    }

    const newVersionId = generateTestId()
    const now = Date.now()

    // Create the new version
    const newVersion: ProjectFile = {
      ...currentFile,
      ...additionalData,
      id: newVersionId,
      content: newContent,
      version: currentFile.version + 1,
      prevId: currentFileId,
      nextId: null,
      isLatest: true,
      size: Buffer.byteLength(newContent, 'utf8'),
      updated: now,
      originalFileId: currentFile.originalFileId || currentFile.id
    }

    // Update the current file to no longer be latest
    const updatedCurrentFile: ProjectFile = {
      ...currentFile,
      nextId: newVersionId,
      isLatest: false,
      updated: now
    }

    files[currentFileId] = updatedCurrentFile
    files[newVersionId] = newVersion
    mockProjectFilesDbPerProject[projectId] = files

    return JSON.parse(JSON.stringify(newVersion))
  },

  getFileVersions: async (projectId: number, originalFileId: number): Promise<ProjectFile[]> => {
    const files = mockProjectFilesDbPerProject[projectId] || {}
    const versions: ProjectFile[] = []

    // First, find the actual original file ID
    // If the requested ID has originalFileId set, use that, otherwise use the ID itself
    const fileRequested = files[originalFileId]
    const actualOriginalFileId = fileRequested?.originalFileId || originalFileId

    for (const file of Object.values(files)) {
      // A file is part of the version chain if:
      // 1. It IS the original file (originalFileId is null and id matches actualOriginalFileId)
      // 2. OR it has originalFileId that matches actualOriginalFileId
      if (
        (file.originalFileId === null && file.id === actualOriginalFileId) ||
        (file.originalFileId === actualOriginalFileId)
      ) {
        versions.push(file)
      }
    }

    return versions.sort((a, b) => a.version - b.version)
  },

  getFileVersion: async (projectId: number, originalFileId: number, version: number): Promise<ProjectFile | null> => {
    const versions = await mockProjectStorage.getFileVersions(projectId, originalFileId)
    return versions.find((v) => v.version === version) || null
  },

  getLatestFileVersion: async (projectId: number, originalFileId: number): Promise<ProjectFile | null> => {
    const files = mockProjectFilesDbPerProject[projectId] || {}

    for (const file of Object.values(files)) {
      if ((file.originalFileId === originalFileId || file.id === originalFileId) && file.isLatest) {
        return file
      }
    }

    return null
  },

  revertToVersion: async (projectId: number, currentFileId: number, targetVersion: number): Promise<ProjectFile> => {
    const files = mockProjectFilesDbPerProject[projectId] || {}
    const currentFile = files[currentFileId]

    if (!currentFile) {
      throw new Error(`File not found: ${currentFileId} in project ${projectId}`)
    }

    const originalFileId = currentFile.originalFileId || currentFile.id
    const targetVersionFile = await mockProjectStorage.getFileVersion(projectId, originalFileId, targetVersion)

    if (!targetVersionFile) {
      throw new Error(`Version ${targetVersion} not found for file`)
    }

    return mockProjectStorage.createFileVersion(projectId, currentFileId, targetVersionFile.content, {
      checksum: targetVersionFile.checksum,
      meta: targetVersionFile.meta
    })
  }
}

mock.module('@octoprompt/storage', () => ({
  projectStorage: mockProjectStorage
}))

// --- Mocking gen-ai-services ---
const mockGenerateStructuredData = mock(async ({ schema }: { schema: z.ZodSchema<any> }) => {
  if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
    return { object: { summary: 'Mocked AI summary' } }
  }
  return { object: {} }
})
mock.module('./gen-ai-services', () => ({
  generateStructuredData: mockGenerateStructuredData
}))

// --- Mocking file-sync-service-unified ---
const mockSyncProject = mock(async (project: Project) => {
  const projectFiles = mockProjectFilesDbPerProject[project.id] || {}
  if (!mockProjectFilesDbPerProject[project.id] || Object.keys(projectFiles).length === 0) {
    const fileId = mockProjectStorage.generateId()
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
        updated: normalizeToUnixMs(Date.now()),
        version: 1,
        prevId: null,
        nextId: null,
        isLatest: true,
        originalFileId: null
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
mock.module('./file-services/file-sync-service-unified', () => ({
  syncProject: mockSyncProject
}))

const randomString = (length = 8) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length)

describe('Project Service (File Storage with Versioning)', () => {
  beforeEach(async () => {
    mockProjectsDb = {}
    mockProjectFilesDbPerProject = {}
    mockIdCounter = BASE_TIMESTAMP + 200000
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
      expect(project.description).toBe(input.description ?? '')
      expect(mockProjectsDb[project.id]).toEqual(project)
      expect(mockProjectFilesDbPerProject[project.id]).toEqual({})
    })

    test('getProjectById returns project if found, throws if not', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 10))
      const p2 = await createProject({ name: 'P2', path: '/p2' })

      all = await listProjects()
      expect(all.length).toBe(2)
      expect(all[0].id).toBe(p2.id)
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
      expect(updated.path).toBe(created.path)
      expect(new Date(updated.updated).getTime()).toBeGreaterThan(new Date(created.updated).getTime())
      expect(mockProjectsDb[created.id]).toEqual(updated)
    })

    test('updateProject throws if project does not exist', async () => {
      const nonExistentId = generateTestId()
      await expect(updateProject(nonExistentId, { name: 'X' })).rejects.toThrowError(
        new ApiError(404, `Project not found with ID ${nonExistentId}.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('deleteProject returns true if deleted, throws if nonexistent, and removes files data', async () => {
      const project = await createProject({ name: 'DelMe', path: '/del/me' })
      const fileIdForDeleteTest = generateTestId()
      mockProjectFilesDbPerProject[project.id] = {
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
          checksum: null,
          // New versioning fields
          version: 1,
          prevId: null,
          nextId: null,
          isLatest: true,
          originalFileId: null
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

  describe('Project File Operations with Versioning', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await createProject({ name: 'FileTestProj', path: '/file/test' })
      projectId = proj.id
    })

    test('createProjectFileRecord creates a file record with versioning fields', async () => {
      const filePath = 'src/app.js'
      const content = 'console.log("hello");'
      const fileRecord = await createProjectFileRecord(projectId, filePath, content)

      expect(fileRecord.id).toBeDefined()
      expect(fileRecord.projectId).toBe(projectId)
      expect(fileRecord.name).toBe('app.js')
      expect(fileRecord.path).toBe(filePath)
      expect(fileRecord.content).toBe(content)
      expect(fileRecord.size).toBe(Buffer.byteLength(content, 'utf8'))
      // Check versioning fields
      expect(fileRecord.version).toBe(1)
      expect(fileRecord.prevId).toBeNull()
      expect(fileRecord.nextId).toBeNull()
      expect(fileRecord.isLatest).toBe(true)
      expect(fileRecord.originalFileId).toBeNull()
      expect(mockProjectFilesDbPerProject[projectId][fileRecord.id]).toEqual(fileRecord)
    })

    test('getProjectFiles returns only latest versions by default', async () => {
      const file1 = await createProjectFileRecord(projectId, 'file1.txt', 'content1')
      const file2 = await createProjectFileRecord(projectId, 'file2.txt', 'content2')

      // Create a new version of file1
      const file1v2 = await updateFileContent(projectId, file1.id, 'content1 updated')

      // By default, should only return latest versions
      const latestFiles = await getProjectFiles(projectId, false)
      expect(latestFiles?.length).toBe(2)

      // Should include the new version of file1, not the old one
      const foundFile1 = latestFiles?.find((f) => f.path === 'file1.txt')
      expect(foundFile1?.id).toBe(file1v2.id)
      expect(foundFile1?.version).toBe(2)
      expect(foundFile1?.content).toBe('content1 updated')

      // Should still include file2 (latest and only version)
      const foundFile2 = latestFiles?.find((f) => f.path === 'file2.txt')
      expect(foundFile2?.id).toBe(file2.id)
      expect(foundFile2?.version).toBe(1)
    })

    test('getProjectFiles can return all versions when requested', async () => {
      const file1 = await createProjectFileRecord(projectId, 'file1.txt', 'content1')
      await updateFileContent(projectId, file1.id, 'content1 updated')

      // Request all versions
      const allFiles = await getProjectFiles(projectId, true)
      expect(allFiles?.length).toBe(2) // Original + new version

      const sortedFiles = allFiles?.sort((a, b) => a.version - b.version)
      expect(sortedFiles?.[0].version).toBe(1)
      expect(sortedFiles?.[0].content).toBe('content1')
      expect(sortedFiles?.[0].isLatest).toBe(false)

      expect(sortedFiles?.[1].version).toBe(2)
      expect(sortedFiles?.[1].content).toBe('content1 updated')
      expect(sortedFiles?.[1].isLatest).toBe(true)
    })

    test('updateFileContent creates new version instead of updating existing', async () => {
      const file = await createProjectFileRecord(projectId, 'update-me.txt', 'old content')
      const newContent = 'new fresh content'
      await new Promise((resolve) => setTimeout(resolve, 1))

      const newVersion = await updateFileContent(projectId, file.id, newContent)

      // Should be a new file with incremented version
      expect(newVersion.id).not.toBe(file.id)
      expect(newVersion.version).toBe(2)
      expect(newVersion.content).toBe(newContent)
      expect(newVersion.size).toBe(Buffer.byteLength(newContent, 'utf8'))
      expect(newVersion.prevId).toBe(file.id)
      expect(newVersion.isLatest).toBe(true)
      expect(newVersion.originalFileId).toBe(file.id)

      // Original file should be updated to point to new version and not be latest
      const originalFile = mockProjectFilesDbPerProject[projectId][file.id]
      expect(originalFile.nextId).toBe(newVersion.id)
      expect(originalFile.isLatest).toBe(false)
      expect(originalFile.content).toBe('old content') // Content unchanged
    })

    test('getFileVersions returns all versions of a file', async () => {
      const file = await createProjectFileRecord(projectId, 'versioned-file.txt', 'v1 content')
      const file_v2 = await updateFileContent(projectId, file.id, 'v2 content')
      const file_v3 = await updateFileContent(projectId, file_v2.id, 'v3 content')

      const versions = await getFileVersions(projectId, file.id)

      expect(versions.length).toBe(3)
      expect(versions[0].fileId).toBe(file.id)
      expect(versions[0].version).toBe(1)
      expect(versions[0].isLatest).toBe(false)

      expect(versions[1].fileId).toBe(file_v2.id)
      expect(versions[1].version).toBe(2)
      expect(versions[1].isLatest).toBe(false)

      expect(versions[2].fileId).toBe(file_v3.id)
      expect(versions[2].version).toBe(3)
      expect(versions[2].isLatest).toBe(true)
    })

    test('getFileVersion retrieves specific version or latest', async () => {
      const file = await createProjectFileRecord(projectId, 'versioned-file.txt', 'v1 content')
      const file_v2 = await updateFileContent(projectId, file.id, 'v2 content')

      // Get specific version
      const v1 = await getFileVersion(projectId, file.id, 1)
      expect(v1?.id).toBe(file.id)
      expect(v1?.version).toBe(1)
      expect(v1?.content).toBe('v1 content')

      // Get latest version (no version specified)
      const latest = await getFileVersion(projectId, file.id)
      expect(latest?.id).toBe(file_v2.id)
      expect(latest?.version).toBe(2)
      expect(latest?.content).toBe('v2 content')
    })

    test('revertFileToVersion creates new version with old content', async () => {
      const file = await createProjectFileRecord(projectId, 'revert-test.txt', 'original content')
      const file_v2 = await updateFileContent(projectId, file.id, 'modified content')
      const file_v3 = await updateFileContent(projectId, file_v2.id, 'further modified')

      // Revert to version 1
      const reverted = await revertFileToVersion(projectId, file_v3.id, 1)

      expect(reverted.version).toBe(4) // New version created
      expect(reverted.content).toBe('original content') // Content from v1
      expect(reverted.prevId).toBe(file_v3.id)
      expect(reverted.isLatest).toBe(true)

      // Check that v3 is no longer latest
      const oldV3 = mockProjectFilesDbPerProject[projectId][file_v3.id]
      expect(oldV3.isLatest).toBe(false)
      expect(oldV3.nextId).toBe(reverted.id)
    })

    test('updateFileContent throws if file not found', async () => {
      const nonExistentFileId = generateTestId()
      await expect(updateFileContent(projectId, nonExistentFileId, 'new content')).rejects.toThrowError(
        `Failed to update file content for ${nonExistentFileId}. Reason: File not found: ${nonExistentFileId} in project ${projectId}`
      )
    })

    test('getFileVersions works with originalFileId tracking', async () => {
      const file = await createProjectFileRecord(projectId, 'track-test.txt', 'v1')
      const file_v2 = await updateFileContent(projectId, file.id, 'v2')
      const file_v3 = await updateFileContent(projectId, file_v2.id, 'v3')

      // All versions should be found when searching by any file ID in the chain
      const versionsFromOriginal = await getFileVersions(projectId, file.id)
      const versionsFromV2 = await getFileVersions(projectId, file_v2.id)
      const versionsFromV3 = await getFileVersions(projectId, file_v3.id)

      expect(versionsFromOriginal.length).toBe(3)
      expect(versionsFromV2.length).toBe(3)
      expect(versionsFromV3.length).toBe(3)

      // All should return the same versions
      expect(versionsFromOriginal.map((v) => v.fileId)).toEqual(versionsFromV2.map((v) => v.fileId))
      expect(versionsFromV2.map((v) => v.fileId)).toEqual(versionsFromV3.map((v) => v.fileId))
    })
  })

  describe('Bulk File Operations with Versioning', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await createProject({ name: 'BulkTestProj', path: '/bulk/test' })
      projectId = proj.id
    })

    test('bulkCreateProjectFiles creates multiple files with versioning fields', async () => {
      const filesToCreate: FileSyncData[] = [
        { path: 'bulk1.js', name: 'bulk1.js', extension: '.js', content: '// bulk 1', size: 9, checksum: 'cs1' },
        { path: 'sub/bulk2.ts', name: 'bulk2.ts', extension: '.ts', content: '// bulk 2', size: 9, checksum: 'cs2' }
      ]
      const created = await bulkCreateProjectFiles(projectId, filesToCreate)

      expect(created.length).toBe(2)
      created.forEach((file) => {
        expect(file.version).toBe(1)
        expect(file.prevId).toBeNull()
        expect(file.nextId).toBeNull()
        expect(file.isLatest).toBe(true)
        expect(file.originalFileId).toBeNull()
      })

      const filesInDb = Object.values(mockProjectFilesDbPerProject[projectId] || {})
      expect(filesInDb.length).toBe(2)
      expect(filesInDb.find((f) => f.path === 'bulk1.js')).toBeDefined()
      expect(filesInDb.find((f) => f.path === 'sub/bulk2.ts')).toBeDefined()
    })

    test('bulkUpdateProjectFiles creates new versions for all files', async () => {
      const f1_created = await createProjectFileRecord(projectId, 'up1.txt', 'old1')
      const f2_created = await createProjectFileRecord(projectId, 'up2.txt', 'old2')

      const updates: Array<{ fileId: number; data: FileSyncData }> = [
        {
          fileId: f1_created.id,
          data: {
            path: f1_created.path,
            name: f1_created.name,
            extension: f1_created.extension,
            content: 'new1',
            size: 4,
            checksum: 'cs_new1'
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
            checksum: 'cs_new2'
          }
        }
      ]

      const updatedResult = await bulkUpdateProjectFiles(projectId, updates)

      expect(updatedResult.length).toBe(2)

      // Should have created new versions
      updatedResult.forEach((file) => {
        expect(file.version).toBe(2)
        expect(file.isLatest).toBe(true)
      })

      // Original files should no longer be latest
      expect(mockProjectFilesDbPerProject[projectId][f1_created.id].isLatest).toBe(false)
      expect(mockProjectFilesDbPerProject[projectId][f2_created.id].isLatest).toBe(false)

      // Check content is updated in new versions
      const newF1Version = updatedResult.find((f) => f.path === 'up1.txt')
      const newF2Version = updatedResult.find((f) => f.path === 'up2.txt')
      expect(newF1Version?.content).toBe('new1')
      expect(newF2Version?.content).toBe('new2')
    })
  })

  describe('Summarization with Versioning', () => {
    let projectId: number
    let file1: ProjectFile

    beforeEach(async () => {
      const proj = await createProject({ name: 'SummarizeProj', path: '/summarize/test' })
      projectId = proj.id
      file1 = await createProjectFileRecord(projectId, 'summarize-me.js', 'function hello() { console.log("world"); }')

      mockGenerateStructuredData.mockImplementation(async ({ schema }: { schema: z.ZodSchema<any> }) => {
        if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
          return { object: { summary: 'Mocked AI summary' } }
        }
        return { object: {} }
      })
    })

    test('summarizeSingleFile works with versioned files', async () => {
      const summarized = await summarizeSingleFile(file1)
      expect(summarized).toBeDefined()
      if (!summarized) throw new Error('Summarization failed')

      expect(summarized.summary).toBe('Mocked AI summary')
      expect(summarized.summaryLastUpdated).toBeDefined()
      expect(mockProjectFilesDbPerProject[projectId][file1.id].summary).toBe('Mocked AI summary')
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1)
    })

    test('summarizeFiles only processes latest versions', async () => {
      const file1_created = await createProjectFileRecord(
        projectId,
        'summarize-me.js',
        'function hello() { console.log("world"); }'
      )
      const file1_v2 = await updateFileContent(
        projectId,
        file1_created.id,
        'function hello() { console.log("world v2"); }'
      )
      const file2_created = await createProjectFileRecord(projectId, 'another.js', 'let x = 10;')

      // Request summarization using all file IDs (including old version)
      const result = await summarizeFiles(projectId, [file1_created.id, file1_v2.id, file2_created.id])

      // Should only process latest versions (getProjectFiles returns only latest by default)
      expect(result.included).toBe(2) // file1_v2 and file2_created
      expect(result.updatedFiles.length).toBe(2)

      // Check that summaries are applied to the correct files
      expect(mockProjectFilesDbPerProject[projectId][file1_v2.id].summary).toBe('Mocked AI summary')
      expect(mockProjectFilesDbPerProject[projectId][file2_created.id].summary).toBe('Mocked AI summary')

      // Old version should not be summarized
      expect(mockProjectFilesDbPerProject[projectId][file1_created.id].summary).toBeNull()

      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(2)
    })

    test('resummarizeAllFiles works with versioning', async () => {
      const newProj = await createProject({ name: 'ResummarizeTest', path: '/resummarize' })
      mockProjectFilesDbPerProject[newProj.id] = {}

      await resummarizeAllFiles(newProj.id)

      expect(mockSyncProject).toHaveBeenCalledWith(expect.objectContaining({ id: newProj.id }))

      const syncedFileInDb = Object.values(mockProjectFilesDbPerProject[newProj.id] || {}).find(
        (f) => f.name === 'synced-file.txt'
      )
      expect(syncedFileInDb).toBeDefined()
      expect(syncedFileInDb?.summary).toBe('Mocked AI summary')
      expect(syncedFileInDb?.version).toBe(1)
      expect(syncedFileInDb?.isLatest).toBe(true)
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1)
    })
  })
})
