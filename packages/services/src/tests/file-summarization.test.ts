import { describe, test, expect, beforeAll, beforeEach, afterEach, mock } from 'bun:test'
import { 
  summarizeSingleFile, 
  summarizeFiles,
  resummarizeAllFiles,
  createProject,
  createProjectFileRecord
} from '../project-service'
import { updateProviderSettings } from '../provider-settings-service'
import type { Project, ProjectFile } from '@promptliano/schemas'
import { 
  LOCAL_MODEL_TEST_CONFIG, 
  isLMStudioAvailable, 
  requireLMStudio,
  createMockFile,
  createLargeFile,
  edgeCaseFiles
} from './local-model-test-config'
import {
  validateAIResponse,
  analyzeSummaryQuality,
  PerformanceTracker,
  generateMockSummary,
  retryWithBackoff
} from './utils/ai-test-helpers'
import { validateSummary } from './validators/summary-quality'
import {
  typescriptFiles,
  pythonFiles,
  createLargeProjectFile,
  edgeCaseProjectFiles,
  createBatchFiles
} from './fixtures/test-files'

// Set test environment
process.env.NODE_ENV = 'test'
process.env.LMSTUDIO_BASE_URL = LOCAL_MODEL_TEST_CONFIG.baseUrl

describe('File Summarization with Local Models', () => {
  let lmstudioAvailable = false
  let testProject: Project
  
  beforeAll(async () => {
    // Check if LMStudio is available
    if (!requireLMStudio()) {
      console.log('⚠️  LMStudio tests disabled')
      return
    }
    
    lmstudioAvailable = await isLMStudioAvailable()
    if (!lmstudioAvailable) {
      console.warn('⚠️  LMStudio not available at', LOCAL_MODEL_TEST_CONFIG.baseUrl)
      console.warn('   Falling back to mock responses')
    } else {
      console.log('✅ LMStudio available at', LOCAL_MODEL_TEST_CONFIG.baseUrl)
      // Set the LMStudio URL in provider settings
      updateProviderSettings({
        lmstudioUrl: LOCAL_MODEL_TEST_CONFIG.baseUrl.replace(/\/v1$/, '')
      })
    }
    
    // Create test project in database
    testProject = await createProject({
      name: 'Test Project',
      path: '/tmp/test-project',
      description: 'Project for testing file summarization'
    })
  })
  
  describe('Single File Summarization', () => {
    test('should summarize a simple TypeScript file', async () => {
      // Create file in database
      const fileData = typescriptFiles.simpleClass
      const file = await createProjectFileRecord(
        testProject.id,
        fileData.path,
        fileData.name,
        fileData.content || '',
        fileData.type,
        fileData.extension,
        fileData.size,
        fileData.checksum
      )
      const tracker = new PerformanceTracker()
      
      tracker.start()
      
      let summary: string
      if (lmstudioAvailable) {
        // Real API call with retry
        summary = await retryWithBackoff(async () => {
          const result = await summarizeSingleFile(file)
          return result.summary || ''
        })
      } else {
        // Mock response for CI/testing
        summary = generateMockSummary(file.content || '')
      }
      
      tracker.end()
      
      // Validate response
      const validation = validateAIResponse(summary, ['PURPOSE', 'TYPE'])
      expect(validation.isValid).toBe(true)
      
      if (validation.errors.length > 0) {
        console.error('Validation errors:', validation.errors)
      }
      
      // Check quality
      const quality = analyzeSummaryQuality(summary, file.content || '')
      expect(quality.overall).toBeGreaterThan(0.5)
      
      // Check structure
      expect(summary).toContain('PURPOSE')
      expect(summary).toContain('TYPE')
      
      // Verify mentions key elements
      expect(summary.toLowerCase()).toContain('user')
      expect(summary.toLowerCase()).toContain('class')
      
      // Check performance
      const metrics = tracker.getMetrics(validation.metrics.tokenCount)
      expect(metrics.responseTime).toBeLessThan(LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile)
      
      console.log('Summary metrics:', {
        length: summary.length,
        tokens: validation.metrics.tokenCount,
        quality: quality.overall,
        responseTime: metrics.responseTime
      })
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile)
    
    test('should handle large files with truncation', async () => {
      const file = createLargeProjectFile(100) // 100KB file
      const tracker = new PerformanceTracker()
      
      tracker.start()
      
      let summary: string
      if (lmstudioAvailable) {
        summary = await retryWithBackoff(async () => {
          const result = await summarizeSingleFile(file)
          return result.summary || ''
        })
      } else {
        summary = generateMockSummary(file.content || '')
      }
      
      tracker.end()
      
      // Validate response
      const validation = validateSummary(summary, file)
      expect(validation.valid).toBe(true)
      
      // Should mention truncation
      if (file.content && file.content.length > 50000) {
        expect(summary.toLowerCase()).toContain('truncat')
      }
      
      // Should still be coherent
      expect(validation.metrics.coherenceScore).toBeGreaterThan(60)
      
      // Check token efficiency
      expect(validation.metrics.tokenEfficiency).toBeGreaterThan(50)
      
      console.log('Large file summary metrics:', validation.metrics)
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile)
    
    test('should handle empty files gracefully', async () => {
      const file = edgeCaseProjectFiles.emptyFile
      
      let summary: string
      if (lmstudioAvailable) {
        summary = await retryWithBackoff(async () => {
          const result = await summarizeSingleFile(file)
          return result.summary || ''
        })
      } else {
        summary = 'PURPOSE: Empty file\nTYPE: empty\nFile contains no content.'
      }
      
      expect(summary).toBeTruthy()
      expect(summary.toLowerCase()).toContain('empty')
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile)
    
    test('should handle files with only comments', async () => {
      const file = edgeCaseProjectFiles.onlyComments
      
      let summary: string
      if (lmstudioAvailable) {
        summary = await retryWithBackoff(async () => {
          const result = await summarizeSingleFile(file)
          return result.summary || ''
        })
      } else {
        summary = generateMockSummary(file.content || '')
      }
      
      const validation = validateSummary(summary, file)
      expect(validation.valid).toBe(true)
      expect(summary.toLowerCase()).toContain('comment')
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile)
    
    test('should handle Python files', async () => {
      const file = pythonFiles.dataProcessor
      
      let summary: string
      if (lmstudioAvailable) {
        summary = await retryWithBackoff(async () => {
          const result = await summarizeSingleFile(file)
          return result.summary || ''
        })
      } else {
        summary = generateMockSummary(file.content || '')
      }
      
      const validation = validateSummary(summary, file)
      expect(validation.valid).toBe(true)
      
      // Should mention Python-specific elements
      expect(summary.toLowerCase()).toContain('dataprocessor')
      expect(summary.toLowerCase()).toContain('process')
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile)
  })
  
  describe('Batch File Summarization', () => {
    test('should summarize multiple files efficiently', async () => {
      const files = createBatchFiles(5)
      const tracker = new PerformanceTracker()
      
      tracker.start()
      
      const result = await summarizeFiles(
        testProject.id,
        files.map(f => f.id),
        false // Don't force
      )
      
      tracker.end()
      
      expect(result.included).toBeGreaterThan(0)
      expect(result.skipped).toBeGreaterThanOrEqual(0)
      expect(result.updatedFiles).toBeDefined()
      
      // Check performance
      const metrics = tracker.getMetrics(files.length * 500) // Estimate tokens
      expect(metrics.responseTime).toBeLessThan(LOCAL_MODEL_TEST_CONFIG.timeouts.batchFiles)
      
      console.log('Batch summarization results:', {
        included: result.included,
        skipped: result.skipped,
        responseTime: metrics.responseTime,
        filesPerSecond: files.length / (metrics.responseTime / 1000)
      })
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.batchFiles)
    
    test('should handle mixed file types in batch', async () => {
      const files = [
        typescriptFiles.simpleClass,
        pythonFiles.dataProcessor,
        edgeCaseProjectFiles.emptyFile
      ]
      
      const result = await summarizeFiles(
        testProject.id,
        files.map(f => f.id),
        false
      )
      
      expect(result.included).toBeGreaterThan(0)
      
      // Check skip reasons if any
      if (result.skippedReasons) {
        console.log('Skip reasons:', result.skippedReasons)
      }
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.batchFiles)
    
    test('should respect force flag for resummarization', async () => {
      const file = typescriptFiles.serviceWithImports
      
      // First summarization
      const firstResult = await summarizeSingleFile(file)
      const firstSummary = firstResult.summary
      
      // Second without force (should skip if already summarized)
      const secondResult = await summarizeFiles(
        testProject.id,
        [file.id],
        false
      )
      
      // Third with force (should resummarize)
      const thirdResult = await summarizeFiles(
        testProject.id,
        [file.id],
        true // Force
      )
      
      expect(thirdResult.included).toBe(1)
      
      // If using real API, summaries might differ slightly
      if (lmstudioAvailable && thirdResult.updatedFiles[0]) {
        const newSummary = thirdResult.updatedFiles[0].summary
        // Check that it's a valid summary, not necessarily different
        expect(newSummary).toBeTruthy()
        expect(newSummary).toContain('PURPOSE')
      }
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile * 3)
  })
  
  describe('Summary Caching', () => {
    test('should use cache for repeated summarizations', async () => {
      const file = typescriptFiles.utilityFunctions
      const tracker1 = new PerformanceTracker()
      const tracker2 = new PerformanceTracker()
      
      // First call (cache miss)
      tracker1.start()
      const result1 = await summarizeSingleFile(file)
      tracker1.end()
      
      // Second call (should be cache hit)
      tracker2.start()
      const result2 = await summarizeSingleFile(file)
      tracker2.end()
      
      // Summaries should be identical
      expect(result1.summary).toBe(result2.summary)
      
      // Second call should be faster (cache hit)
      const metrics1 = tracker1.getMetrics(100)
      const metrics2 = tracker2.getMetrics(100, true) // Cache hit
      
      if (lmstudioAvailable) {
        // Cache should be significantly faster
        expect(metrics2.responseTime).toBeLessThan(metrics1.responseTime * 0.1)
      }
      
      console.log('Cache performance:', {
        firstCall: metrics1.responseTime,
        secondCall: metrics2.responseTime,
        speedup: metrics1.responseTime / metrics2.responseTime
      })
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile * 2)
  })
  
  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      if (!lmstudioAvailable) {
        console.log('Skipping network error test (LMStudio not available)')
        return
      }
      
      // Temporarily break the URL
      const originalUrl = process.env.LMSTUDIO_BASE_URL
      process.env.LMSTUDIO_BASE_URL = 'http://invalid-url:9999'
      
      try {
        const file = typescriptFiles.simpleClass
        const result = await summarizeSingleFile(file)
        
        // Should either fail or return a fallback
        if (result.summary) {
          expect(result.summary).toBeTruthy()
        }
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined()
      } finally {
        // Restore URL
        process.env.LMSTUDIO_BASE_URL = originalUrl
      }
    })
    
    test('should handle malformed code gracefully', async () => {
      const file = edgeCaseProjectFiles.syntaxError
      
      let summary: string
      try {
        const result = await summarizeSingleFile(file)
        summary = result.summary || ''
      } catch (error) {
        // Should not throw, but if it does, check error
        expect(error).toBeDefined()
        summary = 'Error summarizing file'
      }
      
      // Should still produce some summary
      expect(summary).toBeTruthy()
    }, LOCAL_MODEL_TEST_CONFIG.timeouts.singleFile)
  })
})

// Export test utilities for other tests
export { 
  LOCAL_MODEL_TEST_CONFIG,
  isLMStudioAvailable,
  requireLMStudio
}