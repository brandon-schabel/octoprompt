import { describe, it, expect } from 'bun:test'
import { truncateForSummarization, FILE_SUMMARIZATION_LIMITS, needsResummarization } from './file-limits'

describe('truncateForSummarization', () => {
  it('should not truncate content under the limit', () => {
    const content = 'Hello World'
    const result = truncateForSummarization(content)
    
    expect(result.content).toBe(content)
    expect(result.wasTruncated).toBe(false)
    expect(result.originalLength).toBe(content.length)
  })
  
  it('should truncate content over the limit', () => {
    // Create content that exceeds the limit
    const content = 'x'.repeat(FILE_SUMMARIZATION_LIMITS.MAX_CHARACTERS + 1000)
    const result = truncateForSummarization(content)
    
    expect(result.wasTruncated).toBe(true)
    expect(result.originalLength).toBe(content.length)
    expect(result.content.length).toBeLessThan(result.originalLength)
    expect(result.content).toEndWith(FILE_SUMMARIZATION_LIMITS.TRUNCATION_SUFFIX)
  })
  
  it('should handle content exactly at the limit', () => {
    const content = 'x'.repeat(FILE_SUMMARIZATION_LIMITS.MAX_CHARACTERS)
    const result = truncateForSummarization(content)
    
    expect(result.content).toBe(content)
    expect(result.wasTruncated).toBe(false)
    expect(result.originalLength).toBe(FILE_SUMMARIZATION_LIMITS.MAX_CHARACTERS)
  })
  
  it('should preserve truncated content up to max characters', () => {
    const content = 'a'.repeat(50000) + 'b'.repeat(50000) + 'c'.repeat(50000)
    const result = truncateForSummarization(content)
    
    expect(result.wasTruncated).toBe(true)
    // The truncated content should start with 'a's
    expect(result.content.substring(0, 100)).toBe('a'.repeat(100))
    // And should have the suffix
    expect(result.content).toEndWith(FILE_SUMMARIZATION_LIMITS.TRUNCATION_SUFFIX)
  })
  
  it('should handle empty content', () => {
    const content = ''
    const result = truncateForSummarization(content)
    
    expect(result.content).toBe('')
    expect(result.wasTruncated).toBe(false)
    expect(result.originalLength).toBe(0)
  })
  
  it('should calculate correct lengths', () => {
    const content = 'x'.repeat(200000)
    const result = truncateForSummarization(content)
    
    expect(result.originalLength).toBe(200000)
    // Truncated content should be MAX_CHARACTERS + suffix length
    const expectedLength = FILE_SUMMARIZATION_LIMITS.MAX_CHARACTERS + 
                          FILE_SUMMARIZATION_LIMITS.TRUNCATION_SUFFIX.length
    expect(result.content.length).toBe(expectedLength)
  })
})

describe('needsResummarization', () => {
  it('should always return true when force is true', () => {
    const now = Date.now()
    const result = needsResummarization(now, true)
    
    expect(result.needsSummarization).toBe(true)
    expect(result.reason).toBe('Forced re-summarization requested')
  })
  
  it('should return true for files never summarized', () => {
    const result1 = needsResummarization(null)
    const result2 = needsResummarization(undefined)
    const result3 = needsResummarization(0)
    const result4 = needsResummarization(-1)
    
    expect(result1.needsSummarization).toBe(true)
    expect(result1.reason).toBe('File has never been summarized')
    expect(result2.needsSummarization).toBe(true)
    expect(result3.needsSummarization).toBe(true)
    expect(result4.needsSummarization).toBe(true)
  })
  
  it('should return true for files summarized over cooldown period ago', () => {
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000)
    const result = needsResummarization(twoHoursAgo)
    
    expect(result.needsSummarization).toBe(true)
    expect(result.reason).toContain('Last summarized 2 hours ago')
  })
  
  it('should return false for recently summarized files', () => {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
    const result = needsResummarization(tenMinutesAgo)
    
    expect(result.needsSummarization).toBe(false)
    expect(result.reason).toContain('Recently summarized, cooldown:')
    expect(result.reason).toContain('minutes remaining')
  })
  
  it('should handle edge case at exactly cooldown time', () => {
    const exactlyOneHourAgo = Date.now() - FILE_SUMMARIZATION_LIMITS.SUMMARIZATION_COOLDOWN_MS
    const result = needsResummarization(exactlyOneHourAgo)
    
    expect(result.needsSummarization).toBe(true)
    expect(result.reason).toContain('Last summarized 1 hour ago')
  })
  
  it('should calculate remaining cooldown time correctly', () => {
    const fiftyMinutesAgo = Date.now() - (50 * 60 * 1000)
    const result = needsResummarization(fiftyMinutesAgo)
    
    expect(result.needsSummarization).toBe(false)
    expect(result.reason).toContain('10 minutes remaining')
  })
})