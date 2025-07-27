import { z } from 'zod'

/**
 * Navigation menu item schema
 */
export const NavigationItemSchema: z.ZodType<{
  id: string
  label: string
  href: string
  target?: '_self' | '_blank'
  icon?: string
  badge?: string
  children?: Array<any>
}> = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
  target: z.enum(['_self', '_blank']).optional().default('_self'),
  icon: z.string().optional(),
  badge: z.string().optional(),
  children: z.array(z.lazy(() => NavigationItemSchema)).optional()
})

/**
 * Navigation menu schema
 */
export const NavigationMenuSchema = z.object({
  items: z.array(NavigationItemSchema),
  logoText: z.string().optional(),
  logoHref: z.string().default('/')
})

/**
 * Footer navigation schema
 */
export const FooterNavigationSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      items: z.array(NavigationItemSchema)
    })
  ),
  copyright: z.string(),
  socialLinks: z.array(
    z.object({
      platform: z.enum(['github', 'discord', 'twitter', 'linkedin']),
      url: z.string().url(),
      label: z.string()
    })
  )
})

// Type exports
export type NavigationItem = z.infer<typeof NavigationItemSchema>
export type NavigationMenu = z.infer<typeof NavigationMenuSchema>
export type FooterNavigation = z.infer<typeof FooterNavigationSchema>
