import { z } from 'zod';

export const EDITOR_OPTIONS = [
    { value: 'vscode', label: 'VS Code' },
    { value: 'cursor', label: 'Cursor' },
    { value: 'webstorm', label: 'WebStorm' },
] as const;

export type EditorType = typeof EDITOR_OPTIONS[number]['value'];

export const projectTabStateSchema = z.object({
    selectedProjectId: z.string().nullable(),
    editProjectId: z.string().nullable(),
    promptDialogOpen: z.boolean(),
    editPromptId: z.string().nullable(),
    fileSearch: z.string(),
    selectedFiles: z.array(z.string()),
    selectedPrompts: z.array(z.string()),
    userPrompt: z.string(),
    searchByContent: z.boolean(),
    displayName: z.string().optional(),
    selectedFilesHistory: z.array(z.array(z.string())).default([]),
    selectedFilesHistoryIndex: z.number().default(0),
    contextLimit: z.number().default(128000),
    resolveImports: z.boolean().default(false),
    preferredEditor: z.enum(['vscode', 'cursor']).default('vscode'),
});

export const linkSettingsSchema = z.object({
    includeSelectedFiles: z.boolean().default(true),
    includePrompts: z.boolean().default(true),
    includeUserPrompt: z.boolean().default(true),
});

export type LinkSettings = z.infer<typeof linkSettingsSchema>;

export const chatTabStateSchema = z.object({
    provider: z.enum([
        'openai',
        'openrouter',
        'lmstudio',
        'ollama',
        'xai',
        'gemini',
        'anthropic',
    ]).default('openai'),
    model: z.string().default('gpt-4o'),
    input: z.string().default(''),
    messages: z.array(
        z.object({
            id: z.string(),
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string(),
        })
    ).default([]),
    excludedMessageIds: z.array(z.string()).default([]),
    displayName: z.string().optional(),
    activeChatId: z.string().optional(),

    // NEW FIELDS for linking a chat to a project tab
    linkedProjectTabId: z.string().nullable().default(null),
    linkSettings: linkSettingsSchema.optional(),
});

export const themeSchema = z.enum(['light', 'dark']).default('light');
export type Theme = z.infer<typeof themeSchema>;

export const appSettingsSchema = z.object({
    language: z.string(),
    theme: themeSchema.default('light'),
    codeThemeLight: z.string().default('atomOneLight'),
    codeThemeDark: z.string().default('atomOneDark'),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export type ChatTabState = z.infer<typeof chatTabStateSchema>;
export type ProjectTabState = z.infer<typeof projectTabStateSchema>;
export const chatTabsStateRecordSchema = z.record(z.string(), chatTabStateSchema);
export type ChatTabsStateRecord = z.infer<typeof chatTabsStateRecordSchema>;

export const projectTabsStateRecordSchema = z.record(z.string(), projectTabStateSchema);
export type ProjectTabsStateRecord = z.infer<typeof projectTabsStateRecordSchema>;

export const globalStateSchema = z.object({
    settings: appSettingsSchema,
    counter: z.number(),
    projectTabs: z.record(z.string(), projectTabStateSchema),
    projectActiveTabId: z.string().nullable(),
    chatTabs: chatTabsStateRecordSchema,
    chatActiveTabId: z.string().nullable(),

});

export type GlobalState = z.infer<typeof globalStateSchema>;

export const createInitialGlobalState = (): GlobalState => ({
    settings: {
        language: 'en',
        theme: 'light',
        codeThemeLight: 'atomOneLight',
        codeThemeDark: 'atomOneDark',
    },
    counter: 0,
    projectTabs: {
        defaultTab: {
            selectedProjectId: null,
            editProjectId: null,
            promptDialogOpen: false,
            editPromptId: null,
            fileSearch: '',
            selectedFiles: [],
            selectedPrompts: [],
            userPrompt: '',
            searchByContent: false,
            displayName: 'Default Tab',
            selectedFilesHistory: [[]],
            selectedFilesHistoryIndex: 0,
            contextLimit: 128000,
            resolveImports: true,
            preferredEditor: 'cursor',
        },
    },
    chatTabs: {
        defaultTab: {
            provider: 'openai',
            model: 'gpt-4o',
            input: '',
            messages: [],
            excludedMessageIds: [],
            displayName: 'Default Tab',
            activeChatId: undefined,
            linkedProjectTabId: null,
            linkSettings: {
                includeSelectedFiles: true,
                includePrompts: true,
                includeUserPrompt: true,
            },
        },
    },
    chatActiveTabId: 'defaultTab',
    projectActiveTabId: 'defaultTab',
});
