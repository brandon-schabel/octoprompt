import { z } from 'zod'
import { providerSchema, type APIProviders } from './provider-key.schemas'
import { idSchemaSpec, idArraySchemaSpec } from './schema-utils'
import { DEFAULT_MODEL_EXAMPLES } from './model-defaults'

const defaultModelConfigs = DEFAULT_MODEL_EXAMPLES

export const EDITOR_OPTIONS = [
  { value: 'vscode', label: 'VS Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'webstorm', label: 'WebStorm' },
  { value: 'vim', label: 'Vim' },
  { value: 'emacs', label: 'Emacs' },
  { value: 'sublime', label: 'Sublime Text' },
  { value: 'atom', label: 'Atom' },
  { value: 'idea', label: 'IntelliJ IDEA' },
  { value: 'phpstorm', label: 'PhpStorm' },
  { value: 'pycharm', label: 'PyCharm' },
  { value: 'rubymine', label: 'RubyMine' },
  { value: 'goland', label: 'GoLand' },
  { value: 'fleet', label: 'Fleet' },
  { value: 'zed', label: 'Zed' },
  { value: 'neovim', label: 'Neovim' },
  { value: 'xcode', label: 'Xcode' },
  { value: 'androidstudio', label: 'Android Studio' },
  { value: 'rider', label: 'Rider' }
] as const

export type EditorType = (typeof EDITOR_OPTIONS)[number]['value']

export const apiProviders = providerSchema.options

// the following schemas are used for the state/store, they aren't used in teh API
// Project tab state - (Keep as is, unless project tabs are also removed)
export const projectTabStateSchema = z
  .object({
    selectedProjectId: idSchemaSpec.default(-1),
    editProjectId: idSchemaSpec.default(-1),
    promptDialogOpen: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ description: 'Whether the prompt selection/creation dialog is open in this tab.' }),
    editPromptId: idSchemaSpec.default(-1),
    fileSearch: z
      .string()
      .optional()
      .default('')
      .openapi({ description: 'Current search query for files within this project tab.', example: 'userService' }),
    selectedFiles: idArraySchemaSpec.default([]), // DEPRECATED: For backward compatibility only
    selectedFilePaths: z
      .array(z.string())
      .default([])
      .openapi({
        description: 'Array of file paths for selected files. More stable than IDs which change on file updates.',
        example: ['src/index.ts', 'src/components/App.tsx']
      }),
    selectedPrompts: idArraySchemaSpec.default([]),
    userPrompt: z.string().optional().default('').openapi({
      description: 'The current user-entered text in the main prompt input for this tab.',
      example: 'Refactor this component to use hooks.'
    }),
    searchByContent: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ description: 'Flag indicating if file search should search within file content.' }),
    displayName: z
      .string()
      .optional()
      .default('Default Tab')
      .openapi({ description: 'User-defined display name for this project tab.', example: 'Backend Services' }),
    contextLimit: z.number().optional().openapi({
      description:
        'Context limit (in tokens) specifically configured for this project tab, overriding global settings if set.',
      example: 16000
    }),
    resolveImports: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ description: 'Whether to attempt resolving imports to include related file context.' }),
    preferredEditor: z
      .enum([
        'vscode',
        'cursor',
        'webstorm',
        'vim',
        'emacs',
        'sublime',
        'atom',
        'idea',
        'phpstorm',
        'pycharm',
        'rubymine',
        'goland',
        'fleet',
        'zed',
        'neovim',
        'xcode',
        'androidstudio',
        'rider'
      ])
      .optional()
      .default('vscode')
      .openapi({ description: 'The preferred editor to open files with from this tab.', example: 'cursor' }),
    suggestedFileIds: z
      .array(z.number())
      .optional()
      .default([])
      .openapi({
        description: 'Array of file IDs suggested by the AI for the current context.',
        example: [1, 2, 3, 4, 5]
      }),
    bookmarkedFileGroups: z
      .record(z.string(), z.array(z.number()))
      .optional()
      .default({})
      .openapi({
        description: 'A record of user-defined file groups (bookmarks), mapping group names to arrays of file IDs.',
        example: { 'Auth Files': [1, 2] }
      }),
    bookmarkedFileGroupsPaths: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .default({})
      .openapi({
        description: 'Path-based version of bookmarkedFileGroups. Maps group names to arrays of file paths.',
        example: { 'Auth Files': ['src/auth/login.ts', 'src/auth/logout.ts'] }
      }),
    sortOrder: z
      .number()
      .optional()
      .default(0)
      .openapi({ description: 'Numerical sort order for arranging project tabs.' }),
    ticketSearch: z
      .string()
      .optional()
      .default('')
      .openapi({ description: 'Current search query for tickets within this project tab.' }),
    ticketSort: z
      .enum(['created_asc', 'created_desc', 'status', 'priority'])
      .optional()
      .default('created_desc')
      .openapi({ description: 'Sort order for tickets display.' }),
    ticketStatusFilter: z
      .enum(['all', 'open', 'in_progress', 'closed', 'non_closed'])
      .optional()
      .default('non_closed')
      .openapi({ description: 'Status filter for tickets display.' }),
    ticketQueueFilter: z
      .string()
      .optional()
      .default('all')
      .openapi({ description: 'Queue filter for tickets display. Can be "all", "unqueued", or a queue ID.' }),
    promptsPanelCollapsed: z
      .boolean()
      .optional()
      .default(true)
      .openapi({ description: 'Whether the prompts panel is collapsed to save space.' }),
    selectedFilesCollapsed: z
      .boolean()
      .optional()
      .default(true)
      .openapi({ description: 'Whether the selected files panel is collapsed to save space.' }),
    nameGenerationStatus: z
      .enum(['pending', 'success', 'failed', 'fallback'])
      .optional()
      .openapi({ description: 'Status of the AI-generated tab name attempt' }),
    nameGeneratedAt: z
      .date()
      .nullable()
      .optional()
      .openapi({ description: 'Timestamp when the tab name was generated' }),
    claudeCodeEnabled: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ description: 'Whether Claude Code integration features are enabled for this project.' }),
    assetsEnabled: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ description: 'Whether the Assets tab is enabled for this project.' }),
    autoIncludeClaudeMd: z.boolean().optional().default(false).openapi({
      description: 'DEPRECATED: Use instructionFileSettings instead. Kept for backward compatibility.',
      example: true
    }),
    instructionFileSettings: z
      .object({
        autoIncludeEnabled: z.boolean().default(false).openapi({
          description: 'Master switch to enable auto-inclusion of instruction files',
          example: true
        }),
        fileTypes: z
          .array(
            z.enum([
              'claude', // CLAUDE.md
              'agents', // AGENTS.md (general agent file standard)
              'copilot', // copilot-instructions.md, .github/copilot-instructions.md
              'cursor', // .cursorrules, .cursor/rules.md
              'aider', // .aider, .aider.conf.yml
              'codebase', // codebase-instructions.md, AI_INSTRUCTIONS.md
              'windsurf', // .windsurf/rules.md, .windsurfrules
              'continue' // .continue/config.json
            ])
          )
          .default(['claude'])
          .openapi({
            description: 'Types of instruction files to auto-include',
            example: ['claude', 'copilot']
          }),
        priority: z
          .enum(['claude', 'agents', 'copilot', 'cursor', 'aider', 'codebase', 'windsurf', 'continue'])
          .default('claude')
          .openapi({
            description: 'Preferred file type when multiple instruction files exist in the same directory',
            example: 'claude'
          }),
        includeGlobal: z.boolean().default(false).openapi({
          description: 'Whether to include global instruction files from home directory (e.g., ~/.claude/CLAUDE.md)',
          example: false
        }),
        includeProjectRoot: z.boolean().default(true).openapi({
          description:
            'Whether to include instruction files from project root (e.g., /CLAUDE.md, /.github/copilot-instructions.md)',
          example: true
        }),
        includeHierarchy: z.boolean().default(true).openapi({
          description:
            'Whether to include instruction files from all parent directories up to the project root when selecting a file',
          example: true
        })
      })
      .optional()
      .openapi({
        description: 'Settings for auto-including AI instruction files when selecting files'
      })
  })
  .openapi('ProjectTabState', {
    description:
      'Represents the state of a single project tab, including selections, searches, and configurations specific to that tab.'
  })

// Chat Model Settings (Defined once, used in AppSettings)
export const chatModelSettingsSchema = z
  .object({
    temperature: z
      .number()
      .min(0)
      .max(2)
      .default(defaultModelConfigs.temperature ?? 0.7)
      .openapi({ description: 'Controls randomness. Lower values make the model more deterministic.', example: 0.7 }),
    maxTokens: z
      .number()
      .min(100)
      .max(Infinity)
      .default(defaultModelConfigs.maxTokens ?? 4096)
      .openapi({ description: 'Maximum number of tokens to generate in the chat completion.', example: 4096 }),
    topP: z
      .number()
      .min(0)
      .max(1)
      .default(defaultModelConfigs.topP ?? 1)
      .openapi({
        description: 'Nucleus sampling parameter. Considers tokens with top_p probability mass.',
        example: 1
      }),
    frequencyPenalty: z
      .number()
      .min(-2)
      .max(2)
      .default(defaultModelConfigs.frequencyPenalty ?? 0)
      .openapi({ description: 'Penalizes new tokens based on their frequency in the text so far.', example: 0 }),
    presencePenalty: z
      .number()
      .min(-2)
      .max(2)
      .default(defaultModelConfigs.presencePenalty ?? 0)
      .openapi({ description: 'Penalizes new tokens based on whether they appear in the text so far.', example: 0 })
    // stream: z.boolean().default(defaultModelConfigs.stream ?? true).openapi({ description: "Whether to stream back partial progress.", example: true }),
  })
  .openapi('ChatModelSettings', { description: 'Configuration parameters for the AI chat model generation.' })
export type ChatModelSettings = z.infer<typeof chatModelSettingsSchema>

// Theme Schema
export const themeSchema = z
  .enum(['light', 'dark'])
  .default('light')
  .openapi('Theme', { description: 'Application color theme options.' })
export type Theme = z.infer<typeof themeSchema>

// App Settings - Now includes global chat model settings
export const appSettingsSchema = z
  .object({
    language: z
      .string()
      .optional()
      .default('en')
      .openapi({ description: 'Application display language code.', example: 'en' }),
    theme: themeSchema
      .optional()
      .default('light')
      .openapi({ description: 'Selected application color theme.', example: 'dark' }),
    codeThemeLight: z.string().optional().default('atomOneLight').openapi({
      description: 'Name of the code syntax highlighting theme used in light mode.',
      example: 'githubLight'
    }),
    codeThemeDark: z
      .string()
      .optional()
      .default('atomOneDark')
      .openapi({ description: 'Name of the code syntax highlighting theme used in dark mode.', example: 'monokai' }),
    ollamaGlobalUrl: z
      .string()
      .url()
      .optional()
      .default('http://localhost:11434')
      .openapi({ description: 'Base URL for the Ollama server instance.', example: 'http://192.168.1.100:11434' }),
    lmStudioGlobalUrl: z
      .string()
      .url()
      .optional()
      .default('http://localhost:1234')
      .openapi({ description: 'Base URL for the LM Studio local inference server.', example: 'http://localhost:1234' }), // Default corrected based on common LM Studio port
    promptlianoServerUrl: z.string().url().optional().default('http://localhost:3147').openapi({
      description: 'URL of the Promptliano server to connect to. Can be changed to connect to remote servers.',
      example: 'http://localhost:3147'
    }),
    promptlianoServerUrls: z
      .array(
        z.object({
          name: z
            .string()
            .openapi({ description: 'Friendly name for this server configuration', example: 'Local Dev' }),
          url: z.string().url().openapi({ description: 'Server URL', example: 'http://localhost:3147' }),
          isDefault: z.boolean().optional().openapi({ description: 'Whether this is the default server' })
        })
      )
      .optional()
      .default([])
      .openapi({
        description: 'Saved server configurations for quick switching between different Promptliano servers',
        example: [
          { name: 'Local Dev', url: 'http://localhost:3147', isDefault: true },
          { name: 'Production', url: 'https://api.promptliano.com', isDefault: false }
        ]
      }),
    summarizationIgnorePatterns: z
      .array(z.string())
      .optional()
      .default([])
      .openapi({
        description: 'Glob patterns for files/folders to ignore during automatic summarization.',
        example: ['**/node_modules/**', '**/*.log']
      }),
    summarizationAllowPatterns: z
      .array(z.string())
      .optional()
      .default([])
      .openapi({
        description:
          'Glob patterns for files/folders to explicitly include in summarization (if ignore patterns also match).',
        example: ['src/**/*.ts']
      }),
    summarizationEnabledProjectIds: z
      .array(z.number())
      .optional()
      .default([])
      .openapi({
        description: 'List of project IDs for which automatic summarization is enabled.',
        example: [123, 456]
      }),
    useSpacebarToSelectAutocomplete: z
      .boolean()
      .optional()
      .default(true)
      .openapi({ description: 'Whether pressing Spacebar accepts the current autocomplete suggestion.' }),
    hideInformationalTooltips: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ description: 'Whether to hide tooltips that provide general information or tips.' }),
    autoScrollEnabled: z
      .boolean()
      .optional()
      .default(true)
      .openapi({ description: 'Whether the chat view should automatically scroll to the bottom on new messages.' }),

    // Global Chat Model Settings (Referencing the detailed modelSettingsSchema fields)
    provider: providerSchema
      .optional()
      .default(defaultModelConfigs.provider as APIProviders)
      .openapi({ description: 'Default AI provider to use for chat.', example: 'openrouter' }),
    model: z
      .string()
      .optional()
      .default(defaultModelConfigs.model ?? 'gpt-4o')
      .openapi({ description: 'Default AI model name to use for chat.', example: 'gpt-4o' }),
    temperature: chatModelSettingsSchema.shape.temperature,
    maxTokens: chatModelSettingsSchema.shape.maxTokens,
    topP: chatModelSettingsSchema.shape.topP,
    frequencyPenalty: chatModelSettingsSchema.shape.frequencyPenalty,
    presencePenalty: chatModelSettingsSchema.shape.presencePenalty,
    // stream: chatModelSettingsSchema.shape.stream,
    enableChatAutoNaming: z
      .boolean()
      .optional()
      .default(true)
      .openapi({ description: 'Whether to automatically name new chats based on their initial content.' })
  })
  .openapi('AppSettings', {
    description: 'Global application settings, including theme, AI provider configuration, and default chat parameters.'
  })

// Base schemas for partial updates (Project only) - Not directly used in GlobalState, but good practice
export const projectTabStateBaseSchema = projectTabStateSchema.partial()
export type ProjectTabStatePartial = z.infer<typeof projectTabStateBaseSchema>

// Record schemas for the store state (Project only)
export const projectTabsStateRecordSchema = z
  .record(z.string(), projectTabStateSchema)
  .openapi('ProjectTabsStateRecord', {
    description: 'A map where keys are project tab IDs and values are the state objects for each tab.'
  })

// Chat Link Settings Schema
export const chatLinkSettingsSchema = z
  .record(
    z.string(), // Key is chat ID
    z
      .object({
        includeSelectedFiles: z.boolean().optional().default(false).openapi({
          description: 'Whether currently selected files from the linked project tab should be included as context.'
        }),
        includePrompts: z
          .boolean()
          .optional()
          .default(false)
          .openapi({ description: 'Whether selected prompts from the linked project tab should be included.' }),
        includeUserPrompt: z
          .boolean()
          .optional()
          .default(false)
          .openapi({ description: 'Whether the user prompt input from the linked project tab should be included.' }),
        linkedProjectTabId: z
          .string()
          .nullable()
          .optional()
          .openapi({ description: 'The ID of the project tab this chat is linked to, or null if not linked.' })
      })
      .openapi('ChatLinkSetting', {
        description: 'Settings defining how a chat is linked to a project tab and what context is shared.'
      })
  )
  .optional()
  .default({})
  .openapi('ChatLinkSettingsMap', {
    description: 'A map where keys are chat IDs and values are the link settings for that chat.'
  })

// Global State Schema - The main object
export const globalStateSchema = z
  .object({
    appSettings: appSettingsSchema.openapi({ description: 'Application-wide settings.' }),
    projectTabs: projectTabsStateRecordSchema.openapi({
      description: 'State of all open project tabs, keyed by tab ID.'
    }),
    projectActiveTabId: idSchemaSpec,
    activeChatId: idSchemaSpec,
    chatLinkSettings: chatLinkSettingsSchema.openapi({ description: 'Link settings specific to each chat session.' })
  })
  .openapi('GlobalState', { description: 'Represents the entire persistent application state.' })

// this is the best place to set the default values for the global state
// Initial Global State - Simplified (Function doesn't need OpenAPI spec, but uses the schemas)
export const createInitialGlobalState = (): GlobalState => {
  try {
    return {
      appSettings: appSettingsSchema.parse({}), // Use parse with empty object to get defaults
      projectTabs: {
        // Keep default project tab if project tabs are still used
        defaultTab: projectTabStateSchema.parse({
          // Use parse to get defaults
          displayName: 'Default Project Tab' // Override default display name
          // Set any other non-default initial values if needed
        })
      },
      projectActiveTabId: 1, // Assuming project tabs remain
      activeChatId: -1,
      chatLinkSettings: {}
    }
  } catch (error) {
    console.error('Failed to create initial global state, falling back to safe defaults:', error)
    // Fallback to safe defaults if schema parsing fails
    return createSafeGlobalState()
  }
}

// Safe fallback function that creates state without schema validation
export const createSafeGlobalState = (): GlobalState => ({
  appSettings: {
    language: 'en',
    theme: 'light' as Theme,
    codeThemeLight: 'atomOneLight',
    codeThemeDark: 'atomOneDark',
    ollamaGlobalUrl: 'http://localhost:11434',
    lmStudioGlobalUrl: 'http://localhost:1234',
    promptlianoServerUrl: 'http://localhost:3147',
    promptlianoServerUrls: [],
    summarizationIgnorePatterns: [],
    summarizationAllowPatterns: [],
    summarizationEnabledProjectIds: [],
    useSpacebarToSelectAutocomplete: true,
    hideInformationalTooltips: false,
    autoScrollEnabled: true,
    provider: defaultModelConfigs.provider as APIProviders,
    model: defaultModelConfigs.model ?? 'gpt-4o',
    temperature: defaultModelConfigs.temperature ?? 0.7,
    maxTokens: defaultModelConfigs.maxTokens ?? 4096,
    topP: defaultModelConfigs.topP ?? 1,
    frequencyPenalty: defaultModelConfigs.frequencyPenalty ?? 0,
    presencePenalty: defaultModelConfigs.presencePenalty ?? 0,
    enableChatAutoNaming: true
  },
  projectTabs: {
    defaultTab: {
      selectedProjectId: -1,
      editProjectId: -1,
      promptDialogOpen: false,
      editPromptId: -1,
      fileSearch: '',
      selectedFiles: [],
      selectedFilePaths: [],
      selectedPrompts: [],
      userPrompt: '',
      searchByContent: false,
      displayName: 'Default Project Tab',
      resolveImports: false,
      preferredEditor: 'vscode' as const,
      suggestedFileIds: [],
      bookmarkedFileGroups: {},
      bookmarkedFileGroupsPaths: {},
      sortOrder: 0,
      ticketSearch: '',
      ticketSort: 'created_desc' as const,
      ticketStatusFilter: 'non_closed' as const,
      ticketQueueFilter: 'all' as const,
      promptsPanelCollapsed: true,
      selectedFilesCollapsed: false,
      claudeCodeEnabled: false,
      assetsEnabled: false,
      autoIncludeClaudeMd: false,
      instructionFileSettings: {
        autoIncludeEnabled: false,
        fileTypes: ['claude'],
        priority: 'claude' as const,
        includeGlobal: false,
        includeProjectRoot: true,
        includeHierarchy: true
      }
    }
  },
  projectActiveTabId: 1,
  activeChatId: -1,
  chatLinkSettings: {}
})

// Validates and repairs global state, falling back to safe defaults if needed
export const validateAndRepairGlobalState = (state: unknown): GlobalState => {
  try {
    return globalStateSchema.parse(state)
  } catch (error) {
    console.warn('Invalid global state detected, attempting repair:', error)

    // Try to repair by merging with safe defaults
    if (state && typeof state === 'object') {
      try {
        const safeState = createSafeGlobalState()
        const mergedState = {
          ...safeState,
          ...(state as Record<string, unknown>),
          appSettings: {
            ...safeState.appSettings,
            ...((state as any)?.appSettings || {})
          },
          projectTabs: {
            ...safeState.projectTabs,
            ...((state as any)?.projectTabs || {})
          }
        }
        return globalStateSchema.parse(mergedState)
      } catch (repairError) {
        console.error('Failed to repair state, using safe defaults:', repairError)
      }
    }

    return createSafeGlobalState()
  }
}

// Helper function to get default app settings cleanly
export function getDefaultAppSettings(): AppSettings {
  return appSettingsSchema.parse({})
}

// Helper function to get default project tab state cleanly
export function getDefaultProjectTabState(displayName: string = 'Default Project Tab'): ProjectTabState {
  return projectTabStateSchema.parse({ displayName })
}

export type ProjectTabState = z.infer<typeof projectTabStateSchema>
export type ProjectTabsStateRecord = z.infer<typeof projectTabsStateRecordSchema>
export type ChatLinkSettingsMap = z.infer<typeof chatLinkSettingsSchema>
export type AppSettings = z.infer<typeof appSettingsSchema>
export type GlobalState = z.infer<typeof globalStateSchema>
