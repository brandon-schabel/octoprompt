import { describe, test, expect, spyOn, beforeEach, afterEach, Mock } from 'bun:test'
import * as gitService from './git-service'
import * as projectService from './project-service'
import { simpleGit, type SimpleGit } from 'simple-git'
import type { Project, GitStatus } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'

// Mock simple-git
const mockGit: Partial<SimpleGit> = {
  checkIsRepo: async () => true,
  status: async () => ({
    current: 'main',
    tracking: 'origin/main',
    ahead: 1,
    behind: 0,
    files: [
      { path: 'file1.js', index: 'M', working_dir: ' ' },
      { path: 'file2.ts', index: 'A', working_dir: ' ' },
      { path: 'file3.txt', index: ' ', working_dir: 'M' },
      { path: 'file4.md', index: '?', working_dir: '?' }
    ],
    staged: ['file1.js', 'file2.ts'],
    modified: ['file1.js', 'file3.txt'],
    created: ['file2.ts'],
    deleted: [],
    renamed: [],
    conflicted: [],
    isClean: () => false
  }),
  add: async () => {},
  reset: async () => {},
  commit: async () => ({ commit: 'abc123', summary: { changes: 2, deletions: 0, insertions: 10 } })
}

// Mock simpleGit to return our mock git instance
const simpleGitSpy = spyOn(await import('simple-git'), 'simpleGit').mockReturnValue(mockGit as SimpleGit)

describe('Git Service', () => {
  const mockProject: Project = {
    id: 1,
    name: 'Test Project',
    path: '/test/project',
    description: 'Test',
    created: Date.now(),
    updated: Date.now()
  }

  let getProjectByIdSpy: Mock<typeof projectService.getProjectById>

  beforeEach(() => {
    getProjectByIdSpy = spyOn(projectService, 'getProjectById').mockResolvedValue(mockProject)
    gitService.clearGitStatusCache()
  })

  afterEach(() => {
    getProjectByIdSpy.mockRestore()
    simpleGitSpy.mockClear()
  })

  describe('getProjectGitStatus', () => {
    test('should return git status for a valid repository', async () => {
      const result = await gitService.getProjectGitStatus(1)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.isRepo).toBe(true)
      expect(result.data!.current).toBe('main')
      expect(result.data!.tracking).toBe('origin/main')
      expect(result.data!.ahead).toBe(1)
      expect(result.data!.behind).toBe(0)
      expect(result.data!.files).toHaveLength(4)

      // Check file status mapping
      const files = result.data!.files
      expect(files[0]).toMatchObject({ path: 'file1.js', status: 'modified', staged: true })
      expect(files[1]).toMatchObject({ path: 'file2.ts', status: 'added', staged: true })
      expect(files[2]).toMatchObject({ path: 'file3.txt', status: 'modified', staged: false })
      expect(files[3]).toMatchObject({ path: 'file4.md', status: 'untracked', staged: false })
    })

    test('should return cached result within TTL', async () => {
      // First call
      await gitService.getProjectGitStatus(1)

      // Second call should use cache
      const result = await gitService.getProjectGitStatus(1)

      expect(result.success).toBe(true)
      // simpleGit should only be called once due to caching
      expect(simpleGitSpy).toHaveBeenCalledTimes(1)
    })

    test('should handle project without path', async () => {
      getProjectByIdSpy.mockResolvedValue({ ...mockProject, path: undefined })

      const result = await gitService.getProjectGitStatus(1)

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe('not_a_repo')
      expect(result.error?.message).toContain('Project does not have a path')
    })

    test('should handle non-git repository', async () => {
      mockGit.checkIsRepo = async () => false

      const result = await gitService.getProjectGitStatus(1)

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe('not_a_repo')
      expect(result.error?.message).toContain('not a git repository')
    })

    test('should handle git command not found error', async () => {
      mockGit.checkIsRepo = async () => {
        throw new Error('git: command not found')
      }

      const result = await gitService.getProjectGitStatus(1)

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe('git_not_installed')
      expect(result.error?.message).toContain('Git is not installed')
    })

    test('should handle permission denied error', async () => {
      mockGit.checkIsRepo = async () => {
        throw new Error('permission denied')
      }

      const result = await gitService.getProjectGitStatus(1)

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe('permission_denied')
      expect(result.error?.message).toContain('Permission denied')
    })

    test('should throw ApiError when project not found', async () => {
      getProjectByIdSpy.mockRejectedValue(new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND'))

      await expect(gitService.getProjectGitStatus(1)).rejects.toThrow(ApiError)
    })
  })

  describe('clearGitStatusCache', () => {
    test('should clear cache for specific project', async () => {
      // Populate cache
      await gitService.getProjectGitStatus(1)

      // Clear specific project cache
      gitService.clearGitStatusCache(1)

      // Next call should not use cache
      await gitService.getProjectGitStatus(1)
      expect(simpleGitSpy).toHaveBeenCalledTimes(2)
    })

    test('should clear all cache when no projectId provided', async () => {
      // Populate cache for multiple projects
      await gitService.getProjectGitStatus(1)
      getProjectByIdSpy.mockResolvedValue({ ...mockProject, id: 2 })
      await gitService.getProjectGitStatus(2)

      // Clear all cache
      gitService.clearGitStatusCache()

      // Both projects should fetch fresh data
      await gitService.getProjectGitStatus(1)
      await gitService.getProjectGitStatus(2)

      // 4 calls total (2 initial + 2 after cache clear)
      expect(simpleGitSpy).toHaveBeenCalledTimes(4)
    })
  })

  describe('stageFiles', () => {
    beforeEach(() => {
      mockGit.add = async () => {}
    })

    test('should stage files with relative paths', async () => {
      const addSpy = spyOn(mockGit, 'add').mockResolvedValue(undefined)

      await gitService.stageFiles(1, ['file1.js', 'file2.ts'])

      expect(addSpy).toHaveBeenCalledWith(['file1.js', 'file2.ts'])
    })

    test('should convert absolute paths to relative', async () => {
      const addSpy = spyOn(mockGit, 'add').mockResolvedValue(undefined)

      await gitService.stageFiles(1, ['/test/project/file1.js', '/test/project/src/file2.ts'])

      expect(addSpy).toHaveBeenCalledWith(['file1.js', 'src/file2.ts'])
    })

    test('should clear cache after staging', async () => {
      // Populate cache
      await gitService.getProjectGitStatus(1)

      // Reset call count
      simpleGitSpy.mockClear()

      await gitService.stageFiles(1, ['file1.js'])

      // Next status call should fetch fresh data (cache cleared)
      await gitService.getProjectGitStatus(1)
      // Should call simpleGit twice: once for stageFiles, once for getProjectGitStatus
      expect(simpleGitSpy).toHaveBeenCalledTimes(2)
    })

    test('should throw error if project has no path', async () => {
      getProjectByIdSpy.mockResolvedValue({ ...mockProject, path: undefined })

      await expect(gitService.stageFiles(1, ['file1.js'])).rejects.toThrow(ApiError)
    })

    test('should handle git errors', async () => {
      mockGit.add = async () => {
        throw new Error('Failed to add files')
      }

      await expect(gitService.stageFiles(1, ['file1.js'])).rejects.toThrow('Failed to stage files')
    })
  })

  describe('unstageFiles', () => {
    beforeEach(() => {
      mockGit.reset = async () => {}
    })

    test('should unstage files with relative paths', async () => {
      const resetSpy = spyOn(mockGit, 'reset').mockResolvedValue(undefined)

      await gitService.unstageFiles(1, ['file1.js', 'file2.ts'])

      expect(resetSpy).toHaveBeenCalledWith(['HEAD', 'file1.js', 'file2.ts'])
    })

    test('should convert absolute paths to relative', async () => {
      const resetSpy = spyOn(mockGit, 'reset').mockResolvedValue(undefined)

      await gitService.unstageFiles(1, ['/test/project/file1.js'])

      expect(resetSpy).toHaveBeenCalledWith(['HEAD', 'file1.js'])
    })

    test('should clear cache after unstaging', async () => {
      await gitService.getProjectGitStatus(1)

      // Reset call count
      simpleGitSpy.mockClear()

      await gitService.unstageFiles(1, ['file1.js'])

      await gitService.getProjectGitStatus(1)
      // Should call simpleGit twice: once for unstageFiles, once for getProjectGitStatus
      expect(simpleGitSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('stageAll', () => {
    test('should stage all files', async () => {
      const addSpy = spyOn(mockGit, 'add').mockResolvedValue(undefined)

      await gitService.stageAll(1)

      expect(addSpy).toHaveBeenCalledWith('.')
    })

    test('should clear cache after staging all', async () => {
      await gitService.getProjectGitStatus(1)

      // Reset call count
      simpleGitSpy.mockClear()

      await gitService.stageAll(1)

      await gitService.getProjectGitStatus(1)
      // Should call simpleGit twice: once for stageAll, once for getProjectGitStatus
      expect(simpleGitSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('unstageAll', () => {
    test('should unstage all files', async () => {
      const resetSpy = spyOn(mockGit, 'reset').mockResolvedValue(undefined)

      await gitService.unstageAll(1)

      expect(resetSpy).toHaveBeenCalledWith(['HEAD'])
    })

    test('should clear cache after unstaging all', async () => {
      await gitService.getProjectGitStatus(1)

      // Reset call count
      simpleGitSpy.mockClear()

      await gitService.unstageAll(1)

      await gitService.getProjectGitStatus(1)
      // Should call simpleGit twice: once for unstageAll, once for getProjectGitStatus
      expect(simpleGitSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('commitChanges', () => {
    test('should commit staged changes', async () => {
      const commitSpy = spyOn(mockGit, 'commit').mockResolvedValue({
        commit: 'abc123',
        summary: { changes: 2, deletions: 0, insertions: 10 }
      })

      await gitService.commitChanges(1, 'Test commit message')

      expect(commitSpy).toHaveBeenCalledWith('Test commit message')
    })

    test('should throw error if no staged changes', async () => {
      const originalStatus = mockGit.status
      mockGit.status = async () => ({
        current: 'main',
        tracking: 'origin/main',
        ahead: 1,
        behind: 0,
        files: [],
        staged: [],
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
        isClean: () => true
      })

      await expect(gitService.commitChanges(1, 'Test commit')).rejects.toThrow('No staged changes to commit')

      // Restore original status
      mockGit.status = originalStatus
    })

    test('should clear cache after commit', async () => {
      await gitService.getProjectGitStatus(1)

      // Reset call count
      simpleGitSpy.mockClear()

      await gitService.commitChanges(1, 'Test commit')

      await gitService.getProjectGitStatus(1)
      // Should call simpleGit twice: once for commitChanges, once for getProjectGitStatus
      expect(simpleGitSpy).toHaveBeenCalledTimes(2)
    })

    test('should handle commit errors', async () => {
      mockGit.commit = async () => {
        throw new Error('Failed to commit')
      }

      await expect(gitService.commitChanges(1, 'Test commit')).rejects.toThrow('Failed to commit changes')
    })
  })
})
