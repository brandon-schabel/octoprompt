// Re-export shared types from base client
export type { ApiConfig, DataResponseSchema } from './base-client'
export { PromptlianoError } from './base-client'

// Import and re-export commonly used types from schemas
export type { 
  CreateChatBody, 
  UpdateChatBody, 
  AiChatStreamRequest, 
  Chat, 
  ChatMessage 
} from '@promptliano/schemas'

export type {
  CreateProjectBody,
  Project,
  ProjectFile,
  UpdateProjectBody,
  ProjectStatistics
} from '@promptliano/schemas'

export type { 
  CreatePromptBody, 
  UpdatePromptBody, 
  OptimizePromptRequest, 
  Prompt 
} from '@promptliano/schemas'

export type { 
  CreateProviderKeyBody, 
  ProviderKey, 
  UpdateProviderKeyBody 
} from '@promptliano/schemas'

export type { 
  CreateClaudeAgentBody, 
  UpdateClaudeAgentBody, 
  ClaudeAgent 
} from '@promptliano/schemas'

export type {
  TestProviderRequest,
  TestProviderResponse,
  BatchTestProviderRequest,
  BatchTestProviderResponse,
  ProviderHealthStatus,
  ValidateCustomProviderRequest,
  CustomProviderFeatures,
  ProviderModel
} from '@promptliano/schemas'

export type {
  AiGenerateTextRequest,
  UnifiedModel
} from '@promptliano/schemas'

// Git-related types
export type {
  GitBranch,
  GitCommit,
  GitStatus,
  GitStash,
  GitWorktree,
  GitFileDiff,
  GitDiff,
  GitRemote,
  GitTag,
  GitBlame,
  GitLogEntry,
  GitDiffResponse,
  GitOperationResponse,
  GitStatusResult,
  GetProjectGitStatusResponse,
  GitBranchListResponse,
  GitLogResponse,
  GitCommitDetailResponse,
  GitWorktreeListResponse,
  GitWorktreePruneResponse,
  GitLogEnhancedRequest,
  GitLogEnhancedResponse,
  GitBranchListEnhancedResponse,
  GitCompareCommitsResponse
} from '@promptliano/schemas'

// Ticket and Queue types
export type {
  Ticket,
  CreateTicketBody,
  UpdateTicketBody,
  CreateTaskBody,
  UpdateTaskBody,
  TicketWithTasks,
  CreateQueueBody,
  UpdateQueueBody,
  QueueItem,
  QueueStats,
  EnqueueItemBody,
  QueueWithStats,
  TicketTask
} from '@promptliano/schemas'

// Import types that will be redefined locally to avoid conflicts
import type {
  GetNextTaskResponse as SchemaGetNextTaskResponse,
  QueueTimeline as SchemaQueueTimeline,
  TicketWithTaskCount as SchemaTicketWithTaskCount
} from '@promptliano/schemas'

// Define Task alias for backwards compatibility
export type Task = TicketTask

export type Queue = {
  id: number
  name: string
  description?: string
  projectId: number
  status?: 'active' | 'paused' | 'inactive'
  maxParallelItems?: number
  created: number
  updated: number
}

// Missing types needed by queue client
export type CompleteTaskBody = {
  itemType: 'ticket' | 'task'
  itemId: number
  ticketId?: number
  completionNotes?: string
}

export type FailTaskBody = {
  itemType: 'ticket' | 'task'
  itemId: number
  ticketId?: number
  errorMessage: string
}

// Re-export types from schemas to avoid conflicts
export type GetNextTaskResponse = SchemaGetNextTaskResponse
export type QueueTimeline = SchemaQueueTimeline
export type TicketWithTaskCount = SchemaTicketWithTaskCount


// MCP types (using basic types from schemas, complex ones defined in client)
export type {
  MCPServerConfig,
  MCPServerConfigResponse,
  MCPToolExecutionRequest,
  MCPToolExecutionResult,
  MCPServerState,
  MCPTool,
  MCPResource,
  CreateMCPServerConfigBody,
  UpdateMCPServerConfigBody
} from '@promptliano/schemas'


// Additional types that will be defined in individual client modules
// as needed rather than importing from schemas to avoid import errors

// Note: Complex types for MCP, Flow, Agent Files, Claude Code, and Markdown
// are defined within their respective client modules to avoid dependency issues.

// Define missing types here to satisfy type checker
export type MCPGlobalConfig = {
  mcpEnabled: boolean
  defaultServers: Array<{
    name: string
    command: string
    args: string[]
  }>
  maxConcurrentServers: number
  serverTimeoutMs: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export type MCPProjectConfig = {
  projectId: number
  mcpEnabled: boolean
  servers: Array<{
    id: number
    name: string
    command: string
    args: string[]
    autoStart: boolean
  }>
  customInstructions?: string
}


export type MCPInstallationStatus = {
  isInstalled: boolean
  version?: string
  servers: Array<{
    id: number
    name: string
    status: 'running' | 'stopped' | 'error'
  }>
  lastUpdated: number
}

export type MCPAnalyticsData = {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  toolUsage: Array<{
    toolName: string
    count: number
    averageTime: number
  }>
  serverStats: Array<{
    serverId: number
    serverName: string
    executions: number
    uptime: number
  }>
}

export type MCPInstallRequest = {
  tools: string[]
  customInstructions?: string
}

export type MCPInstallResponse = {
  success: boolean
  data: {
    installationId: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    message?: string
  }
}

export type MCPUninstallRequest = {
  removeAll?: boolean
  tools?: string[]
}

export type MCPUninstallResponse = {
  success: boolean
  data: {
    status: 'completed' | 'failed'
    message?: string
  }
}

export type MCPProjectConfigRequest = {
  mcpEnabled?: boolean
  servers?: Array<{
    name: string
    command: string
    args: string[]
    autoStart?: boolean
  }>
  customInstructions?: string
}

export type MCPProjectConfigResponse = {
  success: boolean
  data: MCPProjectConfig
}

// Note: CreateMCPServerConfigBody and UpdateMCPServerConfigBody are already imported from schemas above


// Git-related types that are missing from schemas
export type GitDiffFile = {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  insertions: number
  deletions: number
  binary: boolean
}

export type GitCommitDetails = {
  hash: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
  parents: string[]
  files: Array<{
    path: string
    status: string
    insertions: number
    deletions: number
  }>
  stats: {
    total: number
    insertions: number
    deletions: number
  }
}

export type CommitSummaryRequest = {
  projectId: number
  commitHash: string
}

export type FileCommitHistoryRequest = {
  projectId: number
  filePath: string
  limit?: number
}

export type GitOperationRequest = {
  projectId: number
  operation: string
  parameters?: Record<string, any>
}

export type GitBranchOperationRequest = {
  projectId: number
  branchName: string
  operation: 'create' | 'delete' | 'switch' | 'merge'
  startPoint?: string
  force?: boolean
}

export type GitStashOperationRequest = {
  projectId: number
  operation: 'save' | 'apply' | 'pop' | 'drop'
  stashRef?: string
  message?: string
}

export type GitWorktreeOperationRequest = {
  projectId: number
  operation: 'add' | 'remove' | 'list' | 'lock' | 'unlock'
  path?: string
  branch?: string
  force?: boolean
}

export type GitDiffRequest = {
  projectId: number
  filePath?: string
  commitHash1?: string
  commitHash2?: string
  staged?: boolean
}