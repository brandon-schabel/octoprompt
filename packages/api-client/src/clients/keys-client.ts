import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { DataResponseSchema } from '../base-client'

// Import schemas from @promptliano/schemas
import {
  CreateProviderKeyBodySchema,
  UpdateProviderKeyBodySchema,
  ProviderKeyResponseSchema,
  ProviderKeyListResponseSchema,
  TestProviderRequestSchema,
  TestProviderApiResponseSchema,
  BatchTestProviderRequestSchema,
  BatchTestProviderApiResponseSchema,
  ProviderHealthStatusListResponseSchema,
  ValidateCustomProviderRequestSchema,
  ValidateCustomProviderResponseSchema,
  OperationSuccessResponseSchema,
  type CreateProviderKeyBody,
  type UpdateProviderKeyBody,
  type ProviderKey,
  type TestProviderRequest,
  type TestProviderResponse,
  type BatchTestProviderRequest,
  type BatchTestProviderResponse,
  type ProviderHealthStatus,
  type ValidateCustomProviderRequest,
  type ValidateCustomProviderResponse
} from '@promptliano/schemas'

/**
 * Keys API client for managing provider keys, testing providers, and health monitoring
 */
export class KeysClient extends BaseApiClient {
  /**
   * List all provider keys (censored for security)
   */
  async listKeys(): Promise<DataResponseSchema<ProviderKey[]>> {
    const result = await this.request('GET', '/keys', {
      responseSchema: ProviderKeyListResponseSchema
    })
    return result as DataResponseSchema<ProviderKey[]>
  }

  /**
   * Get a specific provider key by ID (returns key with secret)
   */
  async getKey(keyId: number): Promise<DataResponseSchema<ProviderKey>> {
    const result = await this.request('GET', `/keys/${keyId}`, {
      responseSchema: ProviderKeyResponseSchema
    })
    return result as DataResponseSchema<ProviderKey>
  }

  /**
   * Create a new provider key
   */
  async createKey(data: CreateProviderKeyBody): Promise<DataResponseSchema<ProviderKey>> {
    const validatedData = this.validateBody(CreateProviderKeyBodySchema, data)
    const result = await this.request('POST', '/keys', {
      body: validatedData,
      responseSchema: ProviderKeyResponseSchema
    })
    return result as DataResponseSchema<ProviderKey>
  }

  /**
   * Update an existing provider key
   */
  async updateKey(keyId: number, data: UpdateProviderKeyBody): Promise<DataResponseSchema<ProviderKey>> {
    const validatedData = this.validateBody(UpdateProviderKeyBodySchema, data)
    const result = await this.request('PATCH', `/keys/${keyId}`, {
      body: validatedData,
      responseSchema: ProviderKeyResponseSchema
    })
    return result as DataResponseSchema<ProviderKey>
  }

  /**
   * Delete a provider key
   */
  async deleteKey(keyId: number): Promise<boolean> {
    await this.request('DELETE', `/keys/${keyId}`, {
      responseSchema: OperationSuccessResponseSchema
    })
    return true
  }

  /**
   * Test a single provider connection
   */
  async testProvider(data: TestProviderRequest): Promise<DataResponseSchema<TestProviderResponse>> {
    const validatedData = this.validateBody(TestProviderRequestSchema, data)
    const result = await this.request('POST', '/providers/test', {
      body: validatedData,
      responseSchema: TestProviderApiResponseSchema
    })
    return result as DataResponseSchema<TestProviderResponse>
  }

  /**
   * Test multiple providers in batch
   */
  async batchTestProviders(data: BatchTestProviderRequest): Promise<DataResponseSchema<BatchTestProviderResponse>> {
    const validatedData = this.validateBody(BatchTestProviderRequestSchema, data)
    const result = await this.request('POST', '/providers/batch-test', {
      body: validatedData,
      responseSchema: BatchTestProviderApiResponseSchema,
      timeout: 30000 // Extended timeout for batch operations
    })
    return result as DataResponseSchema<BatchTestProviderResponse>
  }

  /**
   * Get health status for all providers
   */
  async getProvidersHealth(refresh?: boolean): Promise<DataResponseSchema<ProviderHealthStatus[]>> {
    const params = refresh ? { refresh: refresh.toString() } : undefined
    const result = await this.request('GET', '/providers/health', {
      params,
      responseSchema: ProviderHealthStatusListResponseSchema
    })
    return result as DataResponseSchema<ProviderHealthStatus[]>
  }

  /**
   * Update provider settings (generic settings update endpoint)
   */
  async updateProviderSettings(data: Record<string, any>): Promise<DataResponseSchema<any>> {
    const result = await this.request('PUT', '/providers/settings', {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result as DataResponseSchema<any>
  }

  /**
   * Validate if a custom provider is OpenAI-compatible
   */
  async validateCustomProvider(data: ValidateCustomProviderRequest): Promise<ValidateCustomProviderResponse> {
    const validatedData = this.validateBody(ValidateCustomProviderRequestSchema, data)
    const result = await this.request('POST', '/providers/validate', {
      body: validatedData,
      responseSchema: ValidateCustomProviderResponseSchema,
      timeout: 15000 // Extended timeout for validation
    })
    return result as ValidateCustomProviderResponse
  }
}