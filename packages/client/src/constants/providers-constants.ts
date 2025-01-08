import { APIProviders } from "shared/index"


export type Provider = {
    id: APIProviders
    name: string
    apiKeyUrl: string
    description: string
}


export const PROVIDERS = [
    {
        id: 'openai',
        name: 'OpenAI',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        description: 'API keys for GPT-4, GPT-3.5, and other OpenAI models'
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        apiKeyUrl: 'https://openrouter.ai/settings/keys',
        description: 'Access to multiple LLM providers through a single API'
    },
    {
        id: 'xai',
        name: "XAI",
        apiKeyUrl: "https://console.x.ai",
        description: "XAI API keys for Grok models"
    },
    {
        id: 'google_gemini',
        name: 'Google Gemini',
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        description: 'API keys for Google Gemini models (including Gemini Pro and Ultra)'
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        description: 'API keys for Anthropic models'
    },
    {
        id: 'groq',
        name: 'Groq',
        apiKeyUrl: 'https://console.groq.com/keys',
        description: 'API keys for Groq models'
    },
    {
        id: 'together',
        name: 'Together',
        apiKeyUrl: 'https://api.together.ai/settings/api-keys',
        description: 'API keys for Together models'
    }
] satisfies Provider[]



export const PROVIDER_SELECT_OPTIONS: { value: string; label: string }[] = PROVIDERS.map(provider => ({
    value: provider.id,
    label: provider.name
}))