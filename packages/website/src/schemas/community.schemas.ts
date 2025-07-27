import { z } from 'zod'

/**
 * Community member/contributor schema
 */
export const ContributorSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().optional(),
  avatar: z.string().url(),
  githubUrl: z.string().url(),
  contributions: z.number().min(0),
  role: z.enum(['maintainer', 'contributor', 'supporter']).default('contributor'),
  badges: z.array(z.enum(['early-adopter', 'bug-hunter', 'doc-writer', 'feature-builder'])).default([])
})

/**
 * Community link schema
 */
export const CommunityLinkSchema = z.object({
  platform: z.enum(['discord', 'github', 'twitter', 'reddit', 'slack']),
  url: z.string().url(),
  title: z.string(),
  description: z.string(),
  memberCount: z.number().optional(),
  icon: z.string().optional()
})

/**
 * Download item schema
 */
export const DownloadItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  platform: z.enum(['windows', 'macos', 'linux', 'universal']),
  architecture: z.enum(['x64', 'arm64', 'universal']).optional(),
  size: z.string(),
  url: z.string().url(),
  checksum: z.string().optional(),
  releaseDate: z.string().datetime(),
  releaseNotes: z.string().optional()
})

/**
 * Resource item schema
 */
export const ResourceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['video', 'article', 'tutorial', 'example', 'template']),
  description: z.string(),
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  author: z.string().optional(),
  duration: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  tags: z.array(z.string()).default([])
})

/**
 * Community section schema
 */
export const CommunitySectionSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  links: z.array(CommunityLinkSchema),
  contributors: z.object({
    featured: z.array(ContributorSchema),
    totalCount: z.number()
  }),
  resources: z.array(ResourceItemSchema),
  downloads: z.array(DownloadItemSchema),
  stats: z
    .object({
      stars: z.number(),
      forks: z.number(),
      contributors: z.number(),
      downloads: z.number()
    })
    .optional()
})

// Type exports
export type Contributor = z.infer<typeof ContributorSchema>
export type CommunityLink = z.infer<typeof CommunityLinkSchema>
export type DownloadItem = z.infer<typeof DownloadItemSchema>
export type ResourceItem = z.infer<typeof ResourceItemSchema>
export type CommunitySection = z.infer<typeof CommunitySectionSchema>
