// Recent changes:
// 1. Initial creation of comprehensive project API test suite
// 2. Tests all project endpoints with proper cleanup
// 3. Uses Bun's HTTP client for requests
// 4. Follows create-verify-update-verify-fetch-cleanup pattern
// 5. Ensures no test data persists after completion
// 6. Added file operation tests (update, bulk create, bulk update)

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { z } from 'zod'
import { apiFetch } from '../api-fetch'
import type { Endpoint } from '../types/endpoint'
import {
    ProjectSchema, // Will be used from shared
    ProjectFileSchema, // Will be used from shared
    type Project, // Will be used from shared
    type ProjectFile, // Will be used from shared
    CreateProjectBodySchema, // For request body typing if needed
    UpdateProjectBodySchema, // For request body typing if needed
    ProjectResponseSchema,
    ProjectListResponseSchema,
    FileListResponseSchema,
    ProjectSummaryResponseSchema
} from '../../../@octoprompt/schemas'
import { TEST_API_URL } from './test-config'


const BASE_URL = TEST_API_URL
const API_URL = `${BASE_URL}/api`

// Local Zod Schemas - keep generic ones or those not in shared
// ProjectSchema and FileSchema removed

const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.literal(true),
        data: dataSchema
    })

const SuccessMessageResponseSchema = z.object({
    success: z.literal(true),
    message: z.string()
})

// File operation response schemas
const FileResponseSchema = z.object({
    success: z.literal(true),
    data: ProjectFileSchema
})

const BulkFilesResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ProjectFileSchema)
})

// This is more generic than ProjectListResponseSchema or FileListResponseSchema if pagination is expected
const PaginatedSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.literal(true),
        data: z.array(dataSchema),
        pagination: z.object({
            page: z.number(),
            limit: z.number(),
            totalItems: z.number(),
            totalPages: z.number()
        }).optional()
    })


describe('Project API Tests', () => {
    let testProjects: Project[] = [] // Use imported Project type
    let testProjectPaths: string[] = []
    let testFileIds: number[] = [] // Changed to number[] to align with shared ProjectFileSchema
    let createdFileIds: number[] = [] // Track files created during tests

    beforeAll(() => {
        console.log('Starting Project API Tests...')
    })

    afterAll(async () => {
        console.log('Cleaning up test data...')
        for (const project of testProjects) {
            try {
                await fetch(`${API_URL}/projects/${project.id}`, { method: 'DELETE' })
            } catch (err) {
                console.error(`Failed to delete project ${project.id}:`, err)
            }
        }
        for (const path of testProjectPaths) {
            try {
                rmSync(path, { recursive: true, force: true })
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

        const createProjectEndpoint: Endpoint<Partial<Project>, any> = {
            url: `${API_URL}/projects`,
            options: { method: 'POST' }
        }

        for (const data of testData) {
            const tempDir = mkdtempSync(join(tmpdir(), 'project-test-'))
            testProjectPaths.push(tempDir)
            writeFileSync(join(tempDir, 'sample-file.ts'), 'console.log("hello world");')

            // Type issue with TestProject vs ProjectSchema, using 'as any' for now
            const result = await apiFetch(
                createProjectEndpoint,
                { ...data, path: tempDir } as any,
                ProjectResponseSchema
            )

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
        const listProjectsEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects` }
        const result = await apiFetch(listProjectsEndpoint, undefined, ProjectListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)

        for (const testProject of testProjects) {
            const found = result.data.find((p: any) => p.id === testProject.id) // Using any for p type
            expect(found).toBeDefined()
            expect(found.name).toBe(testProject.name)
            expect(found.description).toBe(testProject.description)
        }
    })

    test('GET /api/projects/{projectId} - Get individual projects', async () => {
        for (const project of testProjects) {
            const getProjectEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects/${project.id}` }
            const result = await apiFetch(getProjectEndpoint, undefined, ProjectResponseSchema)

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

            const updateProjectEndpoint: Endpoint<Partial<Project>, any> = {
                url: `${API_URL}/projects/${project.id}`,
                options: { method: 'PATCH' }
            }

            const result = await apiFetch(
                updateProjectEndpoint,
                update as any,
                ProjectResponseSchema
            )

            expect(result.success).toBe(true)

            if (update.name) expect(result.data.name).toBe(update.name)
            if (update.description) expect(result.data.description).toBe(update.description)
            expect(result.data.updated).toBeGreaterThan(project.updated)

            testProjects[i] = result.data
        }
    })

    test('GET /api/projects - Verify updates', async () => {
        const listProjectsEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects` }
        const result = await apiFetch(listProjectsEndpoint, undefined, ProjectListResponseSchema)

        for (const project of testProjects) {
            const found = result.data.find((p: any) => p.id === project.id)
            expect(found).toBeDefined()
            expect(found.name).toBe(project.name)
            expect(found.description).toBe(project.description)
        }
    })

    test('POST /api/projects/{projectId}/sync - Sync project files', async () => {
        const project = testProjects[0]
        if (!project) return
        const syncProjectEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/projects/${project.id}/sync`,
            options: { method: 'POST' }
        }
        const result = await apiFetch(syncProjectEndpoint, undefined, SuccessMessageResponseSchema)

        expect(result.success).toBe(true)
        expect(result.message).toBe('Project sync initiated.')
    })

    test('GET /api/projects/{projectId}/files - Get project files', async () => {
        for (const project of testProjects) {
            if (!project) continue
            const getFilesEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects/${project.id}/files` }
            const result = await apiFetch(getFilesEndpoint, undefined, FileListResponseSchema)

            expect(result.success).toBe(true)
            expect(Array.isArray(result.data)).toBe(true)

            if (result.data.length > 0) {
                result.data.forEach((file: ProjectFile) => {
                    testFileIds.push(file.id)
                    expect(file.projectId).toBe(project.id)
                    expect(file.id).toBeTypeOf('number')
                })
            }
        }
    })

    test('POST /api/projects/{projectId}/files/bulk - Bulk create files', async () => {
        const project = testProjects[0]
        if (!project) return

        const testFiles = [
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

        const bulkCreateEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/projects/${project.id}/files/bulk`,
            options: { method: 'POST' }
        }

        const result = await apiFetch(
            bulkCreateEndpoint,
            { files: testFiles },
            BulkFilesResponseSchema
        )

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data.length).toBe(testFiles.length)

        // Clear any existing created file IDs and use the actual returned IDs
        createdFileIds.length = 0
        result.data.forEach((file: ProjectFile, index: number) => {
            createdFileIds.push(file.id)
            expect(file.projectId).toBe(project.id)
            const testFile = testFiles[index]
            expect(testFile).toBeDefined()
            expect(file.name).toBe(testFile!.name)
            expect(file.content).toBe(testFile!.content)
            expect(file.extension).toBe(testFile!.extension)
            expect(file.size).toBe(testFile!.size)
        })
    })

    test('PUT /api/projects/{projectId}/files/{fileId} - Update single file content', async () => {
        if (createdFileIds.length === 0) {
            console.warn('Skipping single file update test: no created files')
            return
        }
        const project = testProjects[0]
        if (!project) return

        const fileId = createdFileIds[0]!
        const newContent = 'console.log("updated content");'

        console.log('Single file update test - using file ID:', fileId)

        const updateFileEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/projects/${project.id}/files/${fileId}`,
            options: { method: 'PUT' }
        }

        const result = await apiFetch(
            updateFileEndpoint,
            { content: newContent },
            FileResponseSchema
        )

        expect(result.success).toBe(true)
        expect(result.data.id).toBe(fileId)
        expect(result.data.content).toBe(newContent)
        expect(result.data.size).toBe(Buffer.byteLength(newContent, 'utf8'))
        expect(result.data.updated).toBeTypeOf('number')
    })

    test('PUT /api/projects/{projectId}/files/bulk - Bulk update files content', async () => {
        if (createdFileIds.length < 2) {
            console.warn('Skipping bulk update test: insufficient created files')
            return
        }
        const project = testProjects[0]
        if (!project) return

        const updates = [
            {
                fileId: createdFileIds[0]!,
                content: 'console.log("bulk updated file 1");'
            },
            {
                fileId: createdFileIds[1]!,
                content: 'const message: string = "bulk updated file 2";'
            }
        ]

        const bulkUpdateEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/projects/${project.id}/files/bulk`,
            options: { method: 'PUT' }
        }

        console.log('Bulk update test - using file IDs:', createdFileIds)
        console.log('Bulk update test - updates:', JSON.stringify(updates, null, 2))

        try {
            const result = await apiFetch(
                bulkUpdateEndpoint,
                { updates },
                BulkFilesResponseSchema
            )

            expect(result.success).toBe(true)
            expect(Array.isArray(result.data)).toBe(true)
            expect(result.data.length).toBe(updates.length)

            result.data.forEach((file: ProjectFile, index: number) => {
                const update = updates[index]
                expect(update).toBeDefined()
                expect(file.id).toBe(update!.fileId)
                expect(file.content).toBe(update!.content)
                expect(file.size).toBe(Buffer.byteLength(update!.content, 'utf8'))
                expect(file.updated).toBeTypeOf('number')
            })
        } catch (error) {
            console.error('Bulk update test failed with error:', error)
            console.error('Updates data:', JSON.stringify(updates, null, 2))
            console.error('Created file IDs:', createdFileIds)
            throw error
        }
    })

    test('POST /api/projects/{projectId}/refresh - Refresh project files', async () => {
        const project = testProjects[0]
        if (!project) return

        const refreshFilesEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/projects/${project.id}/refresh`,
            options: { method: 'POST' }
        }
        const result = await apiFetch(refreshFilesEndpoint, undefined, FileListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)
    })

    test('GET /api/projects/{projectId}/summary - Get project summary', async () => {
        const project = testProjects[0]
        if (!project) return

        const getSummaryEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects/${project.id}/summary` }
        const result = await apiFetch(getSummaryEndpoint, undefined, ProjectSummaryResponseSchema)

        expect(result.success).toBe(true)
        expect(typeof result.summary).toBe('string')
    })

    // test('POST /api/projects/{projectId}/suggest-files - Suggest files', async () => {
    //     if (testProjects.length === 0) return
    //     const project = testProjects[0]
    //     if (!project) return

    //     const suggestFilesEndpoint: Endpoint<any, any> = {
    //         url: `${API_URL}/projects/${project.id}/suggest-files`,
    //         options: { method: 'POST' }
    //     }
    //     const result = await apiFetch(
    //         suggestFilesEndpoint,
    //         { userInput: 'Find authentication related files' },
    //         z.object({ success: z.literal(true), recommendedFileIds: z.array(z.number()) })
    //     )

    //     expect(result.success).toBe(true)
    //     expect(Array.isArray(result.recommendedFileIds)).toBe(true)
    // })

    test('POST /api/projects/{projectId}/summarize - Summarize files', async () => {
        if (testFileIds.length === 0) return
        const project = testProjects[0]
        if (!project) return

        const summarizeFilesEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/projects/${project.id}/summarize`,
            options: { method: 'POST' }
        }
        const result = await apiFetch(
            summarizeFilesEndpoint,
            { fileIds: testFileIds.slice(0, 2), force: false },
            z.object({ success: z.literal(true), included: z.number(), skipped: z.number() })
        )

        expect(result.success).toBe(true)
        expect(typeof result.included).toBe('number')
        expect(typeof result.skipped).toBe('number')
    })

    test('POST /api/projects/{projectId}/remove-summaries - Remove summaries', async () => {
        if (testFileIds.length === 0) return
        const project = testProjects[0]
        if (!project) return

        const removeSummariesEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/projects/${project.id}/remove-summaries`,
            options: { method: 'POST' }
        }
        const result = await apiFetch(
            removeSummariesEndpoint,
            { fileIds: testFileIds.slice(0, 2) },
            SuccessMessageResponseSchema.extend({ removedCount: z.number() })
        )

        expect(result.success).toBe(true)
        expect(typeof result.removedCount).toBe('number')
        expect(typeof result.message).toBe('string')
    })

    // test('POST /api/prompt/optimize - Optimize user prompt', async () => {
    //     if (testProjects.length === 0) return
    //     const project = testProjects[0]
    //     if (!project) return

    //     const optimizePromptEndpoint: Endpoint<any, any> = {
    //         url: `${API_URL}/prompt/optimize`,
    //         options: { method: 'POST' }
    //     }
    //     const result = await apiFetch(
    //         optimizePromptEndpoint,
    //         { userContext: 'Help me implement user authentication', projectId: project.id },
    //         SuccessResponseSchema(z.object({ optimizedPrompt: z.string() }))
    //     )

    //     expect(result.success).toBe(true)
    //     expect(result.data).toBeDefined()
    //     expect(typeof result.data.optimizedPrompt).toBe('string')
    // })

    test('GET /api/projects/{projectId} - Verify project still exists before deletion', async () => {
        for (const project of testProjects) {
            if (!project) continue
            const getProjectEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects/${project.id}` }
            const result = await apiFetch(getProjectEndpoint, undefined, ProjectResponseSchema)

            expect(result.success).toBe(true)
            expect(result.data.id).toBe(project.id)
        }
    })

    test('DELETE /api/projects/{projectId} - Delete all test projects', async () => {
        for (const project of testProjects) {
            if (!project) continue
            const deleteProjectEndpoint: Endpoint<never, any> = {
                url: `${API_URL}/projects/${project.id}`,
                options: { method: 'DELETE' }
            }
            const result = await apiFetch(deleteProjectEndpoint, undefined, SuccessMessageResponseSchema)

            expect(result.success).toBe(true)
            expect(result.message).toBe('Project deleted successfully.')
        }
    })

    test('GET /api/projects - Verify deletions', async () => {
        const listProjectsEndpoint: Endpoint<never, any> = { url: `${API_URL}/projects` }
        const result = await apiFetch(listProjectsEndpoint, undefined, ProjectListResponseSchema)

        for (const project of testProjects) {
            const found = result.data.find((p: any) => p.id === project.id)
            expect(found).toBeUndefined()
        }
    })

    test('GET /api/projects/{projectId} - Verify 404 after deletion', async () => {
        for (const project of testProjects) {
            if (!project) continue
            // For 404, we expect an error, so we don't use apiFetch's schema validation
            // or we define a specific error schema if the API guarantees a format
            const response = await fetch(`${API_URL}/projects/${project.id}`)
            expect(response.status).toBe(404)

            const result = await response.json() as any // Cast to any for error structure
            expect(result.success).toBe(false)
            expect(result.error.code).toBe('PROJECT_NOT_FOUND')
        }
    })
})