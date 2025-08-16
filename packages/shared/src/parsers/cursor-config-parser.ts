import { JsonParser } from './json-parser'
import type { ParserOptions } from './base-parser'
import { z } from 'zod'

// Cursor-specific settings schema
export const CursorSettingsSchema = z
  .object({
    // AI-related settings
    'cursor.aiProvider': z.enum(['openai', 'anthropic', 'custom']).optional(),
    'cursor.apiKey': z.string().optional(),
    'cursor.model': z.string().optional(),
    'cursor.temperature': z.number().min(0).max(2).optional(),
    'cursor.maxTokens': z.number().positive().optional(),

    // Chat settings
    'cursor.chat.enabled': z.boolean().optional(),
    'cursor.chat.autoSuggest': z.boolean().optional(),
    'cursor.chat.contextLines': z.number().optional(),

    // Code generation settings
    'cursor.codeGeneration.enabled': z.boolean().optional(),
    'cursor.codeGeneration.style': z.enum(['concise', 'verbose', 'balanced']).optional(),

    // Privacy settings
    'cursor.telemetry.enabled': z.boolean().optional(),
    'cursor.codeSharing.enabled': z.boolean().optional(),

    // Include VS Code settings as Cursor extends VS Code
    'editor.fontSize': z.number().optional(),
    'editor.fontFamily': z.string().optional(),
    'workbench.colorTheme': z.string().optional()
  })
  .passthrough() // Allow additional properties

export type CursorSettings = z.infer<typeof CursorSettingsSchema>

// Cursor rules format (for .cursorrules files)
export const CursorRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        pattern: z.string(),
        message: z.string(),
        severity: z.enum(['info', 'warning', 'error']).optional()
      })
    )
    .optional(),
  codeStyle: z
    .object({
      language: z.string(),
      guidelines: z.array(z.string())
    })
    .optional(),
  aiContext: z
    .object({
      projectDescription: z.string().optional(),
      techStack: z.array(z.string()).optional(),
      conventions: z.array(z.string()).optional()
    })
    .optional()
})

export type CursorRules = z.infer<typeof CursorRulesSchema>

export class CursorConfigParser extends JsonParser<CursorSettings | CursorRules> {
  constructor(options: ParserOptions = {}) {
    super(options)
  }

  async parse(content: string, filePath?: string) {
    // Determine schema based on file name
    let schema = this.options.validateSchema

    if (!schema && filePath) {
      if (filePath.includes('.cursorrules')) {
        schema = CursorRulesSchema
      } else if (filePath.includes('settings.json')) {
        schema = CursorSettingsSchema
      }
    }

    // Update options with determined schema
    this.options.validateSchema = schema

    return super.parse(content, filePath)
  }
}