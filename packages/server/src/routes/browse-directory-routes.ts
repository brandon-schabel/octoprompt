import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { readdir, stat } from 'node:fs/promises'
import { join, dirname, basename, resolve } from 'node:path'
import { homedir } from 'node:os'
import {
  ApiErrorResponseSchema,
  BrowseDirectoryRequestSchema,
  BrowseDirectoryResponseSchema,
  DirectoryEntry
} from '@octoprompt/schemas'
import { ApiError } from '@octoprompt/shared'

const browseDirectoryRoute = createRoute({
  method: 'post',
  path: '/api/browse-directory',
  tags: ['System'],
  summary: 'Browse directories on the file system',
  request: {
    body: {
      content: { 'application/json': { schema: BrowseDirectoryRequestSchema } }
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BrowseDirectoryResponseSchema } },
      description: 'Successfully browsed directory'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid path or permission denied'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

export const browseDirectoryRoutes = new OpenAPIHono()
  .openapi(browseDirectoryRoute, async (c) => {
    const body = c.req.valid('json')
    let targetPath = body.path || homedir()

    // Expand ~ to home directory
    if (targetPath.startsWith('~')) {
      targetPath = targetPath.replace(/^~/, homedir())
    }

    // Resolve to absolute path
    targetPath = resolve(targetPath)

    // Security check: ensure we're not going above home directory
    const homeDir = homedir()
    if (!targetPath.startsWith(homeDir)) {
      throw new ApiError(400, 'Access denied: Cannot browse directories outside of home directory', 'ACCESS_DENIED')
    }

    try {
      // Check if the path exists and is a directory
      const stats = await stat(targetPath)
      if (!stats.isDirectory()) {
        throw new ApiError(400, 'Path is not a directory', 'NOT_A_DIRECTORY')
      }

      // Read directory contents
      const entries = await readdir(targetPath, { withFileTypes: true })
      
      // Filter and map entries
      const directoryEntries: DirectoryEntry[] = entries
        .filter(entry => {
          // Filter out some system files/directories
          const name = entry.name
          if (name === '.DS_Store' || name === 'Thumbs.db') return false
          // Include hidden files but mark them
          return true
        })
        .map(entry => ({
          name: entry.name,
          path: join(targetPath, entry.name),
          isDirectory: entry.isDirectory(),
          isHidden: entry.name.startsWith('.')
        }))
        .sort((a, b) => {
          // Sort directories first, then by name
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })

      // Determine parent path
      const parentPath = targetPath === homeDir ? null : dirname(targetPath)

      const response: z.infer<typeof BrowseDirectoryResponseSchema> = {
        success: true,
        data: {
          currentPath: targetPath,
          parentPath,
          entries: directoryEntries
        }
      }

      return c.json(response, 200)
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error
      }
      console.error('Error browsing directory:', error)
      throw new ApiError(500, `Failed to browse directory: ${error.message}`, 'BROWSE_ERROR')
    }
  })

export type BrowseDirectoryRouteTypes = typeof browseDirectoryRoutes