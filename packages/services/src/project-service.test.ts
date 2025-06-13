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
  getFileVersions,
  getFileVersion,
  revertFileToVersion,
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

  createFileVersion: async (
    projectId: number,
    currentFileId: number,
    newContent: string,
    additionalData?: Partial<
      Omit<
        ProjectFile,
        'id' | 'projectId' | 'created' | 'updated' | 'version' | 'prevId' | 'nextId' | 'isLatest' | 'content' | 'size'
      >
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

    const newVersion: ProjectFile = {
      ...currentFile, // spread current file first
      id: newVersionId, // then override specific fields
      content: newContent,
      version: currentFile.version + 1,
      prevId: currentFileId,
      nextId: null,
      isLatest: true,
      size: Buffer.byteLength(newContent, 'utf8'),
      created: now, // New version should have its own creation time
      updated: now,
      originalFileId: currentFile.originalFileId || currentFile.id,
      // Apply additional data last to allow overriding things like checksum, extension, etc.
      ...additionalData
    }

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

  getFileVersions: async (projectId: number, originalFileIdParam: number): Promise<ProjectFile[]> => {
    const files = mockProjectFilesDbPerProject[projectId] || {}
    const versions: ProjectFile[] = []

    const fileRequested = files[originalFileIdParam]
    const actualOriginalFileId = fileRequested?.originalFileId || originalFileIdParam

    for (const file of Object.values(files)) {
      if (
        (file.originalFileId === null && file.id === actualOriginalFileId) ||
        file.originalFileId === actualOriginalFileId
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
    const actualOriginalFileId = files[originalFileId]?.originalFileId || originalFileId

    for (const file of Object.values(files)) {
      if ((file.originalFileId || file.id) === actualOriginalFileId && file.isLatest) {
        return file
      }
    }
    return null
  },

  revertToVersion: async (projectId: number, currentFileId: number, targetVersion: number): Promise<ProjectFile> => {
    const files = mockProjectFilesDbPerProject[projectId] || {}
    const currentFile = files[currentFileId] // This should be the *latest* file ID of the chain

    if (!currentFile) {
      throw new Error(`File not found: ${currentFileId} in project ${projectId}`)
    }
    if (!currentFile.isLatest) {
      throw new Error(`Cannot revert from a non-latest file version: ${currentFileId}`)
    }

    const originalFileId = currentFile.originalFileId || currentFile.id
    const targetVersionFile = await mockProjectStorage.getFileVersion(projectId, originalFileId, targetVersion)

    if (!targetVersionFile) {
      throw new Error(`Version ${targetVersion} not found for file chain of ${originalFileId}`)
    }

    // Create new version using currentFileId (the latest) as the base for prevId link
    return mockProjectStorage.createFileVersion(projectId, currentFileId, targetVersionFile.content, {
      checksum: targetVersionFile.checksum,
      meta: targetVersionFile.meta,
      // Ensure other relevant fields from targetVersionFile are carried over if necessary
      name: targetVersionFile.name,
      path: targetVersionFile.path, // Path should ideally remain consistent for a version chain unless explicitly changed by an "update"
      extension: targetVersionFile.extension
    })
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
        updated: now,
        version: 1,
        prevId: null,
        nextId: null,
        isLatest: true,
        originalFileId: null
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

describe('Project Service (File Storage with Versioning)', () => {
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
        new ApiError(404, `Project not found with ID ${notFoundId}.`, 'PROJECT_NOT_FOUND')
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

  // --- Detailed File Versioning Tests ---
  describe('Project File Operations with Versioning', () => {
    let projectId: number
    let fileA_v1: ProjectFile, fileA_v2: ProjectFile, fileA_v3: ProjectFile
    let fileB_v1: ProjectFile

    beforeEach(async () => {
      const proj = await createProject({ name: 'FileTestProj', path: '/file/test' })
      projectId = proj.id

      // Setup a file with multiple versions (fileA) and one with a single version (fileB)
      fileA_v1 = await createProjectFileRecord(projectId, 'src/fileA.ts', 'content v1 for A')
      fileA_v2 = await updateFileContent(projectId, fileA_v1.id, 'content v2 for A')
      fileA_v3 = await updateFileContent(projectId, fileA_v2.id, 'content v3 for A')
      fileB_v1 = await createProjectFileRecord(projectId, 'src/fileB.ts', 'content v1 for B')
    })

    describe('createProjectFileRecord', () => {
      test('should correctly initialize versioning fields', async () => {
        const newFile = await createProjectFileRecord(projectId, 'newly-created.txt', 'initial')
        expect(newFile.version).toBe(1)
        expect(newFile.isLatest).toBe(true)
        expect(newFile.prevId).toBeNull()
        expect(newFile.nextId).toBeNull()
        expect(newFile.originalFileId).toBeNull() // originalFileId is null for the first version
      })
    })

    describe('getProjectFiles', () => {
      test('returns only latest versions by default', async () => {
        const files = await getProjectFiles(projectId)
        expect(files).toBeArrayOfSize(2)
        const fileA = files?.find((f) => f.path === 'src/fileA.ts')
        const fileB = files?.find((f) => f.path === 'src/fileB.ts')
        expect(fileA?.id).toBe(fileA_v3.id)
        expect(fileA?.version).toBe(3)
        expect(fileA?.isLatest).toBe(true)
        expect(fileB?.id).toBe(fileB_v1.id)
        expect(fileB?.version).toBe(1)
        expect(fileB?.isLatest).toBe(true)
      })

      test('returns all versions when includeAllVersions is true, sorted by path then version', async () => {
        const files = await getProjectFiles(projectId, true)
        expect(files).toBeArrayOfSize(4) // 3 versions of A, 1 of B

        const fileA_versions = files?.filter((f) => f.path === 'src/fileA.ts').sort((a, b) => a.version - b.version)
        const fileB_versions = files?.filter((f) => f.path === 'src/fileB.ts').sort((a, b) => a.version - b.version)

        expect(fileA_versions).toBeArrayOfSize(3)
        expect(fileA_versions?.[0].id).toBe(fileA_v1.id)
        expect(fileA_versions?.[0].version).toBe(1)
        expect(fileA_versions?.[1].id).toBe(fileA_v2.id)
        expect(fileA_versions?.[1].version).toBe(2)
        expect(fileA_versions?.[2].id).toBe(fileA_v3.id)
        expect(fileA_versions?.[2].version).toBe(3)

        expect(fileB_versions).toBeArrayOfSize(1)
        expect(fileB_versions?.[0].id).toBe(fileB_v1.id)
        expect(fileB_versions?.[0].version).toBe(1)
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
      test('creates a new version and updates links correctly', async () => {
        const originalLatest = fileB_v1
        const newContent = 'updated content for B'
        const fileB_v2 = await updateFileContent(projectId, originalLatest.id, newContent)

        expect(fileB_v2.id).not.toBe(originalLatest.id)
        expect(fileB_v2.version).toBe(originalLatest.version + 1)
        expect(fileB_v2.content).toBe(newContent)
        expect(fileB_v2.isLatest).toBe(true)
        expect(fileB_v2.prevId).toBe(originalLatest.id)
        expect(fileB_v2.originalFileId).toBe(originalLatest.id) // originalFileId is originalLatest.id as it was v1

        const updatedOriginalLatest = mockProjectFilesDbPerProject[projectId][originalLatest.id]
        expect(updatedOriginalLatest.isLatest).toBe(false)
        expect(updatedOriginalLatest.nextId).toBe(fileB_v2.id)
      })

      test('throws error if trying to update a non-latest version', async () => {
        // fileA_v1 is not the latest version of fileA
        await expect(updateFileContent(projectId, fileA_v1.id, 'new content')).rejects.toThrowError(
          `Failed to update file content for ${fileA_v1.id}. Reason: Cannot create version from non-latest file: ${fileA_v1.id}`
        )
      })

      test('throws error if fileId does not exist', async () => {
        const nonExistentFileId = generateTestId()
        await expect(updateFileContent(projectId, nonExistentFileId, 'new content')).rejects.toThrowError(
          `Failed to update file content for ${nonExistentFileId}. Reason: File not found: ${nonExistentFileId} in project ${projectId}`
        )
      })
    })

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
            `Failed to revert file to version 1. Reason: Cannot revert from a non-latest file version: ${fileA_v2.id}`
          )
      })

      test('throws error if target version does not exist', async () => {
        await expect(revertFileToVersion(projectId, fileA_v3.id, 99)).rejects.toThrowError(
          `Failed to revert file to version 99. Reason: Version 99 not found for file chain of ${fileA_v1.id}`
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
  })

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
})
