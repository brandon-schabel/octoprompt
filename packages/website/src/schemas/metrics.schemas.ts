import { z } from 'zod'

/**
 * Metric trend schema
 */
export const MetricTrendSchema = z.object({
  direction: z.enum(['up', 'down', 'stable']),
  percentage: z.number(),
  period: z.enum(['day', 'week', 'month', 'year'])
})

/**
 * Individual metric schema
 */
export const MetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  trend: MetricTrendSchema.optional(),
  description: z.string().optional()
})

/**
 * Metrics section schema
 */
export const MetricsSectionSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  metrics: z.array(MetricSchema).min(1).max(6),
  layout: z.enum(['cards', 'stats', 'counters']).default('stats'),
  animated: z.boolean().default(true),
  updateInterval: z.number().optional()
})

/**
 * Performance metric schema
 */
export const PerformanceMetricSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  unit: z.enum(['ms', 's', 'kb', 'mb', '%']),
  threshold: z.object({
    good: z.number(),
    needsImprovement: z.number(),
    poor: z.number()
  }),
  description: z.string().optional()
})

// Type exports
export type MetricTrend = z.infer<typeof MetricTrendSchema>
export type Metric = z.infer<typeof MetricSchema>
export type MetricsSection = z.infer<typeof MetricsSectionSchema>
export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>
