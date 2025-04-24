import { APIProviders } from "shared/src/schemas/provider-key.schemas"


export type ModelProvider = {
    id: APIProviders
    name: string
    link: string
    linkTitle: string
    description: string
    isLocal?: boolean
}


export const PROVIDERS = [
    {
        id: 'openai',
        name: 'OpenAI',
        link: 'https://platform.openai.com/api-keys',
        linkTitle: 'Get OpenAI API key',
        description: 'API keys for GPT-4, GPT-3.5, and other OpenAI models'
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        link: 'https://openrouter.ai/settings/keys',
        linkTitle: 'Get OpenRouter API key',
        description: 'Access to multiple LLM providers through a single API'
    },
    {
        id: 'xai',
        name: "XAI",
        link: "https://console.x.ai",
        linkTitle: 'Get XAI API key',
        description: "XAI API keys for Grok models"
    },
    {
        id: 'google_gemini',
        name: 'Google Gemini',
        link: 'https://aistudio.google.com/app/apikey',
        linkTitle: 'Get Google Gemini API key',
        description: 'API keys for Google Gemini models (including Gemini Pro and Ultra)'
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        link: 'https://console.anthropic.com/settings/keys',
        linkTitle: 'Get Anthropic API key',
        description: 'API keys for Anthropic models'
    },
    {
        id: 'groq',
        name: 'Groq',
        link: 'https://console.groq.com/keys',
        linkTitle: 'Get Groq API key',
        description: 'API keys for Groq models'
    },
    {
        id: 'together',
        name: 'Together',
        link: 'https://api.together.ai/settings/api-keys',
        linkTitle: 'Get Together API key',
        description: 'API keys for Together models'
    },
    {
        id: 'lmstudio',
        name: 'LMStudio',
        link: 'https://lmstudio.ai/',
        linkTitle: 'Download LM Studio',
        isLocal: true,
        description: 'LM Studio is a UI based tool for running LLMs on your local machine. Click the link to download the app. Once you have LM Studio installed, OctoPrompt will automatically start pulling the models API and you can select and start chatting with them. You can change LM Studio base URL in the settings.'
    }, {
        id: 'ollama',
        name: 'Ollama',
        link: 'https://ollama.com/download',
        linkTitle: 'Download Ollama',
        isLocal: true,
        description: 'Ollama is a lightweight terminal based tool for running LLMs on your local machine. Click the link to download the app. Once you have Ollama installed, OctoPrompt will automatically start pulling the models API and you can select and start chatting with them. You can change Ollama base URL in the settings.'
    }
] satisfies ModelProvider[]



export const PROVIDER_SELECT_OPTIONS: { value: string; label: string }[] = PROVIDERS.map(provider => ({
    value: provider.id,
    label: provider.name
}))