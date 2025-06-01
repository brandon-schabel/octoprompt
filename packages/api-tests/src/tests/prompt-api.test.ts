// Recent changes:
// 1. Initial creation of comprehensive prompt API test suite
// 2. Tests all prompt endpoints with proper cleanup
// 3. Uses Bun's HTTP client for requests
// 4. Follows create-verify-update-verify-delete pattern
// 5. Ensures no test data persists after completion

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { z } from 'zod'
import { apiFetch } from '../api-fetch'
import type { Endpoint } from '../types/endpoint'
import {
    PromptSchema,
    type Prompt,
    CreatePromptBodySchema,
    UpdatePromptBodySchema,
    PromptResponseSchema,
    PromptListResponseSchema
} from '../../../@octoprompt/schemas'
import { OperationSuccessResponseSchema } from '../../../@octoprompt/schemas'
import { TEST_API_URL } from './test-config'

const BASE_URL = TEST_API_URL
const API_URL = `${BASE_URL}/api`

describe('Prompt API Tests', () => {
    let testPrompts: Prompt[] = []
    let testProjectId: number | null = null

    beforeAll(async () => {
        console.log('Starting Prompt API Tests...')
        // Create a test project for prompt association tests
        const createProjectEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/projects`,
            options: { method: 'POST' }
        }
        const projectResult = await apiFetch(
            createProjectEndpoint,
            { name: 'Test Project for Prompts', path: '/test/prompts', description: 'Temporary project for testing prompts' },
            z.object({ success: z.literal(true), data: z.object({ id: z.number() }) })
        )
        testProjectId = projectResult.data.id
    })

    afterAll(async () => {
        console.log('Cleaning up prompt test data...')
        // Delete all test prompts
        for (const prompt of testPrompts) {
            try {
                await fetch(`${API_URL}/prompts/${prompt.id}`, { method: 'DELETE' })
            } catch (err) {
                console.error(`Failed to delete prompt ${prompt.id}:`, err)
            }
        }
        // Delete test project
        if (testProjectId) {
            try {
                await fetch(`${API_URL}/projects/${testProjectId}`, { method: 'DELETE' })
            } catch (err) {
                console.error(`Failed to delete test project ${testProjectId}:`, err)
            }
        }
    })

    test('POST /api/prompts - Create prompts', async () => {
        const testData = [
            { name: 'Test Prompt 1', content: 'You are a helpful assistant.' },
            { name: 'Test Prompt 2', content: 'You are an expert in TypeScript.', projectId: testProjectId },
            { name: 'Test Prompt 3', content: 'You are a code reviewer focusing on best practices.' }
        ]

        const createPromptEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/prompts`,
            options: { method: 'POST' }
        }

        for (const data of testData) {
            const result = await apiFetch(createPromptEndpoint, data, PromptResponseSchema)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            expect(result.data.name).toBe(data.name)
            expect(result.data.content).toBe(data.content)
            expect(result.data.id).toBeTypeOf('number')
            expect(result.data.created).toBeNumber()
            expect(result.data.updated).toBeNumber()

            testPrompts.push(result.data)
        }
    })

    test('GET /api/prompts - List all prompts and verify creations', async () => {
        const listPromptsEndpoint: Endpoint<never, any> = { url: `${API_URL}/prompts` }
        const result = await apiFetch(listPromptsEndpoint, undefined, PromptListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)

        for (const testPrompt of testPrompts) {
            const found = result.data.find((p: Prompt) => p.id === testPrompt.id)
            expect(found).toBeDefined()
            expect(found.name).toBe(testPrompt.name)
            expect(found.content).toBe(testPrompt.content)
        }
    })

    test('GET /api/prompts/{promptId} - Get individual prompts', async () => {
        for (const prompt of testPrompts) {
            const getPromptEndpoint: Endpoint<never, any> = { url: `${API_URL}/prompts/${prompt.id}` }
            const result = await apiFetch(getPromptEndpoint, undefined, PromptResponseSchema)

            expect(result.success).toBe(true)
            expect(result.data.id).toBe(prompt.id)
            expect(result.data.name).toBe(prompt.name)
            expect(result.data.content).toBe(prompt.content)
        }
    })

    test('PATCH /api/prompts/{promptId} - Update prompts', async () => {
        const updates = [
            { name: 'Updated Prompt 1', content: 'You are an updated helpful assistant.' },
            { name: 'Updated Prompt 2' },
            { content: 'Only updated content' }
        ]

        for (let i = 0; i < testPrompts.length; i++) {
            const prompt = testPrompts[i]
            if (!prompt) continue
            const update = updates[i]
            if (!update) continue

            const updatePromptEndpoint: Endpoint<any, any> = {
                url: `${API_URL}/prompts/${prompt.id}`,
                options: { method: 'PATCH' }
            }

            const result = await apiFetch(updatePromptEndpoint, update, PromptResponseSchema)

            expect(result.success).toBe(true)
            if (update.name) expect(result.data.name).toBe(update.name)
            if (update.content) expect(result.data.content).toBe(update.content)
            expect(result.data.updated).toBeGreaterThan(prompt.updated)

            testPrompts[i] = result.data
        }
    })

    test('GET /api/prompts - Verify updates', async () => {
        const listPromptsEndpoint: Endpoint<never, any> = { url: `${API_URL}/prompts` }
        const result = await apiFetch(listPromptsEndpoint, undefined, PromptListResponseSchema)

        for (const prompt of testPrompts) {
            const found = result.data.find((p: Prompt) => p.id === prompt.id)
            expect(found).toBeDefined()
            expect(found.name).toBe(prompt.name)
            expect(found.content).toBe(prompt.content)
        }
    })

    test('GET /api/projects/{projectId}/prompts - List prompts by project', async () => {
        if (!testProjectId) return

        const listProjectPromptsEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/projects/${testProjectId}/prompts`
        }
        const result = await apiFetch(listProjectPromptsEndpoint, undefined, PromptListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)

        // Should contain the prompt created with projectId
        const promptWithProject = testPrompts.find(p => p.name === 'Test Prompt 2')
        if (promptWithProject) {
            const found = result.data.find((p: Prompt) => p.id === promptWithProject.id)
            expect(found).toBeDefined()
        }
    })

    test('POST /api/projects/{projectId}/prompts/{promptId} - Add prompt to project', async () => {
        if (!testProjectId) return

        // Use a prompt that wasn't created with a projectId
        const promptToAdd = testPrompts.find(p => p.name === 'Test Prompt 1')
        if (!promptToAdd) return

        const addPromptToProjectEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/projects/${testProjectId}/prompts/${promptToAdd.id}`,
            options: { method: 'POST' }
        }
        const result = await apiFetch(addPromptToProjectEndpoint, undefined, OperationSuccessResponseSchema)

        expect(result.success).toBe(true)
        expect(result.message).toBe('Prompt linked to project.')
    })

    test('GET /api/projects/{projectId}/prompts - Verify prompt was added to project', async () => {
        if (!testProjectId) return

        const listProjectPromptsEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/projects/${testProjectId}/prompts`
        }
        const result = await apiFetch(listProjectPromptsEndpoint, undefined, PromptListResponseSchema)

        const promptToCheck = testPrompts.find(p => p.name === 'Test Prompt 1')
        if (promptToCheck) {
            const found = result.data.find((p: Prompt) => p.id === promptToCheck.id)
            expect(found).toBeDefined()
        }
    })

    test('DELETE /api/projects/{projectId}/prompts/{promptId} - Remove prompt from project', async () => {
        if (!testProjectId) return

        const promptToRemove = testPrompts.find(p => p.name === 'Test Prompt 1')
        if (!promptToRemove) return

        const removePromptFromProjectEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/projects/${testProjectId}/prompts/${promptToRemove.id}`,
            options: { method: 'DELETE' }
        }
        const result = await apiFetch(removePromptFromProjectEndpoint, undefined, OperationSuccessResponseSchema)

        expect(result.success).toBe(true)
        expect(result.message).toBe('Prompt unlinked from project.')
    })

    test('GET /api/projects/{projectId}/prompts - Verify prompt was removed from project', async () => {
        if (!testProjectId) return

        const listProjectPromptsEndpoint: Endpoint<never, any> = {
            url: `${API_URL}/projects/${testProjectId}/prompts`
        }
        const result = await apiFetch(listProjectPromptsEndpoint, undefined, PromptListResponseSchema)

        const promptToCheck = testPrompts.find(p => p.name === 'Test Prompt 1')
        if (promptToCheck) {
            const found = result.data.find((p: Prompt) => p.id === promptToCheck.id)
            expect(found).toBeUndefined()
        }
    })

    test('DELETE /api/prompts/{promptId} - Delete all test prompts', async () => {
        for (const prompt of testPrompts) {
            const deletePromptEndpoint: Endpoint<never, any> = {
                url: `${API_URL}/prompts/${prompt.id}`,
                options: { method: 'DELETE' }
            }
            const result = await apiFetch(deletePromptEndpoint, undefined, OperationSuccessResponseSchema)

            expect(result.success).toBe(true)
            expect(result.message).toBe('Prompt deleted successfully.')
        }
    })

    test('GET /api/prompts - Verify deletions', async () => {
        const listPromptsEndpoint: Endpoint<never, any> = { url: `${API_URL}/prompts` }
        const result = await apiFetch(listPromptsEndpoint, undefined, PromptListResponseSchema)

        for (const prompt of testPrompts) {
            const found = result.data.find((p: Prompt) => p.id === prompt.id)
            expect(found).toBeUndefined()
        }
    })

    test('GET /api/prompts/{promptId} - Verify 404 after deletion', async () => {
        for (const prompt of testPrompts) {
            const response = await fetch(`${API_URL}/prompts/${prompt.id}`)
            expect(response.status).toBe(404)

            const result = await response.json() as any
            expect(result.success).toBe(false)
            expect(result.error.code).toBe('PROMPT_NOT_FOUND')
        }
    })
})