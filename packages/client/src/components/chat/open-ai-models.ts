export type OpenAIModel = {
    id: string
    name: string
    description: string
    contextWindow: number
    category: 'GPT-4o' | 'GPT-4o mini' | 'o1' | 'GPT-4' | 'GPT-3.5' | 'Base'
}

export const openAIModels: OpenAIModel[] = [
    // GPT-4o Models
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Our high-intelligence flagship model for complex, multi-step tasks',
        contextWindow: 128000,
        category: 'GPT-4o'
    },
    {
        id: 'gpt-4o-2024-11-20',
        name: 'GPT-4o (Nov 20, 2024)',
        description: 'Latest gpt-4o snapshot from November 20th, 2024',
        contextWindow: 128000,
        category: 'GPT-4o'
    },
    {
        id: 'chatgpt-4o-latest',
        name: 'ChatGPT-4o Latest',
        description: 'The version of GPT-4o used in ChatGPT, updated frequently',
        contextWindow: 128000,
        category: 'GPT-4o'
    },
    // GPT-4o mini Models
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Our affordable and intelligent small model for fast, lightweight tasks',
        contextWindow: 128000,
        category: 'GPT-4o mini'
    },
    // o1 Models
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        description: 'Reasoning model designed to solve hard problems across domains',
        contextWindow: 128000,
        category: 'o1'
    },
    {
        id: 'o1-mini',
        name: 'o1 Mini',
        description: 'Faster and cheaper reasoning model for coding, math, and science',
        contextWindow: 128000,
        category: 'o1'
    },
    // GPT-4 Models
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Latest GPT-4 Turbo model with vision capabilities',
        contextWindow: 128000,
        category: 'GPT-4'
    },
    {
        id: 'gpt-4-0125-preview',
        name: 'GPT-4 Turbo Preview',
        description: 'Preview model intended to reduce cases of laziness',
        contextWindow: 128000,
        category: 'GPT-4'
    },
    // GPT-3.5 Models
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective model for simpler tasks',
        contextWindow: 16385,
        category: 'GPT-3.5'
    },
    {
        id: 'gpt-3.5-turbo-0125',
        name: 'GPT-3.5 Turbo (Jan 25)',
        description: 'Latest GPT-3.5 Turbo model with improved formatting',
        contextWindow: 16385,
        category: 'GPT-3.5'
    },
    // Base Models
    {
        id: 'babbage-002',
        name: 'Babbage-002',
        description: 'Replacement for GPT-3 ada and babbage base models',
        contextWindow: 16384,
        category: 'Base'
    },
    {
        id: 'davinci-002',
        name: 'Davinci-002',
        description: 'Replacement for GPT-3 curie and davinci base models',
        contextWindow: 16384,
        category: 'Base'
    }
]