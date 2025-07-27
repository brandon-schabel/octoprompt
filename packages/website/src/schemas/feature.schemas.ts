import { z } from 'zod'

/**
 * Feature icon schema
 */
export const FeatureIconSchema = z.object({
  type: z.enum(['icon', 'emoji', 'svg', 'image']),
  value: z.string(),
  color: z.string().optional(),
  backgroundColor: z.string().optional()
})

/**
 * Individual feature schema
 */
export const FeatureSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: FeatureIconSchema,
  badge: z.string().optional(),
  link: z
    .object({
      text: z.string(),
      href: z.string(),
      target: z.enum(['_self', '_blank']).default('_self')
    })
    .optional(),
  highlights: z.array(z.string()).max(5).optional(),
  codeExample: z
    .object({
      language: z.string(),
      code: z.string(),
      filename: z.string().optional()
    })
    .optional()
})

/**
 * Feature showcase section schema
 */
export const FeatureShowcaseSchema = z.object({
  sectionTitle: z.string(),
  sectionSubtitle: z.string().optional(),
  layout: z.enum(['grid', 'cards', 'list', 'carousel']).default('grid'),
  columns: z
    .object({
      mobile: z.number().min(1).max(2).default(1),
      tablet: z.number().min(2).max(3).default(2),
      desktop: z.number().min(3).max(4).default(3)
    })
    .optional(),
  features: z.array(FeatureSchema).min(1).max(12)
})

/**
 * Feature comparison schema
 */
export const FeatureComparisonSchema = z.object({
  title: z.string(),
  competitors: z.array(
    z.object({
      name: z.string(),
      logo: z.string().url().optional()
    })
  ),
  features: z.array(
    z.object({
      feature: z.string(),
      description: z.string().optional(),
      us: z.boolean(),
      competitors: z.record(z.string(), z.boolean())
    })
  )
})

// Type exports
export type FeatureIcon = z.infer<typeof FeatureIconSchema>
export type Feature = z.infer<typeof FeatureSchema>
export type FeatureShowcase = z.infer<typeof FeatureShowcaseSchema>
export type FeatureComparison = z.infer<typeof FeatureComparisonSchema>
