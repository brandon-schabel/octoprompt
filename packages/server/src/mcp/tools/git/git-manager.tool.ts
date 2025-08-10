import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  GitManagerAction,
  GitManagerSchema
} from '../shared'
import {
  getProjectGitStatus,
  stageFiles,
  unstageFiles,
  stageAll,
  unstageAll,
  commitChanges,
  getBranches,
  getCurrentBranch,
  createBranch,
  switchBranch,
  deleteBranch,
  mergeBranch,
  getCommitLog,
  getCommitDetails,
  getFileDiff,
  getCommitDiff,
  cherryPick,
  getRemotes,
  addRemote,
  removeRemote,
  fetch,
  pull,
  push,
  getTags,
  createTag,
  deleteTag,
  stash,
  stashList,
  stashApply,
  stashPop,
  stashDrop,
  reset,
  revert,
  blame,
  clean,
  getConfig,
  setConfig,
  getCommitLogEnhanced,
  getBranchesEnhanced,
  getCommitDetail,
  getWorktrees,
  addWorktree,
  removeWorktree,
  lockWorktree,
  unlockWorktree,
  pruneWorktrees
} from '@promptliano/services'

export const gitManagerTool: MCPToolDefinition = {
  name: 'git_manager',
  description: 'Comprehensive Git operations including status, commits, branches, tags, stash, worktrees, and more',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The Git action to perform',
        enum: Object.values(GitManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required)'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For log_enhanced: { branch?: "main", author?: "john", search?: "fix", page?: 1, perPage?: 20, since?: "2024-01-01", until?: "2024-12-31", includeStats?: true, includeFileDetails?: true }. For commit_detail: { hash: "abc123", includeFileContents?: true }. For worktree_add: { path: "../feature-branch", branch?: "existing-branch", newBranch?: "new-branch", commitish?: "HEAD~3", detach?: true }. For worktree_remove: { path: "../feature-branch", force?: true }. For worktree_lock: { path: "../feature-branch", reason?: "work in progress" }. For worktree_unlock: { path: "../feature-branch" }. For worktree_prune: { dryRun?: true }. For other actions, see git service documentation.'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'git_manager',
    async (args: z.infer<typeof GitManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case GitManagerAction.STATUS: {
            const result = await getProjectGitStatus(projectId)
            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Git error: ${'error' in result && result.error ? result.error.message : 'Unknown error'}`
                  }
                ],
                isError: true
              }
            }
            const status = result.data
            let text = `Branch: ${status.current || 'none'}\n`
            if (status.tracking) text += `Tracking: ${status.tracking}\n`
            text += `Ahead: ${status.ahead}, Behind: ${status.behind}\n\n`
            text += `Files (${status.files.length}):\n`
            status.files.forEach((file) => {
              text += `  ${file.staged ? '[staged]' : '[unstaged]'} ${file.status}: ${file.path}\n`
            })
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.STAGE_FILES: {
            const filePaths = validateDataField<string[]>(data, 'filePaths', 'array', '["src/index.ts", "README.md"]')
            await stageFiles(projectId, filePaths)
            return { content: [{ type: 'text', text: `Staged ${filePaths.length} files` }] }
          }

          case GitManagerAction.UNSTAGE_FILES: {
            const filePaths = validateDataField<string[]>(data, 'filePaths', 'array', '["src/index.ts", "README.md"]')
            await unstageFiles(projectId, filePaths)
            return { content: [{ type: 'text', text: `Unstaged ${filePaths.length} files` }] }
          }

          case GitManagerAction.STAGE_ALL: {
            await stageAll(projectId)
            return { content: [{ type: 'text', text: 'Staged all changes' }] }
          }

          case GitManagerAction.UNSTAGE_ALL: {
            await unstageAll(projectId)
            return { content: [{ type: 'text', text: 'Unstaged all changes' }] }
          }

          case GitManagerAction.COMMIT: {
            const message = validateDataField<string>(data, 'message', 'string', '"Fix: resolve authentication bug"')
            await commitChanges(projectId, message)
            return { content: [{ type: 'text', text: `Committed changes: ${message}` }] }
          }

          case GitManagerAction.BRANCHES: {
            const branches = await getBranches(projectId)
            const text = branches
              .map((b) => {
                const marker = b.current ? '* ' : '  '
                const info = b.isRemote ? '[remote]' : `[local${b.tracking ? `, tracking ${b.tracking}` : ''}]`
                return `${marker}${b.name} ${info} (${b.commit.substring(0, 7)})`
              })
              .join('\n')
            return { content: [{ type: 'text', text: text || 'No branches found' }] }
          }

          case GitManagerAction.CURRENT_BRANCH: {
            const branch = await getCurrentBranch(projectId)
            return { content: [{ type: 'text', text: branch || 'No current branch' }] }
          }

          case GitManagerAction.CREATE_BRANCH: {
            const name = validateDataField<string>(data, 'name', 'string', '"feature/new-auth"')
            const startPoint = data?.startPoint as string | undefined
            await createBranch(projectId, name, startPoint)
            return { content: [{ type: 'text', text: `Created branch: ${name}` }] }
          }

          case GitManagerAction.SWITCH_BRANCH: {
            const name = validateDataField<string>(data, 'name', 'string', '"main"')
            await switchBranch(projectId, name)
            return { content: [{ type: 'text', text: `Switched to branch: ${name}` }] }
          }

          case GitManagerAction.DELETE_BRANCH: {
            const name = validateDataField<string>(data, 'name', 'string', '"feature/old-feature"')
            const force = data?.force as boolean | undefined
            await deleteBranch(projectId, name, force)
            return { content: [{ type: 'text', text: `Deleted branch: ${name}` }] }
          }

          case GitManagerAction.MERGE_BRANCH: {
            const branch = validateDataField<string>(data, 'branch', 'string', '"feature/new-feature"')
            const options = data?.options as { noFastForward?: boolean; message?: string } | undefined
            await mergeBranch(projectId, branch, options)
            return { content: [{ type: 'text', text: `Merged branch: ${branch}` }] }
          }

          case GitManagerAction.LOG: {
            const options = data?.options as
              | { limit?: number; skip?: number; branch?: string; file?: string }
              | undefined
            const logs = await getCommitLog(projectId, options)
            const text = logs
              .map((log) => {
                const date = new Date(log.date).toLocaleDateString()
                return `${log.abbreviatedHash} - ${log.message} (${log.author.name}, ${date})`
              })
              .join('\n')
            return { content: [{ type: 'text', text: text || 'No commits found' }] }
          }

          case GitManagerAction.COMMIT_DETAILS: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            const commit = await getCommitDetails(projectId, hash)
            const text =
              `Commit: ${commit.hash}\n` +
              `Author: ${commit.author.name} <${commit.author.email}>\n` +
              `Date: ${commit.author.date}\n` +
              `Message: ${commit.message}\n` +
              `Files: ${commit.files?.join(', ') || 'none'}`
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.FILE_DIFF: {
            const filePath = validateDataField<string>(data, 'filePath', 'string', '"src/index.ts"')
            const options = data?.options as { commit?: string; staged?: boolean } | undefined
            const diff = await getFileDiff(projectId, filePath, options)
            return { content: [{ type: 'text', text: diff || 'No differences' }] }
          }

          case GitManagerAction.COMMIT_DIFF: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            const diff = await getCommitDiff(projectId, hash)
            const text =
              `Files changed: ${diff.files.length}\n` +
              `Additions: +${diff.additions}, Deletions: -${diff.deletions}\n\n` +
              diff.content
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.CHERRY_PICK: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            await cherryPick(projectId, hash)
            return { content: [{ type: 'text', text: `Cherry-picked commit: ${hash}` }] }
          }

          case GitManagerAction.REMOTES: {
            const remotes = await getRemotes(projectId)
            const text = remotes.map((r) => `${r.name}: ${r.fetch} (fetch), ${r.push} (push)`).join('\n')
            return { content: [{ type: 'text', text: text || 'No remotes configured' }] }
          }

          case GitManagerAction.ADD_REMOTE: {
            const name = validateDataField<string>(data, 'name', 'string', '"origin"')
            const url = validateDataField<string>(data, 'url', 'string', '"https://github.com/user/repo.git"')
            await addRemote(projectId, name, url)
            return { content: [{ type: 'text', text: `Added remote: ${name} -> ${url}` }] }
          }

          case GitManagerAction.REMOVE_REMOTE: {
            const name = validateDataField<string>(data, 'name', 'string', '"origin"')
            await removeRemote(projectId, name)
            return { content: [{ type: 'text', text: `Removed remote: ${name}` }] }
          }

          case GitManagerAction.FETCH: {
            const remote = data?.remote as string | undefined
            const options = data?.options as { prune?: boolean } | undefined
            await fetch(projectId, remote || 'origin', options)
            return { content: [{ type: 'text', text: `Fetched from ${remote || 'origin'}` }] }
          }

          case GitManagerAction.PULL: {
            const remote = data?.remote as string | undefined
            const branch = data?.branch as string | undefined
            const options = data?.options as { rebase?: boolean } | undefined
            await pull(projectId, remote || 'origin', branch, options)
            return {
              content: [{ type: 'text', text: `Pulled from ${remote || 'origin'}${branch ? `/${branch}` : ''}` }]
            }
          }

          case GitManagerAction.PUSH: {
            const remote = data?.remote as string | undefined
            const branch = data?.branch as string | undefined
            const options = data?.options as { force?: boolean; setUpstream?: boolean } | undefined
            await push(projectId, remote || 'origin', branch, options)
            return {
              content: [{ type: 'text', text: `Pushed to ${remote || 'origin'}${branch ? `/${branch}` : ''}` }]
            }
          }

          case GitManagerAction.TAGS: {
            const tags = await getTags(projectId)
            const text = tags
              .map((t) => {
                let line = `${t.name} -> ${t.commit.substring(0, 7)}`
                if (t.annotation) line += ` "${t.annotation}"`
                return line
              })
              .join('\n')
            return { content: [{ type: 'text', text: text || 'No tags found' }] }
          }

          case GitManagerAction.CREATE_TAG: {
            const name = validateDataField<string>(data, 'name', 'string', '"v1.0.0"')
            const options = data?.options as { message?: string; ref?: string } | undefined
            await createTag(projectId, name, options)
            return { content: [{ type: 'text', text: `Created tag: ${name}` }] }
          }

          case GitManagerAction.DELETE_TAG: {
            const name = validateDataField<string>(data, 'name', 'string', '"v1.0.0"')
            await deleteTag(projectId, name)
            return { content: [{ type: 'text', text: `Deleted tag: ${name}` }] }
          }

          case GitManagerAction.STASH: {
            const message = data?.message as string | undefined
            await stash(projectId, message)
            return { content: [{ type: 'text', text: `Stashed changes${message ? `: ${message}` : ''}` }] }
          }

          case GitManagerAction.STASH_LIST: {
            const stashes = await stashList(projectId)
            const text = stashes.map((s) => `stash@{${s.index}}: ${s.message} (on ${s.branch})`).join('\n')
            return { content: [{ type: 'text', text: text || 'No stashes found' }] }
          }

          case GitManagerAction.STASH_APPLY: {
            const ref = data?.ref as string | undefined
            await stashApply(projectId, ref || 'stash@{0}')
            return { content: [{ type: 'text', text: `Applied stash: ${ref || 'stash@{0}'}` }] }
          }

          case GitManagerAction.STASH_POP: {
            const ref = data?.ref as string | undefined
            await stashPop(projectId, ref || 'stash@{0}')
            return { content: [{ type: 'text', text: `Popped stash: ${ref || 'stash@{0}'}` }] }
          }

          case GitManagerAction.STASH_DROP: {
            const ref = data?.ref as string | undefined
            await stashDrop(projectId, ref || 'stash@{0}')
            return { content: [{ type: 'text', text: `Dropped stash: ${ref || 'stash@{0}'}` }] }
          }

          case GitManagerAction.RESET: {
            const ref = validateDataField<string>(data, 'ref', 'string', '"HEAD~1"')
            const mode = data?.mode as 'soft' | 'mixed' | 'hard' | undefined
            await reset(projectId, ref, mode || 'mixed')
            return { content: [{ type: 'text', text: `Reset to ${ref} (${mode || 'mixed'} mode)` }] }
          }

          case GitManagerAction.REVERT: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            const options = data?.options as { noCommit?: boolean } | undefined
            await revert(projectId, hash, options)
            return { content: [{ type: 'text', text: `Reverted commit: ${hash}` }] }
          }

          case GitManagerAction.BLAME: {
            const filePath = validateDataField<string>(data, 'filePath', 'string', '"src/index.ts"')
            const blameResult = await blame(projectId, filePath)
            const text =
              `Blame for ${blameResult.path}:\n` +
              blameResult.lines
                .slice(0, 20)
                .map((line: any) => `${line.line}: ${line.commit.substring(0, 7)} ${line.author} - ${line.content}`)
                .join('\n') +
              (blameResult.lines.length > 20 ? `\n... and ${blameResult.lines.length - 20} more lines` : '')
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.CLEAN: {
            const options = data?.options as { directories?: boolean; force?: boolean; dryRun?: boolean } | undefined
            const cleaned = await clean(projectId, options)
            const text = options?.dryRun ? `Would remove:\n${cleaned.join('\n')}` : `Removed:\n${cleaned.join('\n')}`
            return { content: [{ type: 'text', text: text || 'Nothing to clean' }] }
          }

          case GitManagerAction.CONFIG_GET: {
            const key = data?.key as string | undefined
            const options = data?.options as { global?: boolean } | undefined
            const config = await getConfig(projectId, key, options)
            const text =
              typeof config === 'string'
                ? `${key}: ${config}`
                : Object.entries(config)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.CONFIG_SET: {
            const key = validateDataField<string>(data, 'key', 'string', '"user.name"')
            const value = validateDataField<string>(data, 'value', 'string', '"John Doe"')
            const options = data?.options as { global?: boolean } | undefined
            await setConfig(projectId, key, value, options)
            return { content: [{ type: 'text', text: `Set config: ${key} = ${value}` }] }
          }

          case GitManagerAction.LOG_ENHANCED: {
            const request = {
              branch: data?.branch as string | undefined,
              author: data?.author as string | undefined,
              search: data?.search as string | undefined,
              page: (data?.page as number | undefined) || 1,
              perPage: (data?.perPage as number | undefined) || 20,
              since: data?.since as string | undefined,
              until: data?.until as string | undefined,
              includeStats: (data?.includeStats as boolean | undefined) || false,
              includeFileDetails: (data?.includeFileDetails as boolean | undefined) || false
            }
            const result = await getCommitLogEnhanced(projectId, request)
            if (!result.success || !result.data) {
              return {
                content: [{ type: 'text', text: result.message || 'Failed to get enhanced commit log' }],
                isError: true
              }
            }
            const { commits, pagination, branch } = result.data
            let text = `Branch: ${branch}\n`
            text += `Page ${pagination.page} (${pagination.perPage} per page)${pagination.hasMore ? ' - More available' : ''}\n\n`
            text += commits
              .map((commit) => {
                let commitText = `${commit.abbreviatedHash} - ${commit.subject}\n`
                commitText += `  Author: ${commit.author.name} <${commit.author.email}>\n`
                commitText += `  Date: ${commit.relativeTime} (${new Date(commit.authoredDate).toLocaleString()})\n`
                if (commit.body) {
                  commitText += `  Body: ${commit.body.split('\n').join('\n  ')}\n`
                }
                if (commit.stats) {
                  commitText += `  Stats: +${commit.stats.additions} -${commit.stats.deletions} (${commit.stats.filesChanged} files)\n`
                }
                if (commit.fileStats && commit.fileStats.length > 0) {
                  commitText += '  Files:\n'
                  commit.fileStats.forEach((file) => {
                    commitText += `    ${file.status}: ${file.path} (+${file.additions} -${file.deletions})\n`
                  })
                }
                return commitText
              })
              .join('\n')
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.BRANCHES_ENHANCED: {
            const result = await getBranchesEnhanced(projectId)
            if (!result.success || !result.data) {
              return {
                content: [{ type: 'text', text: result.message || 'Failed to get enhanced branches' }],
                isError: true
              }
            }
            const { branches, current, defaultBranch } = result.data
            let text = `Current branch: ${current || 'none'}\n`
            text += `Default branch: ${defaultBranch}\n`
            text += `Total branches: ${branches.length}\n\n`
            text += branches
              .map((branch) => {
                const marker = branch.current ? '* ' : '  '
                let branchText = `${marker}${branch.name}`
                if (branch.isRemote) branchText += ' [remote]'
                if (branch.isProtected) branchText += ' [protected]'
                branchText += '\n'
                branchText += `    Latest: ${branch.latestCommit.abbreviatedHash} - ${branch.latestCommit.subject}\n`
                branchText += `    Author: ${branch.latestCommit.author} (${branch.latestCommit.relativeTime})\n`
                if (branch.tracking) {
                  branchText += `    Tracking: ${branch.tracking}\n`
                  if (branch.ahead > 0 || branch.behind > 0) {
                    branchText += `    Status: ${branch.ahead} ahead, ${branch.behind} behind\n`
                  }
                }
                return branchText
              })
              .join('\n')
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.COMMIT_DETAIL: {
            const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
            const includeFileContents = (data?.includeFileContents as boolean | undefined) || false
            const result = await getCommitDetail(projectId, hash, includeFileContents)
            if (!result.success || !result.data) {
              return {
                content: [{ type: 'text', text: result.message || 'Failed to get commit details' }],
                isError: true
              }
            }
            const { commit, files } = result.data
            let text = `Commit: ${commit.hash}\n`
            text += `Author: ${commit.author.name} <${commit.author.email}>\n`
            text += `Date: ${new Date(commit.authoredDate).toLocaleString()} (${commit.relativeTime})\n`
            if (commit.committer && commit.committer.email !== commit.author.email) {
              text += `Committer: ${commit.committer.name} <${commit.committer.email}>\n`
            }
            text += `\nMessage:\n${commit.subject}\n`
            if (commit.body) {
              text += `\n${commit.body}\n`
            }
            if (commit.stats) {
              text += `\nStats: ${commit.stats.filesChanged} files changed, +${commit.stats.additions} -${commit.stats.deletions}\n`
            }
            if (commit.parents && commit.parents.length > 0) {
              text += `\nParents: ${commit.parents.join(', ')}\n`
            }
            if (commit.refs && commit.refs.length > 0) {
              text += `Refs: ${commit.refs.join(', ')}\n`
            }
            if (files && files.length > 0) {
              text += '\nFiles:\n'
              files.forEach((file) => {
                text += `  ${file.status}: ${file.path} (+${file.additions} -${file.deletions})`
                if (file.binary) text += ' [binary]'
                if (file.oldPath) text += ` (from ${file.oldPath})`
                text += '\n'
                if (includeFileContents && file.diff) {
                  text += '    Diff:\n'
                  text +=
                    file.diff
                      .split('\n')
                      .map((line) => '    ' + line)
                      .join('\n') + '\n'
                }
              })
            }
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.WORKTREE_LIST: {
            const worktrees = await getWorktrees(projectId)
            if (worktrees.length === 0) {
              return { content: [{ type: 'text', text: 'No worktrees found' }] }
            }
            const text = worktrees
              .map((wt) => {
                let line = wt.isMain ? '* ' : '  '
                line += `${wt.path}`
                if (wt.branch) line += ` (${wt.branch})`
                if (wt.commit) line += ` [${wt.commit.substring(0, 7)}]`
                if (wt.isLocked) line += ` [locked${wt.lockReason ? `: ${wt.lockReason}` : ''}]`
                if (wt.prunable) line += ' [prunable]'
                return line
              })
              .join('\n')
            return { content: [{ type: 'text', text }] }
          }

          case GitManagerAction.WORKTREE_ADD: {
            const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
            const options = {
              branch: data?.branch as string | undefined,
              newBranch: data?.newBranch as string | undefined,
              commitish: data?.commitish as string | undefined,
              detach: data?.detach as boolean | undefined
            }
            await addWorktree(projectId, { path, ...options })
            return { content: [{ type: 'text', text: `Created worktree at: ${path}` }] }
          }

          case GitManagerAction.WORKTREE_REMOVE: {
            const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
            const force = data?.force as boolean | undefined
            await removeWorktree(projectId, path, force)
            return { content: [{ type: 'text', text: `Removed worktree: ${path}` }] }
          }

          case GitManagerAction.WORKTREE_LOCK: {
            const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
            const reason = data?.reason as string | undefined
            await lockWorktree(projectId, path, reason)
            return { content: [{ type: 'text', text: `Locked worktree: ${path}${reason ? ` (${reason})` : ''}` }] }
          }

          case GitManagerAction.WORKTREE_UNLOCK: {
            const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
            await unlockWorktree(projectId, path)
            return { content: [{ type: 'text', text: `Unlocked worktree: ${path}` }] }
          }

          case GitManagerAction.WORKTREE_PRUNE: {
            const dryRun = data?.dryRun as boolean | undefined
            const pruned = await pruneWorktrees(projectId, dryRun)
            if (pruned.length === 0) {
              return {
                content: [{ type: 'text', text: dryRun ? 'No worktrees would be pruned' : 'No worktrees pruned' }]
              }
            }
            const text = dryRun ? `Would prune:\n${pruned.join('\n')}` : `Pruned:\n${pruned.join('\n')}`
            return { content: [{ type: 'text', text }] }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(GitManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'git_manager',
                action: args.action,
                projectId: args.projectId
              })

        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
