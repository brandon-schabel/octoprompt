import { z } from 'zod'

/**
 * Open Graph image schema
 */
export const OpenGraphImageSchema = z.object({
  url: z.string().url(),
  width: z.number().optional(),
  height: z.number().optional(),
  alt: z.string().optional()
})

/**
 * SEO metadata schema
 */
export const SeoMetadataSchema = z.object({
  title: z.string().max(60),
  description: z.string().max(160),
  keywords: z.array(z.string()).optional(),
  canonical: z.string().url().optional(),
  robots: z
    .object({
      index: z.boolean().default(true),
      follow: z.boolean().default(true),
      googleBot: z
        .object({
          index: z.boolean().default(true),
          follow: z.boolean().default(true)
        })
        .optional()
    })
    .optional(),
  openGraph: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(['website', 'article', 'product']).default('website'),
      url: z.string().url().optional(),
      siteName: z.string().optional(),
      images: z.array(OpenGraphImageSchema).optional(),
      locale: z.string().default('en_US')
    })
    .optional(),
  twitter: z
    .object({
      card: z.enum(['summary', 'summary_large_image', 'app', 'player']).default('summary_large_image'),
      site: z.string().optional(),
      creator: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().url().optional()
    })
    .optional(),
  jsonLd: z.record(z.any()).optional()
})

/**
 * Page metadata schema
 */
export const PageMetadataSchema = z.object({
  path: z.string(),
  seo: SeoMetadataSchema,
  lastModified: z.string().datetime().optional(),
  priority: z.number().min(0).max(1).default(0.5),
  changeFrequency: z.enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']).optional()
})

// Type exports
export type OpenGraphImage = z.infer<typeof OpenGraphImageSchema>
export type SeoMetadata = z.infer<typeof SeoMetadataSchema>
export type PageMetadata = z.infer<typeof PageMetadataSchema>
