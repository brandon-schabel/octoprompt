import { z } from 'zod'

/**
 * Testimonial author schema
 */
export const TestimonialAuthorSchema = z.object({
  name: z.string(),
  role: z.string(),
  company: z.string().optional(),
  avatar: z.string().url(),
  linkedIn: z.string().url().optional(),
  twitter: z.string().url().optional()
})

/**
 * Individual testimonial schema
 */
export const TestimonialSchema = z.object({
  id: z.string(),
  quote: z.string().min(20).max(500),
  author: TestimonialAuthorSchema,
  rating: z.number().min(1).max(5).optional(),
  featured: z.boolean().default(false),
  createdAt: z.string().datetime(),
  tags: z.array(z.enum(['productivity', 'collaboration', 'ai', 'developer-experience', 'mcp'])).default([])
})

/**
 * Testimonial section schema
 */
export const TestimonialSectionSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  testimonials: z.array(TestimonialSchema).min(1),
  layout: z.enum(['carousel', 'grid', 'masonry']).default('carousel'),
  autoplay: z.boolean().default(true),
  autoplayInterval: z.number().min(3000).max(10000).default(5000)
})

// Type exports
export type TestimonialAuthor = z.infer<typeof TestimonialAuthorSchema>
export type Testimonial = z.infer<typeof TestimonialSchema>
export type TestimonialSection = z.infer<typeof TestimonialSectionSchema>
