import type { APIProviders } from '@octoprompt/schemas'
import {
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
  TOGETHER_BASE_URL,
  LMSTUDIO_BASE_URL,
  OLLAMA_BASE_URL,
  OPENROUTER_BASE_URL,
  OPENAI_BASE_URL,
  XAI_BASE_URL
} from './provider-defaults'

export type UnifiedModel = {
  id: string
  name: string
  description: string
}

export type OpenRouterStreamResponse = {
  choices: {
    delta?: { content?: string }
    content?: string
  }[]
}

export type OpenRouterModelContext = {
  description: string
  tokens: number
  mode?: string
  formats?: string[]
}

export type OpenRouterModelPricing = {
  prompt: string
  completion: string
  rateLimit?: number
}

export type OpenRouterModel = {
  id: string
  name: string
  description: string
  context: OpenRouterModelContext
  pricing: OpenRouterModelPricing
  top_provider?: string
  architecture?: string
  per_request_limits?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export type OpenRouterModelsResponse = {
  data: OpenRouterModel[]
}

/** Gemini API model types */
export type GeminiAPIModel = {
  name: string
  baseModelId: string
  version: string
  displayName: string
  description: string
  inputTokenLimit: number
  outputTokenLimit: number
  supportedGenerationMethods: string[]
  temperature: number
  maxTemperature: number
  topP: number
  topK: number
}

export type ListModelsResponse = {
  models: GeminiAPIModel[]
}

export type AnthropicModel = {
  type: string
  id: string
  display_name: string
  created: string
}

export type AnthropicModelsResponse = {
  data: AnthropicModel[]
  has_more: boolean
  first_id: number | null
  last_id: number | null
}

export type OpenAIModelObject = {
  id: string
  object: string
  created: number
  owned_by: string
}

export type OpenAIModelsListResponse = {
  object: string
  data: OpenAIModelObject[]
}

export type TogetherModelConfig = {
  chat_template: string
  stop: string[]
  bos_token: string
  eos_token: string
}

export type TogetherModelPricing = {
  hourly: number
  input: number
  output: number
  base: number
  finetune: number
}

export type TogetherModel = {
  id: string
  object: string
  created: number
  type: string
  running: boolean
  display_name: string
  organization: string
  link: string
  license: string
  context_length: number
  config: TogetherModelConfig
  pricing: TogetherModelPricing
}

export type XAIModel = {
  id: string
  // created at unix timestamp
  created: number
  object: string
  owned_by: string
}

export type OllamaModel = {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details: {
    parent_model: string
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}

export interface ProviderKeysConfig {
  openaiKey?: string
  anthropicKey?: string
  googleGeminiKey?: string
  groqKey?: string
  togetherKey?: string
  xaiKey?: string
  openrouterKey?: string
}

export type ListModelsOptions = {
  ollamaBaseUrl?: string
  lmstudioBaseUrl?: string
}

export class ModelFetcherService {
  constructor(private config: ProviderKeysConfig) { }

  private ensure(key?: string, providerName = 'unknown') {
    if (!key) throw new Error(`${providerName} API key not found in config`)
    return key
  }

  async listGeminiModels(): Promise<GeminiAPIModel[]> {
    const apiKey = this.ensure(this.config.googleGeminiKey, 'Google Gemini')
    const response = await fetch(`${GEMINI_BASE_URL}/models?key=${apiKey}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch Gemini models: ${response.statusText}`)
    }
    const data = (await response.json()) as { models: GeminiAPIModel[] }
    return data.models
  }

  async listGroqModels(): Promise<UnifiedModel[]> {
    const groqApiKey = this.ensure(this.config.groqKey, 'Groq')
    const response = await fetch(`${GROQ_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Groq models API error: ${response.status} - ${errorText}`)
    }
    const data = (await response.json()) as {
      object: string
      data: Array<{
        id: string
        object: string
        created: number
        owned_by: string
        active: boolean
        context_window: number
      }>
    }
    return data.data.map((m) => ({
      id: m.id,
      name: m.id,
      description: `Groq model owned by ${m.owned_by}`
    }))
  }

  async listTogetherModels(): Promise<UnifiedModel[]> {
    const togetherApiKey = this.ensure(this.config.togetherKey, 'Together')
    const response = await fetch(`${TOGETHER_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${togetherApiKey}`,
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Together models API error: ${response.status} - ${errorText}`)
    }
    const data = (await response.json()) as TogetherModel[]
    return data.map((m) => ({
      id: m.id,
      name: m.display_name || m.id,
      description: `${m.organization} model - ${m.display_name || m.id} | Context: ${m.context_length} tokens | License: ${m.license}`
    }))
  }

  async listOpenAiModels(): Promise<OpenAIModelObject[]> {
    const openAIKey = this.ensure(this.config.openaiKey, 'OpenAI')
    const response = await fetch(`${OPENAI_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI list models error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as OpenAIModelsListResponse
    return data.data
  }

  async listAnthropicModels(): Promise<AnthropicModel[]> {
    const anthropicKey = this.ensure(this.config.anthropicKey, 'Anthropic')
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic Models API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as AnthropicModelsResponse
    return data.data
  }

  async listOpenRouterModels({
    headers
  }: {
    headers?: Record<string, string>
  } = {}): Promise<OpenRouterModel[]> {
    const openRouterKey = this.ensure(this.config.openrouterKey, 'openrouter')
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        ...headers,
        Authorization: `Bearer ${openRouterKey}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as OpenRouterModelsResponse
    return data.data
  }

  async listXAIModels(): Promise<OpenAIModelObject[]> {
    const xaiKey = this.ensure(this.config.xaiKey, 'XAI')
    const response = await fetch(`${XAI_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${xaiKey}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`XAI API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as { data: OpenAIModelObject[] }
    return data.data
  }

  async listOllamaModels({ baseUrl }: { baseUrl: string } = { baseUrl: OLLAMA_BASE_URL }): Promise<UnifiedModel[]> {
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama error: ${response.statusText} - ${errorText}`)
    }

    const data = (await response.json()) as {
      models: OllamaModel[]
    }

    return data.models.map((model) => ({
      id: model.name,
      name: model.name,
      //  fill in details about the amodel from the data
      description: `${model.details.family} family - ${model.name} | size: ${model.details.parameter_size} | quantization: ${model.details.quantization_level}`
    }))
  }

  async listLMStudioModels({ baseUrl }: { baseUrl: string } = { baseUrl: LMSTUDIO_BASE_URL }): Promise<UnifiedModel[]> {
    const response = await fetch(`${baseUrl}/models`)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LM Studio error: ${response.statusText} - ${errorText}`)
    }

    const data = (await response.json()) as { data: any[] }
    return data.data.map((m) => ({
      id: m.id,
      name: m.id,
      description: `LM Studio model: ${m.id}`
    }))
  }

  async listModels(
    provider: APIProviders,
    { ollamaBaseUrl, lmstudioBaseUrl }: ListModelsOptions = {}
  ): Promise<UnifiedModel[]> {
    switch (provider) {
      case 'openrouter': {
        const models = await this.listOpenRouterModels()
        return models.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description
        }))
      }

      case 'lmstudio': {
        return this.listLMStudioModels({ baseUrl: lmstudioBaseUrl || LMSTUDIO_BASE_URL })
      }

      case 'ollama': {
        return this.listOllamaModels({ baseUrl: ollamaBaseUrl || OLLAMA_BASE_URL })
      }

      case 'xai': {
        const models = await this.listXAIModels()
        return models.map((m) => ({
          id: m.id,
          name: m.id,
          description: `XAI model owned by ${m.owned_by}`
        }))
      }

      case 'google_gemini': {
        const models = await this.listGeminiModels()
        return models.map((m) => ({
          id: m.name,
          name: m.displayName,
          description: m.description
        }))
      }

      case 'anthropic': {
        const models = await this.listAnthropicModels()
        return models.map((m) => ({
          id: m.id,
          name: m.display_name,
          description: `Anthropic model: ${m.id}`
        }))
      }

      case 'groq': {
        const models = await this.listGroqModels()
        return models.map((m) => ({
          id: m.id,
          name: m.name,
          description: `Groq model: ${m.id}`
        }))
      }

      case 'together': {
        const models = await this.listTogetherModels()
        return models.map((m) => ({
          id: m.id,
          name: m.id,
          description: `Together model: ${m.id}`
        }))
      }

      case 'openai':
      default: {
        try {
          const models = await this.listOpenAiModels()
          return models.map((m) => ({
            id: m.id,
            name: m.id,
            description: `OpenAI model owned by ${m.owned_by}`
          }))
        } catch (error) {
          console.warn('Failed to fetch OpenAI models', error)
          return []
        }
      }
    }
  }
}
