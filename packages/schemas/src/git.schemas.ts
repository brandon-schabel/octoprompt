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
