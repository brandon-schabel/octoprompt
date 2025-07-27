import { z } from 'zod'

/**
 * Interactive demo step schema
 */
export const DemoStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  action: z.object({
    type: z.enum(['click', 'type', 'select', 'drag', 'wait']),
    target: z.string().optional(),
    value: z.string().optional(),
    duration: z.number().optional()
  }),
  highlight: z
    .object({
      element: z.string(),
      style: z.enum(['outline', 'overlay', 'pulse']).default('outline')
    })
    .optional(),
  tooltip: z
    .object({
      text: z.string(),
      position: z.enum(['top', 'bottom', 'left', 'right']).default('top')
    })
    .optional()
})

/**
 * Demo scenario schema
 */
export const DemoScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  duration: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  steps: z.array(DemoStepSchema),
  endState: z.object({
    message: z.string(),
    nextScenario: z.string().optional()
  })
})

/**
 * Interactive demo section schema
 */
export const InteractiveDemoSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  scenarios: z.array(DemoScenarioSchema),
  interface: z.object({
    type: z.enum(['terminal', 'code-editor', 'browser', 'split-view']),
    theme: z.enum(['dark', 'light']).default('dark'),
    initialContent: z.string().optional()
  }),
  controls: z.object({
    allowSkip: z.boolean().default(true),
    allowRestart: z.boolean().default(true),
    showProgress: z.boolean().default(true)
  })
})

/**
 * Code playground schema
 */
export const CodePlaygroundSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  defaultCode: z.string(),
  language: z.string(),
  theme: z.enum(['vs-dark', 'github-dark', 'monokai']).default('vs-dark'),
  readOnly: z.boolean().default(false),
  showLineNumbers: z.boolean().default(true),
  showMinimap: z.boolean().default(false),
  templates: z
    .array(
      z.object({
        name: z.string(),
        code: z.string(),
        description: z.string().optional()
      })
    )
    .optional()
})

// Type exports
export type DemoStep = z.infer<typeof DemoStepSchema>
export type DemoScenario = z.infer<typeof DemoScenarioSchema>
export type InteractiveDemo = z.infer<typeof InteractiveDemoSchema>
export type CodePlayground = z.infer<typeof CodePlaygroundSchema>
