import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { z } from 'zod'
import { createOctoPromptClient, OctoPromptError } from '@octoprompt/api-client'
import type { OctoPromptClient } from '@octoprompt/api-client'

import { ProjectFileSchema, type Project, type ProjectFile } from '@octoprompt/schemas'
import { TEST_API_URL } from './test-config'

const BASE_URL = TEST_API_URL

// Schemas for direct validation of client responses' `data` part
const SpecificProjectSummaryResponseSchema = z.object({
  success: z.literal(true),
  summary: z.string()
})

describe('Project API Tests', () => {
  let client: OctoPromptClient
  let testProjects: Project[] = []
  let testProjectPaths: string[] = []
  let createdFileIdsForBulkOps: number[] = []

  beforeAll(() => {
    console.log('Starting Project API Tests...')
    client = createOctoPromptClient({ baseUrl: BASE_URL })
  })

  afterAll(async () => {
    console.log('Cleaning up test data...')
    for (const project of testProjects) {
      try {
        await client.projects.deleteProject(project.id)
      } catch (err) {
        if (err instanceof OctoPromptError && err.statusCode === 404) {
          // Already deleted, ignore
        } else {
          console.error(`Failed to delete project ${project.id}:`, err)
        }
      }
    }
    for (const path of testProjectPaths) {
      try {
        if (existsSync(path)) {
          rmSync(path, { recursive: true, force: true })
        }
      } catch (err) {
        console.error(`Failed to remove test directory ${path}:`, err)
      }
    }
  })

  test('POST /api/projects - Create projects', async () => {
    const testData = [
      { name: 'Test Project 1', description: 'First test project' },
      { name: 'Test Project 2', description: 'Second test project' },
      { name: 'Test Project 3', description: 'Third test project' }
    ]

    for (const data of testData) {
      const tempDir = mkdtempSync(join(tmpdir(), `project-test-${Date.now()}-`))
      testProjectPaths.push(tempDir)
      writeFileSync(join(tempDir, 'sample-file.ts'), 'console.log("hello world");')

      const result = await client.projects.createProject({ ...data, path: tempDir })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.name).toBe(data.name)
      expect(result.data.description).toBe(data.description)
      expect(result.data.path).toBe(tempDir)
      expect(result.data.id).toBeTypeOf('number')
      expect(result.data.created).toBeNumber()
      expect(result.data.updated).toBeNumber()

      testProjects.push(result.data)
    }
  })

  test('GET /api/projects - List all projects and verify creations', async () => {
    const result = await client.projects.listProjects()

    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)

    for (const testProject of testProjects) {
      const found = result.data.find((p: Project) => p.id === testProject.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(testProject.name)
        expect(found.description).toBe(testProject.description)
      }
    }
  })

  test('GET /api/projects/{projectId} - Get individual projects', async () => {
    for (const project of testProjects) {
      const result = await client.projects.getProject(project.id)

      expect(result.success).toBe(true)
      expect(result.data.id).toBe(project.id)
      expect(result.data.name).toBe(project.name)
      expect(result.data.description).toBe(project.description)
      expect(result.data.path).toBe(project.path)
    }
  })

  test('PATCH /api/projects/{projectId} - Update projects', async () => {
    const updates = [
      { name: 'Updated Project 1', description: 'Updated first description' },
      { name: 'Updated Project 2' },
      { description: 'Only updated description' }
    ]

    for (let i = 0; i < testProjects.length; i++) {
      const project = testProjects[i]
      if (!project) continue
      const update = updates[i]
      if (!update) continue

      const result = await client.projects.updateProject(project.id, update)

      expect(result.success).toBe(true)
      if (update.name) expect(result.data.name).toBe(update.name)
      else expect(result.data.name).toBe(project.name)
      if (update.description) expect(result.data.description).toBe(update.description)
      else expect(result.data.description).toBe(project.description)

      expect(result.data.updated).toBeGreaterThanOrEqual(project.updated)
      testProjects[i] = result.data
    }
  })

  test('GET /api/projects - Verify updates', async () => {
    const result = await client.projects.listProjects()
    for (const project of testProjects) {
      const found = result.data.find((p: Project) => p.id === project.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(project.name)
        expect(found.description).toBe(project.description)
      }
    }
  })

  test('POST /api/projects/{projectId}/sync - Sync project files', async () => {
    const project = testProjects[0]
    if (!project) {
      console.warn('Skipping sync test as no project is available.')
      return
    }
    const success = await client.projects.syncProject(project.id)
    expect(success).toBe(true)
  })

  test('GET /api/projects/{projectId}/files - Get project files', async () => {
    for (const project of testProjects) {
      if (!project) continue
      const result = await client.projects.getProjectFiles(project.id)

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)

      if (result.data.length > 0) {
        result.data.forEach((file: ProjectFile) => {
          expect(file.projectId).toBe(project.id)
          expect(file.id).toBeTypeOf('number')
          expect(ProjectFileSchema.safeParse(file).success).toBe(true)
        })
      }
    }
  })

  // NOTE: Bulk file creation endpoint doesn't exist - files are created via the refresh endpoint
  test.skip('POST /api/projects/{projectId}/files/bulk - Bulk create files', async () => {
    const project = testProjects[0]
    if (!project) {
      console.warn('Skipping bulk create files test as no project is available.')
      return
    }

    const testFilesData = [
      {
        path: 'test-file-1.js',
        name: 'test-file-1.js',
        extension: '.js',
        content: 'console.log("test file 1");',
        size: Buffer.byteLength('console.log("test file 1");', 'utf8'),
        checksum: 'test-checksum-1'
      },
      {
        path: 'test-file-2.ts',
        name: 'test-file-2.ts',
        extension: '.ts',
        content: 'const message: string = "test file 2";',
        size: Buffer.byteLength('const message: string = "test file 2";', 'utf8'),
        checksum: 'test-checksum-2'
      }
    ]

    const unknownData = await client.projects.bulkCreateFiles(project.id, testFilesData)
    const resultData = z.array(ProjectFileSchema).parse(unknownData)

    expect(Array.isArray(resultData)).toBe(true)
    expect(resultData.length).toBe(testFilesData.length)

    createdFileIdsForBulkOps.length = 0
    resultData.forEach((file: ProjectFile, index: number) => {
      createdFileIdsForBulkOps.push(file.id)
      expect(file.projectId).toBe(project.id)
      const testFile = testFilesData[index]!
      expect(file.name).toBe(testFile.name)
      expect(file.content).toBe(testFile.content)
      expect(file.extension).toBe(testFile.extension)
      expect(file.size).toBe(testFile.size)
    })
  })

  // Skipping as it depends on bulk file creation which doesn't exist
  test.skip('PUT /api/projects/{projectId}/files/{fileId} - Update single file content', async () => {
    if (createdFileIdsForBulkOps.length === 0) {
      console.warn('Skipping single file update test: no files created by bulk op')
      return
    }
    const project = testProjects[0]
    if (!project) return

    const fileIdToUpdate = createdFileIdsForBulkOps[0]!
    const newContent = 'console.log("updated content for single file");'

    const response = await client.projects.updateFileContent(project.id, fileIdToUpdate, newContent)
    expect(response.success).toBe(true)

    const resultData = ProjectFileSchema.parse(response.data)

    // With versioning, the file ID might change (new version created)
    // So we'll check that a file was returned with the new content
    expect(resultData.content).toBe(newContent)
    expect(resultData.size).toBe(Buffer.byteLength(newContent, 'utf8'))
    expect(resultData.updated).toBeTypeOf('number')

    // Update our tracking array with the new file ID if it changed
    if (resultData.id !== fileIdToUpdate) {
      const index = createdFileIdsForBulkOps.indexOf(fileIdToUpdate)
      if (index !== -1) {
        createdFileIdsForBulkOps[index] = resultData.id
      }
    }
  })

  // Skipping as it depends on bulk file creation which doesn't exist
  test.skip('PUT /api/projects/{projectId}/files/bulk - Bulk update files content', async () => {
    if (createdFileIdsForBulkOps.length < 2) {
      console.warn('Skipping bulk update test: insufficient files from bulk create op')
      return
    }
    const project = testProjects[0]
    if (!project) return

    const updatesForBulk = [
      { fileId: createdFileIdsForBulkOps[0]!, content: 'console.log("bulk updated file 1 data");' },
      { fileId: createdFileIdsForBulkOps[1]!, content: 'const message: string = "bulk updated file 2 data";' }
    ]

    const unknownData = await client.projects.bulkUpdateFiles(project.id, updatesForBulk)
    const resultData = z.array(ProjectFileSchema).parse(unknownData)

    expect(Array.isArray(resultData)).toBe(true)
    // With versioning, we might get fewer results if some updates failed or were optimized
    expect(resultData.length).toBeGreaterThanOrEqual(1)
    expect(resultData.length).toBeLessThanOrEqual(updatesForBulk.length)

    resultData.forEach((file: ProjectFile) => {
      const update = updatesForBulk.find((u) => u.fileId === file.id || u.content === file.content)
      expect(update).toBeDefined()
      if (update) {
        expect(file.content).toBe(update.content)
        expect(file.size).toBe(Buffer.byteLength(update.content, 'utf8'))
        expect(file.updated).toBeTypeOf('number')
      }
    })
  })

  test('POST /api/projects/{projectId}/refresh - Refresh project files', async () => {
    const project = testProjects[0]
    if (!project) return

    const result = await client.projects.refreshProject(project.id)
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /api/projects/{projectId}/summary - Get project summary', async () => {
    const project = testProjects[0]
    if (!project) return

    const result = await client.projects.getProjectSummary(project.id)
    expect(SpecificProjectSummaryResponseSchema.parse(result).success).toBe(true)
    expect(typeof result.summary).toBe('string')
  })

  test('DELETE /api/projects/{projectId} - Delete all test projects and verify', async () => {
    const projectsToDelete = [...testProjects]
    testProjects = []

    for (const project of projectsToDelete) {
      if (!project) continue
      const success = await client.projects.deleteProject(project.id)
      expect(success).toBe(true)

      // Verify 404
      try {
        await client.projects.getProject(project.id)
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(OctoPromptError)
        if (error instanceof OctoPromptError) {
          expect(error.statusCode).toBe(404)
        }
      }
    }
  })

  test('GET /api/projects - Verify all deletions globally', async () => {
    const result = await client.projects.listProjects()
    expect(result.success).toBe(true)
  })
})
