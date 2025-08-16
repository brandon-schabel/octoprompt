/**
 * Git Services Module
 * 
 * This module provides a modularized approach to Git operations,
 * splitting the functionality into specialized services while
 * maintaining backwards compatibility with the original git-service.ts
 */

// Export all service classes
export { BaseGitService } from './base-git-service'
export { GitStatusService, gitStatusService } from './git-status-service'
export { GitCommitService, gitCommitService } from './git-commit-service'
export { GitBranchService, gitBranchService } from './git-branch-service'
export { GitStashService, gitStashService } from './git-stash-service'
export { GitRemoteService, gitRemoteService } from './git-remote-service'
export { GitWorktreeService, gitWorktreeService } from './git-worktree-service'
export { GitConfigService, gitConfigService } from './git-config-service'

// Import service instances
import { gitStatusService } from './git-status-service'
import { gitCommitService } from './git-commit-service'
import { gitBranchService } from './git-branch-service'
import { gitStashService } from './git-stash-service'
import { gitRemoteService } from './git-remote-service'
import { gitWorktreeService } from './git-worktree-service'
import { gitConfigService } from './git-config-service'

// Re-export all functions for backwards compatibility
// These are now delegated to the appropriate service instances

// Status operations
export { gitStatusService as statusService } from './git-status-service'

export const getProjectGitStatus = (projectId: number) => 
  gitStatusService.getProjectGitStatus(projectId)

export const clearGitStatusCache = (projectId?: number) => 
  gitStatusService.clearCache(projectId)

export const stageFiles = (projectId: number, filePaths: string[]) => 
  gitStatusService.stageFiles(projectId, filePaths)

export const unstageFiles = (projectId: number, filePaths: string[]) => 
  gitStatusService.unstageFiles(projectId, filePaths)

export const stageAll = (projectId: number) => 
  gitStatusService.stageAll(projectId)

export const unstageAll = (projectId: number) => 
  gitStatusService.unstageAll(projectId)

export const getFileDiff = (
  projectId: number,
  filePath: string,
  options?: { commit?: string; staged?: boolean }
) => gitStatusService.getFileDiff(projectId, filePath, options)

export const clean = (
  projectId: number,
  options?: { directories?: boolean; force?: boolean; dryRun?: boolean }
) => gitStatusService.clean(projectId, options)

// Commit operations
export const commitChanges = (projectId: number, message: string) => 
  gitCommitService.commitChanges(projectId, message)

export const getCommitLog = (
  projectId: number,
  options?: {
    limit?: number
    skip?: number
    offset?: number
    branch?: string
    file?: string
  }
) => gitCommitService.getCommitLog(projectId, options)

export const getCommitDetails = (projectId: number, commitHash: string) => 
  gitCommitService.getCommitDetails(projectId, commitHash)

export const getCommitDiff = (projectId: number, commitHash: string) => 
  gitCommitService.getCommitDiff(projectId, commitHash)

export const cherryPick = (projectId: number, commitHash: string) => 
  gitCommitService.cherryPick(projectId, commitHash)

export const revert = (
  projectId: number,
  commitHash: string,
  options?: { noCommit?: boolean }
) => gitCommitService.revert(projectId, commitHash, options)

export const blame = (projectId: number, filePath: string) => 
  gitCommitService.blame(projectId, filePath)

export const reset = (
  projectId: number,
  ref: string,
  mode: 'soft' | 'mixed' | 'hard' = 'mixed'
) => gitCommitService.reset(projectId, ref, mode)

export const getCommitLogEnhanced = (
  projectId: number,
  request: import('@promptliano/schemas').GitLogEnhancedRequest
) => gitCommitService.getCommitLogEnhanced(projectId, request)

export const getCommitDetail = (
  projectId: number,
  commitHash: string,
  includeFileContents: boolean = false
) => gitCommitService.getCommitDetail(projectId, commitHash, includeFileContents)

// Branch operations
export const getBranches = (projectId: number) => 
  gitBranchService.getBranches(projectId)

export const getCurrentBranch = (projectId: number) => 
  gitBranchService.getCurrentBranch(projectId)

export const createBranch = (
  projectId: number,
  branchName: string,
  startPoint?: string
) => gitBranchService.createBranch(projectId, branchName, startPoint)

export const switchBranch = (projectId: number, branchName: string) => 
  gitBranchService.switchBranch(projectId, branchName)

export const deleteBranch = (
  projectId: number,
  branchName: string,
  force: boolean = false
) => gitBranchService.deleteBranch(projectId, branchName, force)

export const mergeBranch = (
  projectId: number,
  branchName: string,
  options?: { noFastForward?: boolean; message?: string }
) => gitBranchService.mergeBranch(projectId, branchName, options)

export const getBranchesEnhanced = (projectId: number) => 
  gitBranchService.getBranchesEnhanced(projectId)

// Stash operations
export const stash = (projectId: number, message?: string) => 
  gitStashService.stash(projectId, message)

export const stashList = (projectId: number) => 
  gitStashService.stashList(projectId)

export const stashApply = (projectId: number, stashRef: string = 'stash@{0}') => 
  gitStashService.stashApply(projectId, stashRef)

export const stashPop = (projectId: number, stashRef: string = 'stash@{0}') => 
  gitStashService.stashPop(projectId, stashRef)

export const stashDrop = (projectId: number, stashRef: string = 'stash@{0}') => 
  gitStashService.stashDrop(projectId, stashRef)

// Remote operations
export const getRemotes = (projectId: number) => 
  gitRemoteService.getRemotes(projectId)

export const addRemote = (projectId: number, name: string, url: string) => 
  gitRemoteService.addRemote(projectId, name, url)

export const removeRemote = (projectId: number, name: string) => 
  gitRemoteService.removeRemote(projectId, name)

export const fetch = (
  projectId: number,
  remote: string = 'origin',
  options?: { prune?: boolean }
) => gitRemoteService.fetch(projectId, remote, options)

export const pull = (
  projectId: number,
  remote: string = 'origin',
  branch?: string,
  options?: { rebase?: boolean }
) => gitRemoteService.pull(projectId, remote, branch, options)

export const push = (
  projectId: number,
  remote: string = 'origin',
  branch?: string,
  options?: { force?: boolean; setUpstream?: boolean }
) => gitRemoteService.push(projectId, remote, branch, options)

export const getTags = (projectId: number) => 
  gitRemoteService.getTags(projectId)

export const createTag = (
  projectId: number,
  tagName: string,
  options?: { message?: string; ref?: string }
) => gitRemoteService.createTag(projectId, tagName, options)

export const deleteTag = (projectId: number, tagName: string) => 
  gitRemoteService.deleteTag(projectId, tagName)

// Worktree operations
export const getWorktrees = (projectId: number) => 
  gitWorktreeService.getWorktrees(projectId)

export const addWorktree = (
  projectId: number,
  options: {
    path: string
    branch?: string
    newBranch?: string
    commitish?: string
    detach?: boolean
  }
) => gitWorktreeService.addWorktree(projectId, options)

export const removeWorktree = (
  projectId: number,
  worktreePath: string,
  force: boolean = false
) => gitWorktreeService.removeWorktree(projectId, worktreePath, force)

export const lockWorktree = (
  projectId: number,
  worktreePath: string,
  reason?: string
) => gitWorktreeService.lockWorktree(projectId, worktreePath, reason)

export const unlockWorktree = (projectId: number, worktreePath: string) => 
  gitWorktreeService.unlockWorktree(projectId, worktreePath)

export const pruneWorktrees = (projectId: number, dryRun: boolean = false) => 
  gitWorktreeService.pruneWorktrees(projectId, dryRun)

// Config operations
export const getConfig = (
  projectId: number,
  key?: string,
  options?: { global?: boolean }
) => gitConfigService.getConfig(projectId, key, options)

export const setConfig = (
  projectId: number,
  key: string,
  value: string,
  options?: { global?: boolean }
) => gitConfigService.setConfig(projectId, key, value, options)