import { z } from 'zod'

export const gitFileStatusTypeSchema = z.enum([
  'added',
  'modified',
  'deleted',
  'renamed',
  'copied',
  'untracked',
  'ignored',
  'unchanged'
])

export type GitFileStatusType = z.infer<typeof gitFileStatusTypeSchema>

export const gitFileStatusSchema = z.object({
  path: z.string().describe('The file path relative to the repository root'),
  status: gitFileStatusTypeSchema.describe('The git status of the file'),
  staged: z.boolean().describe('Whether the file is staged for commit'),
  index: z.string().nullable().describe('The index status code from git'),
  workingDir: z.string().nullable().describe('The working directory status code from git')
})

export type GitFileStatus = z.infer<typeof gitFileStatusSchema>

export const gitStatusSchema = z.object({
  isRepo: z.boolean().describe('Whether the directory is a git repository'),
  current: z.string().nullable().describe('The current branch name'),
  tracking: z.string().nullable().describe('The tracking branch name'),
  ahead: z.number().describe('Number of commits ahead of tracking branch'),
  behind: z.number().describe('Number of commits behind tracking branch'),
  files: z.array(gitFileStatusSchema).describe('List of files with git status'),
  staged: z.array(z.string()).describe('List of staged file paths'),
  modified: z.array(z.string()).describe('List of modified file paths'),
  created: z.array(z.string()).describe('List of created file paths'),
  deleted: z.array(z.string()).describe('List of deleted file paths'),
  renamed: z.array(z.string()).describe('List of renamed file paths'),
  conflicted: z.array(z.string()).describe('List of conflicted file paths')
})

export type GitStatus = z.infer<typeof gitStatusSchema>

export const gitStatusErrorSchema = z.object({
  type: z.enum(['not_a_repo', 'git_not_installed', 'permission_denied', 'unknown']),
  message: z.string()
})

export type GitStatusError = z.infer<typeof gitStatusErrorSchema>

export const gitStatusResultSchema = z.union([
  z.object({
    success: z.literal(true),
    data: gitStatusSchema
  }),
  z.object({
    success: z.literal(false),
    error: gitStatusErrorSchema
  })
])

export type GitStatusResult = z.infer<typeof gitStatusResultSchema>

export const getProjectGitStatusResponseSchema = z.object({
  success: z.boolean(),
  data: gitStatusResultSchema.optional(),
  message: z.string().optional()
})

export type GetProjectGitStatusResponse = z.infer<typeof getProjectGitStatusResponseSchema>

// Stage/Unstage request schemas
export const stageFilesRequestSchema = z.object({
  filePaths: z.array(z.string()).describe('Array of file paths to stage')
})

export type StageFilesRequest = z.infer<typeof stageFilesRequestSchema>

export const unstageFilesRequestSchema = z.object({
  filePaths: z.array(z.string()).describe('Array of file paths to unstage')
})

export type UnstageFilesRequest = z.infer<typeof unstageFilesRequestSchema>

// Generic success response for git operations
export const gitOperationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional()
})

export type GitOperationResponse = z.infer<typeof gitOperationResponseSchema>

// Branch schemas
export const gitBranchSchema = z.object({
  name: z.string().describe('Branch name'),
  current: z.boolean().describe('Whether this is the current branch'),
  isRemote: z.boolean().describe('Whether this is a remote branch'),
  commit: z.string().describe('Latest commit hash'),
  tracking: z.string().nullable().describe('Tracking branch name'),
  ahead: z.number().describe('Commits ahead of tracking branch'),
  behind: z.number().describe('Commits behind tracking branch')
})

export type GitBranch = z.infer<typeof gitBranchSchema>

// Commit schemas
export const gitCommitAuthorSchema = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string().describe('ISO date string')
})

export const gitCommitSchema = z.object({
  hash: z.string().describe('Commit hash'),
  message: z.string().describe('Commit message'),
  author: gitCommitAuthorSchema,
  committer: gitCommitAuthorSchema,
  parents: z.array(z.string()).describe('Parent commit hashes'),
  files: z.array(z.string()).describe('Files changed in this commit').optional()
})

export type GitCommit = z.infer<typeof gitCommitSchema>

// Log entry schema (simplified commit info for logs)
export const gitLogEntrySchema = z.object({
  hash: z.string(),
  abbreviatedHash: z.string(),
  message: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string()
  }),
  date: z.string(),
  refs: z.string().optional().describe('Branch/tag references')
})

export type GitLogEntry = z.infer<typeof gitLogEntrySchema>

// Diff schemas
export const gitDiffFileSchema = z.object({
  path: z.string(),
  type: z.enum(['added', 'modified', 'deleted', 'renamed']),
  additions: z.number(),
  deletions: z.number(),
  binary: z.boolean(),
  oldPath: z.string().optional().describe('For renamed files')
})

export const gitDiffSchema = z.object({
  files: z.array(gitDiffFileSchema),
  additions: z.number().describe('Total additions'),
  deletions: z.number().describe('Total deletions'),
  content: z.string().optional().describe('Diff content for single file')
})

export type GitDiff = z.infer<typeof gitDiffSchema>

// Remote schemas
export const gitRemoteSchema = z.object({
  name: z.string(),
  fetch: z.string().describe('Fetch URL'),
  push: z.string().describe('Push URL')
})

export type GitRemote = z.infer<typeof gitRemoteSchema>

// Tag schemas
export const gitTagSchema = z.object({
  name: z.string(),
  commit: z.string().describe('Commit hash'),
  annotation: z.string().optional().describe('Tag message for annotated tags'),
  tagger: gitCommitAuthorSchema.optional().describe('Tagger info for annotated tags')
})

export type GitTag = z.infer<typeof gitTagSchema>

// Stash schemas
export const gitStashSchema = z.object({
  index: z.number(),
  message: z.string(),
  branch: z.string().describe('Branch where stash was created'),
  date: z.string()
})

export type GitStash = z.infer<typeof gitStashSchema>

// Blame schemas
export const gitBlameLineSchema = z.object({
  line: z.number(),
  content: z.string(),
  commit: z.string().describe('Commit hash'),
  author: z.string(),
  date: z.string()
})

export type GitBlameLine = z.infer<typeof gitBlameLineSchema>

export const gitBlameSchema = z.object({
  path: z.string(),
  lines: z.array(gitBlameLineSchema)
})

export type GitBlame = z.infer<typeof gitBlameSchema>

// Request/Response schemas for new operations
export const gitBranchListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(gitBranchSchema).optional(),
  message: z.string().optional()
})

export type GitBranchListResponse = z.infer<typeof gitBranchListResponseSchema>

export const gitLogResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(gitLogEntrySchema).optional(),
  hasMore: z.boolean().optional(),
  message: z.string().optional()
})

export type GitLogResponse = z.infer<typeof gitLogResponseSchema>

export const gitCreateBranchRequestSchema = z.object({
  name: z.string(),
  startPoint: z.string().optional().describe('Branch or commit to start from')
})

export const gitSwitchBranchRequestSchema = z.object({
  name: z.string(),
  createIfNotExists: z.boolean().optional()
})

export const gitMergeBranchRequestSchema = z.object({
  branch: z.string(),
  noFastForward: z.boolean().optional(),
  message: z.string().optional()
})

export const gitPushRequestSchema = z.object({
  remote: z.string().optional().default('origin'),
  branch: z.string().optional().describe('Current branch if not specified'),
  force: z.boolean().optional(),
  setUpstream: z.boolean().optional()
})

export const gitResetRequestSchema = z.object({
  ref: z.string().describe('Commit reference to reset to'),
  mode: z.enum(['soft', 'mixed', 'hard']).default('mixed')
})

// Git diff request/response schemas
export const gitDiffRequestSchema = z.object({
  filePath: z.string().describe('The file path to get diff for'),
  staged: z
    .union([z.boolean(), z.string().transform((val) => val === 'true')])
    .optional()
    .describe('Get staged diff instead of working directory diff'),
  commit: z.string().optional().describe('Get diff for a specific commit')
})

export type GitDiffRequest = z.infer<typeof gitDiffRequestSchema>

export const gitDiffResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      filePath: z.string(),
      diff: z.string().describe('The raw diff content'),
      staged: z.boolean(),
      commit: z.string().optional()
    })
    .optional(),
  message: z.string().optional()
})

export type GitDiffResponse = z.infer<typeof gitDiffResponseSchema>

// ============================================================================
// Enhanced Git Schemas for Commit History Viewer
// ============================================================================

// Enhanced author info with optional avatar
export const gitAuthorEnhancedSchema = z.object({
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().url().optional().describe('Gravatar or other avatar URL')
})

export type GitAuthorEnhanced = z.infer<typeof gitAuthorEnhancedSchema>

// File change statistics
export const gitFileStatsSchema = z.object({
  path: z.string().describe('File path relative to repository root'),
  additions: z.number().int().min(0).describe('Number of lines added'),
  deletions: z.number().int().min(0).describe('Number of lines removed'),
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'copied']).describe('Change type'),
  oldPath: z.string().optional().describe('Previous path for renamed/moved files')
})

export type GitFileStats = z.infer<typeof gitFileStatsSchema>

// Enhanced commit entry with full details
export const gitCommitEnhancedSchema = z.object({
  // Basic info
  hash: z.string().describe('Full SHA-1 commit hash'),
  abbreviatedHash: z.string().describe('Abbreviated commit hash (7-8 chars)'),

  // Message parts
  subject: z.string().describe('First line of commit message'),
  body: z.string().describe('Full commit message including subject'),

  // Author and committer info
  author: gitAuthorEnhancedSchema.describe('Commit author information'),
  committer: gitAuthorEnhancedSchema.describe('Committer information (may differ from author)'),

  // Timestamps
  authoredDate: z.string().describe('ISO 8601 timestamp when authored'),
  committedDate: z.string().describe('ISO 8601 timestamp when committed'),
  relativeTime: z.string().describe('Human-readable relative time (e.g., "2 hours ago")'),

  // Relationships
  parents: z.array(z.string()).describe('Parent commit hashes'),
  refs: z.array(z.string()).describe('Branch and tag references pointing to this commit'),

  // Statistics
  stats: z
    .object({
      filesChanged: z.number().int().min(0).describe('Total number of files changed'),
      additions: z.number().int().min(0).describe('Total lines added'),
      deletions: z.number().int().min(0).describe('Total lines removed')
    })
    .describe('Summary statistics for the commit'),

  // Detailed file changes (optional for performance)
  fileStats: z.array(gitFileStatsSchema).optional().describe('Per-file change statistics')
})

export type GitCommitEnhanced = z.infer<typeof gitCommitEnhancedSchema>

// Enhanced branch info with commit details
export const gitBranchEnhancedSchema = z.object({
  name: z.string().describe('Branch name'),
  current: z.boolean().describe('Whether this is the currently checked out branch'),
  isRemote: z.boolean().describe('Whether this is a remote branch'),
  isProtected: z.boolean().optional().describe('Whether the branch is protected'),

  // Latest commit info
  latestCommit: z
    .object({
      hash: z.string(),
      abbreviatedHash: z.string(),
      subject: z.string(),
      author: z.string().describe('Author name'),
      relativeTime: z.string()
    })
    .describe('Summary of the latest commit on this branch'),

  // Tracking info
  tracking: z.string().nullable().describe('Remote tracking branch'),
  ahead: z.number().int().min(0).describe('Commits ahead of tracking/main branch'),
  behind: z.number().int().min(0).describe('Commits behind tracking/main branch'),

  // Metadata
  lastActivity: z.string().optional().describe('ISO 8601 timestamp of last activity')
})

export type GitBranchEnhanced = z.infer<typeof gitBranchEnhancedSchema>

// Pagination info for commit history
export const gitPaginationSchema = z.object({
  page: z.number().int().min(1).describe('Current page number (1-based)'),
  perPage: z.number().int().min(1).max(100).describe('Number of items per page'),
  totalCount: z.number().int().min(0).optional().describe('Total number of items if available'),
  hasMore: z.boolean().describe('Whether more items are available'),
  cursor: z.string().optional().describe('Cursor for cursor-based pagination')
})

export type GitPagination = z.infer<typeof gitPaginationSchema>

// Request schemas for enhanced operations
export const gitLogEnhancedRequestSchema = z.object({
  branch: z.string().optional().describe('Branch to get commits from (default: current branch)'),
  page: z.number().int().min(1).default(1).describe('Page number for pagination'),
  perPage: z.number().int().min(1).max(100).default(20).describe('Number of commits per page'),
  search: z.string().optional().describe('Search in commit messages and authors'),
  author: z.string().optional().describe('Filter by author name or email'),
  since: z.string().optional().describe('ISO date or relative time (e.g., "2 weeks ago")'),
  until: z.string().optional().describe('ISO date or relative time'),
  includeStats: z.boolean().default(false).describe('Include file statistics (slower)'),
  includeFileDetails: z.boolean().default(false).describe('Include per-file change details (much slower)')
})

export type GitLogEnhancedRequest = z.infer<typeof gitLogEnhancedRequestSchema>

// Response schemas
export const gitLogEnhancedResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      commits: z.array(gitCommitEnhancedSchema),
      pagination: gitPaginationSchema,
      branch: z.string().describe('Branch name these commits are from')
    })
    .optional(),
  message: z.string().optional()
})

export type GitLogEnhancedResponse = z.infer<typeof gitLogEnhancedResponseSchema>

export const gitBranchListEnhancedResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      branches: z.array(gitBranchEnhancedSchema),
      current: z.string().nullable().describe('Name of current branch'),
      defaultBranch: z.string().describe('Default branch name (e.g., main, master)')
    })
    .optional(),
  message: z.string().optional()
})

export type GitBranchListEnhancedResponse = z.infer<typeof gitBranchListEnhancedResponseSchema>

// Commit detail request (for viewing a single commit)
export const gitCommitDetailRequestSchema = z.object({
  hash: z.string().describe('Commit hash (full or abbreviated)'),
  includeFileContents: z.boolean().default(false).describe('Include file content diffs')
})

export type GitCommitDetailRequest = z.infer<typeof gitCommitDetailRequestSchema>

// File diff details for commit view
export const gitFileDiffSchema = z.object({
  path: z.string(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'copied']),
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  binary: z.boolean(),
  oldPath: z.string().optional(),
  diff: z.string().optional().describe('Unified diff content if requested')
})

export type GitFileDiff = z.infer<typeof gitFileDiffSchema>

export const gitCommitDetailResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      commit: gitCommitEnhancedSchema,
      files: z.array(gitFileDiffSchema).describe('Detailed file changes'),
      totalDiff: z.string().optional().describe('Full unified diff if requested')
    })
    .optional(),
  message: z.string().optional()
})

export type GitCommitDetailResponse = z.infer<typeof gitCommitDetailResponseSchema>

// Commit comparison request
export const gitCompareCommitsRequestSchema = z.object({
  base: z.string().describe('Base commit/branch/tag'),
  head: z.string().describe('Head commit/branch/tag to compare'),
  includeStats: z.boolean().default(true).describe('Include change statistics'),
  includeDiffs: z.boolean().default(false).describe('Include file diffs')
})

export type GitCompareCommitsRequest = z.infer<typeof gitCompareCommitsRequestSchema>

export const gitCompareCommitsResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      base: z.string().describe('Resolved base commit hash'),
      head: z.string().describe('Resolved head commit hash'),
      ahead: z.number().int().min(0).describe('Commits ahead'),
      behind: z.number().int().min(0).describe('Commits behind'),
      commits: z.array(gitCommitEnhancedSchema).describe('Commits between base and head'),
      stats: z
        .object({
          filesChanged: z.number().int().min(0),
          additions: z.number().int().min(0),
          deletions: z.number().int().min(0)
        })
        .optional(),
      files: z.array(gitFileDiffSchema).optional()
    })
    .optional(),
  message: z.string().optional()
})

export type GitCompareCommitsResponse = z.infer<typeof gitCompareCommitsResponseSchema>

// ============================================================================
// Git Worktree Schemas
// ============================================================================

export const gitWorktreeSchema = z.object({
  path: z.string().describe('Absolute path to the worktree'),
  branch: z.string().describe('Branch checked out in this worktree'),
  commit: z.string().describe('Current commit hash'),
  isMain: z.boolean().describe('Whether this is the main worktree'),
  isLocked: z.boolean().describe('Whether the worktree is locked'),
  lockReason: z.string().optional().describe('Reason for locking if locked'),
  prunable: z.boolean().optional().describe('Whether the worktree can be pruned')
})

export type GitWorktree = z.infer<typeof gitWorktreeSchema>

export const gitWorktreeListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(gitWorktreeSchema).optional(),
  message: z.string().optional()
})

export type GitWorktreeListResponse = z.infer<typeof gitWorktreeListResponseSchema>

export const gitWorktreeAddRequestSchema = z.object({
  path: z.string().describe('Path where to create the worktree'),
  branch: z.string().optional().describe('Branch to check out'),
  newBranch: z.string().optional().describe('Create new branch with this name'),
  commitish: z.string().optional().describe('Commit/tag to check out'),
  detach: z.boolean().optional().describe('Detach HEAD at specified commit')
})

export type GitWorktreeAddRequest = z.infer<typeof gitWorktreeAddRequestSchema>

export const gitWorktreeRemoveRequestSchema = z.object({
  path: z.string().describe('Path of the worktree to remove'),
  force: z.boolean().optional().describe('Force removal even with uncommitted changes')
})

export type GitWorktreeRemoveRequest = z.infer<typeof gitWorktreeRemoveRequestSchema>

export const gitWorktreeLockRequestSchema = z.object({
  path: z.string().describe('Path of the worktree to lock'),
  reason: z.string().optional().describe('Reason for locking')
})

export type GitWorktreeLockRequest = z.infer<typeof gitWorktreeLockRequestSchema>

export const gitWorktreePruneRequestSchema = z.object({
  dryRun: z.boolean().optional().describe('Only show what would be pruned')
})

export type GitWorktreePruneRequest = z.infer<typeof gitWorktreePruneRequestSchema>

export const gitWorktreePruneResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.string()).optional().describe('Paths that were pruned or would be pruned'),
  message: z.string().optional()
})

export type GitWorktreePruneResponse = z.infer<typeof gitWorktreePruneResponseSchema>
