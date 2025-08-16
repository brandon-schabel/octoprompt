import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  CreatePromptBody,
  UpdatePromptBody,
  Prompt,
  DataResponseSchema
} from '../types'

// Import response schemas
import {
  PromptResponseSchema as PromptResponseSchemaZ,
  PromptListResponseSchema as PromptListResponseSchemaZ,
  SuggestPromptsResponseSchema as SuggestPromptsResponseSchemaZ,
  OptimizePromptResponseSchema as OptimizePromptResponseSchemaZ,
  CreatePromptBodySchema,
  UpdatePromptBodySchema,
  SuggestPromptsRequestSchema,
  OptimizeUserInputRequestSchema,
  OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ
} from '@promptliano/schemas'

/**
 * Prompt API client for managing prompts and prompt-project associations
 */
export class PromptClient extends BaseApiClient {
  /**
   * List all available prompts
   */
  async listPrompts(): Promise<DataResponseSchema<Prompt[]>> {
    const result = await this.request('GET', '/prompts', {
      responseSchema: PromptListResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt[]>
  }

  /**
   * Get prompts associated with a specific project
   */
  async getProjectPrompts(projectId: number): Promise<DataResponseSchema<Prompt[]>> {
    const result = await this.request('GET', `/projects/${projectId}/prompts`, {
      responseSchema: PromptListResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt[]>
  }

  /**
   * Get a specific prompt by ID
   */
  async getPrompt(promptId: number): Promise<DataResponseSchema<Prompt>> {
    const result = await this.request('GET', `/prompts/${promptId}`, {
      responseSchema: PromptResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt>
  }

  /**
   * Create a new prompt
   */
  async createPrompt(data: CreatePromptBody): Promise<DataResponseSchema<Prompt>> {
    const validatedData = this.validateBody(CreatePromptBodySchema, data)
    const result = await this.request('POST', '/prompts', {
      body: validatedData,
      responseSchema: PromptResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt>
  }

  /**
   * Update an existing prompt
   */
  async updatePrompt(promptId: number, data: UpdatePromptBody): Promise<DataResponseSchema<Prompt>> {
    const validatedData = this.validateBody(UpdatePromptBodySchema, data)
    const result = await this.request('PATCH', `/prompts/${promptId}`, {
      body: validatedData,
      responseSchema: PromptResponseSchemaZ
    })
    return result as DataResponseSchema<Prompt>
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(promptId: number): Promise<boolean> {
    await this.request('DELETE', `/prompts/${promptId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  /**
   * Associate a prompt with a project
   */
  async addPromptToProject(projectId: number, promptId: number): Promise<boolean> {
    await this.request('POST', `/projects/${projectId}/prompts/${promptId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  /**
   * Remove prompt association from a project
   */
  async removePromptFromProject(projectId: number, promptId: number): Promise<boolean> {
    await this.request('DELETE', `/projects/${projectId}/prompts/${promptId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  /**
   * Get AI-suggested prompts based on user input
   */
  async suggestPrompts(projectId: number, params: { userInput: string; limit?: number }): Promise<DataResponseSchema<{ prompts: Prompt[] }>> {
    const validatedData = this.validateBody(SuggestPromptsRequestSchema, params)
    const result = await this.request('POST', `/projects/${projectId}/suggest-prompts`, {
      body: validatedData,
      responseSchema: SuggestPromptsResponseSchemaZ
    })
    return result as DataResponseSchema<{ prompts: Prompt[] }>
  }

  /**
   * Optimize user input using AI
   */
  async optimizeUserInput(projectId: number, data: { userContext: string }): Promise<DataResponseSchema<{ optimizedPrompt: string }>> {
    const validatedData = this.validateBody(OptimizeUserInputRequestSchema, {
      projectId,
      userContext: data.userContext
    })
    const result = await this.request('POST', `/ai/optimize-user-input`, {
      body: validatedData,
      responseSchema: OptimizePromptResponseSchemaZ
    })
    return result as DataResponseSchema<{ optimizedPrompt: string }>
  }
}