import { describe, test, expect } from 'bun:test'
import { gitStatusService } from './git-status-service'
import { gitCommitService } from './git-commit-service'
import { gitBranchService } from './git-branch-service'
import { gitStashService } from './git-stash-service'
import { gitRemoteService } from './git-remote-service'
import { gitWorktreeService } from './git-worktree-service'
import { gitConfigService } from './git-config-service'
import { BaseGitService } from './base-git-service'

describe('Modular Git Services', () => {
  describe('Service Instances', () => {
    test('should have singleton instances of all services', () => {
      expect(gitStatusService).toBeDefined()
      expect(gitStatusService).toBeInstanceOf(BaseGitService)

      expect(gitCommitService).toBeDefined()
      expect(gitCommitService).toBeInstanceOf(BaseGitService)

      expect(gitBranchService).toBeDefined()
      expect(gitBranchService).toBeInstanceOf(BaseGitService)

      expect(gitStashService).toBeDefined()
      expect(gitStashService).toBeInstanceOf(BaseGitService)

      expect(gitRemoteService).toBeDefined()
      expect(gitRemoteService).toBeInstanceOf(BaseGitService)

      expect(gitWorktreeService).toBeDefined()
      expect(gitWorktreeService).toBeInstanceOf(BaseGitService)

      expect(gitConfigService).toBeDefined()
      expect(gitConfigService).toBeInstanceOf(BaseGitService)
    })
  })

  describe('Backwards Compatibility', () => {
    test('should export all functions from index', async () => {
      const gitServices = await import('./index')

      // Check that all main functions are exported
      expect(typeof gitServices.getProjectGitStatus).toBe('function')
      expect(typeof gitServices.clearGitStatusCache).toBe('function')
      expect(typeof gitServices.stageFiles).toBe('function')
      expect(typeof gitServices.unstageFiles).toBe('function')
      expect(typeof gitServices.stageAll).toBe('function')
      expect(typeof gitServices.unstageAll).toBe('function')
      expect(typeof gitServices.commitChanges).toBe('function')
      expect(typeof gitServices.getCommitLog).toBe('function')
      expect(typeof gitServices.getBranches).toBe('function')
      expect(typeof gitServices.getCurrentBranch).toBe('function')
      expect(typeof gitServices.createBranch).toBe('function')
      expect(typeof gitServices.switchBranch).toBe('function')
      expect(typeof gitServices.deleteBranch).toBe('function')
      expect(typeof gitServices.mergeBranch).toBe('function')
      expect(typeof gitServices.stash).toBe('function')
      expect(typeof gitServices.stashList).toBe('function')
      expect(typeof gitServices.stashApply).toBe('function')
      expect(typeof gitServices.stashPop).toBe('function')
      expect(typeof gitServices.stashDrop).toBe('function')
      expect(typeof gitServices.getRemotes).toBe('function')
      expect(typeof gitServices.addRemote).toBe('function')
      expect(typeof gitServices.removeRemote).toBe('function')
      expect(typeof gitServices.fetch).toBe('function')
      expect(typeof gitServices.pull).toBe('function')
      expect(typeof gitServices.push).toBe('function')
      expect(typeof gitServices.getTags).toBe('function')
      expect(typeof gitServices.createTag).toBe('function')
      expect(typeof gitServices.deleteTag).toBe('function')
      expect(typeof gitServices.getWorktrees).toBe('function')
      expect(typeof gitServices.addWorktree).toBe('function')
      expect(typeof gitServices.removeWorktree).toBe('function')
      expect(typeof gitServices.lockWorktree).toBe('function')
      expect(typeof gitServices.unlockWorktree).toBe('function')
      expect(typeof gitServices.pruneWorktrees).toBe('function')
      expect(typeof gitServices.getConfig).toBe('function')
      expect(typeof gitServices.setConfig).toBe('function')
    })

    test('should export all from git-service.ts', async () => {
      const gitService = await import('../git-service')

      // Check that the main backwards compatibility layer works
      expect(typeof gitService.getProjectGitStatus).toBe('function')
      expect(typeof gitService.commitChanges).toBe('function')
      expect(typeof gitService.getBranches).toBe('function')
      expect(typeof gitService.stash).toBe('function')
      expect(typeof gitService.getRemotes).toBe('function')
      expect(typeof gitService.getWorktrees).toBe('function')
      expect(typeof gitService.getConfig).toBe('function')
    })
  })

  describe('Service Isolation', () => {
    test('each service should have its own logger', () => {
      // Each service should have its own logger instance
      expect((gitStatusService as any).logger).toBeDefined()
      expect((gitCommitService as any).logger).toBeDefined()
      expect((gitBranchService as any).logger).toBeDefined()
      expect((gitStashService as any).logger).toBeDefined()
      expect((gitRemoteService as any).logger).toBeDefined()
      expect((gitWorktreeService as any).logger).toBeDefined()
      expect((gitConfigService as any).logger).toBeDefined()

      // Logger names should match service class names
      expect((gitStatusService as any).logger.context).toBe('GitStatusService')
      expect((gitCommitService as any).logger.context).toBe('GitCommitService')
      expect((gitBranchService as any).logger.context).toBe('GitBranchService')
      expect((gitStashService as any).logger.context).toBe('GitStashService')
      expect((gitRemoteService as any).logger.context).toBe('GitRemoteService')
      expect((gitWorktreeService as any).logger.context).toBe('GitWorktreeService')
      expect((gitConfigService as any).logger.context).toBe('GitConfigService')
    })
  })
})