import { z } from 'zod'

/**
 * Pricing tier feature schema
 */
export const PricingFeatureSchema = z.object({
  text: z.string(),
  included: z.boolean(),
  tooltip: z.string().optional(),
  highlight: z.boolean().default(false)
})

/**
 * Pricing tier schema
 */
export const PricingTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.object({
    amount: z.number(),
    currency: z.string().default('USD'),
    period: z.enum(['monthly', 'yearly', 'one-time']).optional(),
    originalAmount: z.number().optional()
  }),
  badge: z.string().optional(),
  highlighted: z.boolean().default(false),
  features: z.array(PricingFeatureSchema),
  cta: z.object({
    text: z.string(),
    href: z.string(),
    variant: z.enum(['primary', 'secondary', 'outline']).default('primary')
  })
})

/**
 * Pricing section schema
 */
export const PricingSectionSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  billingToggle: z
    .object({
      enabled: z.boolean().default(true),
      monthlyLabel: z.string().default('Monthly'),
      yearlyLabel: z.string().default('Yearly'),
      yearlySavingsText: z.string().optional()
    })
    .optional(),
  tiers: z.array(PricingTierSchema).min(1).max(4),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string()
      })
    )
    .optional()
})

// Type exports
export type PricingFeature = z.infer<typeof PricingFeatureSchema>
export type PricingTier = z.infer<typeof PricingTierSchema>
export type PricingSection = z.infer<typeof PricingSectionSchema>
