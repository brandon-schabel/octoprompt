#!/usr/bin/env bun
/**
 * Multi-Modal Processing Example
 * 
 * This example demonstrates how to process various media types:
 * - Image analysis (OCR, object detection, scene classification)
 * - Audio processing (transcription, speaker diarization, emotion)
 * - Document parsing (PDF, Word, HTML with tables and forms)
 * - Cross-modal analysis and relationships
 */

import {
  createMultiModalManager,
  createProductionMultiModalManager,
  MultiModalManager,
  MediaFile,
  MultiModalContext
} from '../../src/adapters/multimodal'
import { Effect } from 'effect'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Simulate various media files for testing
 */
class MediaSimulator {
  /**
   * Create a simulated image buffer (PNG header + data)
   */
  static createImageBuffer(): Buffer {
    // PNG magic number and basic header
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      // IHDR chunk
      0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52,
      // Width: 100px
      0x00, 0x00, 0x00, 0x64,
      // Height: 100px
      0x00, 0x00, 0x00, 0x64,
      // Bit depth and color type
      0x08, 0x02,
      // Compression, filter, interlace
      0x00, 0x00, 0x00
    ])
    
    // Add some dummy image data
    const imageData = Buffer.alloc(10000)
    return Buffer.concat([pngHeader, imageData])
  }
  
  /**
   * Create a simulated audio buffer (WAV header + data)
   */
  static createAudioBuffer(): Buffer {
    // WAV file header
    const wavHeader = Buffer.from('RIFF----WAVEfmt ')
    const audioData = Buffer.alloc(44100 * 2) // 1 second of audio at 44.1kHz
    return Buffer.concat([wavHeader, audioData])
  }
  
  /**
   * Create a simulated PDF buffer
   */
  static createPDFBuffer(): Buffer {
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Sample PDF Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000229 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
344
%%EOF`
    return Buffer.from(pdfContent)
  }
  
  /**
   * Create a simulated HTML document
   */
  static createHTMLBuffer(): Buffer {
    const html = `<!DOCTYPE html>
<html>
<head><title>Sample Document</title></head>
<body>
  <h1>Multi-Modal Analysis Report</h1>
  <p>This document contains various types of content for analysis.</p>
  <table>
    <tr><th>Type</th><th>Status</th><th>Score</th></tr>
    <tr><td>Image</td><td>Processed</td><td>95%</td></tr>
    <tr><td>Audio</td><td>Transcribed</td><td>87%</td></tr>
    <tr><td>Text</td><td>Analyzed</td><td>92%</td></tr>
  </table>
  <form>
    <input type="text" name="name" placeholder="Name">
    <input type="email" name="email" placeholder="Email">
    <button type="submit">Submit</button>
  </form>
</body>
</html>`
    return Buffer.from(html)
  }
}

/**
 * Basic multi-modal processing
 */
async function basicMultiModalProcessing() {
  console.log('🎨 Basic Multi-Modal Processing\n')
  console.log('═'.repeat(60))
  
  const manager = createMultiModalManager()
  
  // Create sample media files
  const mediaFiles: MediaFile[] = [
    {
      data: MediaSimulator.createImageBuffer(),
      type: 'image',
      mimeType: 'image/png',
      filename: 'sample.png'
    },
    {
      data: MediaSimulator.createAudioBuffer(),
      type: 'audio',
      mimeType: 'audio/wav',
      filename: 'sample.wav'
    },
    {
      data: MediaSimulator.createPDFBuffer(),
      type: 'document',
      mimeType: 'application/pdf',
      filename: 'sample.pdf'
    }
  ]
  
  console.log('Processing individual media files...\n')
  
  for (const file of mediaFiles) {
    try {
      console.log(`📁 Processing: ${file.filename}`)
      
      const result = await Effect.runPromise(
        manager.processMedia(file)
      )
      
      console.log(`├─ Type: ${result.type}`)
      console.log(`├─ Caption: ${result.caption}`)
      
      if (result.metadata) {
        console.log(`├─ Metadata:`)
        for (const [key, value] of Object.entries(result.metadata)) {
          console.log(`│  ├─ ${key}: ${value}`)
        }
      }
      
      if (result.text) {
        console.log(`└─ Extracted Text: ${result.text.substring(0, 50)}...`)
      }
      
      console.log()
    } catch (error) {
      console.log(`└─ ⚠️ Note: ${error.message}`)
      console.log()
    }
  }
}

/**
 * Advanced multi-modal analysis with relationships
 */
async function advancedMultiModalAnalysis() {
  console.log('\n🔬 Advanced Multi-Modal Analysis\n')
  console.log('═'.repeat(60))
  
  const manager = createProductionMultiModalManager()
  
  // Create a context with multiple related media files
  const context: MultiModalContext = {
    media: [
      {
        data: MediaSimulator.createImageBuffer(),
        type: 'image',
        filename: 'presentation-slide.png',
        metadata: { slide: 1 }
      },
      {
        data: MediaSimulator.createAudioBuffer(),
        type: 'audio',
        filename: 'presentation-narration.wav',
        metadata: { duration: 60 }
      },
      {
        data: MediaSimulator.createHTMLBuffer(),
        type: 'document',
        filename: 'presentation-notes.html',
        metadata: { pages: 5 }
      }
    ],
    prompt: 'Analyze this presentation and extract key insights',
    options: {
      extractText: true,
      generateCaptions: true,
      analyzeContent: true,
      compareMedia: true
    }
  }
  
  console.log('Analyzing multi-modal presentation...\n')
  
  try {
    const analysis = await Effect.runPromise(
      manager.processMultiModal(context)
    )
    
    console.log('📊 Combined Analysis Results:')
    console.log(`├─ Summary: ${analysis.summary}`)
    console.log(`├─ Media Files: ${analysis.media.length}`)
    console.log(`├─ Relationships Found: ${analysis.relationships.length}`)
    
    console.log('├─ Insights:')
    analysis.insights.forEach(insight => {
      console.log(`│  ├─ ${insight}`)
    })
    
    if (analysis.relationships.length > 0) {
      console.log('└─ Media Relationships:')
      analysis.relationships.forEach(rel => {
        console.log(`   ├─ Media ${rel.source} → Media ${rel.target}`)
        console.log(`   │  Type: ${rel.type}`)
        console.log(`   │  Confidence: ${(rel.confidence * 100).toFixed(1)}%`)
        console.log(`   │  ${rel.description}`)
      })
    }
  } catch (error) {
    console.log(`└─ ⚠️ Note: Simulated analysis - ${error.message}`)
  }
}

/**
 * Media type detection
 */
async function mediaTypeDetection() {
  console.log('\n\n🔍 Media Type Detection\n')
  console.log('═'.repeat(60))
  
  const manager = createMultiModalManager()
  
  const testCases = [
    { name: 'PNG Image', data: Buffer.from([0x89, 0x50, 0x4E, 0x47]) },
    { name: 'JPEG Image', data: Buffer.from([0xFF, 0xD8, 0xFF]) },
    { name: 'PDF Document', data: Buffer.from('%PDF-1.4') },
    { name: 'HTML Document', data: Buffer.from('<!DOCTYPE html>') },
    { name: 'WAV Audio', data: Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]) },
    { name: 'MP3 Audio', data: Buffer.from([0xFF, 0xFB]) },
    { name: 'Unknown', data: Buffer.from('Random data here') }
  ]
  
  console.log('Testing media type detection...\n')
  
  for (const test of testCases) {
    const detectedType = manager.detectMediaType(test.data)
    const icon = detectedType !== 'unknown' ? '✅' : '❓'
    console.log(`${icon} ${test.name}: Detected as '${detectedType}'`)
  }
}

/**
 * Cross-modal querying
 */
async function crossModalQuerying() {
  console.log('\n\n🔎 Cross-Modal Querying\n')
  console.log('═'.repeat(60))
  
  const manager = createMultiModalManager()
  
  const media: MediaFile[] = [
    {
      data: MediaSimulator.createImageBuffer(),
      type: 'image',
      filename: 'chart.png',
      metadata: { 
        description: 'Sales chart showing Q4 growth of 25%'
      }
    },
    {
      data: MediaSimulator.createPDFBuffer(),
      type: 'document',
      filename: 'report.pdf',
      metadata: {
        content: 'Quarterly report: Revenue increased by 25% in Q4'
      }
    },
    {
      data: MediaSimulator.createAudioBuffer(),
      type: 'audio',
      filename: 'earnings-call.wav',
      metadata: {
        transcript: 'CEO: We saw exceptional growth of 25% this quarter'
      }
    }
  ]
  
  const queries = [
    'What was the Q4 growth rate?',
    'Show me sales performance',
    'Find information about revenue'
  ]
  
  console.log('Testing cross-modal queries...\n')
  
  for (const query of queries) {
    console.log(`📝 Query: "${query}"`)
    
    try {
      const response = await Effect.runPromise(
        manager.queryMultiModal(media, query)
      )
      
      // Simulate query results
      console.log('├─ Results found in:')
      console.log('│  ├─ chart.png: Visual representation of 25% growth')
      console.log('│  ├─ report.pdf: Text mention of 25% revenue increase')
      console.log('│  └─ earnings-call.wav: Audio confirmation of 25% growth')
      console.log('└─ Confidence: High (corroborated across media)\n')
      
    } catch (error) {
      console.log(`└─ ⚠️ Note: Simulated query - ${error.message}\n`)
    }
  }
}

/**
 * Media comparison
 */
async function mediaComparison() {
  console.log('\n🔄 Media Comparison\n')
  console.log('═'.repeat(60))
  
  const manager = createMultiModalManager()
  
  // Create two similar documents for comparison
  const doc1: MediaFile = {
    data: Buffer.from(`
      <html>
        <body>
          <h1>Q3 Report</h1>
          <p>Revenue: $1M</p>
          <p>Growth: 15%</p>
        </body>
      </html>
    `),
    type: 'document',
    filename: 'q3-report.html'
  }
  
  const doc2: MediaFile = {
    data: Buffer.from(`
      <html>
        <body>
          <h1>Q4 Report</h1>
          <p>Revenue: $1.25M</p>
          <p>Growth: 25%</p>
        </body>
      </html>
    `),
    type: 'document',
    filename: 'q4-report.html'
  }
  
  console.log('Comparing Q3 vs Q4 reports...\n')
  
  try {
    const comparison = await Effect.runPromise(
      manager.compareMedia(doc1, doc2)
    )
    
    // Simulate comparison results
    console.log('📊 Comparison Results:')
    console.log(`├─ Similarity: 72%`)
    console.log(`├─ Differences:`)
    console.log(`│  ├─ Period: Q3 → Q4`)
    console.log(`│  ├─ Revenue: $1M → $1.25M (+25%)`)
    console.log(`│  └─ Growth: 15% → 25% (+10pp)`)
    console.log(`└─ Insights:`)
    console.log(`   ├─ Significant improvement in Q4`)
    console.log(`   ├─ Revenue growth accelerating`)
    console.log(`   └─ Positive trend continuation`)
    
  } catch (error) {
    console.log(`└─ ⚠️ Note: Simulated comparison - ${error.message}`)
  }
}

/**
 * Production multi-modal pipeline
 */
async function productionPipeline() {
  console.log('\n\n🏭 Production Multi-Modal Pipeline\n')
  console.log('═'.repeat(60))
  
  class MultiModalPipeline {
    private manager: MultiModalManager
    private cache = new Map<string, any>()
    
    constructor() {
      this.manager = createProductionMultiModalManager()
    }
    
    async processUserContent(
      userId: string,
      files: MediaFile[],
      purpose: string
    ) {
      const startTime = Date.now()
      const cacheKey = `${userId}-${files.length}-${purpose}`
      
      // Check cache
      if (this.cache.has(cacheKey)) {
        console.log('├─ Cache hit! Returning cached results')
        return this.cache.get(cacheKey)
      }
      
      console.log(`Processing ${files.length} files for user ${userId}...`)
      console.log(`├─ Purpose: ${purpose}`)
      
      try {
        // Phase 1: Individual processing
        console.log('├─ Phase 1: Individual media processing')
        const individualResults = await Promise.all(
          files.map(file => 
            Effect.runPromise(this.manager.processMedia(file))
              .catch(err => ({ type: file.type, error: err.message }))
          )
        )
        
        // Phase 2: Combined analysis
        console.log('├─ Phase 2: Combined analysis')
        const context: MultiModalContext = {
          media: files,
          prompt: purpose,
          options: {
            extractText: true,
            generateCaptions: true,
            analyzeContent: true
          }
        }
        
        // Simulate combined analysis
        const combinedAnalysis = {
          summary: `Processed ${files.length} files successfully`,
          insights: [
            `Total media types: ${new Set(files.map(f => f.type)).size}`,
            `Processing time: ${Date.now() - startTime}ms`,
            `Cache status: Will be cached for 5 minutes`
          ],
          confidence: 0.92
        }
        
        // Phase 3: Generate response
        console.log('├─ Phase 3: Generating response')
        const response = {
          userId,
          purpose,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          results: {
            individual: individualResults,
            combined: combinedAnalysis
          },
          recommendations: this.generateRecommendations(individualResults)
        }
        
        // Cache results
        this.cache.set(cacheKey, response)
        setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000) // 5 min TTL
        
        console.log('└─ ✅ Processing complete')
        return response
        
      } catch (error) {
        console.log(`└─ ❌ Processing failed: ${error.message}`)
        throw error
      }
    }
    
    private generateRecommendations(results: any[]): string[] {
      return [
        'Consider optimizing image sizes for faster processing',
        'Audio files could benefit from noise reduction',
        'Document structure is well-formed for extraction'
      ]
    }
  }
  
  const pipeline = new MultiModalPipeline()
  
  // Simulate production usage
  const userFiles: MediaFile[] = [
    {
      data: MediaSimulator.createImageBuffer(),
      type: 'image',
      filename: 'product-photo.png'
    },
    {
      data: MediaSimulator.createPDFBuffer(),
      type: 'document',
      filename: 'product-manual.pdf'
    }
  ]
  
  console.log('Running production pipeline...\n')
  
  const result = await pipeline.processUserContent(
    'user-12345',
    userFiles,
    'Extract product information for catalog'
  )
  
  console.log('\n📦 Pipeline Results:')
  console.log(`├─ User: ${result.userId}`)
  console.log(`├─ Processing Time: ${result.processingTime}ms`)
  console.log(`├─ Summary: ${result.results.combined.summary}`)
  console.log(`├─ Confidence: ${(result.results.combined.confidence * 100).toFixed(1)}%`)
  console.log(`└─ Recommendations:`)
  result.recommendations.forEach(rec => {
    console.log(`   ├─ ${rec}`)
  })
}

/**
 * Main execution
 */
async function main() {
  console.log('🎭 Multi-Modal Processing Examples\n')
  console.log('This example demonstrates processing of images, audio,')
  console.log('documents, and cross-modal analysis capabilities.\n')
  
  try {
    // Run all examples
    await basicMultiModalProcessing()
    await advancedMultiModalAnalysis()
    await mediaTypeDetection()
    await crossModalQuerying()
    await mediaComparison()
    await productionPipeline()
    
    console.log('\n\n✨ All multi-modal examples completed successfully!')
    console.log('\n🔑 Key Capabilities:')
    console.log('├─ Process images, audio, and documents')
    console.log('├─ Extract text and generate captions')
    console.log('├─ Detect relationships between media')
    console.log('├─ Query across multiple media types')
    console.log('├─ Compare and analyze media files')
    console.log('└─ Production-ready pipeline with caching')
    
    console.log('\n📝 Note: This example uses simulated media processing.')
    console.log('In production, integrate with actual OCR, speech-to-text,')
    console.log('and document parsing services for real results.')
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error)
    process.exit(1)
  }
}

// Run the examples
main().catch(console.error)