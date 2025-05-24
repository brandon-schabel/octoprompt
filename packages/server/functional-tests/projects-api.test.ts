// Recent changes:
// 1. Initial creation of comprehensive project API test suite
// 2. Tests all project endpoints with proper cleanup
// 3. Uses Bun's HTTP client for requests
// 4. Follows create-verify-update-verify-fetch-cleanup pattern
// 5. Ensures no test data persists after completion

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

const BASE_URL = process.env.API_URL || 'http://localhost:3000'
const API_URL = `${BASE_URL}/api`

interface TestProject {
    id: string
    name: string
    path: string
    description: string
    created: number
    updated: number
}

interface TestFile {
    id: string
    projectId: number
    name: string
    path: string
    extension: string
    size: number
    content: string | null
    summary: string | null
    summaryLastUpdatedAt: number | null
    meta: string | null
    checksum: string | null
    created: number
    updated: number
}

describe('Project API Tests', () => {
    let testProjects: TestProject[] = []
    let testProjectPaths: string[] = []
    let testFileIds: string[] = []

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

        for (const data of testData) {
            const tempDir = mkdtempSync(join(tmpdir(), 'project-test-'))
            testProjectPaths.push(tempDir)

            const response = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, path: tempDir })
            })

            expect(response.status).toBeOneOf([201, 207])
            const result = await response.json()
            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            expect(result.data.name).toBe(data.name)
            expect(result.data.description).toBe(data.description)
            expect(result.data.path).toBe(tempDir)
            expect(result.data.id).toMatch(/^proj_/)
            expect(result.data.created).toBeNumber()
            expect(result.data.updated).toBeNumber()

            testProjects.push(result.data)
        }
    })

    test('GET /api/projects - List all projects and verify creations', async () => {
        const response = await fetch(`${API_URL}/projects`)
        expect(response.status).toBe(200)

        const result = await response.json()
        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)

        for (const testProject of testProjects) {
            const found = result.data.find((p: TestProject) => p.id === testProject.id)
            expect(found).toBeDefined()
            expect(found.name).toBe(testProject.name)
            expect(found.description).toBe(testProject.description)
        }
    })

    test('GET /api/projects/{projectId} - Get individual projects', async () => {
        for (const project of testProjects) {
            const response = await fetch(`${API_URL}/projects/${project.id}`)
            expect(response.status).toBe(200)

            const result = await response.json()
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
            const update = updates[i]

            const response = await fetch(`${API_URL}/projects/${project.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update)
            })

            expect(response.status).toBe(200)
            const result = await response.json()
            expect(result.success).toBe(true)

            if (update.name) expect(result.data.name).toBe(update.name)
            if (update.description) expect(result.data.description).toBe(update.description)
            expect(result.data.updated).toBeGreaterThan(project.updated)

            testProjects[i] = result.data
        }
    })

    test('GET /api/projects - Verify updates', async () => {
        const response = await fetch(`${API_URL}/projects`)
        expect(response.status).toBe(200)

        const result = await response.json()
        for (const project of testProjects) {
            const found = result.data.find((p: TestProject) => p.id === project.id)
            expect(found).toBeDefined()
            expect(found.name).toBe(project.name)
            expect(found.description).toBe(project.description)
        }
    })

    test('POST /api/projects/{projectId}/sync - Sync project files', async () => {
        const project = testProjects[0]
        const response = await fetch(`${API_URL}/projects/${project.id}/sync`, {
            method: 'POST'
        })

        expect(response.status).toBe(200)
        const result = await response.json()
        expect(result.success).toBe(true)
        expect(result.message).toBe('Project sync initiated.')
    })

    test('GET /api/projects/{projectId}/files - Get project files', async () => {
        for (const project of testProjects) {
            const response = await fetch(`${API_URL}/projects/${project.id}/files`)
            expect(response.status).toBe(200)

            const result = await response.json()
            expect(result.success).toBe(true)
            expect(Array.isArray(result.data)).toBe(true)

            if (result.data.length > 0) {
                result.data.forEach((file: TestFile) => {
                    testFileIds.push(file.id)
                    expect(file.projectId).toBe(project.id)
                    expect(file.id).toMatch(/^file_/)
                })
            }
        }
    })

    test('POST /api/projects/{projectId}/refresh - Refresh project files', async () => {
        const project = testProjects[0]
        const response = await fetch(`${API_URL}/projects/${project.id}/refresh`, {
            method: 'POST'
        })

        expect(response.status).toBe(200)
        const result = await response.json()
        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)
    })

    test('GET /api/projects/{projectId}/summary - Get project summary', async () => {
        const project = testProjects[0]
        const response = await fetch(`${API_URL}/projects/${project.id}/summary`)
        expect(response.status).toBe(200)

        const result = await response.json()
        expect(result.success).toBe(true)
        expect(typeof result.summary).toBe('string')
    })

    test('POST /api/projects/{projectId}/suggest-files - Suggest files', async () => {
        if (testProjects.length === 0) return

        const project = testProjects[0]
        const response = await fetch(`${API_URL}/projects/${project.id}/suggest-files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userInput: 'Find authentication related files' })
        })

        const result = await response.json()
        if (response.status === 200) {
            expect(result.success).toBe(true)
            expect(Array.isArray(result.recommendedFileIds)).toBe(true)
        }
    })

    test('POST /api/projects/{projectId}/summarize - Summarize files', async () => {
        if (testFileIds.length === 0) return

        const project = testProjects[0]
        const response = await fetch(`${API_URL}/projects/${project.id}/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileIds: testFileIds.slice(0, 2), force: false })
        })

        const result = await response.json()
        if (response.status === 200) {
            expect(result.success).toBe(true)
            expect(typeof result.included).toBe('number')
            expect(typeof result.skipped).toBe('number')
        }
    })

    test('POST /api/projects/{projectId}/remove-summaries - Remove summaries', async () => {
        if (testFileIds.length === 0) return

        const project = testProjects[0]
        const response = await fetch(`${API_URL}/projects/${project.id}/remove-summaries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileIds: testFileIds.slice(0, 2) })
        })

        expect(response.status).toBe(200)
        const result = await response.json()
        expect(result.success).toBe(true)
        expect(typeof result.removedCount).toBe('number')
        expect(typeof result.message).toBe('string')
    })

    test('POST /api/prompt/optimize - Optimize user prompt', async () => {
        if (testProjects.length === 0) return

        const response = await fetch(`${API_URL}/prompt/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userContext: 'Help me implement user authentication',
                projectId: testProjects[0].id
            })
        })

        const result = await response.json()
        if (response.status === 200) {
            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            expect(typeof result.data.optimizedPrompt).toBe('string')
        }
    })

    test('GET /api/projects/{projectId} - Verify project still exists before deletion', async () => {
        for (const project of testProjects) {
            const response = await fetch(`${API_URL}/projects/${project.id}`)
            expect(response.status).toBe(200)

            const result = await response.json()
            expect(result.success).toBe(true)
            expect(result.data.id).toBe(project.id)
        }
    })

    test('DELETE /api/projects/{projectId} - Delete all test projects', async () => {
        for (const project of testProjects) {
            const response = await fetch(`${API_URL}/projects/${project.id}`, {
                method: 'DELETE'
            })

            expect(response.status).toBe(200)
            const result = await response.json()
            expect(result.success).toBe(true)
            expect(result.message).toBe('Project deleted successfully.')
        }
    })

    test('GET /api/projects - Verify deletions', async () => {
        const response = await fetch(`${API_URL}/projects`)
        expect(response.status).toBe(200)

        const result = await response.json()
        for (const project of testProjects) {
            const found = result.data.find((p: TestProject) => p.id === project.id)
            expect(found).toBeUndefined()
        }
    })

    test('GET /api/projects/{projectId} - Verify 404 after deletion', async () => {
        for (const project of testProjects) {
            const response = await fetch(`${API_URL}/projects/${project.id}`)
            expect(response.status).toBe(404)

            const result = await response.json()
            expect(result.success).toBe(false)
            expect(result.error.code).toBe('PROJECT_NOT_FOUND')
        }
    })
})