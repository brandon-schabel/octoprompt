/**
 * File size limits for AI operations to control costs and performance
 */

export const FILE_SUMMARIZATION_LIMITS = {
  /**
   * Maximum characters to send for summarization
   * ~100k chars ≈ 25k tokens (rough estimate)
   * Adjustable based on your AI model and cost requirements
   */
  MAX_CHARACTERS: 100_000,

  /**
   * Dynamic limits based on summary depth
   */
  MAX_CHARACTERS_BY_DEPTH: {
    minimal: 25_000,   // ~6.25k tokens
    standard: 100_000, // ~25k tokens
    detailed: 200_000  // ~50k tokens
  },

  /**
   * Suffix added to truncated content to indicate truncation
   */
  TRUNCATION_SUFFIX: '\n\n[File truncated for summarization...]',

  /**
   * Minimum time between re-summarizations (in milliseconds)
   * Default: 1 hour (3600000 ms)
   * Files won't be re-summarized within this time window unless forced
   */
  SUMMARIZATION_COOLDOWN_MS: 60 * 60 * 1000 // 1 hour
} as const

/**
 * Get maximum characters based on summary depth
 */
export function getMaxCharactersForDepth(depth: 'minimal' | 'standard' | 'detailed' = 'standard'): number {
  return FILE_SUMMARIZATION_LIMITS.MAX_CHARACTERS_BY_DEPTH[depth] || FILE_SUMMARIZATION_LIMITS.MAX_CHARACTERS
}

/**
 * Helper function to truncate content if it exceeds the character limit
 */
export function truncateForSummarization(
  content: string, 
  depth: 'minimal' | 'standard' | 'detailed' = 'standard'
): {
  content: string
  wasTruncated: boolean
  originalLength: number
} {
  const originalLength = content.length
  const maxChars = getMaxCharactersForDepth(depth)

  if (originalLength <= maxChars) {
    return {
      content,
      wasTruncated: false,
      originalLength
    }
  }

  const truncatedContent =
    content.substring(0, maxChars) + FILE_SUMMARIZATION_LIMITS.TRUNCATION_SUFFIX

  return {
    content: truncatedContent,
    wasTruncated: true,
    originalLength
  }
}

/**
 * Check if a file needs re-summarization based on last update time
 */
export function needsResummarization(
  summaryLastUpdated: number | null | undefined,
  force: boolean = false
): {
  needsSummarization: boolean
  reason: string
} {
  // Always summarize if forced
  if (force) {
    return {
      needsSummarization: true,
      reason: 'Forced re-summarization requested'
    }
  }

  // Summarize if never summarized before
  if (!summaryLastUpdated || summaryLastUpdated <= 0) {
    return {
      needsSummarization: true,
      reason: 'File has never been summarized'
    }
  }

  // Check if enough time has passed since last summarization
  const now = Date.now()
  const timeSinceLastSummary = now - summaryLastUpdated

  if (timeSinceLastSummary >= FILE_SUMMARIZATION_LIMITS.SUMMARIZATION_COOLDOWN_MS) {
    const hours = Math.floor(timeSinceLastSummary / (60 * 60 * 1000))
    return {
      needsSummarization: true,
      reason: `Last summarized ${hours} hour${hours !== 1 ? 's' : ''} ago`
    }
  }

  // Skip summarization - too recent
  const minutesRemaining = Math.ceil(
    (FILE_SUMMARIZATION_LIMITS.SUMMARIZATION_COOLDOWN_MS - timeSinceLastSummary) / (60 * 1000)
  )
  return {
    needsSummarization: false,
    reason: `Recently summarized, cooldown: ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} remaining`
  }
}
