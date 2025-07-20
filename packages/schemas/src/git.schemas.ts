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

export const gitLogResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(gitLogEntrySchema).optional(),
  hasMore: z.boolean().optional(),
  message: z.string().optional()
})

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
  staged: z.union([
    z.boolean(),
    z.string().transform((val) => val === 'true')
  ]).optional().describe('Get staged diff instead of working directory diff'),
  commit: z.string().optional().describe('Get diff for a specific commit')
})

export type GitDiffRequest = z.infer<typeof gitDiffRequestSchema>

export const gitDiffResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    filePath: z.string(),
    diff: z.string().describe('The raw diff content'),
    staged: z.boolean(),
    commit: z.string().optional()
  }).optional(),
  message: z.string().optional()
})

export type GitDiffResponse = z.infer<typeof gitDiffResponseSchema>
