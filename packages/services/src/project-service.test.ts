// packages/server/src/services/project-service.test.ts
// Or if your file is in `packages/services` as per context:
// packages/services/src/project-service.test.ts

import { describe, test, expect, beforeEach, mock, afterEach, spyOn } from 'bun:test' // << CORRECTED IMPORT
import {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
  deleteProject,
  getProjectFiles,
  updateFileContent,
  createProjectFileRecord,
  bulkCreateProjectFiles,
  bulkUpdateProjectFiles,
  type FileSyncData
} from '@octoprompt/services' // Assuming this path is correct based on your setup
// Mock summarization functions
const mockSummarizeSingleFile = mock(async (file: any) => {
  // Mock implementation until Mastra integration is complete
  const summary = `Mock summary for ${file.name || 'file'}`

  // Simulate updating the file's summary in storage
  const projectFiles = mockProjectFilesDbPerProject[file.projectId] || {}
  if (projectFiles[file.id]) {
    projectFiles[file.id] = { ...projectFiles[file.id], summary, summaryLastUpdated: Date.now() }
  }
  return projectFiles[file.id]
})

const mockSummarizeFiles = mock(async (projectId: number, fileIds: number[]) => {
  // Find all files by their IDs and summarize them
  const projectFiles = mockProjectFilesDbPerProject[projectId] || {}
  for (const fileId of fileIds) {
    const file = projectFiles[fileId]
    if (file) {
      await mockSummarizeSingleFile(file)
    }
  }
})

const summarizeSingleFile = mockSummarizeSingleFile
const summarizeFiles = mockSummarizeFiles
import type { Project, ProjectFile, CreateProjectBody, UpdateProjectBody, FileVersion } from '@octoprompt/schemas'
import type { ProjectsStorage, ProjectFilesStorage } from '@octoprompt/storage'
import { ApiError } from '@octoprompt/shared'
import { z } from 'zod'
import { normalizeToUnixMs } from '@octoprompt/shared'

// ... (rest of the mock setup remains the same) ...
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
  // V2 API methods
  create: async (data: Omit<Project, 'id' | 'created' | 'updated'>) => {
    const id = generateTestId()
    const now = Date.now()
    const project: Project = {
      id,
      ...data,
      created: now,
      updated: now
    }
    mockProjectsDb[id] = project
    mockProjectFilesDbPerProject[id] = {}
    return project
  },
  getById: async (id: number) => {
    return mockProjectsDb[id] || null
  },
  update: async (id: number, data: Partial<Omit<Project, 'id' | 'created' | 'updated'>>) => {
    const existing = mockProjectsDb[id]
    if (!existing) return null
    // Only update fields that are provided in data
    const updated = {
      ...existing,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.path !== undefined && { path: data.path }),
      updated: Date.now()
    }
    mockProjectsDb[id] = updated
    return updated
  },
  delete: async (id: number) => {
    if (!mockProjectsDb[id]) return false
    delete mockProjectsDb[id]
    delete mockProjectFilesDbPerProject[id]
    return true
  },
  getAllProjects: async () => {
    return Object.values(mockProjectsDb)
  },
  getProjectFiles: async (projectId: number) => {
    return Object.values(mockProjectFilesDbPerProject[projectId] || {})
  },
  getProjectFileArray: async (projectId: number) => {
    return Object.values(mockProjectFilesDbPerProject[projectId] || {})
  },
  addFile: async (projectId: number, fileData: Omit<ProjectFile, 'id' | 'created' | 'updated' | 'projectId'>) => {
    const id = generateTestId()
    const now = Date.now()
    const file: ProjectFile = {
      id,
      projectId,
      ...fileData,
      created: now,
      updated: now
    }
    if (!mockProjectFilesDbPerProject[projectId]) {
      mockProjectFilesDbPerProject[projectId] = {}
    }
    mockProjectFilesDbPerProject[projectId][id] = file
    return file
  },
  getFileStorage: (projectId: number) => ({
    getById: async (fileId: number) => {
      return mockProjectFilesDbPerProject[projectId]?.[fileId] || null
    },
    update: async (fileId: number, data: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created'>>) => {
      const file = mockProjectFilesDbPerProject[projectId]?.[fileId]
      if (!file) return null
      const updated = {
        ...file,
        ...data,
        updated: Date.now()
      }
      mockProjectFilesDbPerProject[projectId][fileId] = updated
      return updated
    },
    delete: async (fileId: number) => {
      if (!mockProjectFilesDbPerProject[projectId]?.[fileId]) return false
      delete mockProjectFilesDbPerProject[projectId][fileId]
      return true
    }
  }),
  // V2 list method
  list: async (): Promise<Project[]> => {
    return Object.values(mockProjectsDb)
  },
  // Legacy compatibility methods (map to V2)
  getAllProjects: async function (): Promise<Project[]> {
    return this.list()
  },
  // V1 compatibility methods
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
  }
}

mock.module('@octoprompt/storage', () => ({
  projectStorage: mockProjectStorage
}))

// TODO: Remove gen-ai-services mock when Mastra integration is complete

const mockSyncProject = mock(async (project: Project) => {
  const projectFiles = mockProjectFilesDbPerProject[project.id] || {}
  if (!mockProjectFilesDbPerProject[project.id] || Object.keys(projectFiles).length === 0) {
    const fileId = mockProjectStorage.generateId()
    const now = Date.now()
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
        created: now,
        updated: now
      }
    }
  }
  return { added: [], updated: [], removed: [], unchanged: [], log: [], error: null }
})
mock.module('./file-services/file-sync-service-unified', () => ({
  // Adjust path
  syncProject: mockSyncProject
}))

const randomString = (length = 8) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length)

describe('Project Service', () => {
  beforeEach(async () => {
    mockProjectsDb = {}
    mockProjectFilesDbPerProject = {}
    mockIdCounter = BASE_TIMESTAMP + 200000
    mockSyncProject.mockClear()
  })

  afterEach(() => {
    // Optional: Log DB state for debugging
    // console.log('mockProjectsDb after test:', JSON.stringify(mockProjectsDb, null, 2));
    // console.log('mockProjectFilesDbPerProject after test:', JSON.stringify(mockProjectFilesDbPerProject, null, 2));
  })

  // --- Project CRUD Tests (largely unchanged, but ensure they run) ---
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
        new ApiError(404, `Project with ID ${notFoundId} not found.`, 'PROJECT_NOT_FOUND')
      )
    })

    test('listProjects returns all projects sorted by updatedAt DESC', async () => {
      let all = await listProjects()
      expect(all.length).toBe(0)

      const p1 = await createProject({ name: 'P1', path: '/p1' })
      await new Promise((resolve) => setTimeout(resolve, 10)) // ensure time difference
      const p2 = await createProject({ name: 'P2', path: '/p2' })

      all = await listProjects()
      expect(all.length).toBe(2)
      expect(all[0].id).toBe(p2.id) // P2 is newer
      expect(all[1].id).toBe(p1.id)
    })

    test('updateProject updates fields and returns updated project', async () => {
      const created = await createProject({ name: 'Before', path: '/old' })
      const updates: UpdateProjectBody = { name: 'After', description: 'New Desc' }
      await new Promise((resolve) => setTimeout(resolve, 1)) // ensure time difference
      const updated = await updateProject(created.id, updates)

      expect(updated).toBeDefined()
      if (!updated) throw new Error('Update failed')
      expect(updated.name).toBe('After')
      expect(updated.description).toBe('New Desc')
      expect(updated.path).toBe(created.path) // Path not updated
      expect(updated.updated).toBeGreaterThan(created.updated)
      expect(mockProjectsDb[created.id]).toEqual(updated)
    })

    test('deleteProject returns true if deleted, throws if nonexistent, and removes files data', async () => {
      const project = await createProject({ name: 'DelMe', path: '/del/me' })
      const fileIdForDeleteTest = generateTestId()
      const now = Date.now()
      mockProjectFilesDbPerProject[project.id] = {
        [fileIdForDeleteTest]: {
          id: fileIdForDeleteTest,
          projectId: project.id,
          name: 'f.txt',
          path: 'f.txt',
          content: '',
          extension: '.txt',
          size: 0,
          created: now - 100,
          updated: now - 50,
          summary: null,
          summaryLastUpdated: null,
          meta: '{}',
          checksum: null,
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
    })
  })

  // --- File Operations Tests (V1 Versioning removed) ---
  describe('Project File Operations', () => {
    let projectId: number
    let fileA: ProjectFile
    let fileB: ProjectFile

    beforeEach(async () => {
      const proj = await createProject({ name: 'FileTestProj', path: '/file/test' })
      projectId = proj.id

      // Setup test files
      fileA = await createProjectFileRecord(projectId, 'src/fileA.ts', 'content v1 for A')
      fileB = await createProjectFileRecord(projectId, 'src/fileB.ts', 'content v1 for B')
    })

    describe('createProjectFileRecord', () => {
      test('should correctly initialize file fields', async () => {
        const newFile = await createProjectFileRecord(projectId, 'newly-created.txt', 'initial')
        expect(newFile.projectId).toBe(projectId)
        expect(newFile.path).toBe('newly-created.txt')
        expect(newFile.content).toBe('initial')
        expect(newFile.created).toBeGreaterThan(0)
        expect(newFile.updated).toBeGreaterThan(0)
      })
    })

    describe('getProjectFiles', () => {
      test('returns all project files', async () => {
        const files = await getProjectFiles(projectId)
        expect(files).toBeArrayOfSize(2)
        const foundFileA = files?.find((f) => f.path === 'src/fileA.ts')
        const foundFileB = files?.find((f) => f.path === 'src/fileB.ts')
        expect(foundFileA?.id).toBe(fileA.id)
        expect(foundFileA?.path).toBe('src/fileA.ts')
        expect(foundFileB?.id).toBe(fileB.id)
        expect(foundFileB?.path).toBe('src/fileB.ts')
      })

      test('supports limit option', async () => {
        // Add another file
        await createProjectFileRecord(projectId, 'test/search.ts', 'search content')

        const allFiles = await getProjectFiles(projectId)
        expect(allFiles).toBeArrayOfSize(3)

        const limitedFiles = await getProjectFiles(projectId, false, { limit: 1 })
        expect(limitedFiles).toBeArrayOfSize(1)
      })

      test('returns empty array for a project with no files', async () => {
        const newProj = await createProject({ name: 'EmptyProj', path: '/empty' })
        const files = await getProjectFiles(newProj.id)
        expect(files).toBeArrayOfSize(0)
        const allFiles = await getProjectFiles(newProj.id, true)
        expect(allFiles).toBeArrayOfSize(0)
      })
    })

    describe('updateFileContent', () => {
      test('updates file content directly', async () => {
        const newContent = 'updated content for B'
        const updatedFile = await updateFileContent(projectId, fileB.id, newContent)

        expect(updatedFile.id).toBe(fileB.id)
        expect(updatedFile.content).toBe(newContent)
        expect(updatedFile.updated).toBeGreaterThanOrEqual(fileB.updated)
      })

      test('throws error if fileId does not exist', async () => {
        const nonExistentFileId = generateTestId()
        await expect(updateFileContent(projectId, nonExistentFileId, 'new content')).rejects.toThrowError(
          `File with ID ${nonExistentFileId} not found.`
        )
      })
    })

    // V1 versioning functionality has been removed
    /*
    describe('getFileVersions', () => {
      test('returns all versions for a given originalFileId', async () => {
        const versions = await getFileVersions(projectId, fileA_v1.id) // fileA_v1.id is the original
        expect(versions).toBeArrayOfSize(3)
        expect(versions.map((v) => v.version)).toEqual([1, 2, 3])
        expect(versions.map((v) => v.fileId)).toEqual([fileA_v1.id, fileA_v2.id, fileA_v3.id])
      })

      test('returns all versions when a later version ID is passed', async () => {
        const versions = await getFileVersions(projectId, fileA_v3.id) // pass latest version ID
        expect(versions).toBeArrayOfSize(3)
        expect(versions.map((v) => v.version)).toEqual([1, 2, 3])
      })

      test('returns a single version for a file with only one version', async () => {
        const versions = await getFileVersions(projectId, fileB_v1.id)
        expect(versions).toBeArrayOfSize(1)
        expect(versions[0].fileId).toBe(fileB_v1.id)
      })

      test('returns an empty array if the file does not exist', async () => {
        const nonExistentFileId = generateTestId()
        const versions = await getFileVersions(projectId, nonExistentFileId)
        expect(versions).toBeArrayOfSize(0)
      })
    })

    describe('getFileVersion', () => {
      test('retrieves a specific version of a file', async () => {
        const versionTwo = await getFileVersion(projectId, fileA_v1.id, 2)
        expect(versionTwo?.id).toBe(fileA_v2.id)
        expect(versionTwo?.version).toBe(2)
        expect(versionTwo?.content).toBe('content v2 for A')
      })

      test('retrieves the latest version if no version number is specified', async () => {
        const latestVersion = await getFileVersion(projectId, fileA_v1.id)
        expect(latestVersion?.id).toBe(fileA_v3.id)
        expect(latestVersion?.version).toBe(3)
        expect(latestVersion?.isLatest).toBe(true)
      })

      test('returns null if a specific version does not exist', async () => {
        const nonExistentVersion = await getFileVersion(projectId, fileA_v1.id, 99)
        expect(nonExistentVersion).toBeNull()
      })

      test('returns null if the file ID does not exist', async () => {
        const nonExistentFileId = generateTestId()
        const file = await getFileVersion(projectId, nonExistentFileId, 1)
        expect(file).toBeNull()
      })
    })

    describe('revertFileToVersion', () => {
      test('creates a new latest version with content from the target version', async () => {
        const targetVersionNumber = 1
        const originalContentOfV1 = fileA_v1.content

        // Revert fileA (latest is v3) back to version 1
        const revertedFile = await revertFileToVersion(projectId, fileA_v3.id, targetVersionNumber)

        expect(revertedFile.version).toBe(4) // v3 was latest, so new is v4
        expect(revertedFile.content).toBe(originalContentOfV1)
        expect(revertedFile.isLatest).toBe(true)
        expect(revertedFile.prevId).toBe(fileA_v3.id)
        expect(revertedFile.originalFileId).toBe(fileA_v1.id)

        const oldV3 = mockProjectFilesDbPerProject[projectId][fileA_v3.id]
        expect(oldV3.isLatest).toBe(false)
        expect(oldV3.nextId).toBe(revertedFile.id)
      })

      test('throws error if trying to revert from a non-latest version ID', async () => {
        await expect(revertFileToVersion(projectId, fileA_v2.id, 1)) // fileA_v2 is not latest
          .rejects.toThrowError(
            `Failed to revert file to version 1. Reason: Cannot create version from non-latest file: ${fileA_v2.id}`
          )
      })

      test('throws error if target version does not exist', async () => {
        await expect(revertFileToVersion(projectId, fileA_v3.id, 99)).rejects.toThrowError(
          `Version 99 not found for file ${fileA_v3.id}`
        )
      })

      test('reverting to the current latest version still creates a new version', async () => {
        const currentLatestContent = fileA_v3.content
        const revertedFile = await revertFileToVersion(projectId, fileA_v3.id, 3) // Revert to v3 (current latest)

        expect(revertedFile.version).toBe(4)
        expect(revertedFile.content).toBe(currentLatestContent)
        expect(revertedFile.isLatest).toBe(true)
        expect(revertedFile.prevId).toBe(fileA_v3.id)

        const oldV3 = mockProjectFilesDbPerProject[projectId][fileA_v3.id]
        expect(oldV3.isLatest).toBe(false)
        expect(oldV3.nextId).toBe(revertedFile.id)
      })
    })
    */
  })

  // V1 versioning functionality has been removed
  /*
  describe('Bulk File Operations with Versioning', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await createProject({ name: 'BulkTestProj', path: '/bulk/test' })
      projectId = proj.id
    })

    test('bulkCreateProjectFiles creates files with version 1 and correct flags', async () => {
      const filesToCreate: FileSyncData[] = [
        { path: 'bulk1.js', name: 'bulk1.js', extension: '.js', content: '// bulk 1', size: 9, checksum: 'cs1' }
      ]
      const created = await bulkCreateProjectFiles(projectId, filesToCreate)
      expect(created).toBeArrayOfSize(1)
      const file = created[0]
      expect(file.version).toBe(1)
      expect(file.isLatest).toBe(true)
      expect(file.prevId).toBeNull()
      expect(file.nextId).toBeNull()
      expect(file.originalFileId).toBeNull()
    })

    test('bulkUpdateProjectFiles creates new versions for each update', async () => {
      const f1_v1 = await createProjectFileRecord(projectId, 'up1.txt', 'old1')
      const f2_v1 = await createProjectFileRecord(projectId, 'up2.txt', 'old2')

      const updates: Array<{ fileId: number; data: FileSyncData }> = [
        {
          fileId: f1_v1.id,
          data: { path: 'up1.txt', name: 'up1.txt', extension: '.txt', content: 'new1', size: 4, checksum: 'cs_new1' }
        },
        {
          fileId: f2_v1.id,
          data: { path: 'up2.txt', name: 'up2.txt', extension: '.txt', content: 'new2', size: 4, checksum: 'cs_new2' }
        }
      ]
      const updatedResults = await bulkUpdateProjectFiles(projectId, updates)
      expect(updatedResults).toBeArrayOfSize(2)

      const updated_f1 = updatedResults.find((f) => f.originalFileId === f1_v1.id)
      const updated_f2 = updatedResults.find((f) => f.originalFileId === f2_v1.id)

      expect(updated_f1?.version).toBe(2)
      expect(updated_f1?.isLatest).toBe(true)
      expect(updated_f1?.prevId).toBe(f1_v1.id)
      expect(updated_f1?.content).toBe('new1')
      expect(mockProjectFilesDbPerProject[projectId][f1_v1.id].isLatest).toBe(false)
      expect(mockProjectFilesDbPerProject[projectId][f1_v1.id].nextId).toBe(updated_f1?.id)

      expect(updated_f2?.version).toBe(2)
      expect(updated_f2?.isLatest).toBe(true)
      expect(updated_f2?.prevId).toBe(f2_v1.id)
      expect(updated_f2?.content).toBe('new2')
      expect(mockProjectFilesDbPerProject[projectId][f2_v1.id].isLatest).toBe(false)
      expect(mockProjectFilesDbPerProject[projectId][f2_v1.id].nextId).toBe(updated_f2?.id)
    })

    test('bulkUpdateProjectFiles skips update and logs error if a fileId is non-latest', async () => {
      const f1_v1 = await createProjectFileRecord(projectId, 'f1.txt', 'f1_v1_content')
      const f1_v2 = await updateFileContent(projectId, f1_v1.id, 'f1_v2_content') // f1_v1 is now non-latest
      const f2_v1 = await createProjectFileRecord(projectId, 'f2.txt', 'f2_v1_content')

      const consoleErrorMock = spyOn(console, 'error') // << CORRECTED USAGE

      const updates: Array<{ fileId: number; data: FileSyncData }> = [
        {
          fileId: f1_v1.id,
          data: {
            path: 'f1.txt',
            name: 'f1.txt',
            extension: '.txt',
            content: 'attempt_update_non_latest',
            size: 10,
            checksum: 'cs_nonlatest'
          }
        }, // This should fail
        {
          fileId: f2_v1.id,
          data: {
            path: 'f2.txt',
            name: 'f2.txt',
            extension: '.txt',
            content: 'f2_v2_content',
            size: 10,
            checksum: 'cs_f2v2'
          }
        } // This should succeed
      ]

      const results = await bulkUpdateProjectFiles(projectId, updates)

      expect(results).toBeArrayOfSize(1) // Only f2 should be updated
      expect(results[0].originalFileId).toBe(f2_v1.id)
      expect(results[0].version).toBe(2)
      expect(results[0].content).toBe('f2_v2_content')

      expect(consoleErrorMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `[ProjectService] Failed to create new version for file ${f1_v1.id} during bulk update:`
        ),
        expect.stringContaining(`Cannot create version from non-latest file: ${f1_v1.id}`)
      )

      // Verify f1_v1 and f1_v2 are untouched by the failed update attempt
      expect(mockProjectFilesDbPerProject[projectId][f1_v1.id].content).toBe('f1_v1_content')
      expect(mockProjectFilesDbPerProject[projectId][f1_v2.id].content).toBe('f1_v2_content')
      expect(mockProjectFilesDbPerProject[projectId][f1_v2.id].isLatest).toBe(true)

      consoleErrorMock.mockRestore()
    })
  })

  describe('Summarization with Versioning', () => {
    let projectId: number
    let fileToSummarize_v1: ProjectFile, fileToSummarize_v2: ProjectFile

    beforeEach(async () => {
      const proj = await createProject({ name: 'SummarizeProj', path: '/summarize/test' })
      projectId = proj.id
      fileToSummarize_v1 = await createProjectFileRecord(
        projectId,
        'summarize-me.js',
        'function hello() { console.log("v1"); }'
      )
      fileToSummarize_v2 = await updateFileContent(
        projectId,
        fileToSummarize_v1.id,
        'function hello() { console.log("v2"); }'
      )
    })

    test('summarizeSingleFile updates summary in-place for the given file version', async () => {
      // Summarize v1 (which is not latest)
      const summarizedV1 = await summarizeSingleFile(fileToSummarize_v1)
      expect(summarizedV1?.id).toBe(fileToSummarize_v1.id)
      expect(summarizedV1?.summary).toContain('Mock summary for summarize-me.js')
      expect(mockProjectFilesDbPerProject[projectId][fileToSummarize_v1.id].summary).toContain(
        'Mock summary for summarize-me.js'
      )
      expect(mockProjectFilesDbPerProject[projectId][fileToSummarize_v1.id].version).toBe(1) // No new version

      // Summarize v2 (which is latest)
      const summarizedV2 = await summarizeSingleFile(fileToSummarize_v2)
      expect(summarizedV2?.id).toBe(fileToSummarize_v2.id)
      expect(summarizedV2?.summary).toContain('Mock summary for summarize-me.js')
      expect(mockProjectFilesDbPerProject[projectId][fileToSummarize_v2.id].summary).toContain(
        'Mock summary for summarize-me.js'
      )
      expect(mockProjectFilesDbPerProject[projectId][fileToSummarize_v2.id].version).toBe(2) // No new version
    })
  })
  */
})
