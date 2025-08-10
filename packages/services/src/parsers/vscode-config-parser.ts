import { JsonParser } from './json-parser'
import type { ParserOptions } from './base-parser'
import { z } from 'zod'

// VS Code settings schema (partial)
export const VSCodeSettingsSchema = z
  .object({
    'editor.fontSize': z.number().optional(),
    'editor.fontFamily': z.string().optional(),
    'editor.tabSize': z.number().optional(),
    'editor.wordWrap': z.enum(['off', 'on', 'wordWrapColumn', 'bounded']).optional(),
    'workbench.colorTheme': z.string().optional(),
    'workbench.iconTheme': z.string().optional(),
    extensions: z.array(z.string()).optional(),
    'terminal.integrated.fontSize': z.number().optional(),
    'files.autoSave': z.enum(['off', 'afterDelay', 'onFocusChange', 'onWindowChange']).optional(),
    'files.autoSaveDelay': z.number().optional()
  })
  .passthrough() // Allow additional properties

export type VSCodeSettings = z.infer<typeof VSCodeSettingsSchema>

// VS Code tasks schema
export const VSCodeTaskSchema = z.object({
  label: z.string(),
  type: z.string(),
  command: z.string().optional(),
  script: z.string().optional(),
  group: z
    .union([
      z.string(),
      z.object({
        kind: z.string(),
        isDefault: z.boolean().optional()
      })
    ])
    .optional(),
  presentation: z
    .object({
      echo: z.boolean().optional(),
      reveal: z.enum(['always', 'silent', 'never']).optional(),
      focus: z.boolean().optional(),
      panel: z.enum(['shared', 'dedicated', 'new']).optional()
    })
    .optional(),
  problemMatcher: z.union([z.string(), z.array(z.string())]).optional()
})

export const VSCodeTasksConfigSchema = z.object({
  version: z.string(),
  tasks: z.array(VSCodeTaskSchema)
})

export type VSCodeTasksConfig = z.infer<typeof VSCodeTasksConfigSchema>

export class VSCodeConfigParser extends JsonParser<VSCodeSettings | VSCodeTasksConfig> {
  constructor(options: ParserOptions = {}) {
    super(options)
  }

  async parse(content: string, filePath?: string) {
    // Determine schema based on file name
    let schema = this.options.validateSchema

    if (!schema && filePath) {
      if (filePath.includes('settings.json')) {
        schema = VSCodeSettingsSchema
      } else if (filePath.includes('tasks.json')) {
        schema = VSCodeTasksConfigSchema
      }
    }

    // Update options with determined schema
    this.options.validateSchema = schema

    return super.parse(content, filePath)
  }
}
