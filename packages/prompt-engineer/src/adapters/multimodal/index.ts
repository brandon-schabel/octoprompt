/**
 * Multi-Modal Adapter Exports
 * Unified interface for processing various media types
 */

export * from './image-adapter'
export * from './audio-adapter'
export * from './document-adapter'

import { Effect, pipe } from 'effect'
import { ImageAdapter, createImageAdapter } from './image-adapter'
import { AudioAdapter, createAudioAdapter } from './audio-adapter'
import { DocumentAdapter, createDocumentAdapter } from './document-adapter'
import type { ImageAnalysisResult, ImagePromptContext } from './image-adapter'
import type { AudioAnalysisResult, AudioPromptContext } from './audio-adapter'
import type { DocumentContent, DocumentQuery } from './document-adapter'

// ============================================================================
// Multi-Modal Types
// ============================================================================

export type MediaType = 'image' | 'audio' | 'document' | 'video' | 'unknown'

export interface MediaFile {
  readonly data: Buffer
  readonly type: MediaType
  readonly mimeType?: string
  readonly filename?: string
  readonly metadata?: Record<string, any>
}

export interface MultiModalContext {
  readonly media: MediaFile[]
  readonly prompt: string
  readonly options?: {
    readonly extractText?: boolean
    readonly generateCaptions?: boolean
    readonly analyzeContent?: boolean
    readonly compareMedia?: boolean
  }
}

export interface MultiModalResult {
  readonly type: MediaType
  readonly analysis: ImageAnalysisResult | AudioAnalysisResult | DocumentContent | any
  readonly text?: string
  readonly caption?: string
  readonly metadata?: Record<string, any>
}

export interface CombinedAnalysis {
  readonly media: MultiModalResult[]
  readonly summary: string
  readonly relationships: MediaRelationship[]
  readonly insights: string[]
}

export interface MediaRelationship {
  readonly source: number // index in media array
  readonly target: number // index in media array
  readonly type: 'references' | 'contains' | 'relates_to' | 'contradicts'
  readonly confidence: number
  readonly description: string
}

// ============================================================================
// Multi-Modal Manager
// ============================================================================

/**
 * Unified manager for all multi-modal processing
 */
export class MultiModalManager {
  private imageAdapter: ImageAdapter
  private audioAdapter: AudioAdapter
  private documentAdapter: DocumentAdapter
  
  constructor(config?: {
    image?: ConstructorParameters<typeof ImageAdapter>[0]
    audio?: ConstructorParameters<typeof AudioAdapter>[0]
    document?: ConstructorParameters<typeof DocumentAdapter>[0]
  }) {
    this.imageAdapter = createImageAdapter(config?.image)
    this.audioAdapter = createAudioAdapter(config?.audio)
    this.documentAdapter = createDocumentAdapter(config?.document)
  }

  /**
   * Detect media type from buffer
   */
  detectMediaType(data: Buffer): MediaType {
    // Check magic numbers / file signatures
    const signature = data.slice(0, 8).toString('hex')
    
    // Image formats
    if (signature.startsWith('ffd8ff')) return 'image' // JPEG
    if (signature.startsWith('89504e47')) return 'image' // PNG
    if (signature.startsWith('47494638')) return 'image' // GIF
    if (signature.startsWith('52494646') && data.slice(8, 12).toString() === 'WEBP') return 'image' // WebP
    
    // Audio formats
    if (signature.startsWith('52494646') && data.slice(8, 12).toString() === 'WAVE') return 'audio' // WAV
    if (signature.startsWith('fff') || signature.startsWith('494433')) return 'audio' // MP3
    if (signature.startsWith('4f676753')) return 'audio' // OGG
    
    // Document formats
    if (signature.startsWith('25504446')) return 'document' // PDF
    if (signature.startsWith('504b0304')) return 'document' // DOCX, XLSX, PPTX (ZIP-based)
    if (data.slice(0, 5).toString() === '<!DOC' || data.slice(0, 5).toString() === '<html') return 'document' // HTML
    
    // Check text-based formats
    const textSample = data.slice(0, 1000).toString('utf8')
    if (textSample.includes('# ') || textSample.includes('## ')) return 'document' // Markdown
    
    return 'unknown'
  }

  /**
   * Process a single media file
   */
  processMedia(file: MediaFile): Effect.Effect<MultiModalResult, Error> {
    return Effect.gen(function* (_) {
      const type = file.type !== 'unknown' ? file.type : this.detectMediaType(file.data)
      
      switch (type) {
        case 'image': {
          const analysis = yield* _(this.imageAdapter.analyzeImage(file.data))
          return {
            type: 'image',
            analysis,
            caption: analysis.caption,
            text: analysis.text.map(ocr => ocr.text).join(' '),
            metadata: {
              dimensions: `${analysis.metadata.width}x${analysis.metadata.height}`,
              format: analysis.metadata.format,
              quality: analysis.quality.aestheticScore
            }
          }
        }
        
        case 'audio': {
          const analysis = yield* _(this.audioAdapter.analyzeAudio(file.data))
          return {
            type: 'audio',
            analysis,
            text: analysis.transcript?.text,
            caption: `Audio: ${analysis.metadata.duration}s, ${analysis.metadata.format}`,
            metadata: {
              duration: analysis.metadata.duration,
              format: analysis.metadata.format,
              speakers: analysis.speakers?.length || 0
            }
          }
        }
        
        case 'document': {
          const analysis = yield* _(this.documentAdapter.parseDocument(file.data))
          return {
            type: 'document',
            analysis,
            text: analysis.text,
            caption: `Document: ${analysis.pages.length} pages`,
            metadata: {
              pageCount: analysis.pages.length,
              wordCount: analysis.text.split(/\s+/).length,
              hasTables: analysis.tables.length > 0
            }
          }
        }
        
        default:
          return yield* _(Effect.fail(new Error(`Unsupported media type: ${type}`)))
      }
    }.bind(this))
  }

  /**
   * Process multiple media files with a unified prompt
   */
  processMultiModal(context: MultiModalContext): Effect.Effect<CombinedAnalysis, Error> {
    return Effect.gen(function* (_) {
      // Process all media files
      const results = yield* _(Effect.all(
        context.media.map(file => this.processMedia(file))
      ))
      
      // Analyze relationships between media
      const relationships = yield* _(this.analyzeRelationships(results))
      
      // Generate insights
      const insights = this.generateInsights(results, relationships)
      
      // Create summary
      const summary = this.createCombinedSummary(results, context.prompt)
      
      return {
        media: results,
        summary,
        relationships,
        insights
      }
    }.bind(this))
  }

  /**
   * Query across multiple media types
   */
  queryMultiModal(
    media: MediaFile[],
    query: string
  ): Effect.Effect<string, Error> {
    return Effect.gen(function* (_) {
      const context: MultiModalContext = {
        media,
        prompt: query,
        options: {
          extractText: true,
          analyzeContent: true
        }
      }
      
      const analysis = yield* _(this.processMultiModal(context))
      
      // Process query against all media
      const responses = yield* _(Effect.all(
        analysis.media.map((result, index) => 
          this.queryMediaResult(result, query, index)
        )
      ))
      
      // Combine responses
      return this.combineQueryResponses(responses, query)
    }.bind(this))
  }

  /**
   * Compare media files
   */
  compareMedia(
    media1: MediaFile,
    media2: MediaFile
  ): Effect.Effect<{
    similarity: number
    differences: string[]
    insights: string[]
  }, Error> {
    return Effect.gen(function* (_) {
      const [result1, result2] = yield* _(Effect.all([
        this.processMedia(media1),
        this.processMedia(media2)
      ]))
      
      // Type-specific comparison
      if (result1.type === result2.type) {
        switch (result1.type) {
          case 'image':
            const imageCmp = yield* _(this.imageAdapter.compareImages(
              media1.data,
              media2.data
            ))
            return {
              similarity: imageCmp.similarity,
              differences: imageCmp.differences,
              insights: this.generateComparisonInsights(result1, result2, imageCmp.similarity)
            }
          
          case 'audio':
            const audioCmp = yield* _(this.audioAdapter.compareAudio(
              media1.data,
              media2.data
            ))
            return {
              similarity: audioCmp.similarity,
              differences: audioCmp.differences,
              insights: this.generateComparisonInsights(result1, result2, audioCmp.similarity)
            }
          
          case 'document':
            const docCmp = yield* _(this.documentAdapter.compareDocuments(
              media1.data,
              media2.data
            ))
            return {
              similarity: docCmp.similarity,
              differences: docCmp.structuralChanges,
              insights: this.generateComparisonInsights(result1, result2, docCmp.similarity)
            }
        }
      }
      
      // Cross-type comparison (text-based)
      const textSimilarity = this.compareText(
        result1.text || '',
        result2.text || ''
      )
      
      return {
        similarity: textSimilarity,
        differences: [`Different media types: ${result1.type} vs ${result2.type}`],
        insights: [`Cross-media comparison based on extracted text`]
      }
    }.bind(this))
  }

  /**
   * Extract all text from mixed media
   */
  extractAllText(media: MediaFile[]): Effect.Effect<string, Error> {
    return Effect.gen(function* (_) {
      const results = yield* _(Effect.all(
        media.map(file => this.processMedia(file))
      ))
      
      return results
        .map(r => r.text || r.caption || '')
        .filter(text => text.length > 0)
        .join('\n\n---\n\n')
    }.bind(this))
  }

  /**
   * Generate captions for all media
   */
  generateCaptions(media: MediaFile[]): Effect.Effect<string[], Error> {
    return Effect.gen(function* (_) {
      const results = yield* _(Effect.all(
        media.map(file => this.processMedia(file))
      ))
      
      return results.map(r => r.caption || 'No caption available')
    }.bind(this))
  }

  // Private helper methods

  private analyzeRelationships(
    results: MultiModalResult[]
  ): Effect.Effect<MediaRelationship[], never> {
    return Effect.gen(function* (_) {
      const relationships: MediaRelationship[] = []
      
      // Analyze text overlap
      for (let i = 0; i < results.length; i++) {
        for (let j = i + 1; j < results.length; j++) {
          const similarity = this.compareText(
            results[i].text || '',
            results[j].text || ''
          )
          
          if (similarity > 0.3) {
            relationships.push({
              source: i,
              target: j,
              type: 'relates_to',
              confidence: similarity,
              description: `Content similarity: ${(similarity * 100).toFixed(1)}%`
            })
          }
        }
      }
      
      return relationships
    })
  }

  private generateInsights(
    results: MultiModalResult[],
    relationships: MediaRelationship[]
  ): string[] {
    const insights: string[] = []
    
    // Media type distribution
    const types = results.map(r => r.type)
    const uniqueTypes = new Set(types)
    insights.push(`Processing ${types.length} media files across ${uniqueTypes.size} different types`)
    
    // Text content
    const totalText = results.reduce((acc, r) => acc + (r.text?.length || 0), 0)
    if (totalText > 0) {
      insights.push(`Extracted ${totalText} characters of text content`)
    }
    
    // Relationships
    if (relationships.length > 0) {
      insights.push(`Found ${relationships.length} relationships between media files`)
    }
    
    // Type-specific insights
    const images = results.filter(r => r.type === 'image')
    if (images.length > 0) {
      const avgQuality = images.reduce((acc, r) => 
        acc + ((r.analysis as any).quality?.aestheticScore || 0), 0
      ) / images.length
      insights.push(`Average image quality: ${(avgQuality * 100).toFixed(1)}%`)
    }
    
    const audio = results.filter(r => r.type === 'audio')
    if (audio.length > 0) {
      const totalDuration = audio.reduce((acc, r) =>
        acc + ((r.analysis as any).metadata?.duration || 0), 0
      )
      insights.push(`Total audio duration: ${totalDuration}s`)
    }
    
    const documents = results.filter(r => r.type === 'document')
    if (documents.length > 0) {
      const totalPages = documents.reduce((acc, r) =>
        acc + ((r.analysis as any).pages?.length || 0), 0
      )
      insights.push(`Total document pages: ${totalPages}`)
    }
    
    return insights
  }

  private createCombinedSummary(
    results: MultiModalResult[],
    prompt: string
  ): string {
    const summaries = results.map((r, i) => {
      const type = r.type.charAt(0).toUpperCase() + r.type.slice(1)
      const caption = r.caption || 'No description'
      return `${i + 1}. ${type}: ${caption}`
    })
    
    return `Multi-modal analysis for "${prompt}":\n${summaries.join('\n')}`
  }

  private queryMediaResult(
    result: MultiModalResult,
    query: string,
    index: number
  ): Effect.Effect<string, never> {
    return Effect.succeed(
      `Media ${index + 1} (${result.type}): ${result.text?.substring(0, 200) || result.caption}`
    )
  }

  private combineQueryResponses(responses: string[], query: string): string {
    return `Query: "${query}"\n\nResults:\n${responses.join('\n\n')}`
  }

  private generateComparisonInsights(
    result1: MultiModalResult,
    result2: MultiModalResult,
    similarity: number
  ): string[] {
    const insights: string[] = []
    
    if (similarity > 0.8) {
      insights.push('Very similar content detected')
    } else if (similarity > 0.5) {
      insights.push('Moderate similarity in content')
    } else {
      insights.push('Significantly different content')
    }
    
    if (result1.type === result2.type) {
      insights.push(`Both files are ${result1.type} type`)
    }
    
    return insights
  }

  private compareText(text1: string, text2: string): number {
    if (!text1 || !text2) return 0
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default multi-modal manager
 */
export function createMultiModalManager(config?: ConstructorParameters<typeof MultiModalManager>[0]): MultiModalManager {
  return new MultiModalManager(config)
}

/**
 * Create production multi-modal manager
 */
export function createProductionMultiModalManager(): MultiModalManager {
  return new MultiModalManager({
    image: {
      enableOCR: true,
      enableFaceDetection: true,
      enableNSFW: true,
      cacheResults: true
    },
    audio: {
      enableTranscription: true,
      enableDiarization: true,
      enableEmotionDetection: true,
      cacheResults: true
    },
    document: {
      enableOCR: true,
      enableFormExtraction: true,
      enableTableExtraction: true,
      cacheResults: true
    }
  })
}

/**
 * Create minimal multi-modal manager
 */
export function createMinimalMultiModalManager(): MultiModalManager {
  return new MultiModalManager({
    image: {
      enableOCR: false,
      enableFaceDetection: false,
      enableNSFW: false,
      cacheResults: false
    },
    audio: {
      enableTranscription: true,
      enableDiarization: false,
      enableEmotionDetection: false,
      cacheResults: false
    },
    document: {
      enableOCR: false,
      enableFormExtraction: false,
      enableTableExtraction: false,
      cacheResults: false
    }
  })
}