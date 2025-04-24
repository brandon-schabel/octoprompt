import { z } from "zod";
import { DEFAULT_MODEL_CONFIGS } from "../constants/model-default-configs";
import { providerSchema, type APIProviders } from "./provider-key.schemas";

const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

export const EDITOR_OPTIONS = [
    { value: "vscode", label: "VS Code" },
    { value: "cursor", label: "Cursor" },
    { value: "webstorm", label: "WebStorm" },
] as const;

export type EditorType = typeof EDITOR_OPTIONS[number]["value"];

export const apiProviders = providerSchema.options;

// Project tab state - (Keep as is, unless project tabs are also removed)
export const projectTabStateSchema = z.object({
    selectedProjectId: z.string().nullable().optional().default(null).openapi({ description: "UUID of the currently selected project within this tab, or null.", example: "proj_123abc" }),
    editProjectId: z.string().nullable().optional().default(null).openapi({ description: "UUID of the project whose settings are being edited within this tab, or null.", example: null }),
    promptDialogOpen: z.boolean().optional().default(false).openapi({ description: "Whether the prompt selection/creation dialog is open in this tab." }),
    editPromptId: z.string().nullable().optional().default(null).openapi({ description: "UUID of the prompt being edited in this tab, or null.", example: "prompt_xyz789" }),
    fileSearch: z.string().optional().default("").openapi({ description: "Current search query for files within this project tab.", example: "userService" }),
    selectedFiles: z.array(z.string()).nullable().optional().default([]).openapi({ description: "Array of file UUIDs currently selected in this tab.", example: ["file_abc", "file_def"] }),
    selectedPrompts: z.array(z.string()).optional().default([]).openapi({ description: "Array of prompt UUIDs currently selected in this tab.", example: ["prompt_ghi"] }),
    userPrompt: z.string().optional().default("").openapi({ description: "The current user-entered text in the main prompt input for this tab.", example: "Refactor this component to use hooks." }),
    searchByContent: z.boolean().optional().default(false).openapi({ description: "Flag indicating if file search should search within file content." }),
    displayName: z.string().optional().openapi({ description: "User-defined display name for this project tab.", example: "Backend Services" }),
    contextLimit: z.number().optional().default(128000).openapi({ description: "Context limit (in tokens) specifically configured for this project tab, overriding global settings if set.", example: 16000 }),
    resolveImports: z.boolean().optional().default(false).openapi({ description: "Whether to attempt resolving imports to include related file context." }),
    preferredEditor: z.enum(["vscode", "cursor", "webstorm"]).optional().default("vscode").openapi({ description: "The preferred editor to open files with from this tab.", example: "cursor" }),
    suggestedFileIds: z.array(z.string()).optional().default([]).openapi({ description: "Array of file UUIDs suggested by the AI for the current context.", example: ["file_sug1", "file_sug2"] }),
    bookmarkedFileGroups: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .default({})
        .openapi({ description: "A record of user-defined file groups (bookmarks), mapping group names to arrays of file UUIDs.", example: { "Auth Files": ["file_auth1", "file_auth2"] } }),
    ticketSearch: z.string().optional().default("").openapi({ description: "Current search query for tickets.", example: "UI bug" }),
    ticketSort: z
        .enum(["created_desc", "created_asc", "status", "priority"])
        .optional()
        .default("created_desc").openapi({ description: "Sorting criteria for the ticket list." }),
    ticketStatusFilter: z
        .enum(["all", "open", "in_progress", "closed"])
        .optional()
        .default("all").openapi({ description: "Filter criteria for ticket status." }),
    ticketId: z.string().nullable().optional().default(null).openapi({ description: "UUID of the currently selected ticket, or null.", example: "ticket_999" }),
    sortOrder: z.number().optional().default(0).openapi({ description: "Numerical sort order for arranging project tabs." }),
}).openapi('ProjectTabState', { description: 'Represents the state of a single project tab, including selections, searches, and configurations specific to that tab.' });
export type ProjectTabState = z.infer<typeof projectTabStateSchema>;


// Chat Model Settings (Defined once, used in AppSettings)
export const chatModelSettingsSchema = z.object({
    temperature: z.number().min(0).max(2).default(defaultModelConfigs.temperature).openapi({ description: "Controls randomness. Lower values make the model more deterministic.", example: 0.7 }),
    max_tokens: z.number().min(100).max(Infinity).default(defaultModelConfigs.max_tokens).openapi({ description: "Maximum number of tokens to generate in the chat completion.", example: 4096 }),
    top_p: z.number().min(0).max(1).default(defaultModelConfigs.top_p).openapi({ description: "Nucleus sampling parameter. Considers tokens with top_p probability mass.", example: 1 }),
    frequency_penalty: z.number().min(-2).max(2).default(defaultModelConfigs.frequency_penalty).openapi({ description: "Penalizes new tokens based on their frequency in the text so far.", example: 0 }),
    presence_penalty: z.number().min(-2).max(2).default(defaultModelConfigs.presence_penalty).openapi({ description: "Penalizes new tokens based on whether they appear in the text so far.", example: 0 }),
    stream: z.boolean().default(defaultModelConfigs.stream).openapi({ description: "Whether to stream back partial progress.", example: true }),
}).openapi('ChatModelSettings', { description: 'Configuration parameters for the AI chat model generation.' });
export type ChatModelSettings = z.infer<typeof chatModelSettingsSchema>;

// Theme Schema
export const themeSchema = z.enum(["light", "dark"]).default("light").openapi('Theme', { description: 'Application color theme options.' });
export type Theme = z.infer<typeof themeSchema>;


// App Settings - Now includes global chat model settings
export const appSettingsSchema = z.object({
    language: z.string().optional().default("en").openapi({ description: "Application display language code.", example: "en" }),
    theme: themeSchema.optional().default("light").openapi({ description: "Selected application color theme.", example: "dark" }),
    codeThemeLight: z.string().optional().default("atomOneLight").openapi({ description: "Name of the code syntax highlighting theme used in light mode.", example: "githubLight" }),
    codeThemeDark: z.string().optional().default("atomOneDark").openapi({ description: "Name of the code syntax highlighting theme used in dark mode.", example: "monokai" }),
    ollamaGlobalUrl: z.string().url().optional().default("http://localhost:11434").openapi({ description: "Base URL for the Ollama server instance.", example: "http://192.168.1.100:11434" }),
    lmStudioGlobalUrl: z.string().url().optional().default("http://localhost:1234").openapi({ description: "Base URL for the LM Studio local inference server.", example: "http://localhost:1234" }), // Default corrected based on common LM Studio port
    summarizationIgnorePatterns: z.array(z.string()).optional().default([]).openapi({ description: "Glob patterns for files/folders to ignore during automatic summarization.", example: ["**/node_modules/**", "**/*.log"] }),
    summarizationAllowPatterns: z.array(z.string()).optional().default([]).openapi({ description: "Glob patterns for files/folders to explicitly include in summarization (if ignore patterns also match).", example: ["src/**/*.ts"] }),
    summarizationEnabledProjectIds: z.array(z.string()).optional().default([]).openapi({ description: "List of project UUIDs for which automatic summarization is enabled.", example: ["proj_123", "proj_456"] }),
    useSpacebarToSelectAutocomplete: z.boolean().optional().default(true).openapi({ description: "Whether pressing Spacebar accepts the current autocomplete suggestion." }),
    hideInformationalTooltips: z.boolean().optional().default(false).openapi({ description: "Whether to hide tooltips that provide general information or tips." }),
    autoScrollEnabled: z.boolean().optional().default(true).openapi({ description: "Whether the chat view should automatically scroll to the bottom on new messages." }),

    // Global Chat Settings (Referencing the detailed chatModelSettingsSchema fields)
    provider: providerSchema.optional().default(defaultModelConfigs.provider as APIProviders).openapi({ description: "Default AI provider to use for chat.", example: "openai" }),
    model: z.string().optional().default(defaultModelConfigs.model).openapi({ description: "Default AI model name to use for chat.", example: "gpt-4-turbo-preview" }),
    temperature: chatModelSettingsSchema.shape.temperature,
    max_tokens: chatModelSettingsSchema.shape.max_tokens,
    top_p: chatModelSettingsSchema.shape.top_p,
    frequency_penalty: chatModelSettingsSchema.shape.frequency_penalty,
    presence_penalty: chatModelSettingsSchema.shape.presence_penalty,
    stream: chatModelSettingsSchema.shape.stream,
}).openapi('AppSettings', { description: 'Global application settings, including theme, AI provider configuration, and default chat parameters.' });
export type AppSettings = z.infer<typeof appSettingsSchema>;


// Base schemas for partial updates (Project only) - Not directly used in GlobalState, but good practice
export const projectTabStateBaseSchema = projectTabStateSchema.partial();
export type ProjectTabStatePartial = z.infer<typeof projectTabStateBaseSchema>;

// Record schemas for the store state (Project only)
export const projectTabsStateRecordSchema = z.record(z.string(), projectTabStateSchema).openapi('ProjectTabsStateRecord', { description: 'A map where keys are project tab UUIDs and values are the state objects for each tab.' });
export type ProjectTabsStateRecord = z.infer<typeof projectTabsStateRecordSchema>;

// Chat Link Settings Schema
export const chatLinkSettingsSchema = z.record(
    z.string().uuid(), // Key is chat UUID
    z.object({
        includeSelectedFiles: z.boolean().optional().default(false).openapi({ description: 'Whether currently selected files from the linked project tab should be included as context.' }),
        includePrompts: z.boolean().optional().default(false).openapi({ description: 'Whether selected prompts from the linked project tab should be included.' }),
        includeUserPrompt: z.boolean().optional().default(false).openapi({ description: 'Whether the user prompt input from the linked project tab should be included.' }),
        linkedProjectTabId: z.string().uuid().nullable().optional().openapi({ description: 'The UUID of the project tab this chat is linked to, or null if not linked.' })
    }).openapi('ChatLinkSetting', { description: 'Settings defining how a chat is linked to a project tab and what context is shared.' })
).optional().default({}).openapi('ChatLinkSettingsMap', { description: 'A map where keys are chat UUIDs and values are the link settings for that chat.' });


// Global State Schema - The main object
export const globalStateSchema = z.object({
    settings: appSettingsSchema.openapi({ description: "Application-wide settings." }),
    projectTabs: projectTabsStateRecordSchema.openapi({ description: "State of all open project tabs, keyed by tab ID." }),
    projectActiveTabId: z.string().nullable().optional().default(null).openapi({ description: "The UUID of the currently active project tab, or null if none is active.", example: "tab_abc123" }),
    activeChatId: z.string().nullable().optional().default(null).openapi({ description: "The UUID of the currently active chat session, or null.", example: "chat_xyz789" }),
    chatLinkSettings: chatLinkSettingsSchema.openapi({ description: "Link settings specific to each chat session." })
}).openapi('GlobalState', { description: 'Represents the entire persistent application state.' });
export type GlobalState = z.infer<typeof globalStateSchema>;


// Initial Global State - Simplified (Function doesn't need OpenAPI spec, but uses the schemas)
export const createInitialGlobalState = (): GlobalState => ({
    settings: appSettingsSchema.parse({}), // Use parse with empty object to get defaults
    projectTabs: {
        // Keep default project tab if project tabs are still used
        defaultTab: projectTabStateSchema.parse({ // Use parse to get defaults
            displayName: "Default Project Tab", // Override default display name
            // Set any other non-default initial values if needed
        }),
    },
    projectActiveTabId: "defaultTab", // Assuming project tabs remain
    activeChatId: null,
    chatLinkSettings: {}
});

// Helper function to get default app settings cleanly
export function getDefaultAppSettings(): AppSettings {
    return appSettingsSchema.parse({});
}

// Helper function to get default project tab state cleanly
export function getDefaultProjectTabState(displayName: string = "Default Project Tab"): ProjectTabState {
    return projectTabStateSchema.parse({ displayName });
}