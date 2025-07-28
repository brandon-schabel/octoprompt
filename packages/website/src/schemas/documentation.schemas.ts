import { z } from 'zod'

/**
 * Documentation category schema
 */
export const DocCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().default(0)
})

/**
 * Code example schema for documentation
 */
export const DocCodeExampleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  language: z.string(),
  code: z.string(),
  filename: z.string().optional(),
  runnable: z.boolean().default(false),
  output: z.string().optional()
})

/**
 * Documentation article schema
 */
export const DocArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  categoryId: z.string(),
  summary: z.string(),
  content: z.string(),
  author: z
    .object({
      name: z.string(),
      avatar: z.string().url().optional(),
      url: z.string().url().optional()
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  readingTime: z.number().min(1).optional(),
  codeExamples: z.array(DocCodeExampleSchema).optional(),
  relatedArticles: z.array(z.string()).optional(),
  lastUpdated: z.string().datetime(),
  publishedAt: z.string().datetime()
})

/**
 * Documentation search result schema
 */
export const DocSearchResultSchema = z.object({
  articleId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  category: z.string(),
  relevanceScore: z.number().min(0).max(1),
  highlights: z.array(
    z.object({
      field: z.string(),
      snippet: z.string()
    })
  )
})

/**
 * Documentation structure schema
 */
export const DocumentationStructureSchema = z.object({
  categories: z.array(DocCategorySchema),
  articles: z.array(DocArticleSchema),
  searchIndex: z
    .object({
      enabled: z.boolean().default(true),
      provider: z.enum(['algolia', 'elasticsearch', 'local']).optional()
    })
    .optional()
})

// Type exports
export type DocCategory = z.infer<typeof DocCategorySchema>
export type DocCodeExample = z.infer<typeof DocCodeExampleSchema>
export type DocArticle = z.infer<typeof DocArticleSchema>
export type DocSearchResult = z.infer<typeof DocSearchResultSchema>
export type DocumentationStructure = z.infer<typeof DocumentationStructureSchema>
