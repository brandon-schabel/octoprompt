import { z } from 'zod';



export const EDITOR_OPTIONS = [
    { value: 'vscode', label: 'VS Code' },
    { value: 'cursor', label: 'Cursor' },
    { value: 'webstorm', label: 'WebStorm' },
] as const


export type EditorType = typeof EDITOR_OPTIONS[number]['value']


export const tabStateSchema = z.object({
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

export type TabState = z.infer<typeof tabStateSchema>;

export const globalStateSchema = z.object({
    users: z.array(z.object({ id: z.string(), name: z.string() })),
    settings: z.object({
        darkMode: z.boolean(),
        language: z.string(),
    }),
    counter: z.number(),
    tabs: z.record(z.string(), tabStateSchema),
    activeTabId: z.string().nullable(),
});

export type GlobalState = z.infer<typeof globalStateSchema>;

export const createInitialGlobalState = (): GlobalState => ({
    users: [],
    settings: { darkMode: false, language: 'en' },
    counter: 0,

    // We’ll create one default tab on first load
    tabs: {
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
    activeTabId: 'defaultTab',
});