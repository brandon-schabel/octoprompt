import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { PromptlianoClient } from '../../api-client'
import type { ApiConfig } from '@promptliano/api-client'
import { createTestEnvironment, withTestData } from './test-environment'
import { TestDataManager, assertions, factories, retryOperation, waitFor, PerformanceTracker } from './utils/test-helpers'
import type { TestEnvironment } from './test-environment'
import type { 
  BulkImportResponse, 
  MarkdownExportResponse, 
  MarkdownImportRequest,
  BatchExportRequest,
  ParsedMarkdownPrompt,
  MarkdownFrontmatter
} from '@promptliano/schemas'

/**
 * Comprehensive Markdown Service API Tests
 * 
 * Tests all Markdown Service operations with proper isolation:
 * - Markdown import operations (single and bulk)
 * - Markdown export operations (single and batch)
 * - Markdown validation functionality
 * - Error handling for malformed markdown
 * - Performance with large document collections
 * - Various markdown formats and edge cases
 * - Frontmatter parsing and validation
 * - Content extraction and processing
 */

describe('Markdown Service API Tests', () => {
  let testEnv: TestEnvironment
  let client: PromptlianoClient
  let dataManager: TestDataManager
  let perfTracker: PerformanceTracker
  let testProjectId: number

  beforeAll(async () => {
    console.log('🚀 Starting Markdown Service API Tests...')
    
    // Create isolated test environment optimized for file processing
    testEnv = await createTestEnvironment({
      useIsolatedServer: true,
      database: {
        useMemory: testEnv?.isCI ?? false, // Use memory DB in CI for speed
        path: '/tmp/promptliano-markdown-test.db'
      },
      execution: {
        apiTimeout: 45000, // Longer timeout for file processing operations
        enableRateLimit: false,
        logLevel: 'warn'
      }
    })

    client = new PromptlianoClient({ baseUrl: testEnv.baseUrl })
    dataManager = new TestDataManager(client)
    perfTracker = new PerformanceTracker()

    // Verify markdown client is available
    expect(client.markdown).toBeDefined()
    expect(typeof client.markdown.importMarkdownPrompts).toBe('function')
    expect(typeof client.markdown.exportPromptAsMarkdown).toBe('function')
    expect(typeof client.markdown.exportPromptsAsMarkdown).toBe('function')
    expect(typeof client.markdown.importProjectMarkdownPrompts).toBe('function')
    
    // Create test project for markdown operations
    const project = await dataManager.createTestProject('Markdown Test Project')
    testProjectId = project.id
    
    console.log('✅ Test environment initialized successfully')
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up markdown test data...')
    
    try {
      await dataManager.cleanup()
      perfTracker.printSummary()
    } catch (error) {
      console.warn('⚠️ Cleanup encountered errors:', error)
    }
    
    await testEnv.cleanup()
    console.log('✅ Markdown API tests cleanup completed')
  })

  // ============================================================================
  // MARKDOWN IMPORT OPERATIONS
  // ============================================================================

  describe('Markdown Import Operations', () => {
    test('should import single markdown file with frontmatter successfully', async () => {
      const markdownContent = `---
name: Code Review Assistant
created: 2024-01-01T10:00:00Z
updated: 2024-01-15T14:30:00Z
tags: [code-review, programming, quality]
---

# Code Review Assistant

You are an expert code reviewer. Please review the following code for:

1. **Code Quality**: Check for readability, maintainability, and best practices
2. **Performance**: Identify potential performance issues
3. **Security**: Look for security vulnerabilities
4. **Testing**: Suggest improvements for testability

## Instructions

\`\`\`
Please provide specific, actionable feedback with examples.
\`\`\`

Code to review: {code}`

      const file = new File([markdownContent], 'code-review.md', { type: 'text/markdown' })
      
      const result = await perfTracker.measure('import-single-markdown', async () => {
        return client.markdown.importMarkdownPrompts([file])
      })

      // Validate import response structure
      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.totalFiles).toBe(1)
      expect(result.data.filesProcessed).toBe(1)
      expect(result.data.totalPrompts).toBe(1)
      expect(result.data.promptsImported).toBe(1)
      
      // Validate file results
      expect(result.data.fileResults).toHaveLength(1)
      const fileResult = result.data.fileResults[0]
      expect(fileResult.success).toBe(true)
      expect(fileResult.fileName).toBe('code-review.md')
      expect(fileResult.promptsProcessed).toBe(1)
      expect(fileResult.promptsImported).toBe(1)
      expect(fileResult.results).toHaveLength(1)
      
      // Validate prompt import result
      const promptResult = fileResult.results[0]
      expect(promptResult.success).toBe(true)
      expect(promptResult.promptName).toBe('Code Review Assistant')
      expect(promptResult.action).toBe('created')
      assertions.assertValidId(promptResult.promptId!)
      
      // Validate summary
      expect(result.data.summary.created).toBe(1)
      expect(result.data.summary.updated).toBe(0)
      expect(result.data.summary.skipped).toBe(0)
      expect(result.data.summary.failed).toBe(0)
    })

    test('should import markdown file without frontmatter using filename as name', async () => {
      const markdownContent = `# Database Migration Helper

This prompt helps with database migrations and schema changes.

## Usage

Describe your current schema and desired changes, and I'll help you:
- Create migration scripts
- Identify potential issues
- Suggest rollback strategies

Current schema: {schema}
Desired changes: {changes}`

      const file = new File([markdownContent], 'database-migration-helper.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([file])

      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.totalPrompts).toBe(1)
      expect(result.data.promptsImported).toBe(1)
      
      const promptResult = result.data.fileResults[0].results[0]
      expect(promptResult.success).toBe(true)
      // Should use filename as name when no frontmatter
      expect(promptResult.promptName).toBe('database-migration-helper')
      expect(promptResult.action).toBe('created')
    })

    test('should import multiple markdown files in bulk', async () => {
      const files = [
        new File([`---
name: API Documentation Writer
tags: [documentation, api]
---

Generate comprehensive API documentation for: {endpoint}`], 'api-docs.md', { type: 'text/markdown' }),
        
        new File([`---
name: Test Case Generator
tags: [testing, automation]
---

Create test cases for the following functionality: {feature}`], 'test-generator.md', { type: 'text/markdown' }),
        
        new File([`---
name: Refactoring Assistant
tags: [refactoring, code-quality]
---

Refactor the following code to improve: {code}`], 'refactoring.md', { type: 'text/markdown' })
      ]
      
      const result = await perfTracker.measure('import-bulk-markdown', async () => {
        return client.markdown.importMarkdownPrompts(files)
      })

      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.totalFiles).toBe(3)
      expect(result.data.filesProcessed).toBe(3)
      expect(result.data.totalPrompts).toBe(3)
      expect(result.data.promptsImported).toBe(3)
      expect(result.data.fileResults).toHaveLength(3)
      
      // Validate all files processed successfully
      result.data.fileResults.forEach((fileResult, index) => {
        expect(fileResult.success).toBe(true)
        expect(fileResult.promptsImported).toBe(1)
        expect(fileResult.results[0].success).toBe(true)
        expect(fileResult.results[0].action).toBe('created')
      })
      
      // Validate summary
      expect(result.data.summary.created).toBe(3)
      expect(result.data.summary.failed).toBe(0)
    })

    test('should import markdown files to specific project', async () => {
      const markdownContent = `---
name: Project Specific Prompt
tags: [project, specific]
---

This prompt is for a specific project: {requirement}`

      const file = new File([markdownContent], 'project-prompt.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importProjectMarkdownPrompts(testProjectId, [file])

      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.promptsImported).toBe(1)
      
      // Verify the prompt was created and associated with the project
      const promptResult = result.data.fileResults[0].results[0]
      expect(promptResult.success).toBe(true)
      assertions.assertValidId(promptResult.promptId!)
      
      // Check if prompt is associated with project (would need project prompts endpoint)
      // This validates the projectId parameter was properly handled
    })

    test('should handle overwrite existing prompts option', async () => {
      const promptName = 'Duplicate Prompt Test'
      const originalContent = `---
name: ${promptName}
---

Original content`

      const updatedContent = `---
name: ${promptName}
---

Updated content with more details`

      // First import
      const file1 = new File([originalContent], 'original.md', { type: 'text/markdown' })
      const result1 = await client.markdown.importMarkdownPrompts([file1])
      assertions.assertSuccessResponse(result1)
      expect(result1.data.summary.created).toBe(1)

      // Second import without overwrite (should skip)
      const file2 = new File([updatedContent], 'updated.md', { type: 'text/markdown' })
      const result2 = await client.markdown.importMarkdownPrompts([file2], { overwriteExisting: false })
      assertions.assertSuccessResponse(result2)
      expect(result2.data.summary.skipped).toBe(1)
      expect(result2.data.fileResults[0].results[0].action).toBe('skipped')

      // Third import with overwrite (should update)
      const result3 = await client.markdown.importMarkdownPrompts([file2], { overwriteExisting: true })
      assertions.assertSuccessResponse(result3)
      expect(result3.data.summary.updated).toBe(1)
      expect(result3.data.fileResults[0].results[0].action).toBe('updated')
    })

    test('should validate markdown content structure when enabled', async () => {
      const invalidMarkdown = `---
name: Invalid Prompt
invalid_field: this_should_cause_warning
---

# Missing proper content structure

This markdown has some issues but should still import with warnings.`

      const file = new File([invalidMarkdown], 'invalid.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([file], { validateContent: true })

      assertions.assertSuccessResponse(result)
      
      // Should import but with warnings about unknown frontmatter fields
      const fileResult = result.data.fileResults[0]
      expect(fileResult.success).toBe(true)
      // Check for validation warnings
      expect(fileResult.warnings?.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // MARKDOWN EXPORT OPERATIONS
  // ============================================================================

  describe('Markdown Export Operations', () => {
    let testPromptId: number

    beforeAll(async () => {
      // Create a test prompt for export operations via markdown import first
      // This avoids potential schema issues with direct prompt creation
      const markdownContent = `---
name: Export Test Prompt
---

Test content for export operations`

      const file = new File([markdownContent], 'export-test.md', { type: 'text/markdown' })
      const importResult = await client.markdown.importMarkdownPrompts([file])
      
      if (importResult.success && importResult.data.promptsImported > 0) {
        testPromptId = importResult.data.fileResults[0].results[0].promptId!
      } else {
        throw new Error('Failed to create test prompt for export operations')
      }
    })

    test('should export single prompt as markdown text', async () => {
      const result = await perfTracker.measure('export-single-markdown', async () => {
        return client.markdown.exportPromptAsMarkdown(testPromptId)
      })

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      
      // Validate markdown structure
      expect(result).toContain('---')  // Frontmatter delimiters
      expect(result).toContain('name:') // Frontmatter name field
      expect(result).toContain('Export Test Prompt') // Prompt name
      expect(result).toContain('Test content for export') // Prompt content
      
      // Validate frontmatter format
      const frontmatterMatch = result.match(/^---\n([\s\S]*?)\n---\n/)
      expect(frontmatterMatch).toBeTruthy()
    })

    test('should export single prompt with custom options', async () => {
      const result = await client.markdown.exportPromptAsMarkdown(testPromptId, {
        includeFrontmatter: true,
        includeCreatedDate: true,
        includeUpdatedDate: true,
        includeTags: true,
        sanitizeContent: true
      })

      expect(typeof result).toBe('string')
      expect(result).toContain('---')
      expect(result).toContain('name:')
      expect(result).toContain('created:')
      // Note: updated field may not be present if prompt wasn't updated
    })

    test('should export single prompt without frontmatter', async () => {
      const result = await client.markdown.exportPromptAsMarkdown(testPromptId, {
        includeFrontmatter: false
      })

      expect(typeof result).toBe('string')
      expect(result).not.toContain('---') // No frontmatter
      expect(result).toContain('Test content for export') // Just the content
    })

    test('should export multiple prompts in single file format', async () => {
      // Create additional test prompts via import
      const files = [
        new File([`---
name: Second Export Prompt
---

Second content`], 'second.md', { type: 'text/markdown' }),
        new File([`---
name: Third Export Prompt
---

Third content`], 'third.md', { type: 'text/markdown' })
      ]
      
      const importResult = await client.markdown.importMarkdownPrompts(files)
      assertions.assertSuccessResponse(importResult)
      
      const prompt2 = { id: importResult.data.fileResults[0].results[0].promptId! }
      const prompt3 = { id: importResult.data.fileResults[1].results[0].promptId! }
      
      const result = await perfTracker.measure('export-batch-single-file', async () => {
        return client.markdown.exportPromptsAsMarkdown([testPromptId, prompt2.id, prompt3.id], {
          format: 'single-file',
          sortBy: 'name',
          sortOrder: 'asc'
        })
      })

      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.format).toBe('single-file')
      expect(result.data.promptCount).toBe(3)
      
      // Single file export should have content and filename
      expect(result.data.fileName).toBeDefined()
      expect(result.data.content).toBeDefined()
      expect(typeof result.data.content).toBe('string')
      expect(result.data.content!.length).toBeGreaterThan(0)
      
      // Should contain all prompt names
      expect(result.data.content).toContain('Export Test Prompt')
      expect(result.data.content).toContain('Second Export Prompt')
      expect(result.data.content).toContain('Third Export Prompt')
      
      // Validate metadata
      expect(result.data.metadata).toBeDefined()
      expect(result.data.metadata!.exportedAt).toBeDefined()
      expect(result.data.metadata!.totalSize).toBeGreaterThan(0)
    })

    test('should export multiple prompts in multi-file format', async () => {
      // Create test prompts via import
      const files = [
        new File([`---
name: Multi File Prompt 1
---

Content 1`], 'multi1.md', { type: 'text/markdown' }),
        new File([`---
name: Multi File Prompt 2
---

Content 2`], 'multi2.md', { type: 'text/markdown' })
      ]
      
      const importResult = await client.markdown.importMarkdownPrompts(files)
      assertions.assertSuccessResponse(importResult)
      
      const prompt2 = { id: importResult.data.fileResults[0].results[0].promptId! }
      const prompt3 = { id: importResult.data.fileResults[1].results[0].promptId! }
      
      const result = await client.markdown.exportPromptsAsMarkdown([prompt2.id, prompt3.id], {
        format: 'multi-file',
        includeCreatedDate: false,
        includeUpdatedDate: false
      })

      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.format).toBe('multi-file')
      expect(result.data.promptCount).toBe(2)
      
      // Multi-file export should have files array
      expect(result.data.files).toBeDefined()
      expect(result.data.files!.length).toBe(2)
      
      // Validate each exported file
      result.data.files!.forEach(file => {
        expect(file.fileName).toBeDefined()
        expect(file.content).toBeDefined()
        expect(file.promptId).toBeDefined()
        expect(file.promptName).toBeDefined()
        expect(typeof file.content).toBe('string')
        expect(file.content.length).toBeGreaterThan(0)
        
        // Should contain frontmatter
        expect(file.content).toContain('---')
        expect(file.content).toContain('name:')
        
        // Should NOT contain created/updated dates (disabled in options)
        expect(file.content).not.toContain('created:')
        expect(file.content).not.toContain('updated:')
      })
    })

    test('should sort exported prompts by different criteria', async () => {
      // Create prompts with specific names for sorting test via import
      const files = [
        new File([`---\nname: A Prompt\n---\n\nContent A`], 'a.md', { type: 'text/markdown' }),
        new File([`---\nname: Z Prompt\n---\n\nContent Z`], 'z.md', { type: 'text/markdown' }),
        new File([`---\nname: M Prompt\n---\n\nContent M`], 'm.md', { type: 'text/markdown' })
      ]
      
      const importResult = await client.markdown.importMarkdownPrompts(files)
      assertions.assertSuccessResponse(importResult)
      
      const promptA = { id: importResult.data.fileResults[0].results[0].promptId! }
      const promptZ = { id: importResult.data.fileResults[1].results[0].promptId! }
      const promptM = { id: importResult.data.fileResults[2].results[0].promptId! }
      
      // Test ascending sort
      const resultAsc = await client.markdown.exportPromptsAsMarkdown([promptZ.id, promptA.id, promptM.id], {
        format: 'single-file',
        sortBy: 'name',
        sortOrder: 'asc'
      })
      
      assertions.assertSuccessResponse(resultAsc)
      const contentAsc = resultAsc.data.content!
      const posA = contentAsc.indexOf('A Prompt')
      const posM = contentAsc.indexOf('M Prompt')
      const posZ = contentAsc.indexOf('Z Prompt')
      expect(posA).toBeLessThan(posM)
      expect(posM).toBeLessThan(posZ)
      
      // Test descending sort
      const resultDesc = await client.markdown.exportPromptsAsMarkdown([promptA.id, promptZ.id, promptM.id], {
        format: 'single-file',
        sortBy: 'name',
        sortOrder: 'desc'
      })
      
      assertions.assertSuccessResponse(resultDesc)
      const contentDesc = resultDesc.data.content!
      const posA2 = contentDesc.indexOf('A Prompt')
      const posM2 = contentDesc.indexOf('M Prompt')
      const posZ2 = contentDesc.indexOf('Z Prompt')
      expect(posZ2).toBeLessThan(posM2)
      expect(posM2).toBeLessThan(posA2)
    })
  })

  // ============================================================================
  // VALIDATION AND ERROR HANDLING
  // ============================================================================

  describe('Validation and Error Handling', () => {
    test('should reject files with invalid extensions', async () => {
      const invalidFile = new File(['Some content'], 'invalid.txt', { type: 'text/plain' })
      
      try {
        await client.markdown.importMarkdownPrompts([invalidFile])
        throw new Error('Expected import to fail with invalid file extension')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/invalid file type|only.*md.*allowed/i)
      }
    })

    test('should handle large file size limits', async () => {
      // Create a file larger than the typical limit (10MB)
      const largeContent = 'A'.repeat(11 * 1024 * 1024) // 11MB
      const largeFile = new File([largeContent], 'large.md', { type: 'text/markdown' })
      
      try {
        await client.markdown.importMarkdownPrompts([largeFile])
        throw new Error('Expected import to fail with large file')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/file.*too large|size.*exceed/i)
      }
    })

    test('should handle malformed YAML frontmatter', async () => {
      const malformedMarkdown = `---
name: Malformed Prompt
tags: [unclosed array
invalid: : syntax
---

Content after malformed frontmatter`

      const file = new File([malformedMarkdown], 'malformed.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([file])
      
      // Should handle gracefully with errors in file results
      assertions.assertSuccessResponse(result)
      const fileResult = result.data.fileResults[0]
      expect(fileResult.success).toBe(false)
      expect(fileResult.errors.length).toBeGreaterThan(0)
      expect(fileResult.errors[0]).toMatch(/frontmatter|yaml|parse/i)
    })

    test('should handle empty markdown files', async () => {
      const emptyFile = new File([''], 'empty.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([emptyFile])
      
      assertions.assertSuccessResponse(result)
      const fileResult = result.data.fileResults[0]
      expect(fileResult.promptsProcessed).toBe(0)
      expect(fileResult.promptsImported).toBe(0)
      expect(fileResult.warnings?.some(w => w.includes('empty') || w.includes('no content'))).toBe(true)
    })

    test('should handle markdown with only frontmatter (no content)', async () => {
      const frontmatterOnly = `---
name: No Content Prompt
tags: [test]
---`

      const file = new File([frontmatterOnly], 'frontmatter-only.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([file])
      
      assertions.assertSuccessResponse(result)
      const fileResult = result.data.fileResults[0]
      // Should either import with warning or reject based on validation
      if (fileResult.success) {
        expect(fileResult.warnings?.some(w => w.includes('empty content') || w.includes('no content'))).toBe(true)
      } else {
        expect(fileResult.errors?.some(e => e.includes('content required') || e.includes('empty content'))).toBe(true)
      }
    })

    test('should handle special characters in markdown content', async () => {
      const specialCharsMarkdown = `---
name: Special Characters Test
tags: [unicode, symbols]
---

# Content with Special Characters

- Emoji: 🚀 🎯 ✅ ❌ 
- Unicode: αβγδε ♠♥♦♣ ±×÷∞
- Code blocks with symbols:

\`\`\`javascript
const regex = /[\\w\\-\\.]+@[\\w\\-\\.]+\\.[a-zA-Z]{2,}/;
const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
\`\`\`

- Mathematical: ∑∏∫∆∇ ≤≥≠≈ 
- Quotes: "Smart quotes" 'Single quotes' «Guillemets»`

      const file = new File([specialCharsMarkdown], 'special-chars.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([file])
      
      assertions.assertSuccessResponse(result)
      expect(result.data.promptsImported).toBe(1)
      
      const promptResult = result.data.fileResults[0].results[0]
      expect(promptResult.success).toBe(true)
      expect(promptResult.promptName).toBe('Special Characters Test')
    })

    test('should validate exported prompt ID exists', async () => {
      const nonExistentId = 999999
      
      try {
        await client.markdown.exportPromptAsMarkdown(nonExistentId)
        throw new Error('Expected export to fail with non-existent prompt ID')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/not found|does not exist/i)
      }
    })

    test('should handle empty prompt ID array for batch export', async () => {
      try {
        await client.markdown.exportPromptsAsMarkdown([])
        throw new Error('Expected export to fail with empty prompt array')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/empty|no prompts|at least one/i)
      }
    })

    test('should validate batch export with mix of valid and invalid IDs', async () => {
      // Create valid prompt via import
      const file = new File([`---\nname: Valid Prompt\n---\n\nValid content`], 'valid.md', { type: 'text/markdown' })
      const importResult = await client.markdown.importMarkdownPrompts([file])
      assertions.assertSuccessResponse(importResult)
      
      const validPrompt = { id: importResult.data.fileResults[0].results[0].promptId! }
      const invalidId = 999999
      
      try {
        await client.markdown.exportPromptsAsMarkdown([validPrompt.id, invalidId])
        throw new Error('Expected export to fail with invalid prompt ID in batch')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/not found|invalid.*id/i)
      }
    })
  })

  // ============================================================================
  // PERFORMANCE AND LARGE DOCUMENT TESTING
  // ============================================================================

  describe('Performance and Large Document Testing', () => {
    test('should handle multiple large markdown files efficiently', async () => {
      const largeContent = (index: number) => `---
name: Large Prompt ${index}
tags: [performance, large-content]
---

# Large Content Prompt ${index}

${'This is repeated content to make the file large. '.repeat(1000)}

## Section 1
${'More content here to increase file size. '.repeat(500)}

## Section 2  
${'Even more content for testing purposes. '.repeat(500)}

## Code Example
\`\`\`javascript
// Large code block
${'const data = "sample data"; '.repeat(100)}
\`\`\`

## Conclusion
${'Final content section with more text. '.repeat(300)}`

      const files = Array.from({ length: 5 }, (_, i) => 
        new File([largeContent(i + 1)], `large-prompt-${i + 1}.md`, { type: 'text/markdown' })
      )
      
      const startTime = Date.now()
      const result = await client.markdown.importMarkdownPrompts(files)
      const duration = Date.now() - startTime
      
      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.totalFiles).toBe(5)
      expect(result.data.promptsImported).toBe(5)
      
      // Performance assertion - should complete within reasonable time
      expect(duration).toBeLessThan(30000) // 30 seconds max
      
      console.log(`Large file import completed in ${duration}ms`)
    })

    test('should handle export of many prompts efficiently', async () => {
      // Create multiple prompts for batch export via import
      const files = Array.from({ length: 20 }, (_, i) => 
        new File([`---
name: Batch Export Prompt ${i + 1}
---

Content for prompt ${i + 1} with some additional text to make it more realistic.`], 
          `batch-${i + 1}.md`, 
          { type: 'text/markdown' }
        )
      )
      
      const importResult = await client.markdown.importMarkdownPrompts(files)
      assertions.assertSuccessResponse(importResult)
      
      const prompts = importResult.data.fileResults.map(fileResult => ({
        id: fileResult.results[0].promptId!
      }))
      
      const promptIds = prompts.map(p => p.id)
      
      const startTime = Date.now()
      const result = await client.markdown.exportPromptsAsMarkdown(promptIds, {
        format: 'single-file',
        includeFrontmatter: true,
        includeCreatedDate: true
      })
      const duration = Date.now() - startTime
      
      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.promptCount).toBe(20)
      expect(result.data.content!.length).toBeGreaterThan(1000)
      
      // Performance assertion
      expect(duration).toBeLessThan(15000) // 15 seconds max
      
      console.log(`Batch export of ${promptIds.length} prompts completed in ${duration}ms`)
    })

    test('should handle concurrent import operations', async () => {
      const createConcurrentImport = (index: number) => {
        const content = `---
name: Concurrent Prompt ${index}
tags: [concurrent, test-${index}]
---

Concurrent content for prompt ${index}`
        
        const file = new File([content], `concurrent-${index}.md`, { type: 'text/markdown' })
        return client.markdown.importMarkdownPrompts([file])
      }
      
      // Run 5 concurrent imports
      const concurrentImports = Array.from({ length: 5 }, (_, i) => 
        createConcurrentImport(i + 1)
      )
      
      const startTime = Date.now()
      const results = await Promise.all(concurrentImports)
      const duration = Date.now() - startTime
      
      // All imports should succeed
      results.forEach((result, index) => {
        assertions.assertSuccessResponse(result)
        expect(result.data.success).toBe(true)
        expect(result.data.promptsImported).toBe(1)
        expect(result.data.fileResults[0].results[0].promptName).toBe(`Concurrent Prompt ${index + 1}`)
      })
      
      console.log(`${results.length} concurrent imports completed in ${duration}ms`)
    })

    test('should maintain performance with complex markdown structures', async () => {
      const complexMarkdown = `---
name: Complex Structure Prompt
tags: [complex, markdown, tables, lists]
created: 2024-01-01T00:00:00Z
updated: 2024-01-15T12:00:00Z
---

# Complex Markdown Structure Test

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Import | ✅ | Fully implemented |
| Export | ✅ | Multiple formats |
| Validation | ⚠️ | In progress |

## Nested Lists

1. First level
   - Second level
     - Third level
       - Fourth level
   - Back to second
2. Another first level
   - Mixed content
     1. Numbered in bullet
     2. More numbers
   - Code in lists:
     \`\`\`javascript
     const nested = {
       deeply: {
         nested: {
           object: true
         }
       }
     };
     \`\`\`

## Code Blocks

\`\`\`typescript
interface ComplexInterface {
  id: number;
  metadata: {
    tags: string[];
    created: Date;
    nested: {
      deep: {
        value: string;
      }[];
    };
  };
}

class ComplexClass implements ComplexInterface {
  constructor(
    public id: number,
    public metadata: ComplexInterface['metadata']
  ) {}
}
\`\`\`

## Links and References

- [External link](https://example.com)
- [Relative link](./relative/path)
- [Email](mailto:test@example.com)
- ![Image](https://example.com/image.png)

## Inline Code and Formatting

This paragraph contains \`inline code\`, **bold text**, *italic text*, ~~strikethrough~~, and even \`\`complex.nested.code()\`\`.

## Blockquotes

> This is a blockquote
> 
> > With nested blockquotes
> > 
> > > And even deeper nesting
> 
> Back to first level

## Horizontal Rules

---

Content after rule.

## HTML Elements

<details>
<summary>Collapsible section</summary>

Hidden content here.

</details>

## Mathematical Expressions

Inline math: $E = mc^2$

Block math:
$$
\\frac{1}{\\sqrt{2\\pi\\sigma^2}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}
$$

## Final Notes

This complex structure tests the parser's ability to handle:
- Multiple formatting types
- Nested structures  
- Code blocks with syntax highlighting
- Tables with alignment
- Mixed content types
- Special characters and symbols`

      const file = new File([complexMarkdown], 'complex-structure.md', { type: 'text/markdown' })
      
      const startTime = Date.now()
      const result = await client.markdown.importMarkdownPrompts([file])
      const duration = Date.now() - startTime
      
      assertions.assertSuccessResponse(result)
      expect(result.data.success).toBe(true)
      expect(result.data.promptsImported).toBe(1)
      
      const promptResult = result.data.fileResults[0].results[0]
      expect(promptResult.success).toBe(true)
      expect(promptResult.promptName).toBe('Complex Structure Prompt')
      
      // Should handle complex structure within reasonable time
      expect(duration).toBeLessThan(5000) // 5 seconds max
      
      console.log(`Complex markdown import completed in ${duration}ms`)
    })
  })

  // ============================================================================
  // CONTENT PRESERVATION AND ENCODING
  // ============================================================================

  describe('Content Preservation and Encoding', () => {
    test('should preserve exact markdown formatting in round-trip', async () => {
      const originalMarkdown = `---
name: Formatting Test
tags: [formatting, preservation]
---

# Exact Formatting Test

This tests **exact** preservation of *formatting*.

## Code Blocks

\`\`\`javascript
// Preserve exact indentation and spacing
const test = {
  property: "value",
  nested: {
    array: [1, 2, 3],
    method: function() {
      return true;
    }
  }
};
\`\`\`

## Lists

1. First item
2. Second item with \`inline code\`
3. Third item

- Bullet item
- Another bullet with **bold**
  - Nested bullet
  - Another nested

## Special Characters

- Quotes: "Smart quotes" 'Single quotes'
- Symbols: © ® ™ § ¶ † ‡
- Arrows: ← → ↑ ↓ ↔ ↕
- Math: ± × ÷ ≠ ≤ ≥ ≈ ∞

## Whitespace Preservation

This line has    multiple    spaces.

This paragraph has
line breaks
in the middle.`

      // Import the markdown
      const file = new File([originalMarkdown], 'formatting-test.md', { type: 'text/markdown' })
      const importResult = await client.markdown.importMarkdownPrompts([file])
      
      assertions.assertSuccessResponse(importResult)
      const promptId = importResult.data.fileResults[0].results[0].promptId!
      
      // Export it back
      const exportedMarkdown = await client.markdown.exportPromptAsMarkdown(promptId, {
        includeFrontmatter: true,
        sanitizeContent: false // Don't sanitize to preserve formatting
      })
      
      // Verify key formatting elements are preserved
      expect(exportedMarkdown).toContain('**exact** preservation of *formatting*')
      expect(exportedMarkdown).toContain('```javascript')
      expect(exportedMarkdown).toContain('property: "value"')
      expect(exportedMarkdown).toContain('1. First item')
      expect(exportedMarkdown).toContain('- Bullet item')
      expect(exportedMarkdown).toContain('© ® ™')
      expect(exportedMarkdown).toContain('← → ↑ ↓')
      
      // Check that structure is maintained
      expect(exportedMarkdown).toContain('# Exact Formatting Test')
      expect(exportedMarkdown).toContain('## Code Blocks')
      expect(exportedMarkdown).toContain('## Lists')
      expect(exportedMarkdown).toContain('## Special Characters')
    })

    test('should handle UTF-8 encoding correctly', async () => {
      const utf8Content = `---
name: UTF-8 Test Prompt
tags: [utf8, encoding, international]
---

# International Content Test

## Languages

- **English**: Hello, world!
- **Spanish**: ¡Hola, mundo!
- **French**: Bonjour, le monde!
- **German**: Hallo, Welt!
- **Russian**: Привет, мир!
- **Japanese**: こんにちは、世界！
- **Chinese**: 你好，世界！
- **Korean**: 안녕하세요, 세계!
- **Arabic**: مرحبا بالعالم!
- **Hebrew**: שלום, עולם!

## Symbols and Emojis

- Weather: ☀️ ⛅ ☁️ 🌧️ ⛈️ 🌩️ ❄️
- Animals: 🐶 🐱 🐸 🦋 🐘 🦁 🐧 🦄
- Food: 🍎 🍕 🍔 🍣 🍜 🧀 🥖 🍰
- Tech: 💻 📱 ⌚ 🖥️ 📺 📷 🔌 💾

## Mathematical Symbols

- Greek: α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω
- Math: ∑ ∏ ∫ ∆ ∇ ∂ ∈ ∉ ⊂ ⊃ ∪ ∩ ∅ ∞ ± × ÷ ≠ ≤ ≥ ≈ ≡
- Arrows: ← → ↑ ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇑ ⇓ ⇔ ⇕

## Currency

- $ € £ ¥ ₹ ₽ ₩ ₪ ₦ ₡ ₨ ₱ ₴ ₵ ₶ ₷ ₸ ₹ ₺ ₻ ₼ ₽ ₾ ₿

## Special Characters

- Punctuation: ‚ „ " " ' ' « » ‹ › ¡ ¿ § ¶ † ‡ • ‰ ′ ″ ‴ ※
- Dashes: – — ― ‾
- Spaces: (em space) (en space) (thin space) (zero-width space)​`

      const file = new File([utf8Content], 'utf8-test.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([file])
      
      assertions.assertSuccessResponse(result)
      expect(result.data.promptsImported).toBe(1)
      
      const promptId = result.data.fileResults[0].results[0].promptId!
      
      // Export and verify UTF-8 content is preserved
      const exported = await client.markdown.exportPromptAsMarkdown(promptId)
      
      // Verify various UTF-8 content is preserved
      expect(exported).toContain('Привет, мир!') // Russian
      expect(exported).toContain('こんにちは、世界！') // Japanese
      expect(exported).toContain('你好，世界！') // Chinese
      expect(exported).toContain('안녕하세요, 세계!') // Korean
      expect(exported).toContain('مرحبا بالعالم!') // Arabic
      expect(exported).toContain('🍕 🍔 🍣') // Emojis
      expect(exported).toContain('α β γ δ') // Greek letters
      expect(exported).toContain('∑ ∏ ∫ ∆') // Math symbols
      expect(exported).toContain('€ £ ¥ ₹') // Currency symbols
    })

    test('should sanitize content when requested', async () => {
      const unsafeContent = `---
name: Sanitization Test
tags: [security, sanitization]
---

# Content with Potential Issues

## HTML Elements
<script>alert('xss')</script>
<div onclick="alert('click')">Clickable div</div>
<img src="x" onerror="alert('error')">

## Dangerous Links
[Suspicious link](javascript:alert('danger'))
[Data URL](data:text/html,<script>alert('data')</script>)

## Raw HTML
<iframe src="https://malicious.com"></iframe>
<object data="malicious.swf"></object>
<embed src="malicious.swf">

## Safe Content
This should be preserved: **bold**, *italic*, \`code\`, [normal link](https://safe.com)

\`\`\`javascript
// Code blocks should be safe
const safe = "This is safe code";
\`\`\``

      const file = new File([unsafeContent], 'unsafe-content.md', { type: 'text/markdown' })
      
      const result = await client.markdown.importMarkdownPrompts([file])
      assertions.assertSuccessResponse(result)
      
      const promptId = result.data.fileResults[0].results[0].promptId!
      
      // Export with sanitization enabled
      const sanitizedExport = await client.markdown.exportPromptAsMarkdown(promptId, {
        sanitizeContent: true
      })
      
      // Verify dangerous content is removed or neutralized
      expect(sanitizedExport).not.toContain('<script>')
      expect(sanitizedExport).not.toContain('javascript:')
      expect(sanitizedExport).not.toContain('onclick=')
      expect(sanitizedExport).not.toContain('onerror=')
      expect(sanitizedExport).not.toContain('<iframe>')
      expect(sanitizedExport).not.toContain('<object>')
      expect(sanitizedExport).not.toContain('<embed>')
      
      // Verify safe content is preserved
      expect(sanitizedExport).toContain('**bold**')
      expect(sanitizedExport).toContain('*italic*')
      expect(sanitizedExport).toContain('`code`')
      expect(sanitizedExport).toContain('[normal link](https://safe.com)')
      expect(sanitizedExport).toContain('```javascript')
      expect(sanitizedExport).toContain('const safe = "This is safe code";')
    })
  })
})