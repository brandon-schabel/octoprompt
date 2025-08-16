import { z } from '@hono/zod-openapi'

// Project Manager Types
export enum ProjectManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  GET_SUMMARY = 'get_summary',
  GET_SUMMARY_ADVANCED = 'get_summary_advanced',
  GET_SUMMARY_METRICS = 'get_summary_metrics',
  BROWSE_FILES = 'browse_files',
  GET_FILE_CONTENT = 'get_file_content',
  UPDATE_FILE_CONTENT = 'update_file_content',
  SUGGEST_FILES = 'suggest_files',
  GET_SELECTION_CONTEXT = 'get_selection_context',
  SEARCH = 'search',
  CREATE_FILE = 'create_file',
  GET_FILE_CONTENT_PARTIAL = 'get_file_content_partial',
  DELETE_FILE = 'delete_file',
  GET_FILE_TREE = 'get_file_tree',
  OVERVIEW = 'overview'
}

export const ProjectManagerSchema = z.object({
  action: z.nativeEnum(ProjectManagerAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

// Prompt Manager Types
export enum PromptManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_BY_PROJECT = 'list_by_project',
  ADD_TO_PROJECT = 'add_to_project',
  REMOVE_FROM_PROJECT = 'remove_from_project',
  SUGGEST_PROMPTS = 'suggest_prompts'
}

export const PromptManagerSchema = z.object({
  action: z.nativeEnum(PromptManagerAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

// Agent Manager Types
export enum AgentManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_BY_PROJECT = 'list_by_project',
  ASSOCIATE_WITH_PROJECT = 'associate_with_project',
  SUGGEST_AGENTS = 'suggest_agents'
}

export const AgentManagerSchema = z.object({
  action: z.nativeEnum(AgentManagerAction),
  agentId: z.string().optional(),
  projectId: z.number().optional(),
  data: z.any().optional()
})

// Ticket Manager Types
export enum TicketManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_WITH_TASK_COUNT = 'list_with_task_count',
  SUGGEST_TASKS = 'suggest_tasks',
  AUTO_GENERATE_TASKS = 'auto_generate_tasks',
  SUGGEST_FILES = 'suggest_files',
  SEARCH = 'search',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete'
}

export const TicketManagerSchema = z.object({
  action: z.nativeEnum(TicketManagerAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

// Task Manager Types
export enum TaskManagerAction {
  LIST = 'list',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  REORDER = 'reorder',
  SUGGEST_FILES = 'suggest_files',
  UPDATE_CONTEXT = 'update_context',
  GET_WITH_CONTEXT = 'get_with_context',
  ANALYZE_COMPLEXITY = 'analyze_complexity',
  FILTER = 'filter',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete',
  BATCH_MOVE = 'batch_move'
}

export const TaskManagerSchema = z.object({
  action: z.nativeEnum(TaskManagerAction),
  ticketId: z.number().optional(),
  data: z.any().optional()
})

// Git Manager Types
export enum GitManagerAction {
  STATUS = 'status',
  STAGE_FILES = 'stage_files',
  UNSTAGE_FILES = 'unstage_files',
  STAGE_ALL = 'stage_all',
  UNSTAGE_ALL = 'unstage_all',
  COMMIT = 'commit',
  BRANCHES = 'branches',
  CURRENT_BRANCH = 'current_branch',
  CREATE_BRANCH = 'create_branch',
  SWITCH_BRANCH = 'switch_branch',
  DELETE_BRANCH = 'delete_branch',
  MERGE_BRANCH = 'merge_branch',
  LOG = 'log',
  LOG_ENHANCED = 'log_enhanced',
  COMMIT_DETAILS = 'commit_details',
  COMMIT_DETAIL = 'commit_detail',
  FILE_DIFF = 'file_diff',
  COMMIT_DIFF = 'commit_diff',
  CHERRY_PICK = 'cherry_pick',
  REMOTES = 'remotes',
  ADD_REMOTE = 'add_remote',
  REMOVE_REMOTE = 'remove_remote',
  FETCH = 'fetch',
  PULL = 'pull',
  PUSH = 'push',
  TAGS = 'tags',
  CREATE_TAG = 'create_tag',
  DELETE_TAG = 'delete_tag',
  STASH = 'stash',
  STASH_LIST = 'stash_list',
  STASH_APPLY = 'stash_apply',
  STASH_DROP = 'stash_drop',
  STASH_POP = 'stash_pop',
  STASH_CLEAR = 'stash_clear',
  RESET = 'reset',
  CHECKOUT = 'checkout',
  REBASE = 'rebase',
  REVERT = 'revert',
  CLONE = 'clone',
  GET_IGNORED_FILES = 'get_ignored_files',
  ADD_TO_GITIGNORE = 'add_to_gitignore',
  // Additional Git actions
  BLAME = 'blame',
  CLEAN = 'clean',
  CONFIG_GET = 'config_get',
  CONFIG_SET = 'config_set',
  BRANCHES_ENHANCED = 'branches_enhanced',
  WORKTREE_LIST = 'worktree_list',
  WORKTREE_ADD = 'worktree_add',
  WORKTREE_REMOVE = 'worktree_remove',
  WORKTREE_LOCK = 'worktree_lock',
  WORKTREE_UNLOCK = 'worktree_unlock',
  WORKTREE_PRUNE = 'worktree_prune'
}

export const GitManagerSchema = z.object({
  action: z.nativeEnum(GitManagerAction),
  projectId: z.number(),
  data: z.any().optional()
})

// File Summarization Manager Types
export enum FileSummarizationManagerAction {
  IDENTIFY_UNSUMMARIZED = 'identify_unsummarized',
  GROUP_FILES = 'group_files',
  SUMMARIZE_BATCH = 'summarize_batch',
  GET_PROGRESS = 'get_progress',
  CANCEL_BATCH = 'cancel_batch',
  GET_SUMMARY_STATS = 'get_summary_stats'
}

export const FileSummarizationManagerSchema = z.object({
  action: z.nativeEnum(FileSummarizationManagerAction),
  projectId: z.number(),
  data: z.any().optional()
})

// AI Assistant Types (already migrated but included for completeness)
export enum AIAssistantAction {
  OPTIMIZE_PROMPT = 'optimize_prompt',
  GET_COMPACT_SUMMARY = 'get_compact_summary',
  GET_COMPACT_SUMMARY_WITH_OPTIONS = 'get_compact_summary_with_options'
}

export const AIAssistantSchema = z.object({
  action: z.nativeEnum(AIAssistantAction),
  projectId: z.number(),
  data: z.any().optional()
})

// Tab Manager Types (already migrated but included for completeness)
export enum TabManagerAction {
  GET_ACTIVE = 'get_active',
  SET_ACTIVE = 'set_active',
  CLEAR_ACTIVE = 'clear_active',
  GENERATE_NAME = 'generate_name'
}

export const TabManagerSchema = z.object({
  action: z.nativeEnum(TabManagerAction),
  data: z.any().optional()
})


// Markdown Prompt Manager Types
export enum MarkdownPromptManagerAction {
  IMPORT_MARKDOWN = 'import_markdown',
  EXPORT_MARKDOWN = 'export_markdown',
  VALIDATE_MARKDOWN = 'validate_markdown',
  BULK_IMPORT = 'bulk_import'
}

export const MarkdownPromptManagerSchema = z.object({
  action: z.nativeEnum(MarkdownPromptManagerAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})
