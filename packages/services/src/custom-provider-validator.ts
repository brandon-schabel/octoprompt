import { ApiError } from '@promptliano/shared'
import { logger } from './utils/logger'
import type { 
  ValidateCustomProviderRequest, 
  ValidateCustomProviderResponse,
  CustomProviderFeatures,
  ProviderModel
} from '@promptliano/schemas'
import { sanitizeCustomHeaders, mergeHeaders } from './utils/header-sanitizer'
import { validateProviderURL, sanitizeProviderURL } from './utils/ssrf-protection'

/**
 * Validates if a given URL is OpenAI API compatible
 * by testing various endpoints and detecting features
 */
export async function validateCustomProvider(
  request: ValidateCustomProviderRequest
): Promise<ValidateCustomProviderResponse['data']> {
  const { baseUrl, apiKey, customHeaders } = request
  
  // Validate URL for SSRF attacks (allow localhost in development)
  const allowLocalhost = process.env.NODE_ENV === 'development' || process.env.DEV === 'true'
  const urlValidation = await validateProviderURL(baseUrl, allowLocalhost)
  if (!urlValidation.valid) {
    throw new ApiError(
      400,
      urlValidation.error || 'Invalid provider URL',
      'INVALID_PROVIDER_URL'
    )
  }
  
  // Log warnings if any
  if (urlValidation.warnings.length > 0) {
    logger.warn('Provider URL validation warnings', {
      url: baseUrl,
      warnings: urlValidation.warnings
    })
  }
  
  // Sanitize URL
  const sanitizedUrl = sanitizeProviderURL(baseUrl)
  
  // Normalize URL to ensure it ends with /v1
  const normalizedUrl = sanitizedUrl.endsWith('/v1') 
    ? sanitizedUrl 
    : `${sanitizedUrl.replace(/\/$/, '')}/v1`
  
  try {
    // Test the /v1/models endpoint first
    const modelsResponse = await testModelsEndpoint(normalizedUrl, apiKey, customHeaders)
    
    if (!modelsResponse.success) {
      return {
        compatible: false,
        models: [],
        features: {
          streaming: false,
          functionCalling: false,
          structuredOutput: false,
          vision: false,
          embeddings: false
        },
        baseUrl: normalizedUrl
      }
    }
    
    // Extract models from response
    const models = extractModels(modelsResponse.data)
    
    // Detect features based on available models and endpoints
    const features = await detectProviderFeatures(normalizedUrl, apiKey, models, customHeaders)
    
    return {
      compatible: true,
      models,
      features,
      baseUrl: normalizedUrl
    }
  } catch (error) {
    console.error('Custom provider validation error:', error)
    throw new ApiError(
      400,
      `Failed to validate custom provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'CUSTOM_PROVIDER_VALIDATION_FAILED'
    )
  }
}

/**
 * Test the /v1/models endpoint for OpenAI compatibility
 */
async function testModelsEndpoint(
  baseUrl: string,
  apiKey: string,
  customHeaders?: Record<string, string>
): Promise<{ success: boolean; data?: any }> {
  try {
    // Prepare base headers
    const baseHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
    
    // Merge with sanitized custom headers
    const headers = mergeHeaders(baseHeaders, customHeaders)
    
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })
    
    if (!response.ok) {
      console.error(`Models endpoint returned ${response.status}: ${response.statusText}`)
      return { success: false }
    }
    
    const data = await response.json()
    
    // Check if response has the expected OpenAI structure
    if (!data.data || !Array.isArray(data.data)) {
      console.error('Models response does not match OpenAI structure')
      return { success: false }
    }
    
    return { success: true, data }
  } catch (error) {
    console.error('Failed to test models endpoint:', error)
    return { success: false }
  }
}

/**
 * Extract model information from the API response
 */
function extractModels(data: any): ProviderModel[] {
  if (!data?.data || !Array.isArray(data.data)) {
    return []
  }
  
  return data.data.map((model: any) => ({
    id: model.id || model.name || 'unknown',
    name: model.name || model.id || 'Unknown Model',
    description: model.description || `Model: ${model.id || model.name || 'unknown'}`
  }))
}

/**
 * Detect provider features by testing various capabilities
 */
async function detectProviderFeatures(
  baseUrl: string,
  apiKey: string,
  models: ProviderModel[],
  customHeaders?: Record<string, string>
): Promise<CustomProviderFeatures> {
  const features: CustomProviderFeatures = {
    streaming: false,
    functionCalling: false,
    structuredOutput: false,
    vision: false,
    embeddings: false
  }
  
  // Test streaming capability with a simple completion
  features.streaming = await testStreamingCapability(baseUrl, apiKey, models[0]?.id, customHeaders)
  
  // Test structured output (JSON mode)
  features.structuredOutput = await testStructuredOutput(baseUrl, apiKey, models[0]?.id, customHeaders)
  
  // Check for embedding models (usually contain 'embedding' in the name)
  features.embeddings = models.some(m => 
    m.id.toLowerCase().includes('embed') || 
    m.name.toLowerCase().includes('embed')
  )
  
  // Check for vision models (usually contain 'vision' or 'gpt-4-vision' in the name)
  features.vision = models.some(m => 
    m.id.toLowerCase().includes('vision') || 
    m.id.toLowerCase().includes('gpt-4-turbo')
  )
  
  // Test function calling (tools) capability
  features.functionCalling = await testFunctionCalling(baseUrl, apiKey, models[0]?.id, customHeaders)
  
  return features
}

/**
 * Test if the provider supports streaming responses
 */
async function testStreamingCapability(
  baseUrl: string,
  apiKey: string,
  modelId?: string,
  customHeaders?: Record<string, string>
): Promise<boolean> {
  if (!modelId) return false
  
  try {
    // Prepare base headers
    const baseHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
    
    // Merge with sanitized custom headers
    const headers = mergeHeaders(baseHeaders, customHeaders)
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
        max_tokens: 5
      })
    })
    
    // If we get a successful response with streaming headers, it likely supports streaming
    return response.ok && (response.headers.get('content-type')?.includes('text/event-stream') ?? false)
  } catch {
    return false
  }
}

/**
 * Test if the provider supports structured JSON output
 */
async function testStructuredOutput(
  baseUrl: string,
  apiKey: string,
  modelId?: string,
  customHeaders?: Record<string, string>
): Promise<boolean> {
  if (!modelId) return false
  
  try {
    // Prepare base headers
    const baseHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
    
    // Merge with sanitized custom headers
    const headers = mergeHeaders(baseHeaders, customHeaders)
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Return a JSON object with a name field' }],
        response_format: { type: 'json_object' },
        max_tokens: 50
      })
    })
    
    // If the request succeeds, the provider likely supports JSON mode
    // Some providers may return 400 if they don't support response_format
    return response.ok
  } catch {
    return false
  }
}

/**
 * Test if the provider supports function calling (tools)
 */
async function testFunctionCalling(
  baseUrl: string,
  apiKey: string,
  modelId?: string,
  customHeaders?: Record<string, string>
): Promise<boolean> {
  if (!modelId) return false
  
  try {
    // Prepare base headers
    const baseHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
    
    // Merge with sanitized custom headers
    const headers = mergeHeaders(baseHeaders, customHeaders)
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get the weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            }
          }
        ],
        max_tokens: 50
      })
    })
    
    // If the request succeeds, the provider likely supports function calling
    return response.ok
  } catch {
    return false
  }
}

/**
 * Pure function to validate URL format
 */
export function isValidOpenAIUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    // Should ideally end with /v1 or be ready to append it
    return true
  } catch {
    return false
  }
}

/**
 * Pure function to normalize headers
 */
export function normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers) return {}
  
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    // Normalize header names to proper case
    const normalizedKey = key
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('-')
    normalized[normalizedKey] = value
  }
  return normalized
}

/**
 * Pure function to extract model capabilities from model name
 */
export function extractModelCapabilities(modelName: string): {
  likelySupportsVision: boolean
  likelySupportsTools: boolean
  likelySupportsJson: boolean
} {
  const lower = modelName.toLowerCase()
  
  return {
    likelySupportsVision: lower.includes('vision') || lower.includes('gpt-4-turbo'),
    likelySupportsTools: lower.includes('gpt') || lower.includes('claude') || lower.includes('gemini'),
    likelySupportsJson: !lower.includes('davinci') && !lower.includes('curie') && !lower.includes('babbage')
  }
}