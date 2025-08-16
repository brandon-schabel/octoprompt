import {
  ApiError,
  buildProjectSummary,
  buildProjectSummaryWithFormat,
  compressSummary,
  promptsMap,
  truncateForSummarization,
  FILE_SUMMARIZATION_LIMITS
} from '@promptliano/shared'
import type {
  SummaryOptions,
  SummaryVersion,
  SummaryMetrics,
  EnhancedProjectSummaryResponse,
  ProjectFile
} from '@promptliano/schemas'
import { getProjectFiles } from '../project-service'
import { generateSingleText } from '../gen-ai-services'
import { LOW_MODEL_CONFIG } from '@promptliano/config'
import { sortFilesByImportance, getTopImportantFiles, filterByImportance } from './file-importance-scorer'

// Cache for project summaries with TTL
interface CachedSummary {
  content: string
  version: SummaryVersion
  metrics?: SummaryMetrics
  timestamp: number
}

const projectSummaryCache = new Map<string, CachedSummary>()
const SUMMARY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

// Summary model configuration optimized for token efficiency
export const SUMMARY_MODEL_CONFIG = {
  ...LOW_MODEL_CONFIG,
  temperature: 0.3, // Lower for consistent summaries
  maxTokens: 1000 // Reduced from 20000
}

// Helper function to get cache key
function getSummaryCacheKey(projectId: number, options: SummaryOptions): string {
  const optionStr = JSON.stringify({
    depth: options.depth,
    format: options.format,
    strategy: options.strategy,
    focus: options.focus?.sort()
  })
  return `${projectId}:${optionStr}`
}

// Helper function to invalidate cache for a project
export function invalidateProjectSummaryCache(projectId: number): void {
  // Remove all cached entries for this project
  for (const key of projectSummaryCache.keys()) {
    if (key.startsWith(`${projectId}:`)) {
      projectSummaryCache.delete(key)
    }
  }
}

export const getSafeAllProjectFiles = async (projectId: number) => {
  const allFiles = await getProjectFiles(projectId)
  if (!allFiles) {
    throw new ApiError(404, 'Project files not found', 'NOT_FOUND')
  }
  if (!allFiles.length) {
    throw new ApiError(404, 'No files found in project', 'NO_PROJECT_FILES')
  }
  return allFiles
}

/**
 * Get project summary with enhanced options
 */
export async function getProjectSummaryWithOptions(
  projectId: number,
  options: SummaryOptions
): Promise<EnhancedProjectSummaryResponse> {
  const startTime = Date.now()
  const cacheKey = getSummaryCacheKey(projectId, options)
  const cached = projectSummaryCache.get(cacheKey)

  // Check if cached summary is still valid
  if (cached && Date.now() - cached.timestamp < SUMMARY_CACHE_TTL) {
    return {
      success: true,
      summary: cached.content,
      version: cached.version,
      metrics: options.includeMetrics ? cached.metrics : undefined
    }
  }

  // Get all project files
  const allFiles = await getSafeAllProjectFiles(projectId)

  // Apply file filtering based on options
  let selectedFiles = await filterFilesForSummary(allFiles, options)

  // Generate summary based on strategy
  let summary: string
  let wasTruncated = false
  let originalSize = 0

  switch (options.strategy) {
    case 'fast':
      // No AI processing, just structured data
      summary = buildProjectSummaryWithFormat(selectedFiles, options.format, options)
      break

    case 'balanced':
      // Pre-filter to top 50 files, then use AI
      selectedFiles = getTopImportantFiles(selectedFiles, 50)
      summary = await generateAISummary(selectedFiles, options)
      break

    case 'thorough':
      // Pre-filter to top 100 files, use high-quality model
      selectedFiles = getTopImportantFiles(selectedFiles, 100)
      summary = await generateAISummary(selectedFiles, options, true)
      break
  }

  // Apply compression if needed
  if (options.depth === 'minimal') {
    const originalLength = summary.length
    summary = compressSummary(summary, options)
    wasTruncated = summary.length < originalLength
    originalSize = originalLength
  }

  // Create version info
  const version: SummaryVersion = {
    version: '2.0',
    generated: Date.now(),
    model: options.strategy === 'fast' ? 'none' : SUMMARY_MODEL_CONFIG.model,
    options,
    tokenCount: estimateTokenCount(summary)
  }

  // Calculate metrics
  const metrics: SummaryMetrics = {
    generationTime: Date.now() - startTime,
    originalSize: originalSize || summary.length,
    compressedSize: summary.length,
    compressionRatio: originalSize ? summary.length / originalSize : 1,
    tokensSaved: originalSize ? estimateTokenCount(String(originalSize)) - estimateTokenCount(summary) : 0,
    filesProcessed: selectedFiles.length,
    cacheHit: false,
    truncated: wasTruncated
  }

  // Cache the result
  projectSummaryCache.set(cacheKey, {
    content: summary,
    version,
    metrics,
    timestamp: Date.now()
  })

  return {
    success: true,
    summary,
    version,
    metrics: options.includeMetrics ? metrics : undefined
  }
}

/**
 * Filter files based on summary options
 */
async function filterFilesForSummary(files: ProjectFile[], options: SummaryOptions): Promise<ProjectFile[]> {
  let filtered = [...files]

  // Apply focus areas if specified
  if (options.focus && options.focus.length > 0) {
    filtered = filtered.filter((file) => {
      const path = file.path.toLowerCase()
      return options.focus!.some((focus) => path.includes(focus.toLowerCase()))
    })
  }

  // Apply importance filtering based on depth
  switch (options.depth) {
    case 'minimal':
      // Only include most important files
      filtered = filterByImportance(filtered, 2.0)
      break
    case 'standard':
      // Include moderately important files
      filtered = filterByImportance(filtered, 1.0)
      break
    case 'detailed':
      // Include all files except very low importance
      filtered = filterByImportance(filtered, 0.5)
      break
  }

  // Sort by importance for better organization
  filtered = sortFilesByImportance(filtered)

  return filtered
}

/**
 * Generate AI-powered summary
 */
async function generateAISummary(
  files: ProjectFile[],
  options: SummaryOptions,
  useHighQuality = false
): Promise<string> {
  // Build structured summary
  const structuredSummary = buildProjectSummaryWithFormat(files, 'xml', options)

  // Ensure the summary doesn't exceed character limits based on depth
  const truncationResult = truncateForSummarization(structuredSummary, options.depth || 'standard')

  if (truncationResult.wasTruncated) {
    console.log(
      `[ProjectSummary] Content truncated for AI processing:\n` +
        `  Original: ${truncationResult.originalLength.toLocaleString()} chars\n` +
        `  Truncated to: ${truncationResult.content.length.toLocaleString()} chars`
    )
  }

  try {
    // Select appropriate prompt based on depth
    const systemPrompt = getSystemPromptForDepth(options.depth)

    // Use AI to create a compact version
    const compactSummary = await generateSingleText({
      prompt: truncationResult.content,
      systemMessage: systemPrompt,
      options: useHighQuality ? HIGH_QUALITY_SUMMARY_CONFIG : SUMMARY_MODEL_CONFIG
    })

    // Convert to requested format if not XML
    if (options.format !== 'xml') {
      return convertSummaryFormat(compactSummary.trim(), options.format)
    }

    return compactSummary.trim()
  } catch (error) {
    // Fallback to structured summary if AI fails
    console.error(`[ProjectSummary] AI service failed:`, error)
    return buildProjectSummaryWithFormat(
      files.slice(0, 50), // Limit files for fallback
      options.format,
      options
    )
  }
}

/**
 * Get system prompt based on depth level
 */
function getSystemPromptForDepth(depth: string): string {
  switch (depth) {
    case 'minimal':
      return (
        promptsMap.minimalProjectSummary ||
        `Ultra-concise overview (max 100 words).
Include: stack, purpose, entry points.
Use heavy abbreviations.`
      )

    case 'detailed':
      return (
        promptsMap.detailedProjectSummary ||
        `Comprehensive project analysis (max 400 words).
Include: architecture decisions, all components, dependencies, patterns.
Provide full context for complex development tasks.`
      )

    default: // standard
      return promptsMap.compactProjectSummary
  }
}

/**
 * Convert summary between formats
 */
function convertSummaryFormat(xmlSummary: string, targetFormat: string): string {
  // This is a simplified conversion - in production you'd want proper XML parsing
  if (targetFormat === 'markdown') {
    return xmlSummary
      .replace(/<summary_memory>/g, '# Project Summary\n')
      .replace(/<\/summary_memory>/g, '')
      .replace(/<file>/g, '\n## ')
      .replace(/<\/file>/g, '')
      .replace(/<name>(.*?)<\/name>/g, '$1\n')
      .replace(/<summary>(.*?)<\/summary>/g, '\n$1\n')
      .replace(/<file_id>(.*?)<\/file_id>/g, '')
  }

  // For JSON, we'd need to parse XML properly
  // For now, return as-is
  return xmlSummary
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

// High quality model config for thorough summaries
const HIGH_QUALITY_SUMMARY_CONFIG = {
  ...SUMMARY_MODEL_CONFIG,
  maxTokens: 2000,
  temperature: 0.5
}

// Legacy functions for backward compatibility
export async function getFullProjectSummary(projectId: number): Promise<string> {
  const result = await getProjectSummaryWithOptions(projectId, {
    depth: 'standard',
    format: 'xml',
    strategy: 'fast',
    includeImports: true,
    includeExports: true,
    progressive: false,
    includeMetrics: false,
    groupAware: true,
    includeRelationships: true,
    contextWindow: 4000
  })
  return result.summary
}

export async function getCompactProjectSummary(projectId: number): Promise<string> {
  const result = await getProjectSummaryWithOptions(projectId, {
    depth: 'standard',
    format: 'xml',
    strategy: 'balanced',
    includeImports: true,
    includeExports: true,
    progressive: false,
    includeMetrics: false,
    groupAware: true,
    includeRelationships: true,
    contextWindow: 4000
  })
  return result.summary
}
