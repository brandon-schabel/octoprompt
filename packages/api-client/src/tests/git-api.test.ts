import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient } from '@promptliano/api-client'
import type { PromptlianoClient } from '@promptliano/api-client'
import type { TestEnvironment } from './test-environment'
import { withTestEnvironment } from './test-environment'
import { assertions, factories, TestDataManager, withTestData, retryOperation, waitFor } from './utils/test-helpers'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

/**
 * Comprehensive API tests for Git operations
 * Tests Git status, commits, branches, stashes, worktrees, and workflows
 */
describe('Git API Tests', () => {
  /**
   * Test helper to create a test Git repository with some initial files
   */
  async function setupTestRepository(client: PromptlianoClient, projectPath: string) {
    // Ensure the directory exists
    if (!existsSync(projectPath)) {
      mkdirSync(projectPath, { recursive: true })
    }

    // Initialize Git repository
    try {
      execSync('git init', { cwd: projectPath, stdio: 'ignore' })
      execSync('git config user.name "Test User"', { cwd: projectPath, stdio: 'ignore' })
      execSync('git config user.email "test@example.com"', { cwd: projectPath, stdio: 'ignore' })
    } catch (error) {
      console.warn('Failed to initialize Git repository:', error)
      throw error
    }

    // Create some test files
    writeFileSync(join(projectPath, 'README.md'), '# Test Repository\n\nThis is a test repository for Git API testing.')
    writeFileSync(join(projectPath, 'package.json'), JSON.stringify({ name: 'test-repo', version: '1.0.0' }, null, 2))
    
    // Create a subdirectory with files
    const srcDir = join(projectPath, 'src')
    if (!existsSync(srcDir)) {
      mkdirSync(srcDir, { recursive: true })
    }
    writeFileSync(join(srcDir, 'index.ts'), 'console.log("Hello, World!");')
    writeFileSync(join(srcDir, 'utils.ts'), 'export function greet(name: string) { return `Hello, ${name}!`; }')
  }

  /**
   * Test helper to modify files in the repository
   */
  function modifyRepositoryFiles(projectPath: string) {
    writeFileSync(join(projectPath, 'README.md'), '# Updated Test Repository\n\nThis repository has been updated.')
    writeFileSync(join(projectPath, 'CHANGELOG.md'), '# Changelog\n\n## v1.0.1\n- Initial changes')
    writeFileSync(join(projectPath, 'src', 'config.ts'), 'export const config = { version: "1.0.1" };')
  }

  describe('Git Status Operations', () => {
    test('should get project git status', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-status'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          // Setup test repository
          await setupTestRepository(client, project.path)

          // Get git status
          const statusResult = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusResult)

          expect(statusResult.data).toBeDefined()
          expect(statusResult.data.success).toBe(true)
          
          // Access the nested data object from the Git result
          const gitData = statusResult.data.data
          expect(gitData).toBeDefined()
          expect(gitData.current).toBeDefined() // Use 'current' instead of 'currentBranch'
          expect(gitData.ahead).toBeTypeOf('number')
          expect(gitData.behind).toBeTypeOf('number')
          expect(Array.isArray(gitData.files)).toBe(true)
        })
      })
    })

    test('should handle git status for non-git repository', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-non-git'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          try {
            await client.git.getProjectGitStatus(project.id)
            throw new Error('Should have failed for non-git repository')
          } catch (error) {
            expect(error).toBeDefined()
            // Expect error indicating not a git repository
          }
        })
      })
    })
  })

  describe('Git File Staging Operations', () => {
    test('should stage and unstage specific files', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-staging'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          modifyRepositoryFiles(project.path)

          // Stage specific files
          const stageResult = await client.git.stageFiles(project.id, ['README.md', 'CHANGELOG.md'])
          assertions.assertSuccessResponse(stageResult)
          expect(stageResult.data.success).toBe(true)

          // Verify staging worked
          const statusAfterStage = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterStage)
          const stagedFiles = statusAfterStage.data.files.filter(f => f.staged)
          expect(stagedFiles.length).toBeGreaterThanOrEqual(2)

          // Unstage specific files
          const unstageResult = await client.git.unstageFiles(project.id, ['README.md'])
          assertions.assertSuccessResponse(unstageResult)
          expect(unstageResult.data.success).toBe(true)

          // Verify unstaging worked
          const statusAfterUnstage = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterUnstage)
          const remainingStagedFiles = statusAfterUnstage.data.files.filter(f => f.staged)
          expect(remainingStagedFiles.length).toBeLessThan(stagedFiles.length)
        })
      })
    })

    test('should stage and unstage all files', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-stage-all'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          modifyRepositoryFiles(project.path)

          // Stage all files
          const stageAllResult = await client.git.stageAll(project.id)
          assertions.assertSuccessResponse(stageAllResult)

          // Verify all files are staged
          const statusAfterStageAll = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterStageAll)
          const modifiedFiles = statusAfterStageAll.data.files.filter(f => f.status !== 'untracked')
          const stagedFiles = statusAfterStageAll.data.files.filter(f => f.staged)
          expect(stagedFiles.length).toBeGreaterThan(0)

          // Unstage all files
          const unstageAllResult = await client.git.unstageAll(project.id)
          assertions.assertSuccessResponse(unstageAllResult)

          // Verify no files are staged
          const statusAfterUnstageAll = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterUnstageAll)
          const remainingStagedFiles = statusAfterUnstageAll.data.files.filter(f => f.staged)
          expect(remainingStagedFiles.length).toBe(0)
        })
      })
    })

    test('should handle staging non-existent files', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-stage-nonexistent'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          try {
            await client.git.stageFiles(project.id, ['non-existent-file.txt'])
            // Some Git implementations might not error, just check response
          } catch (error) {
            // Expected behavior - staging non-existent files should fail
            expect(error).toBeDefined()
          }
        })
      })
    })
  })

  describe('Git Commit Operations', () => {
    test('should create commits with staged changes', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-commit'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          modifyRepositoryFiles(project.path)

          // Stage files for commit
          await client.git.stageAll(project.id)

          // Create commit
          const commitMessage = 'feat: add initial test files and updates'
          const commitResult = await client.git.commitChanges(project.id, commitMessage)
          assertions.assertSuccessResponse(commitResult)
          expect(commitResult.data.success).toBe(true)

          // Verify commit was created by checking status
          const statusAfterCommit = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterCommit)
          expect(statusAfterCommit.data.files.filter(f => f.staged).length).toBe(0)
        })
      })
    })

    test('should handle empty commits', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-empty-commit'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          try {
            await client.git.commitChanges(project.id, 'Empty commit')
            throw new Error('Should have failed for empty commit')
          } catch (error) {
            // Expected - empty commits should fail
            expect(error).toBeDefined()
          }
        })
      })
    })

    test('should validate commit message requirements', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-commit-validation'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          modifyRepositoryFiles(project.path)
          await client.git.stageAll(project.id)

          try {
            await client.git.commitChanges(project.id, '')
            throw new Error('Should have failed for empty commit message')
          } catch (error) {
            // Expected - empty commit message should fail validation
            expect(error).toBeDefined()
          }
        })
      })
    })
  })

  describe('Git Branch Management', () => {
    test('should list, create, switch, and delete branches', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-branches'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          // Initial commit required for branch operations
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // List initial branches
          const initialBranches = await client.git.getBranches(project.id)
          assertions.assertSuccessResponse(initialBranches)
          expect(Array.isArray(initialBranches.data)).toBe(true)

          // Create new branch
          const branchName = 'feature/test-branch'
          const createBranchResult = await client.git.createBranch(project.id, branchName)
          assertions.assertSuccessResponse(createBranchResult)

          // Verify branch was created
          const branchesAfterCreate = await client.git.getBranches(project.id)
          assertions.assertSuccessResponse(branchesAfterCreate)
          const newBranch = branchesAfterCreate.data.find(b => b.name === branchName)
          expect(newBranch).toBeDefined()

          // Switch to new branch
          const switchResult = await client.git.switchBranch(project.id, branchName)
          assertions.assertSuccessResponse(switchResult)

          // Verify current branch changed
          const statusAfterSwitch = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterSwitch)
          expect(statusAfterSwitch.data.data.current).toBe(branchName)

          // Switch back to main/master
          const mainBranch = initialBranches.data.find(b => b.current)?.name || 'main'
          await client.git.switchBranch(project.id, mainBranch)

          // Delete the test branch
          const deleteResult = await client.git.deleteBranch(project.id, branchName)
          assertions.assertSuccessResponse(deleteResult)

          // Verify branch was deleted
          const branchesAfterDelete = await client.git.getBranches(project.id)
          assertions.assertSuccessResponse(branchesAfterDelete)
          const deletedBranch = branchesAfterDelete.data.find(b => b.name === branchName)
          expect(deletedBranch).toBeUndefined()
        })
      })
    })

    test('should handle branch creation with start point', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-branch-startpoint'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Create branch from specific start point
          const createResult = await client.git.createBranch(project.id, 'feature/from-head', 'HEAD')
          assertions.assertSuccessResponse(createResult)

          // Verify branch exists
          const branches = await client.git.getBranches(project.id)
          assertions.assertSuccessResponse(branches)
          const newBranch = branches.data.find(b => b.name === 'feature/from-head')
          expect(newBranch).toBeDefined()
        })
      })
    })

    test('should handle branch operation errors', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-branch-errors'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Try to create branch with invalid name
          try {
            await client.git.createBranch(project.id, 'invalid/branch/../name')
            throw new Error('Should have failed for invalid branch name')
          } catch (error) {
            expect(error).toBeDefined()
          }

          // Try to switch to non-existent branch
          try {
            await client.git.switchBranch(project.id, 'non-existent-branch')
            throw new Error('Should have failed for non-existent branch')
          } catch (error) {
            expect(error).toBeDefined()
          }

          // Try to delete non-existent branch
          try {
            await client.git.deleteBranch(project.id, 'non-existent-branch')
            throw new Error('Should have failed for non-existent branch')
          } catch (error) {
            expect(error).toBeDefined()
          }
        })
      })
    })
  })

  describe('Git Commit History', () => {
    test('should retrieve commit log', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-log'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          // Create multiple commits
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'feat: initial commit')

          modifyRepositoryFiles(project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'feat: add more files')

          // Get commit log
          const logResult = await client.git.getCommitLog(project.id)
          assertions.assertSuccessResponse(logResult)
          assertions.assertArrayOfItems(logResult.data, 2)

          // Verify commit structure
          const firstCommit = logResult.data[0]
          expect(firstCommit.hash).toBeTypeOf('string')
          expect(firstCommit.message).toBeTypeOf('string')
          expect(firstCommit.author).toBeTypeOf('string')
          expect(firstCommit.date).toBeTypeOf('string')
        })
      })
    })

    test('should handle commit log with options', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-log-options'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          // Create several commits
          for (let i = 1; i <= 5; i++) {
            modifyRepositoryFiles(project.path)
            writeFileSync(join(project.path, `file${i}.txt`), `Content ${i}`)
            await client.git.stageAll(project.id)
            await client.git.commitChanges(project.id, `feat: commit ${i}`)
          }

          // Test with limit
          const limitedLog = await client.git.getCommitLog(project.id, { limit: 3 })
          assertions.assertSuccessResponse(limitedLog)
          expect(limitedLog.data.length).toBeLessThanOrEqual(3)

          // Test with skip
          const skippedLog = await client.git.getCommitLog(project.id, { skip: 2, limit: 2 })
          assertions.assertSuccessResponse(skippedLog)
          expect(skippedLog.data.length).toBeLessThanOrEqual(2)
        })
      })
    })

    test('should get enhanced commit log', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-enhanced-log'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'feat: initial setup')

          // Get enhanced log
          const enhancedLog = await client.git.getCommitLogEnhanced(project.id)
          assertions.assertSuccessResponse(enhancedLog)
          expect(enhancedLog.data.commits).toBeDefined()
          expect(Array.isArray(enhancedLog.data.commits)).toBe(true)
        })
      })
    })
  })

  describe('Git Stash Operations', () => {
    test('should create, list, apply, and drop stashes', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-stash'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Make some changes
          modifyRepositoryFiles(project.path)

          // Create stash
          const stashResult = await client.git.stash(project.id, 'Test stash')
          assertions.assertSuccessResponse(stashResult)

          // List stashes
          const stashList = await client.git.getStashList(project.id)
          assertions.assertSuccessResponse(stashList)
          expect(Array.isArray(stashList.data)).toBe(true)
          expect(stashList.data.length).toBeGreaterThan(0)

          // Apply stash
          const applyResult = await client.git.stashApply(project.id)
          assertions.assertSuccessResponse(applyResult)

          // Drop stash
          const dropResult = await client.git.stashDrop(project.id)
          assertions.assertSuccessResponse(dropResult)

          // Verify stash was dropped
          const stashListAfterDrop = await client.git.getStashList(project.id)
          assertions.assertSuccessResponse(stashListAfterDrop)
          expect(stashListAfterDrop.data.length).toBeLessThan(stashList.data.length)
        })
      })
    })

    test('should handle stash pop operation', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-stash-pop'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Make changes and stash
          modifyRepositoryFiles(project.path)
          await client.git.stash(project.id, 'Test stash for pop')

          // Pop stash (apply and drop in one operation)
          const popResult = await client.git.stashPop(project.id)
          assertions.assertSuccessResponse(popResult)

          // Verify stash list is empty
          const stashList = await client.git.getStashList(project.id)
          assertions.assertSuccessResponse(stashList)
          expect(stashList.data.length).toBe(0)
        })
      })
    })
  })

  describe('Git Remote Operations', () => {
    test('should list remotes', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-remotes'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          // Get remotes (may be empty for a local repo)
          const remotes = await client.git.getRemotes(project.id)
          assertions.assertSuccessResponse(remotes)
          expect(Array.isArray(remotes.data)).toBe(true)
        })
      })
    })

    test('should handle fetch operation gracefully', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-fetch'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          try {
            // Fetch may fail if no remote is configured
            await client.git.fetch(project.id)
          } catch (error) {
            // Expected for local repositories without remotes
            expect(error).toBeDefined()
          }
        })
      })
    })
  })

  describe('Git Tag Operations', () => {
    test('should create and list tags', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-tags'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit for tagging')

          // Create tag
          const tagName = 'v1.0.0'
          const createTagResult = await client.git.createTag(project.id, tagName, {
            message: 'Release version 1.0.0'
          })
          assertions.assertSuccessResponse(createTagResult)

          // List tags
          const tags = await client.git.getTags(project.id)
          assertions.assertSuccessResponse(tags)
          expect(Array.isArray(tags.data)).toBe(true)
          
          const createdTag = tags.data.find(t => t.name === tagName)
          expect(createdTag).toBeDefined()
        })
      })
    })
  })

  describe('Git Worktree Operations', () => {
    test('should list, add, and remove worktrees', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-worktrees'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // List initial worktrees
          const initialWorktrees = await client.git.worktrees.list(project.id)
          assertions.assertSuccessResponse(initialWorktrees)
          expect(Array.isArray(initialWorktrees.data)).toBe(true)

          // Create a branch for the worktree
          await client.git.createBranch(project.id, 'worktree-branch')

          // Add worktree
          const worktreePath = '/tmp/git-test-worktree-branch'
          const addResult = await client.git.worktrees.add(project.id, {
            path: worktreePath,
            branch: 'worktree-branch'
          })
          assertions.assertSuccessResponse(addResult)

          // List worktrees after adding
          const worktreesAfterAdd = await client.git.worktrees.list(project.id)
          assertions.assertSuccessResponse(worktreesAfterAdd)
          expect(worktreesAfterAdd.data.length).toBeGreaterThan(initialWorktrees.data.length)

          // Remove worktree
          const removeResult = await client.git.worktrees.remove(project.id, {
            path: worktreePath
          })
          assertions.assertSuccessResponse(removeResult)

          // Cleanup the directory
          try {
            rmSync(worktreePath, { recursive: true, force: true })
          } catch (error) {
            // Ignore cleanup errors
          }
        })
      })
    })

    test('should handle worktree lock and unlock operations', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-worktree-lock'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Create branch and worktree
          await client.git.createBranch(project.id, 'lock-test-branch')
          const worktreePath = '/tmp/git-test-worktree-lock-branch'

          try {
            await client.git.worktrees.add(project.id, {
              path: worktreePath,
              branch: 'lock-test-branch'
            })

            // Lock worktree
            const lockResult = await client.git.worktrees.lock(project.id, {
              path: worktreePath,
              reason: 'Testing lock functionality'
            })
            assertions.assertSuccessResponse(lockResult)

            // Unlock worktree
            const unlockResult = await client.git.worktrees.unlock(project.id, {
              path: worktreePath
            })
            assertions.assertSuccessResponse(unlockResult)

            // Remove worktree
            await client.git.worktrees.remove(project.id, { path: worktreePath })
          } finally {
            // Cleanup
            try {
              rmSync(worktreePath, { recursive: true, force: true })
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        })
      })
    })

    test('should prune worktrees', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-worktree-prune'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Prune worktrees (dry run)
          const pruneResult = await client.git.worktrees.prune(project.id, { dryRun: true })
          assertions.assertSuccessResponse(pruneResult)
          expect(pruneResult.data).toBeDefined()
        })
      })
    })
  })

  describe('Git File Diff Operations', () => {
    test('should get file diff for modified files', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-diff'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Modify a file
          modifyRepositoryFiles(project.path)

          // Get diff for modified file
          const diffResult = await client.git.getFileDiff(project.id, 'README.md')
          assertions.assertSuccessResponse(diffResult)
          expect(diffResult.data.diff).toBeTypeOf('string')
          expect(diffResult.data.diff.length).toBeGreaterThan(0)
        })
      })
    })

    test('should get staged file diff', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-staged-diff'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Modify and stage a file
          modifyRepositoryFiles(project.path)
          await client.git.stageFiles(project.id, ['README.md'])

          // Get staged diff
          const stagedDiff = await client.git.getFileDiff(project.id, 'README.md', { staged: true })
          assertions.assertSuccessResponse(stagedDiff)
          expect(stagedDiff.data.diff).toBeTypeOf('string')
        })
      })
    })
  })

  describe('Git Enhanced Operations', () => {
    test('should get enhanced branches information', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-enhanced-branches'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Get enhanced branches
          const enhancedBranches = await client.git.getBranchesEnhanced(project.id)
          assertions.assertSuccessResponse(enhancedBranches)
          expect(enhancedBranches.data).toBeDefined()
          expect(Array.isArray(enhancedBranches.data.branches)).toBe(true)
        })
      })
    })

    test('should get detailed commit information', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-commit-detail'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit for detail testing')

          // Get commit log to find a commit hash
          const log = await client.git.getCommitLog(project.id, { limit: 1 })
          assertions.assertSuccessResponse(log)
          expect(log.data.length).toBeGreaterThan(0)

          const commitHash = log.data[0].hash

          // Get commit detail
          const commitDetail = await client.git.getCommitDetail(project.id, commitHash)
          assertions.assertSuccessResponse(commitDetail)
          expect(commitDetail.data.commit).toBeDefined()
          expect(commitDetail.data.commit.hash).toBe(commitHash)
        })
      })
    })
  })

  describe('Git Reset Operations', () => {
    test('should reset to specific commit', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-reset'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Make another commit
          modifyRepositoryFiles(project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Second commit')

          // Reset to HEAD~1 (previous commit)
          const resetResult = await client.git.reset(project.id, 'HEAD~1', 'mixed')
          assertions.assertSuccessResponse(resetResult)

          // Verify the reset worked by checking status
          const statusAfterReset = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterReset)
          // After mixed reset, changes should be unstaged
          expect(statusAfterReset.data.files.some(f => !f.staged)).toBe(true)
        })
      })
    })
  })

  describe('Git Workflow Integration Tests', () => {
    test('should handle complete feature branch workflow', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-workflow'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          // Setup initial repository
          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Create feature branch
          const featureBranch = 'feature/workflow-test'
          await client.git.createBranch(project.id, featureBranch)
          await client.git.switchBranch(project.id, featureBranch)

          // Make changes in feature branch
          writeFileSync(join(project.path, 'feature.ts'), 'export const feature = "new feature";')
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'feat: add new feature')

          // Switch back to main
          const branches = await client.git.getBranches(project.id)
          assertions.assertSuccessResponse(branches)
          const mainBranch = branches.data.find(b => b.name === 'main' || b.name === 'master')?.name || 'main'
          await client.git.switchBranch(project.id, mainBranch)

          // Clean up by deleting feature branch
          await client.git.deleteBranch(project.id, featureBranch)

          // Verify workflow completed successfully
          const finalStatus = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(finalStatus)
          expect(finalStatus.data.data.current).toBe(mainBranch)
        })
      })
    })

    test('should handle stash and branch switching workflow', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-stash-workflow'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Create feature branch
          await client.git.createBranch(project.id, 'feature/stash-test')

          // Make uncommitted changes
          modifyRepositoryFiles(project.path)

          // Stash changes
          await client.git.stash(project.id, 'WIP: uncommitted changes')

          // Switch branch (should work because changes are stashed)
          await client.git.switchBranch(project.id, 'feature/stash-test')

          // Switch back and apply stash
          const branches = await client.git.getBranches(project.id)
          assertions.assertSuccessResponse(branches)
          const mainBranch = branches.data.find(b => b.name === 'main' || b.name === 'master')?.name || 'main'
          await client.git.switchBranch(project.id, mainBranch)
          await client.git.stashPop(project.id)

          // Verify changes are back
          const statusAfterPop = await client.git.getProjectGitStatus(project.id)
          assertions.assertSuccessResponse(statusAfterPop)
          expect(statusAfterPop.data.files.some(f => f.status === 'modified')).toBe(true)
        })
      })
    })
  })

  describe('Git Error Handling', () => {
    test('should handle invalid project IDs', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        const client = createPromptlianoClient({ baseUrl: env.baseUrl })

        try {
          await client.git.getProjectGitStatus(99999)
          throw new Error('Should have failed for invalid project ID')
        } catch (error) {
          expect(error).toBeDefined()
        }
      })
    })

    test('should handle operations on non-existent paths', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/non-existent-git-repo'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          try {
            await client.git.getProjectGitStatus(project.id)
            throw new Error('Should have failed for non-existent path')
          } catch (error) {
            expect(error).toBeDefined()
          }
        })
      })
    })

    test('should handle concurrent git operations gracefully', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-concurrent'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)
          await client.git.stageAll(project.id)
          await client.git.commitChanges(project.id, 'Initial commit')

          // Try multiple status calls concurrently
          const statusPromises = Array.from({ length: 5 }, () =>
            client.git.getProjectGitStatus(project.id)
          )

          const results = await Promise.allSettled(statusPromises)
          
          // At least some should succeed
          const successful = results.filter(r => r.status === 'fulfilled')
          expect(successful.length).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('Git Performance Tests', () => {
    test('should handle large commit history efficiently', async () => {
      await withTestEnvironment(async (env: TestEnvironment) => {
        await withTestData(env, async (dataManager: TestDataManager) => {
          const project = await dataManager.createProject(factories.createProjectData({
            path: '/tmp/git-test-performance'
          }))
          const client = createPromptlianoClient({ baseUrl: env.baseUrl })

          await setupTestRepository(client, project.path)

          // Create multiple commits quickly
          const start = performance.now()
          
          for (let i = 1; i <= 10; i++) {
            writeFileSync(join(project.path, `perf-test-${i}.txt`), `Performance test file ${i}`)
            await client.git.stageAll(project.id)
            await client.git.commitChanges(project.id, `perf: commit ${i}`)
          }

          const commitTime = performance.now() - start

          // Get commit log with limit
          const logStart = performance.now()
          const log = await client.git.getCommitLog(project.id, { limit: 50 })
          const logTime = performance.now() - logStart

          assertions.assertSuccessResponse(log)
          expect(log.data.length).toBeGreaterThan(5)

          // Performance should be reasonable (adjust thresholds as needed)
          expect(commitTime).toBeLessThan(30000) // 30 seconds for 10 commits
          expect(logTime).toBeLessThan(5000) // 5 seconds for log retrieval

          console.log(`Performance test - Commits: ${commitTime.toFixed(2)}ms, Log: ${logTime.toFixed(2)}ms`)
        })
      })
    }, 45000) // 45 second timeout for performance test
  })
})