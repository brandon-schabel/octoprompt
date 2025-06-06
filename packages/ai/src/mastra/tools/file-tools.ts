// packages/server/src/mastra/tools/file-tools.ts
// Last 5 changes:
// 1. Initial creation of read project file tool
// 2. Added write project file tool with validation
// 3. Added error handling and proper type definitions
// 4. Integrated with existing OctoPrompt storage layer
// 5. Added file existence checking capabilities

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { projectStorage } from '@octoprompt/storage'
import { computeChecksum } from '@octoprompt/services'
import { normalizeToUnixMs } from '@octoprompt/shared'
import type { ProjectFile } from '@octoprompt/schemas'

export const readProjectFileTool = createTool({
  id: 'read-project-file',
  description: 'Reads a file from a project by path or ID',
  inputSchema: z
    .object({
      projectId: z.number(),
      filePath: z.string().optional(),
      fileId: z.number().optional()
    })
    .refine((data) => data.filePath || data.fileId, {
      message: 'Either filePath or fileId must be provided'
    }),
  outputSchema: z.object({
    content: z.string().nullable(),
    fileId: z.number().nullable(),
    path: z.string().nullable(),
    exists: z.boolean(),
    error: z.string().nullable()
  }),
  execute: async ({ context }) => {
    try {
      let file: ProjectFile | null = null

      if (context.fileId) {
        file = (await projectStorage.readProjectFile(context.projectId, context.fileId)) || null
      } else if (context.filePath) {
        // Find file by path
        const allFiles = await projectStorage.readProjectFiles(context.projectId)
        const foundFile = Object.values(allFiles).find((f) => f.path === context.filePath && f.isLatest)
        file = foundFile || null
      }

      if (!file) {
        return {
          content: null,
          fileId: null,
          path: context.filePath || null,
          exists: false,
          error: null
        }
      }

      return {
        content: file.content || null,
        fileId: file.id,
        path: file.path,
        exists: true,
        error: null
      }
    } catch (error: any) {
      return {
        content: null,
        fileId: null,
        path: context.filePath || null,
        exists: false,
        error: error.message
      }
    }
  }
})

export const writeProjectFileTool = createTool({
  id: 'write-project-file',
  description: 'Writes or updates a file in a project',
  inputSchema: z.object({
    projectId: z.number(),
    filePath: z.string(),
    content: z.string(),
    fileId: z.number().optional(),
    createIfNotExists: z.boolean().default(true)
  }),
  outputSchema: z.object({
    success: z.boolean(),
    fileId: z.number().nullable(),
    path: z.string(),
    wasCreated: z.boolean(),
    checksum: z.string().nullable(),
    error: z.string().nullable()
  }),
  execute: async ({ context }) => {
    try {
      const { projectId, filePath, content, fileId, createIfNotExists } = context
      const checksum = computeChecksum(content)
      const now = normalizeToUnixMs(new Date())

      // Check if file exists
      let existingFile: ProjectFile | null = null
      if (fileId) {
        existingFile = (await projectStorage.readProjectFile(projectId, fileId)) || null
      } else {
        // Find file by path
        const allFiles = await projectStorage.readProjectFiles(projectId)
        const foundFile = Object.values(allFiles).find((f) => f.path === filePath && f.isLatest)
        existingFile = foundFile || null
      }

      if (existingFile) {
        // Update existing file by creating a new version
        const { createFileVersion } = projectStorage
        const updatedFile = await createFileVersion(projectId, existingFile.id, content, {
          checksum,
          size: Buffer.byteLength(content, 'utf8')
        })

        return {
          success: true,
          fileId: updatedFile.id,
          path: updatedFile.path,
          wasCreated: false,
          checksum,
          error: null
        }
      } else if (createIfNotExists) {
        // Create new file - delegate to project service bulk creation
        const { bulkCreateProjectFiles } = await import('@octoprompt/services')
        const { basename, extname } = await import('path')

        const fileSyncData = {
          path: filePath,
          name: basename(filePath),
          extension: extname(filePath),
          content,
          size: Buffer.byteLength(content, 'utf8'),
          checksum
        }

        const createdFiles = await bulkCreateProjectFiles(projectId, [fileSyncData])
        if (createdFiles && createdFiles.length > 0) {
          const newFile = createdFiles[0]
          if (newFile) {
            return {
              success: true,
              fileId: newFile.id,
              path: newFile.path,
              wasCreated: true,
              checksum,
              error: null
            }
          }
        }
        
        return {
          success: false,
          fileId: null,
          path: filePath,
          wasCreated: false,
          checksum: null,
          error: 'Failed to create file via bulk operation'
        }
      } else {
        return {
          success: false,
          fileId: null,
          path: filePath,
          wasCreated: false,
          checksum: null,
          error: 'File does not exist and createIfNotExists is false'
        }
      }
    } catch (error: any) {
      return {
        success: false,
        fileId: null,
        path: context.filePath,
        wasCreated: false,
        checksum: null,
        error: error.message
      }
    }
  }
})

export const analyzeCodeTool = createTool({
  id: 'analyze-code',
  description: 'Analyzes code content for structure, dependencies, and patterns',
  inputSchema: z.object({
    content: z.string(),
    filePath: z.string(),
    analysisType: z.enum(['structure', 'dependencies', 'exports', 'imports', 'all']).default('all')
  }),
  outputSchema: z.object({
    structure: z
      .object({
        functions: z.array(z.string()),
        classes: z.array(z.string()),
        interfaces: z.array(z.string()),
        types: z.array(z.string())
      })
      .optional(),
    dependencies: z
      .object({
        imports: z.array(z.string()),
        exports: z.array(z.string()),
        externalDeps: z.array(z.string())
      })
      .optional(),
    summary: z.string(),
    error: z.string().nullable()
  }),
  execute: async ({ context }) => {
    try {
      const { content, filePath, analysisType } = context
      const analysis: any = {}

      // Basic structure analysis
      if (analysisType === 'structure' || analysisType === 'all') {
        const functions = [
          ...content.matchAll(/(?:function|const\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g)
        ].map((match) => {
          const line = content.substring(0, match.index).split('\n').pop() || ''
          return line.trim().split(/\s+/)[1] || 'anonymous'
        })

        const classes = [...content.matchAll(/class\s+(\w+)/g)].map((match) => match[1])
        const interfaces = [...content.matchAll(/interface\s+(\w+)/g)].map((match) => match[1])
        const types = [...content.matchAll(/type\s+(\w+)/g)].map((match) => match[1])

        analysis.structure = { functions, classes, interfaces, types }
      }

      // Dependencies analysis
      if (analysisType === 'dependencies' || analysisType === 'all') {
        const imports = [...content.matchAll(/import\s+[^;]+from\s+['"`]([^'"`]+)['"`]/g)].map((match) => match[1]).filter(Boolean)
        const exports = [
          ...content.matchAll(/export\s+(?:default\s+)?(?:function|class|interface|type|const|let|var)\s+(\w+)/g)
        ].map((match) => match[1]).filter(Boolean)
        const externalDeps = imports.filter((imp) => imp && !imp.startsWith('.') && !imp.startsWith('/'))

        analysis.dependencies = { imports, exports, externalDeps }
      }

      // Generate summary
      const lineCount = content.split('\n').length
      const extension = filePath.split('.').pop() || ''
      const summary = `${extension.toUpperCase()} file with ${lineCount} lines. Contains ${analysis.structure?.functions?.length || 0} functions, ${analysis.structure?.classes?.length || 0} classes.`

      return {
        ...analysis,
        summary,
        error: null
      }
    } catch (error: any) {
      return {
        summary: 'Failed to analyze code',
        error: error.message
      }
    }
  }
})

export const searchCodebaseTool = createTool({
  id: 'search-codebase',
  description: 'Search for patterns or text within project files',
  inputSchema: z.object({
    projectId: z.number(),
    query: z.string(),
    searchType: z.enum(['text', 'regex', 'function', 'class']).default('text'),
    fileExtensions: z.array(z.string()).optional(),
    maxResults: z.number().default(10)
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        fileId: z.number(),
        filePath: z.string(),
        matches: z.array(
          z.object({
            line: z.number(),
            content: z.string(),
            context: z.string()
          })
        )
      })
    ),
    totalMatches: z.number(),
    error: z.string().nullable()
  }),
  execute: async ({ context }) => {
    try {
      const { projectId, query, searchType, fileExtensions, maxResults } = context

      // Get all project files
      const filesMap = await projectStorage.readProjectFiles(projectId)
      const files = Object.values(filesMap).filter((f) => f.isLatest)
      const results: any[] = []
      let totalMatches = 0

      for (const file of files) {
        if (fileExtensions && fileExtensions.length > 0) {
          const ext = file.path.split('.').pop() || ''
          if (!fileExtensions.includes(ext)) continue
        }

        if (!file.content) continue

        const lines = file.content.split('\n')
        const matches: any[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (!line) continue
          
          let isMatch = false

          switch (searchType) {
            case 'text':
              isMatch = line.toLowerCase().includes(query.toLowerCase())
              break
            case 'regex':
              try {
                isMatch = new RegExp(query, 'i').test(line)
              } catch {
                isMatch = false
              }
              break
            case 'function':
              isMatch =
                line.includes(`function ${query}`) || line.includes(`${query} =`) || line.includes(`const ${query}`)
              break
            case 'class':
              isMatch = line.includes(`class ${query}`)
              break
          }

          if (isMatch) {
            const contextStart = Math.max(0, i - 2)
            const contextEnd = Math.min(lines.length - 1, i + 2)
            const context = lines.slice(contextStart, contextEnd + 1).join('\n')

            matches.push({
              line: i + 1,
              content: line.trim(),
              context
            })

            totalMatches++
            if (totalMatches >= maxResults) break
          }
        }

        if (matches.length > 0) {
          results.push({
            fileId: file.id,
            filePath: file.path,
            matches
          })
        }

        if (totalMatches >= maxResults) break
      }

      return {
        results,
        totalMatches,
        error: null
      }
    } catch (error: any) {
      return {
        results: [],
        totalMatches: 0,
        error: error.message
      }
    }
  }
})
