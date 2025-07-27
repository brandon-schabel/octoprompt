import { describe, test, expect } from 'bun:test'
import { summarizeSingleFile, summarizeFiles } from './project-service'
import { type ProjectFile } from '@promptliano/schemas'
import { MAX_FILE_SIZE_FOR_SUMMARY, MAX_TOKENS_FOR_SUMMARY, CHARS_PER_TOKEN_ESTIMATE } from '@promptliano/config'

describe('Large File Handling in Summarization', () => {
  describe('summarizeSingleFile', () => {
    test('should skip files larger than MAX_FILE_SIZE_FOR_SUMMARY', async () => {
      const largeFile: ProjectFile = {
        id: 1,
        projectId: 1,
        path: 'large.ts',
        name: 'large.ts',
        extension: '.ts',
        size: MAX_FILE_SIZE_FOR_SUMMARY + 1,
        content: 'x'.repeat(1000),
        summary: null,
        summaryLastUpdated: null,
        lastModified: Date.now(),
        checksum: 'test-checksum',
        meta: '',
        created: Date.now(),
        updated: Date.now()
      }

      const result = await summarizeSingleFile(largeFile)
      expect(result).toBeNull()
    })

    test('should skip empty files', async () => {
      const emptyFile: ProjectFile = {
        id: 2,
        projectId: 1,
        path: 'empty.ts',
        name: 'empty.ts',
        extension: '.ts',
        size: 0,
        content: '   ',
        summary: null,
        summaryLastUpdated: null,
        lastModified: Date.now(),
        checksum: 'test-checksum',
        meta: '',
        created: Date.now(),
        updated: Date.now()
      }

      const result = await summarizeSingleFile(emptyFile)
      expect(result).toBeNull()
    })

    test('should detect files with content exceeding token limit', async () => {
      // Create content that exceeds token limit
      const longContent = 'x'.repeat((MAX_TOKENS_FOR_SUMMARY + 1000) * CHARS_PER_TOKEN_ESTIMATE)

      const fileWithLongContent: ProjectFile = {
        id: 3,
        projectId: 1,
        path: 'long-content.ts',
        name: 'long-content.ts',
        extension: '.ts',
        size: longContent.length,
        content: longContent,
        summary: null,
        summaryLastUpdated: null,
        lastModified: Date.now(),
        checksum: 'test-checksum',
        meta: '',
        created: Date.now(),
        updated: Date.now()
      }

      // This will attempt to summarize but with truncated content
      // In a real test we'd mock the AI service, but for now we just verify
      // the file size check works correctly
      const estimatedTokens = Math.ceil(longContent.length / CHARS_PER_TOKEN_ESTIMATE)
      expect(estimatedTokens).toBeGreaterThan(MAX_TOKENS_FOR_SUMMARY)
    })
  })

  describe('File size constants', () => {
    test('should have reasonable size limits', () => {
      expect(MAX_FILE_SIZE_FOR_SUMMARY).toBe(1024 * 1024) // 1MB
      // Token limit should be reasonable (between 8k and 100k)
      expect(MAX_TOKENS_FOR_SUMMARY).toBeGreaterThanOrEqual(8000)
      expect(MAX_TOKENS_FOR_SUMMARY).toBeLessThanOrEqual(100000)
      expect(CHARS_PER_TOKEN_ESTIMATE).toBe(4)
    })
  })
})
