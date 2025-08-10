import { describe, it, expect } from 'bun:test'
import {
  parseMarkdownToPrompt,
  promptToMarkdown,
  validateMarkdownContent,
  extractPromptMetadata,
  exportPromptsToMarkdown,
  type File
} from './markdown-prompt-service'
import { ApiError } from '@promptliano/shared'
import type { Prompt } from '@promptliano/schemas'

describe('markdown-prompt-service', () => {
  describe('parseMarkdownToPrompt', () => {
    it('should parse valid markdown with frontmatter', async () => {
      const markdown = `---
name: Test Prompt
created: 2024-01-01T00:00:00Z
updated: 2024-01-02T00:00:00Z
tags: [coding, test]
---

This is a test prompt content.

It can have multiple lines.`

      const result = await parseMarkdownToPrompt(markdown)

      expect(result.frontmatter.name).toBe('Test Prompt')
      expect(result.frontmatter.created).toBe('2024-01-01T00:00:00.000Z')
      expect(result.frontmatter.updated).toBe('2024-01-02T00:00:00.000Z')
      expect(result.frontmatter.tags).toEqual(['coding', 'test'])
      expect(result.content).toBe('This is a test prompt content.\n\nIt can have multiple lines.')
      expect(result.rawContent).toBe(markdown)
    })

    it('should parse markdown with minimal frontmatter', async () => {
      const markdown = `---
name: Simple Prompt
---

Simple content.`

      const result = await parseMarkdownToPrompt(markdown)

      expect(result.frontmatter.name).toBe('Simple Prompt')
      expect(result.frontmatter.created).toBeUndefined()
      expect(result.frontmatter.updated).toBeUndefined()
      expect(result.frontmatter.tags).toEqual([])
      expect(result.content).toBe('Simple content.')
    })

    it('should throw error for empty content', async () => {
      await expect(parseMarkdownToPrompt('')).rejects.toThrow(ApiError)
      await expect(parseMarkdownToPrompt('   ')).rejects.toThrow(ApiError)
    })

    it('should throw error for missing name field', async () => {
      const markdown = `---
created: 2024-01-01T00:00:00Z
---

Content without name.`

      await expect(parseMarkdownToPrompt(markdown)).rejects.toThrow(ApiError)
    })

    it('should throw error for empty name field', async () => {
      const markdown = `---
name: ""
---

Content with empty name.`

      await expect(parseMarkdownToPrompt(markdown)).rejects.toThrow(ApiError)
    })

    it('should throw error for empty prompt content', async () => {
      const markdown = `---
name: Test Prompt
---

`

      await expect(parseMarkdownToPrompt(markdown)).rejects.toThrow(ApiError)
    })

    it('should throw error for invalid YAML frontmatter', async () => {
      const markdown = `---
name: Test Prompt
invalid: [yaml content
---

Content.`

      await expect(parseMarkdownToPrompt(markdown)).rejects.toThrow(ApiError)
    })

    it('should handle content that exceeds maximum length', async () => {
      const longContent = 'a'.repeat(1024 * 1024 + 1) // Exceed 1MB limit
      const markdown = `---
name: Long Prompt
---

${longContent}`

      await expect(parseMarkdownToPrompt(markdown)).rejects.toThrow(ApiError)
    })

    it('should filter invalid tags', async () => {
      const markdown = `---
name: Test Prompt
tags: ["valid", "", "  ", "another-valid", 123, null]
---

Content with mixed tags.`

      const result = await parseMarkdownToPrompt(markdown)
      expect(result.frontmatter.tags).toEqual(['valid', 'another-valid'])
    })
  })

  describe('promptToMarkdown', () => {
    it('should convert prompt to markdown with frontmatter', async () => {
      const prompt: Prompt = {
        id: 1,
        name: 'Test Prompt',
        content: 'This is test content.',
        created: 1704067200000, // 2024-01-01T00:00:00Z
        updated: 1704153600000 // 2024-01-02T00:00:00Z
      }

      const markdown = await promptToMarkdown(prompt)

      expect(markdown).toContain('---')
      expect(markdown).toContain('name: Test Prompt')
      expect(markdown).toContain("created: '2024-01-01T00:00:00.000Z'")
      expect(markdown).toContain("updated: '2024-01-02T00:00:00.000Z'")
      expect(markdown).toContain('tags: []')
      expect(markdown).toContain('This is test content.')
    })

    it('should handle prompt without timestamps', async () => {
      const prompt: Prompt = {
        id: 1,
        name: 'Simple Prompt',
        content: 'Simple content.',
        created: 0,
        updated: 0
      }

      const markdown = await promptToMarkdown(prompt)

      expect(markdown).toContain('name: Simple Prompt')
      expect(markdown).toContain('Simple content.')
      // Should not include created/updated if they are 0
    })

    it('should throw error for invalid prompt data', async () => {
      const invalidPrompt = {
        id: 'invalid-id', // Should be number
        name: '',
        content: 'Content'
      } as any

      await expect(promptToMarkdown(invalidPrompt)).rejects.toThrow(ApiError)
    })
  })

  describe('validateMarkdownContent', () => {
    it('should validate correct markdown content', async () => {
      const markdown = `---
name: Valid Prompt
---

Valid content.`

      const result = await validateMarkdownContent(markdown)

      expect(result.isValid).toBe(true)
      expect(result.validation.hasValidFrontmatter).toBe(true)
      expect(result.validation.hasRequiredFields).toBe(true)
      expect(result.validation.contentLength).toBe(14) // "Valid content."
      expect(result.validation.estimatedPrompts).toBe(1)
      expect(result.validation.errors).toEqual([])
    })

    it('should detect empty content', async () => {
      const result = await validateMarkdownContent('')

      expect(result.isValid).toBe(false)
      expect(result.validation.errors).toContain('Content is empty')
    })

    it('should detect missing name field', async () => {
      const markdown = `---
created: 2024-01-01T00:00:00Z
---

Content without name.`

      const result = await validateMarkdownContent(markdown)

      expect(result.isValid).toBe(false)
      expect(result.validation.hasRequiredFields).toBe(false)
      expect(result.validation.errors).toContain('Missing required field: name')
    })

    it('should detect invalid YAML', async () => {
      const markdown = `---
invalid: [yaml
---

Content.`

      const result = await validateMarkdownContent(markdown)

      expect(result.isValid).toBe(false)
      expect(result.validation.hasValidFrontmatter).toBe(false)
      expect(result.validation.errors.length).toBeGreaterThan(0)
    })

    it('should warn about empty content', async () => {
      const markdown = `---
name: Empty Content Prompt
---

`

      const result = await validateMarkdownContent(markdown)

      expect(result.isValid).toBe(false)
      expect(result.validation.warnings).toContain(
        'No content found after frontmatter - add your prompt text below the --- marker'
      )
    })

    it('should detect oversized content', async () => {
      const largeContent = 'a'.repeat(1024 * 1024 + 1)
      const markdown = `---
name: Large Prompt
---

${largeContent}`

      const result = await validateMarkdownContent(markdown)

      expect(result.isValid).toBe(false)
      expect(result.validation.errors.some((e) => e.includes('exceeds maximum'))).toBe(true)
    })

    it('should warn about invalid date formats', async () => {
      const markdown = `---
name: Invalid Date Prompt
created: not-a-date
updated: 2024-invalid-date
---

Content.`

      const result = await validateMarkdownContent(markdown)

      expect(result.validation.warnings.some((w) => w.includes('Invalid created date format'))).toBe(true)
      expect(result.validation.warnings.some((w) => w.includes('Invalid updated date format'))).toBe(true)
    })
  })

  describe('extractPromptMetadata', () => {
    it('should extract complete metadata', async () => {
      const markdown = `---
name: Metadata Test
created: 2024-01-01T00:00:00Z
updated: 2024-01-02T00:00:00Z
tags: [test, metadata]
---

Content.`

      const metadata = await extractPromptMetadata(markdown)

      expect(metadata.name).toBe('Metadata Test')
      expect(metadata.created).toBe('2024-01-01T00:00:00.000Z')
      expect(metadata.updated).toBe('2024-01-02T00:00:00.000Z')
      expect(metadata.tags).toEqual(['test', 'metadata'])
    })

    it('should handle minimal metadata', async () => {
      const markdown = `---
name: Minimal Test
---

Content.`

      const metadata = await extractPromptMetadata(markdown)

      expect(metadata.name).toBe('Minimal Test')
      expect(metadata.created).toBeUndefined()
      expect(metadata.updated).toBeUndefined()
      expect(metadata.tags).toEqual([])
    })

    it('should throw error for invalid frontmatter', async () => {
      const markdown = `---
name: ""
invalid-field: value
---

Content.`

      await expect(extractPromptMetadata(markdown)).rejects.toThrow(ApiError)
    })
  })

  describe('exportPromptsToMarkdown', () => {
    const samplePrompts: Prompt[] = [
      {
        id: 1,
        name: 'Prompt A',
        content: 'Content A',
        created: 1704067200000, // 2024-01-01
        updated: 1704153600000 // 2024-01-02
      },
      {
        id: 2,
        name: 'Prompt B',
        content: 'Content B',
        created: 1704240000000, // 2024-01-03
        updated: 1704326400000 // 2024-01-04
      }
    ]

    it('should export to single file format', async () => {
      const result = await exportPromptsToMarkdown(samplePrompts, {
        format: 'single-file',
        sortBy: 'name'
      })

      expect(result.success).toBe(true)
      expect(result.format).toBe('single-file')
      expect(result.promptCount).toBe(2)
      expect(result.fileName).toBe('exported-prompts.md')
      expect(result.content).toContain('Prompt A')
      expect(result.content).toContain('Prompt B')
      expect(result.content).toContain('---\n\n')
      expect(result.metadata.exportedAt).toBeDefined()
      expect(result.metadata.totalSize).toBeGreaterThan(0)
    })

    it('should export to multi-file format', async () => {
      const result = await exportPromptsToMarkdown(samplePrompts, {
        format: 'multi-file'
      })

      expect(result.success).toBe(true)
      expect(result.format).toBe('multi-file')
      expect(result.promptCount).toBe(2)
      expect(result.files).toHaveLength(2)

      const fileA = result.files?.find((f) => f.promptName === 'Prompt A')
      const fileB = result.files?.find((f) => f.promptName === 'Prompt B')

      expect(fileA).toBeDefined()
      expect(fileB).toBeDefined()
      expect(fileA?.fileName).toBe('prompt-a.md')
      expect(fileB?.fileName).toBe('prompt-b.md')
      expect(fileA?.content).toContain('Content A')
      expect(fileB?.content).toContain('Content B')
    })

    it('should sort prompts correctly', async () => {
      const result = await exportPromptsToMarkdown(samplePrompts, {
        format: 'multi-file',
        sortBy: 'created',
        sortOrder: 'desc'
      })

      expect(result.files?.[0].promptName).toBe('Prompt B') // More recent created date
      expect(result.files?.[1].promptName).toBe('Prompt A')
    })

    it('should handle export without frontmatter', async () => {
      const result = await exportPromptsToMarkdown(samplePrompts, {
        format: 'single-file',
        includeFrontmatter: false
      })

      expect(result.success).toBe(true)
      expect(result.content).not.toContain('---')
      expect(result.content).not.toContain('name:')
      expect(result.content).toContain('Content A')
      expect(result.content).toContain('Content B')
    })

    it('should sanitize content', async () => {
      const promptsWithConflicts: Prompt[] = [
        {
          id: 1,
          name: 'Conflict Prompt',
          content: 'Content with\n---\nfrontmatter delimiter',
          created: Date.now(),
          updated: Date.now()
        }
      ]

      const result = await exportPromptsToMarkdown(promptsWithConflicts, {
        sanitizeContent: true
      })

      expect(result.content).toContain('\\---') // Should be escaped
    })

    it('should handle empty prompt array', async () => {
      await expect(exportPromptsToMarkdown([], {})).rejects.toThrow(ApiError)
    })

    it('should handle invalid prompt data', async () => {
      const invalidPrompts = [
        {
          id: 'invalid',
          name: '',
          content: 'test'
        } as any
      ]

      await expect(exportPromptsToMarkdown(invalidPrompts, {})).rejects.toThrow(ApiError)
    })

    it('should generate safe filenames for multi-file export', async () => {
      const promptsWithSpecialNames: Prompt[] = [
        {
          id: 1,
          name: 'Special Characters!@#$%^&*()_+{}[]|\\:";\'<>?,./',
          content: 'Content',
          created: Date.now(),
          updated: Date.now()
        },
        {
          id: 2,
          name: 'A very long prompt name that should be truncated to meet filename length limits and not cause filesystem issues',
          content: 'Content',
          created: Date.now(),
          updated: Date.now()
        }
      ]

      const result = await exportPromptsToMarkdown(promptsWithSpecialNames, {
        format: 'multi-file'
      })

      const specialCharsFile = result.files?.find((f) => f.promptName.includes('Special Characters'))
      const longNameFile = result.files?.find((f) => f.promptName.includes('very long'))

      expect(specialCharsFile?.fileName).toBe('special-characters.md')
      expect(longNameFile?.fileName).toBe('a-very-long-prompt-name-that-should-be-truncated-t.md')
      expect(specialCharsFile?.fileName.length).toBeLessThanOrEqual(53) // 50 + '.md'
      expect(longNameFile?.fileName.length).toBeLessThanOrEqual(53) // 50 + '.md'
    })

    it('should exclude timestamps based on options', async () => {
      const result = await exportPromptsToMarkdown(samplePrompts, {
        format: 'single-file',
        includeCreatedDate: false,
        includeUpdatedDate: false
      })

      expect(result.content).not.toContain('created:')
      expect(result.content).not.toContain('updated:')
      expect(result.content).toContain('name:')
    })
  })
})
