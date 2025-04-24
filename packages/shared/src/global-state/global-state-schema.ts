import { z } from "zod";
import { DEFAULT_MODEL_CONFIGS } from "../constants/model-default-configs";
import { providerSchema, type APIProviders } from "../schemas/provider-key.schemas";

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
    selectedProjectId: z.string().nullable().optional().default(null),
    editProjectId: z.string().nullable().optional().default(null),
    promptDialogOpen: z.boolean().optional().default(false),
    editPromptId: z.string().nullable().optional().default(null),
    fileSearch: z.string().optional().default(""),
    selectedFiles: z.array(z.string()).nullable().optional().default([]),
    selectedPrompts: z.array(z.string()).optional().default([]),
    userPrompt: z.string().optional().default(""),
    searchByContent: z.boolean().optional().default(false),
    displayName: z.string().optional(),
    contextLimit: z.number().optional().default(128000),
    resolveImports: z.boolean().optional().default(false),
    preferredEditor: z.enum(["vscode", "cursor"]).optional().default("vscode"),
    suggestedFileIds: z.array(z.string()).optional().default([]),
    bookmarkedFileGroups: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .default({}),
    ticketSearch: z.string().optional().default(""),
    ticketSort: z
        .enum(["created_desc", "created_asc", "status", "priority"])
        .optional()
        .default("created_desc"),
    ticketStatusFilter: z
        .enum(["all", "open", "in_progress", "closed"])
        .optional()
        .default("all"),
    ticketId: z.string().nullable().optional().default(null),
    sortOrder: z.number().optional().default(0), // Keep for Project Tabs
});
export type ProjectTabState = z.infer<typeof projectTabStateSchema>;


// Chat Model Settings (Defined once, used in AppSettings)
export const chatModelSettingsSchema = z.object({
    temperature: z.number().min(0).max(2).default(defaultModelConfigs.temperature),
    max_tokens: z.number().min(100).max(Infinity).default(defaultModelConfigs.max_tokens),
    top_p: z.number().min(0).max(1).default(defaultModelConfigs.top_p),
    frequency_penalty: z.number().min(-2).max(2).default(defaultModelConfigs.frequency_penalty),
    presence_penalty: z.number().min(-2).max(2).default(defaultModelConfigs.presence_penalty),
    stream: z.boolean().default(defaultModelConfigs.stream),
});
export type ChatModelSettings = z.infer<typeof chatModelSettingsSchema>;

// Theme Schema
export const themeSchema = z.enum(["light", "dark"]).default("light");
export type Theme = z.infer<typeof themeSchema>;


// App Settings - Now includes global chat model settings
export const appSettingsSchema = z.object({
    language: z.string().optional().default("en"),
    theme: themeSchema.optional().default("light"),
    codeThemeLight: z.string().optional().default("atomOneLight"),
    codeThemeDark: z.string().optional().default("atomOneDark"),
    ollamaGlobalUrl: z.string().optional().default("http://localhost:11434"),
    lmStudioGlobalUrl: z.string().optional().default("http://localhost:8000"), // Ensure this matches your setup if different
    summarizationIgnorePatterns: z.array(z.string()).optional().default([]),
    summarizationAllowPatterns: z.array(z.string()).optional().default([]),
    summarizationEnabledProjectIds: z.array(z.string()).optional().default([]),
    useSpacebarToSelectAutocomplete: z.boolean().optional().default(true),
    hideInformationalTooltips: z.boolean().optional().default(false),
    autoScrollEnabled: z.boolean().optional().default(true),

    // Global Chat Settings
    provider: providerSchema.optional().default(defaultModelConfigs.provider as APIProviders),
    model: z.string().optional().default(defaultModelConfigs.model),
    temperature: chatModelSettingsSchema.shape.temperature,
    max_tokens: chatModelSettingsSchema.shape.max_tokens,
    top_p: chatModelSettingsSchema.shape.top_p,
    frequency_penalty: chatModelSettingsSchema.shape.frequency_penalty,
    presence_penalty: chatModelSettingsSchema.shape.presence_penalty,
    stream: chatModelSettingsSchema.shape.stream,
});
export type AppSettings = z.infer<typeof appSettingsSchema>;


// Base schemas for partial updates (Project only)
export const projectTabStateBaseSchema = projectTabStateSchema.partial();
export type ProjectTabStatePartial = z.infer<typeof projectTabStateBaseSchema>;

// Record schemas for the store state (Project only)
export const projectTabsStateRecordSchema = z.record(z.string(), projectTabStateSchema);
export type ProjectTabsStateRecord = z.infer<typeof projectTabsStateRecordSchema>;


// Global State Schema - Simplified
export const globalStateSchema = z.object({
    settings: appSettingsSchema,
    projectTabs: projectTabsStateRecordSchema,
    projectActiveTabId: z.string().nullable().optional().default(null),
    activeChatId: z.string().nullable().optional().default(null),
    chatLinkSettings: z.record(z.string(), z.object({
        includeSelectedFiles: z.boolean().optional().default(false),
        includePrompts: z.boolean().optional().default(false),
        includeUserPrompt: z.boolean().optional().default(false),
        linkedProjectTabId: z.string().nullable().optional()
    })).optional().default({})
});
export type GlobalState = z.infer<typeof globalStateSchema>;


// Initial Global State - Simplified
export const createInitialGlobalState = (): GlobalState => ({
    settings: {
        language: "en",
        theme: "light",
        codeThemeLight: "atomOneLight",
        codeThemeDark: "atomOneDark",
        ollamaGlobalUrl: "http://localhost:11434",
        lmStudioGlobalUrl: "http://localhost:8000", // Default added
        summarizationIgnorePatterns: [],
        summarizationAllowPatterns: [],
        summarizationEnabledProjectIds: [],
        useSpacebarToSelectAutocomplete: true,
        hideInformationalTooltips: false,
        autoScrollEnabled: true,
        // Default Global Chat Settings
        provider: defaultModelConfigs.provider as APIProviders,
        model: defaultModelConfigs.model,
        temperature: defaultModelConfigs.temperature,
        max_tokens: defaultModelConfigs.max_tokens,
        top_p: defaultModelConfigs.top_p,
        frequency_penalty: defaultModelConfigs.frequency_penalty,
        presence_penalty: defaultModelConfigs.presence_penalty,
        stream: defaultModelConfigs.stream,
    },
    projectTabs: {
        // Keep default project tab if project tabs are still used
        defaultTab: {
            selectedProjectId: null,
            editProjectId: null,
            promptDialogOpen: false,
            editPromptId: null,
            fileSearch: "",
            selectedFiles: [],
            selectedPrompts: [],
            userPrompt: "",
            searchByContent: false,
            displayName: "Default Project Tab", // Renamed for clarity
            contextLimit: 128000,
            resolveImports: false,
            preferredEditor: "cursor", // Ensure 'cursor' is valid or use 'vscode'
            suggestedFileIds: [],
            bookmarkedFileGroups: {},
            ticketSearch: "",
            ticketSort: "created_desc",
            ticketStatusFilter: "all",
            ticketId: null,
            // provider: undefined, // Removed from project tab
            // linkSettings: undefined, // Removed
            sortOrder: 0,
        },
    },
    projectActiveTabId: "defaultTab", // Assuming project tabs remain
    activeChatId: null,
    chatLinkSettings: {}
});