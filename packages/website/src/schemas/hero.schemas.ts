import { z } from 'zod'

/**
 * Hero section CTA button schema
 */
export const HeroCtaSchema = z.object({
  id: z.string(),
  text: z.string(),
  href: z.string(),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).default('primary'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  icon: z.string().optional(),
  target: z.enum(['_self', '_blank']).optional()
})

/**
 * Hero animation configuration schema
 */
export const HeroAnimationSchema = z.object({
  type: z.enum(['fade', 'slide', 'scale', 'bounce', 'float']),
  duration: z.number().min(0).max(10).default(1),
  delay: z.number().min(0).max(5).default(0),
  easing: z.enum(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']).default('ease-out')
})

/**
 * Hero section content schema
 */
export const HeroSectionSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  ctas: z.array(HeroCtaSchema).max(3),
  backgroundImage: z.string().url().optional(),
  backgroundGradient: z
    .object({
      from: z.string(),
      to: z.string(),
      direction: z.enum(['to-t', 'to-tr', 'to-r', 'to-br', 'to-b', 'to-bl', 'to-l', 'to-tl']).default('to-br')
    })
    .optional(),
  animation: HeroAnimationSchema.optional(),
  decorativeElements: z
    .array(
      z.object({
        type: z.enum(['grid', 'dots', 'lines', 'circles', 'code']),
        position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']),
        opacity: z.number().min(0).max(1).default(0.1)
      })
    )
    .optional()
})

// Type exports
export type HeroCta = z.infer<typeof HeroCtaSchema>
export type HeroAnimation = z.infer<typeof HeroAnimationSchema>
export type HeroSection = z.infer<typeof HeroSectionSchema>
