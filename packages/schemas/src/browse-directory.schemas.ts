import { z } from 'zod'

// Directory entry schema
export const DirectoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
  isHidden: z.boolean()
})

export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>

// Browse directory request schema
export const BrowseDirectoryRequestSchema = z.object({
  path: z.string().optional().describe('The directory path to browse. If not provided, defaults to home directory')
})

export type BrowseDirectoryRequest = z.infer<typeof BrowseDirectoryRequestSchema>

// Browse directory response schema
export const BrowseDirectoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    currentPath: z.string(),
    parentPath: z.string().nullable(),
    entries: z.array(DirectoryEntrySchema)
  })
})

export type BrowseDirectoryResponse = z.infer<typeof BrowseDirectoryResponseSchema>