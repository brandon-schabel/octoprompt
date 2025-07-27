import { type JobHandler } from '../job-service'
import { getWorktrees, addWorktree, removeWorktree, pruneWorktrees, lockWorktree, unlockWorktree } from '../git-service'
import {
  gitWorktreeAddRequestSchema,
  gitWorktreeRemoveRequestSchema,
  gitWorktreeLockRequestSchema,
  gitWorktreePruneRequestSchema
} from '@promptliano/schemas'
import { z } from 'zod'

// Simple schema for unlock operation (just needs path)
const unlockWorktreeOptionsSchema = z.object({
  path: z.string().describe('Path of the worktree to unlock')
})

// Git worktree add handler
export const gitWorktreeAddHandler: JobHandler = {
  type: 'git.worktree.add',
  name: 'Add Git Worktree',
  description: 'Create a new git worktree',
  timeout: 120000, // 2 minutes

  validate: (input) => {
    return gitWorktreeAddRequestSchema.safeParse(input).success
  },

  execute: async (job, context) => {
    const { projectId } = job
    if (!projectId) {
      throw new Error('Project ID is required for git worktree operations')
    }

    const options = gitWorktreeAddRequestSchema.parse(job.input)

    context.log(`Creating worktree at path: ${options.path}`)
    await context.updateProgress({
      current: 1,
      total: 4,
      message: 'Validating worktree path...'
    })

    // Check if cancelled
    if (await context.checkCancelled()) {
      throw new Error('Job cancelled by user')
    }

    await context.updateProgress({
      current: 2,
      total: 4,
      message: 'Creating worktree directory...'
    })

    // Add the worktree
    await addWorktree(projectId, options)

    await context.updateProgress({
      current: 3,
      total: 4,
      message: 'Checking out branch...'
    })

    // Get updated worktrees list
    const worktrees = await getWorktrees(projectId)

    await context.updateProgress({
      current: 4,
      total: 4,
      message: 'Worktree created successfully'
    })

    return {
      success: true,
      path: options.path,
      worktrees
    }
  }
}

// Git worktree remove handler
export const gitWorktreeRemoveHandler: JobHandler = {
  type: 'git.worktree.remove',
  name: 'Remove Git Worktree',
  description: 'Remove an existing git worktree',
  timeout: 60000, // 1 minute

  validate: (input) => {
    return gitWorktreeRemoveRequestSchema.safeParse(input).success
  },

  execute: async (job, context) => {
    const { projectId } = job
    if (!projectId) {
      throw new Error('Project ID is required for git worktree operations')
    }

    const options = gitWorktreeRemoveRequestSchema.parse(job.input)

    context.log(`Removing worktree at path: ${options.path}`)
    await context.updateProgress({
      current: 1,
      total: 3,
      message: 'Preparing to remove worktree...'
    })

    if (await context.checkCancelled()) {
      throw new Error('Job cancelled by user')
    }

    await context.updateProgress({
      current: 2,
      total: 3,
      message: 'Removing worktree...'
    })

    // Remove the worktree
    await removeWorktree(projectId, options.path, options.force)

    // Get updated worktrees list
    const worktrees = await getWorktrees(projectId)

    await context.updateProgress({
      current: 3,
      total: 3,
      message: 'Worktree removed successfully'
    })

    return {
      success: true,
      path: options.path,
      worktrees
    }
  }
}

// Git worktree prune handler
export const gitWorktreePruneHandler: JobHandler = {
  type: 'git.worktree.prune',
  name: 'Prune Git Worktrees',
  description: 'Remove references to worktrees that no longer exist',
  timeout: 60000, // 1 minute

  validate: (input) => {
    return gitWorktreePruneRequestSchema.safeParse(input).success
  },

  execute: async (job, context) => {
    const { projectId } = job
    if (!projectId) {
      throw new Error('Project ID is required for git worktree operations')
    }

    const options = gitWorktreePruneRequestSchema.parse(job.input)

    context.log(`Pruning worktrees (dry run: ${options.dryRun})`)
    await context.updateProgress({
      current: 1,
      total: 3,
      message: 'Scanning for prunable worktrees...'
    })

    if (await context.checkCancelled()) {
      throw new Error('Job cancelled by user')
    }

    // Prune worktrees
    const prunedPaths = await pruneWorktrees(projectId, options.dryRun)

    await context.updateProgress({
      current: 2,
      total: 3,
      message: options.dryRun
        ? `Found ${prunedPaths.length} prunable worktrees`
        : `Pruned ${prunedPaths.length} worktrees`
    })

    // Get updated worktrees list
    const worktrees = await getWorktrees(projectId)

    await context.updateProgress({
      current: 3,
      total: 3,
      message: 'Prune operation completed'
    })

    return {
      success: true,
      dryRun: options.dryRun,
      prunedPaths,
      worktrees
    }
  }
}

// Git worktree lock handler
export const gitWorktreeLockHandler: JobHandler = {
  type: 'git.worktree.lock',
  name: 'Lock Git Worktree',
  description: 'Lock a worktree to prevent removal',
  timeout: 30000, // 30 seconds

  validate: (input) => {
    return gitWorktreeLockRequestSchema.safeParse(input).success
  },

  execute: async (job, context) => {
    const { projectId } = job
    if (!projectId) {
      throw new Error('Project ID is required for git worktree operations')
    }

    const options = gitWorktreeLockRequestSchema.parse(job.input)

    context.log(`Locking worktree at path: ${options.path}`)
    await lockWorktree(projectId, options.path, options.reason)

    const worktrees = await getWorktrees(projectId)

    return {
      success: true,
      path: options.path,
      reason: options.reason,
      worktrees
    }
  }
}

// Git worktree unlock handler
export const gitWorktreeUnlockHandler: JobHandler = {
  type: 'git.worktree.unlock',
  name: 'Unlock Git Worktree',
  description: 'Unlock a previously locked worktree',
  timeout: 30000, // 30 seconds

  validate: (input) => {
    return unlockWorktreeOptionsSchema.safeParse(input).success
  },

  execute: async (job, context) => {
    const { projectId } = job
    if (!projectId) {
      throw new Error('Project ID is required for git worktree operations')
    }

    const options = unlockWorktreeOptionsSchema.parse(job.input)

    context.log(`Unlocking worktree at path: ${options.path}`)
    await unlockWorktree(projectId, options.path)

    const worktrees = await getWorktrees(projectId)

    return {
      success: true,
      path: options.path,
      worktrees
    }
  }
}

// Export all handlers as an array for easy registration
export const gitWorktreeHandlers = [
  gitWorktreeAddHandler,
  gitWorktreeRemoveHandler,
  gitWorktreePruneHandler,
  gitWorktreeLockHandler,
  gitWorktreeUnlockHandler
]
