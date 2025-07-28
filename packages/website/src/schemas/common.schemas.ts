import { z } from 'zod'

/**
 * Common image schema with responsive variants
 */
export const ResponsiveImageSchema = z.object({
  src: z.string().url(),
  alt: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  srcSet: z
    .array(
      z.object({
        url: z.string().url(),
        width: z.number()
      })
    )
    .optional(),
  placeholder: z.string().optional()
})

/**
 * Common link schema
 */
export const LinkSchema = z.object({
  text: z.string(),
  href: z.string(),
  target: z.enum(['_self', '_blank']).default('_self'),
  rel: z.string().optional(),
  icon: z.string().optional()
})

/**
 * Common badge schema
 */
export const BadgeSchema = z.object({
  text: z.string(),
  variant: z.enum(['default', 'primary', 'secondary', 'success', 'warning', 'danger']).default('default'),
  size: z.enum(['sm', 'md', 'lg']).default('md')
})

/**
 * Common animation configuration
 */
export const AnimationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(['fade', 'slide', 'scale', 'rotate', 'bounce']),
  duration: z.number().min(0).max(5).default(0.5),
  delay: z.number().min(0).max(2).default(0),
  easing: z.enum(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']).default('ease-out'),
  trigger: z.enum(['onMount', 'onScroll', 'onHover', 'onClick']).default('onMount')
})

/**
 * Common color scheme
 */
export const ColorSchemeSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  foreground: z.string(),
  muted: z.string(),
  border: z.string()
})

/**
 * Email validation schema
 */
export const EmailSchema = z.string().email().toLowerCase()

/**
 * URL validation schema
 */
export const UrlSchema = z.string().url()

// Type exports
export type ResponsiveImage = z.infer<typeof ResponsiveImageSchema>
export type Link = z.infer<typeof LinkSchema>
export type Badge = z.infer<typeof BadgeSchema>
export type AnimationConfig = z.infer<typeof AnimationConfigSchema>
export type ColorScheme = z.infer<typeof ColorSchemeSchema>
export type Email = z.infer<typeof EmailSchema>
export type Url = z.infer<typeof UrlSchema>
