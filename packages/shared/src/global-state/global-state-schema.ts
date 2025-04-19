import { z } from "zod";
import { DEFAULT_MODEL_CONFIGS } from "../constants/model-default-configs";

const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

export const EDITOR_OPTIONS = [
    { value: "vscode", label: "VS Code" },
    { value: "cursor", label: "Cursor" },
    { value: "webstorm", label: "WebStorm" },
] as const;

export type EditorType = typeof EDITOR_OPTIONS[number]["value"];


export const AI_API_PROVIDERS = [
    "openai",
    "openrouter",
    "lmstudio",
    "ollama",
    "xai",
    "google_gemini",
    "anthropic",
    "groq",
    "together",
] as const;

// ------------------------------------------------------------------
// Provider enum
// ------------------------------------------------------------------
export const providerSchema = z.enum(AI_API_PROVIDERS);
export type APIProviders = z.infer<typeof providerSchema>;
export const apiProviders = providerSchema.options;

// ------------------------------------------------------------------
// Link settings
// ------------------------------------------------------------------
export const linkSettingsSchema = z.object({
    includeSelectedFiles: z.boolean().optional().default(true),
    includePrompts: z.boolean().optional().default(true),
    includeUserPrompt: z.boolean().optional().default(true),
});
export type LinkSettings = z.infer<typeof linkSettingsSchema>;

// ------------------------------------------------------------------
// Project tab state
// ------------------------------------------------------------------
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
    provider: providerSchema.optional(),
    linkSettings: linkSettingsSchema.optional(),
    sortOrder: z.number().optional().default(0),
});
export type ProjectTabState = z.infer<typeof projectTabStateSchema>;

export const chatModelSettingsSchema = z.object({
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens: z.number().min(100).max(Infinity).default(32000),
    top_p: z.number().min(0).max(1).default(1),
    frequency_penalty: z.number().min(-2).max(2).default(0),
    presence_penalty: z.number().min(-2).max(2).default(0),
    stream: z.boolean().default(true),
});

export type ChatModelSettings = z.infer<typeof chatModelSettingsSchema>;

export const chatTabStateSchema = z.object({
    provider: providerSchema.optional().default(defaultModelConfigs.provider as APIProviders),
    model: z.string().optional().default(defaultModelConfigs.model),
    input: z.string().optional().default(""),
    messages: z
        .array(
            z.object({
                id: z.string(),
                role: z.enum(["system", "user", "assistant"]),
                content: z.string(),
            })
        )
        .optional()
        .default([]),
    excludedMessageIds: z.array(z.string()).optional().default([]),
    displayName: z.string().optional(),
    activeChatId: z.string().optional(),
    linkedProjectTabId: z.string().nullable().optional().default(null),
    linkSettings: linkSettingsSchema.optional(),
    ollamaUrl: z.string().optional(),
    lmStudioUrl: z.string().optional(),
    temperature: chatModelSettingsSchema.shape.temperature,
    max_tokens: chatModelSettingsSchema.shape.max_tokens,
    top_p: chatModelSettingsSchema.shape.top_p,
    frequency_penalty: chatModelSettingsSchema.shape.frequency_penalty,
    presence_penalty: chatModelSettingsSchema.shape.presence_penalty,
    stream: chatModelSettingsSchema.shape.stream,
    sortOrder: z.number().optional().default(0),
});
export type ChatTabState = z.infer<typeof chatTabStateSchema>;


export const themeSchema = z.enum(["light", "dark"]).default("light");
export type Theme = z.infer<typeof themeSchema>;


export const appSettingsSchema = z.object({
    language: z.string().optional().default("en"),
    theme: themeSchema.optional().default("light"),
    codeThemeLight: z.string().optional().default("atomOneLight"),
    codeThemeDark: z.string().optional().default("atomOneDark"),
    ollamaGlobalUrl: z.string().optional().default("http://localhost:11434"),
    lmStudioGlobalUrl: z.string().optional().default("http://localhost:8000"),
    summarizationIgnorePatterns: z.array(z.string()).optional().default([]),
    summarizationAllowPatterns: z.array(z.string()).optional().default([]),
    summarizationEnabledProjectIds: z.array(z.string()).optional().default([]),
    useSpacebarToSelectAutocomplete: z.boolean().optional().default(true),
    hideInformationalTooltips: z.boolean().optional().default(false),
    autoScrollEnabled: z.boolean().optional().default(true),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

// Base schemas with all fields optional for partial updates
export const projectTabStateBaseSchema = projectTabStateSchema.partial();
export type ProjectTabStatePartial = z.infer<typeof projectTabStateBaseSchema>;

export const chatTabStateBaseSchema = chatTabStateSchema.partial();
export type ChatTabStatePartial = z.infer<typeof chatTabStateBaseSchema>;

// Record schemas for the store state
export const projectTabsStateRecordSchema = z.record(z.string(), projectTabStateSchema);
export type ProjectTabsStateRecord = z.infer<typeof projectTabsStateRecordSchema>;

export const chatTabsStateRecordSchema = z.record(z.string(), chatTabStateSchema);
export type ChatTabsStateRecord = z.infer<typeof chatTabsStateRecordSchema>;

export const globalStateSchema = z.object({
    settings: appSettingsSchema,
    projectTabs: projectTabsStateRecordSchema,
    projectActiveTabId: z.string().nullable().optional().default(null),
    chatTabs: chatTabsStateRecordSchema,
    chatActiveTabId: z.string().nullable().optional().default(null),
});
export type GlobalState = z.infer<typeof globalStateSchema>;


export const createInitialGlobalState = (): GlobalState => ({
    settings: {
        language: "en",
        theme: "light",
        codeThemeLight: "atomOneLight",
        codeThemeDark: "atomOneDark",
        ollamaGlobalUrl: "http://localhost:11434",
        lmStudioGlobalUrl: "http://localhost:8000",
        summarizationIgnorePatterns: [],
        summarizationAllowPatterns: [],
        summarizationEnabledProjectIds: [],
        useSpacebarToSelectAutocomplete: true,
        hideInformationalTooltips: false,
        autoScrollEnabled: true,
    },
    projectTabs: {
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
            displayName: "Default Tab",
            contextLimit: 128000,
            resolveImports: false,
            preferredEditor: "cursor",
            suggestedFileIds: [],
            bookmarkedFileGroups: {},
            ticketSearch: "",
            ticketSort: "created_desc",
            ticketStatusFilter: "all",
            ticketId: null,
            provider: undefined,
            linkSettings: undefined,
            sortOrder: 0,
        },
    },
    chatTabs: {
        defaultTab: {
            provider: "openai",
            model: "gpt-4o",
            input: "",
            messages: [],
            excludedMessageIds: [],
            displayName: "Default Tab",
            activeChatId: undefined,
            linkedProjectTabId: null,
            linkSettings: {
                includeSelectedFiles: true,
                includePrompts: true,
                includeUserPrompt: true,
            },
            ollamaUrl: undefined,
            lmStudioUrl: undefined,
            temperature: 0.7,
            max_tokens: 4000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: true,
            sortOrder: 0,
        },
    },
    chatActiveTabId: "defaultTab",
    projectActiveTabId: "defaultTab",
});