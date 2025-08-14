# Multi-Modal Processing Guide

## Overview

The @promptliano/prompt-engineer package provides comprehensive multi-modal processing capabilities, allowing you to work with images, audio, documents, and cross-modal content. This guide covers how to process different media types, extract information, and perform cross-modal analysis.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Image Processing](#image-processing)
3. [Audio Processing](#audio-processing)
4. [Document Processing](#document-processing)
5. [Cross-Modal Analysis](#cross-modal-analysis)
6. [Unified Content Extraction](#unified-content-extraction)
7. [Production Patterns](#production-patterns)
8. [Performance Optimization](#performance-optimization)
9. [Examples](#examples)

## Getting Started

### Basic Setup

```typescript
import { createMultiModalManager } from '@promptliano/prompt-engineer/adapters/multimodal'

// Initialize the multi-modal manager
const multimodal = createMultiModalManager({
  // Optional configuration
  maxFileSize: 10 * 1024 * 1024,  // 10MB limit
  supportedFormats: {
    image: ['jpg', 'png', 'gif', 'webp'],
    audio: ['mp3', 'wav', 'ogg', 'm4a'],
    document: ['pdf', 'docx', 'txt', 'md', 'html']
  },
  enableCaching: true
})
```

### Media Type Detection

```typescript
// Automatic media type detection
const mediaType = await multimodal.detectMediaType(buffer, 'filename.jpg')

console.log(mediaType)
// {
//   type: 'image',
//   subtype: 'jpeg',
//   confidence: 0.95,
//   mimeType: 'image/jpeg'
// }

// Manual type specification
const result = await multimodal.processMedia({
  data: buffer,
  type: 'image',  // Explicitly specify type
  options: { /* ... */ }
})
```

## Image Processing

### OCR (Optical Character Recognition)

Extract text from images:

```typescript
import { createImageAdapter } from '@promptliano/prompt-engineer/adapters/multimodal'

const imageAdapter = createImageAdapter()

// Extract text from image
const result = await imageAdapter.process(imageBuffer, {
  ocr: true,
  ocrLanguages: ['en', 'es'],  // Multiple languages
  enhanceImage: true            // Pre-process for better OCR
})

console.log(result.text)
// {
//   content: "Extracted text from image",
//   confidence: 0.92,
//   blocks: [
//     { text: "Title", bbox: { x: 10, y: 10, width: 100, height: 30 } },
//     { text: "Body text", bbox: { x: 10, y: 50, width: 200, height: 100 } }
//   ],
//   language: "en"
// }
```

### Object Detection

Identify objects in images:

```typescript
const result = await imageAdapter.process(imageBuffer, {
  detectObjects: true,
  objectConfidenceThreshold: 0.7
})

console.log(result.objects)
// [
//   {
//     label: "person",
//     confidence: 0.95,
//     boundingBox: { x: 100, y: 50, width: 150, height: 200 },
//     attributes: { pose: "standing", age: "adult" }
//   },
//   {
//     label: "car",
//     confidence: 0.88,
//     boundingBox: { x: 300, y: 100, width: 200, height: 100 },
//     attributes: { color: "red", type: "sedan" }
//   }
// ]
```

### Face Detection

Detect and analyze faces:

```typescript
const result = await imageAdapter.process(imageBuffer, {
  detectFaces: true,
  analyzeFaceAttributes: true
})

console.log(result.faces)
// [
//   {
//     boundingBox: { x: 120, y: 80, width: 60, height: 80 },
//     landmarks: {
//       leftEye: { x: 135, y: 100 },
//       rightEye: { x: 165, y: 100 },
//       nose: { x: 150, y: 120 },
//       mouth: { x: 150, y: 140 }
//     },
//     attributes: {
//       age: { min: 25, max: 35 },
//       gender: { value: "female", confidence: 0.92 },
//       emotion: { value: "happy", confidence: 0.88 },
//       glasses: false,
//       beard: false
//     },
//     confidence: 0.94
//   }
// ]
```

### Scene Classification

Understand image context:

```typescript
const result = await imageAdapter.process(imageBuffer, {
  classifyScene: true
})

console.log(result.scene)
// {
//   category: "outdoor",
//   subcategory: "beach",
//   tags: ["ocean", "sand", "sunset", "vacation"],
//   confidence: 0.91,
//   attributes: {
//     timeOfDay: "evening",
//     weather: "clear",
//     activity: "leisure"
//   }
// }
```

### Color Analysis

Extract color information:

```typescript
const result = await imageAdapter.process(imageBuffer, {
  extractColors: true
})

console.log(result.colors)
// {
//   dominant: "#FF5733",
//   palette: [
//     { hex: "#FF5733", rgb: [255, 87, 51], percentage: 35 },
//     { hex: "#3498DB", rgb: [52, 152, 219], percentage: 25 },
//     { hex: "#2ECC71", rgb: [46, 204, 113], percentage: 20 }
//   ],
//   histogram: { /* RGB histogram data */ },
//   mood: "warm",
//   contrast: 0.75
// }
```

### Image Quality Assessment

Evaluate image quality:

```typescript
const result = await imageAdapter.process(imageBuffer, {
  assessQuality: true
})

console.log(result.quality)
// {
//   sharpness: 85,      // 0-100
//   brightness: 65,     // 0-100
//   contrast: 70,       // 0-100
//   saturation: 60,     // 0-100
//   noise: 15,          // 0-100 (lower is better)
//   overall: 75,        // 0-100
//   issues: ["slight_underexposure", "low_saturation"],
//   recommendations: ["increase_brightness", "enhance_colors"]
// }
```

### Image Comparison

Compare two images:

```typescript
const comparison = await imageAdapter.compare(image1Buffer, image2Buffer, {
  method: 'perceptual',  // 'pixel', 'perceptual', 'structural'
  extractDifferences: true
})

console.log(comparison)
// {
//   similarity: 0.87,
//   isDuplicate: false,
//   differences: {
//     regions: [
//       { bbox: { x: 50, y: 50, width: 100, height: 100 }, type: "content_change" }
//     ],
//     pixelDifference: 0.13,
//     structuralSimilarity: 0.91
//   },
//   matchingFeatures: 145,
//   totalFeatures: 167
// }
```

## Audio Processing

### Transcription

Convert speech to text:

```typescript
import { createAudioAdapter } from '@promptliano/prompt-engineer/adapters/multimodal'

const audioAdapter = createAudioAdapter()

const result = await audioAdapter.process(audioBuffer, {
  transcribe: true,
  language: 'auto',  // Auto-detect language
  includeTimestamps: true
})

console.log(result.transcript)
// {
//   text: "Hello, this is a sample audio transcription.",
//   confidence: 0.94,
//   language: "en-US",
//   words: [
//     { word: "Hello", start: 0.0, end: 0.5, confidence: 0.96 },
//     { word: "this", start: 0.6, end: 0.8, confidence: 0.95 },
//     // ...
//   ],
//   segments: [
//     {
//       text: "Hello, this is a sample audio transcription.",
//       start: 0.0,
//       end: 3.5,
//       speaker: "SPEAKER_1"
//     }
//   ]
// }
```

### Speaker Diarization

Identify different speakers:

```typescript
const result = await audioAdapter.process(audioBuffer, {
  diarization: true,
  maxSpeakers: 5
})

console.log(result.speakers)
// [
//   {
//     id: "SPEAKER_1",
//     segments: [
//       { start: 0.0, end: 5.2, text: "Hello, I'm the first speaker." },
//       { start: 10.5, end: 15.3, text: "Let me continue..." }
//     ],
//     totalDuration: 10.1,
//     voiceProfile: {
//       pitch: "medium",
//       gender: { value: "male", confidence: 0.88 },
//       age: { min: 30, max: 40 }
//     }
//   },
//   {
//     id: "SPEAKER_2",
//     segments: [
//       { start: 5.3, end: 10.4, text: "Hi, I'm another speaker." }
//     ],
//     totalDuration: 5.1,
//     voiceProfile: {
//       pitch: "high",
//       gender: { value: "female", confidence: 0.91 }
//     }
//   }
// ]
```

### Emotion Detection

Analyze emotional content:

```typescript
const result = await audioAdapter.process(audioBuffer, {
  detectEmotions: true
})

console.log(result.emotions)
// {
//   primary: "happy",
//   confidence: 0.82,
//   distribution: {
//     happy: 0.82,
//     neutral: 0.10,
//     sad: 0.03,
//     angry: 0.02,
//     surprised: 0.03
//   },
//   timeline: [
//     { start: 0.0, end: 2.0, emotion: "neutral" },
//     { start: 2.0, end: 5.0, emotion: "happy" },
//     { start: 5.0, end: 7.0, emotion: "excited" }
//   ],
//   arousal: 0.7,  // Energy level (0-1)
//   valence: 0.8   // Positivity (0-1)
// }
```

### Music Analysis

Analyze musical content:

```typescript
const result = await audioAdapter.process(audioBuffer, {
  analyzeMusic: true
})

console.log(result.music)
// {
//   tempo: 120,           // BPM
//   key: "C major",
//   timeSignature: "4/4",
//   genre: ["pop", "rock"],
//   mood: ["energetic", "upbeat"],
//   instruments: ["guitar", "drums", "bass", "vocals"],
//   sections: [
//     { type: "intro", start: 0, end: 10 },
//     { type: "verse", start: 10, end: 30 },
//     { type: "chorus", start: 30, end: 50 }
//   ],
//   energy: 0.75,
//   danceability: 0.68,
//   acousticness: 0.22
// }
```

### Sound Event Detection

Identify specific sounds:

```typescript
const result = await audioAdapter.process(audioBuffer, {
  detectEvents: true,
  eventTypes: ['speech', 'music', 'applause', 'laughter', 'silence']
})

console.log(result.events)
// [
//   { type: "speech", start: 0.0, end: 5.0, confidence: 0.92 },
//   { type: "applause", start: 5.0, end: 7.0, confidence: 0.88 },
//   { type: "music", start: 7.0, end: 15.0, confidence: 0.95 },
//   { type: "silence", start: 15.0, end: 16.0, confidence: 0.99 }
// ]
```

## Document Processing

### PDF Processing

Extract content from PDFs:

```typescript
import { createDocumentAdapter } from '@promptliano/prompt-engineer/adapters/multimodal'

const documentAdapter = createDocumentAdapter()

const result = await documentAdapter.process(pdfBuffer, {
  format: 'pdf',
  extractText: true,
  extractTables: true,
  extractImages: true,
  extractMetadata: true
})

console.log(result)
// {
//   text: "Full document text...",
//   pages: 10,
//   metadata: {
//     title: "Document Title",
//     author: "John Doe",
//     created: "2024-01-15",
//     modified: "2024-01-20"
//   },
//   structure: {
//     headings: [
//       { level: 1, text: "Introduction", page: 1 },
//       { level: 2, text: "Background", page: 2 }
//     ],
//     paragraphs: 45,
//     lists: 5
//   },
//   tables: [
//     {
//       page: 3,
//       headers: ["Name", "Value", "Description"],
//       rows: [
//         ["Item 1", "100", "First item"],
//         ["Item 2", "200", "Second item"]
//       ]
//     }
//   ],
//   images: [
//     {
//       page: 5,
//       data: Buffer,
//       caption: "Figure 1: Sample diagram"
//     }
//   ]
// }
```

### Table Extraction

Extract structured data from tables:

```typescript
const result = await documentAdapter.process(documentBuffer, {
  extractTables: true,
  tableFormat: 'json'  // 'json', 'csv', 'markdown'
})

console.log(result.tables)
// [
//   {
//     headers: ["Product", "Price", "Quantity", "Total"],
//     rows: [
//       ["Widget A", "$10.00", "5", "$50.00"],
//       ["Widget B", "$15.00", "3", "$45.00"]
//     ],
//     metadata: {
//       page: 2,
//       confidence: 0.92,
//       hasHeaders: true,
//       rowCount: 2,
//       columnCount: 4
//     },
//     structured: [
//       { Product: "Widget A", Price: 10.00, Quantity: 5, Total: 50.00 },
//       { Product: "Widget B", Price: 15.00, Quantity: 3, Total: 45.00 }
//     ]
//   }
// ]
```

### Form Extraction

Extract form fields and values:

```typescript
const result = await documentAdapter.process(formDocument, {
  extractForms: true
})

console.log(result.forms)
// [
//   {
//     formId: "application_form",
//     fields: [
//       {
//         name: "full_name",
//         label: "Full Name",
//         value: "John Doe",
//         type: "text",
//         required: true
//       },
//       {
//         name: "email",
//         label: "Email Address",
//         value: "john@example.com",
//         type: "email",
//         required: true
//       },
//       {
//         name: "subscribe",
//         label: "Subscribe to newsletter",
//         value: true,
//         type: "checkbox",
//         required: false
//       }
//     ],
//     signatures: [
//       {
//         field: "signature",
//         signed: true,
//         timestamp: "2024-01-20T10:30:00Z"
//       }
//     ]
//   }
// ]
```

### Entity Extraction

Extract named entities:

```typescript
const result = await documentAdapter.process(documentBuffer, {
  extractEntities: true
})

console.log(result.entities)
// {
//   people: [
//     { name: "John Doe", role: "CEO", mentions: 5 },
//     { name: "Jane Smith", role: "CTO", mentions: 3 }
//   ],
//   organizations: [
//     { name: "Acme Corp", type: "company", mentions: 10 },
//     { name: "Stanford University", type: "education", mentions: 2 }
//   ],
//   locations: [
//     { name: "San Francisco", type: "city", country: "USA", mentions: 4 },
//     { name: "California", type: "state", country: "USA", mentions: 3 }
//   ],
//   dates: [
//     { value: "2024-01-15", context: "meeting date", format: "ISO" },
//     { value: "Q2 2024", context: "deadline", format: "quarter" }
//   ],
//   money: [
//     { amount: 1000000, currency: "USD", context: "funding" },
//     { amount: 50000, currency: "EUR", context: "budget" }
//   ],
//   emails: ["john@example.com", "support@acme.com"],
//   phones: ["+1-555-123-4567"],
//   urls: ["https://example.com", "https://acme.com"]
// }
```

### Language Detection

Detect document language:

```typescript
const result = await documentAdapter.detectLanguage(documentBuffer)

console.log(result)
// {
//   language: "en",
//   confidence: 0.95,
//   additionalLanguages: [
//     { language: "es", confidence: 0.03, segments: [15, 16] },
//     { language: "fr", confidence: 0.02, segments: [22] }
//   ],
//   script: "Latin",
//   isMultilingual: true
// }
```

## Cross-Modal Analysis

### Multi-Modal Correlation

Analyze relationships between different media:

```typescript
const items = [
  {
    id: 'slide1',
    data: slideImageBuffer,
    type: 'image' as const,
    metadata: { slideNumber: 1, timestamp: 0 }
  },
  {
    id: 'narration1',
    data: audioBuffer,
    type: 'audio' as const,
    metadata: { startTime: 0, endTime: 30 }
  },
  {
    id: 'transcript1',
    data: documentBuffer,
    type: 'document' as const,
    metadata: { pageNumber: 1 }
  }
]

const analysis = await multimodal.analyzeMultiModal(items)

console.log(analysis)
// {
//   items: [...processed items...],
//   relationships: [
//     {
//       source: 'slide1',
//       target: 'narration1',
//       type: 'temporal_alignment',
//       confidence: 0.92,
//       details: { overlap: 30, synchronization: 0.88 }
//     },
//     {
//       source: 'narration1',
//       target: 'transcript1',
//       type: 'content_match',
//       confidence: 0.95,
//       details: { similarity: 0.95, matchedPhrases: 15 }
//     }
//   ],
//   insights: {
//     synchronization: {
//       score: 0.87,
//       issues: ["audio_lag_at_15s"],
//       recommendations: ["align_audio_with_slide_transitions"]
//     },
//     contentAlignment: {
//       score: 0.91,
//       consistency: "high",
//       gaps: ["slide3_missing_narration"]
//     },
//     quality: {
//       overall: 0.85,
//       audioQuality: 0.82,
//       imageQuality: 0.88,
//       textClarity: 0.90
//     }
//   },
//   summary: "Well-synchronized presentation with minor audio lag at 15s mark",
//   timeline: [
//     { time: 0, events: ["slide1_shown", "narration_starts"] },
//     { time: 15, events: ["audio_lag_detected"] },
//     { time: 30, events: ["slide2_transition", "narration_continues"] }
//   ]
// }
```

## Unified Content Extraction

Extract and merge content from multiple sources:

```typescript
const unifiedContent = await multimodal.extractUnifiedContent([
  { data: imageBuffer, type: 'image' },
  { data: audioBuffer, type: 'audio' },
  { data: pdfBuffer, type: 'document' }
])

console.log(unifiedContent)
// {
//   text: {
//     combined: "Merged text from all sources...",
//     sources: {
//       image: "Text extracted via OCR...",
//       audio: "Transcribed speech...",
//       document: "Document text content..."
//     }
//   },
//   entities: {
//     people: ["John Doe", "Jane Smith"],
//     organizations: ["Acme Corp"],
//     locations: ["San Francisco"],
//     topics: ["technology", "innovation", "sustainability"]
//   },
//   summary: "A presentation about technology innovation at Acme Corp...",
//   keyPoints: [
//     "Introduction of new product line",
//     "Sustainability initiatives",
//     "Q2 revenue projections"
//   ],
//   sentiment: {
//     overall: "positive",
//     score: 0.75,
//     distribution: { positive: 0.75, neutral: 0.20, negative: 0.05 }
//   },
//   metadata: {
//     totalDuration: 300,  // seconds
//     wordCount: 1500,
//     mediaTypes: ["image", "audio", "document"],
//     languages: ["en"],
//     confidence: 0.88
//   }
// }
```

## Production Patterns

### Batch Processing

Process multiple files efficiently:

```typescript
async function batchProcessMedia(files: File[]) {
  const batchSize = 5
  const results = []
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const buffer = await file.arrayBuffer()
        const type = detectMediaType(file.name)
        
        return multimodal.processMedia({
          data: Buffer.from(buffer),
          type,
          options: { /* ... */ }
        })
      })
    )
    
    results.push(...batchResults)
    
    // Progress update
    console.log(`Processed ${i + batch.length}/${files.length} files`)
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return results
}
```

### Streaming Processing

Handle large files with streaming:

```typescript
async function* streamProcessLargeAudio(audioStream: ReadableStream) {
  const chunkSize = 1024 * 1024  // 1MB chunks
  const reader = audioStream.getReader()
  const audioAdapter = createAudioAdapter()
  
  let buffer = Buffer.alloc(0)
  let done = false
  
  while (!done) {
    const { value, done: streamDone } = await reader.read()
    done = streamDone
    
    if (value) {
      buffer = Buffer.concat([buffer, Buffer.from(value)])
      
      // Process when we have enough data
      while (buffer.length >= chunkSize) {
        const chunk = buffer.slice(0, chunkSize)
        buffer = buffer.slice(chunkSize)
        
        const result = await audioAdapter.processChunk(chunk, {
          transcribe: true,
          streaming: true
        })
        
        yield result
      }
    }
  }
  
  // Process remaining buffer
  if (buffer.length > 0) {
    const result = await audioAdapter.processChunk(buffer, {
      transcribe: true,
      streaming: true,
      isFinal: true
    })
    
    yield result
  }
}
```

### Caching Strategy

Implement intelligent caching:

```typescript
class MultiModalCache {
  private cache = new Map<string, any>()
  private maxSize = 100 * 1024 * 1024  // 100MB
  private currentSize = 0
  
  async process(data: Buffer, type: string, options: any) {
    const hash = this.calculateHash(data)
    const cacheKey = `${hash}_${type}_${JSON.stringify(options)}`
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      console.log('Cache hit')
      return this.cache.get(cacheKey)
    }
    
    // Process
    const result = await multimodal.processMedia({
      data,
      type,
      options
    })
    
    // Cache result
    this.addToCache(cacheKey, result, data.length)
    
    return result
  }
  
  private addToCache(key: string, value: any, size: number) {
    // Evict if necessary
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value
      const evicted = this.cache.get(firstKey)
      this.cache.delete(firstKey)
      this.currentSize -= evicted._size || 0
    }
    
    // Add to cache
    value._size = size
    this.cache.set(key, value)
    this.currentSize += size
  }
  
  private calculateHash(data: Buffer): string {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(data).digest('hex')
  }
}
```

## Performance Optimization

### Parallel Processing

Process multiple media types concurrently:

```typescript
async function parallelMultiModalProcessing(items: MediaItem[]) {
  // Group by type for optimized processing
  const grouped = items.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || []
    acc[item.type].push(item)
    return acc
  }, {} as Record<string, MediaItem[]>)
  
  // Process each type in parallel
  const results = await Promise.all([
    processImageBatch(grouped.image || []),
    processAudioBatch(grouped.audio || []),
    processDocumentBatch(grouped.document || [])
  ])
  
  // Merge results
  return results.flat()
}

async function processImageBatch(images: MediaItem[]) {
  const adapter = createImageAdapter({ parallel: true })
  return Promise.all(images.map(img => 
    adapter.process(img.data, { /* options */ })
  ))
}
```

### Memory Management

Handle large files efficiently:

```typescript
class MemoryEfficientProcessor {
  private maxMemory = 500 * 1024 * 1024  // 500MB limit
  
  async processLargeFile(filePath: string, type: string) {
    const stats = await fs.promises.stat(filePath)
    
    if (stats.size > this.maxMemory) {
      // Process in chunks
      return this.processInChunks(filePath, type)
    } else {
      // Process normally
      const data = await fs.promises.readFile(filePath)
      return multimodal.processMedia({ data, type })
    }
  }
  
  private async processInChunks(filePath: string, type: string) {
    const chunkSize = 50 * 1024 * 1024  // 50MB chunks
    const results = []
    const stream = fs.createReadStream(filePath, { 
      highWaterMark: chunkSize 
    })
    
    for await (const chunk of stream) {
      const result = await this.processChunk(chunk, type)
      results.push(result)
      
      // Force garbage collection if available
      if (global.gc) global.gc()
    }
    
    return this.mergeResults(results)
  }
}
```

## Examples

### Complete Multi-Modal Pipeline

```typescript
import { 
  createMultiModalManager,
  createImageAdapter,
  createAudioAdapter,
  createDocumentAdapter
} from '@promptliano/prompt-engineer/adapters/multimodal'

async function completeMultiModalPipeline(
  presentationFile: string,
  audioFile: string,
  transcriptFile: string
) {
  const manager = createMultiModalManager()
  
  // 1. Load all media
  const [slides, audio, transcript] = await Promise.all([
    fs.promises.readFile(presentationFile),
    fs.promises.readFile(audioFile),
    fs.promises.readFile(transcriptFile)
  ])
  
  // 2. Process individually
  console.log('Processing media files...')
  
  const [slideAnalysis, audioAnalysis, docAnalysis] = await Promise.all([
    manager.processMedia({
      data: slides,
      type: 'document',
      options: {
        extractImages: true,
        extractText: true
      }
    }),
    manager.processMedia({
      data: audio,
      type: 'audio',
      options: {
        transcribe: true,
        diarization: true,
        detectEmotions: true
      }
    }),
    manager.processMedia({
      data: transcript,
      type: 'document',
      options: {
        extractEntities: true
      }
    })
  ])
  
  // 3. Cross-modal analysis
  console.log('Analyzing relationships...')
  
  const crossAnalysis = await manager.analyzeMultiModal([
    { 
      id: 'slides',
      data: slides,
      type: 'document',
      processed: slideAnalysis
    },
    {
      id: 'audio',
      data: audio,
      type: 'audio',
      processed: audioAnalysis
    },
    {
      id: 'transcript',
      data: transcript,
      type: 'document',
      processed: docAnalysis
    }
  ])
  
  // 4. Generate unified summary
  const unified = await manager.extractUnifiedContent([
    { data: slides, type: 'document' },
    { data: audio, type: 'audio' },
    { data: transcript, type: 'document' }
  ])
  
  // 5. Generate report
  const report = generateMultiModalReport({
    slideAnalysis,
    audioAnalysis,
    docAnalysis,
    crossAnalysis,
    unified
  })
  
  return report
}

function generateMultiModalReport(analysis: any) {
  return {
    summary: analysis.unified.summary,
    insights: {
      contentQuality: assessContentQuality(analysis),
      synchronization: analysis.crossAnalysis.insights.synchronization,
      accessibility: assessAccessibility(analysis),
      recommendations: generateRecommendations(analysis)
    },
    metrics: {
      duration: analysis.audioAnalysis.duration,
      slideCount: analysis.slideAnalysis.pages,
      wordCount: analysis.unified.wordCount,
      speakerCount: analysis.audioAnalysis.speakers?.length || 1,
      qualityScore: calculateQualityScore(analysis)
    },
    details: {
      keyTopics: analysis.unified.entities.topics,
      emotions: analysis.audioAnalysis.emotions,
      entities: analysis.unified.entities
    }
  }
}
```

### Real-time Multi-Modal Processing

```typescript
async function realtimeMultiModalProcessor() {
  const manager = createMultiModalManager()
  const eventEmitter = new EventEmitter()
  
  // Setup real-time processors
  const processors = {
    image: createImageAdapter({ realtime: true }),
    audio: createAudioAdapter({ realtime: true }),
    document: createDocumentAdapter({ realtime: true })
  }
  
  // Process incoming media stream
  async function processIncoming(data: Buffer, type: string) {
    const startTime = Date.now()
    
    try {
      // Quick analysis for real-time feedback
      const quickResult = await processors[type].quickProcess(data)
      
      // Emit immediate result
      eventEmitter.emit('quick-result', {
        type,
        result: quickResult,
        latency: Date.now() - startTime
      })
      
      // Full processing in background
      setImmediate(async () => {
        const fullResult = await manager.processMedia({
          data,
          type,
          options: { full: true }
        })
        
        eventEmitter.emit('full-result', {
          type,
          result: fullResult,
          latency: Date.now() - startTime
        })
      })
      
    } catch (error) {
      eventEmitter.emit('error', { type, error })
    }
  }
  
  return {
    process: processIncoming,
    on: eventEmitter.on.bind(eventEmitter),
    off: eventEmitter.off.bind(eventEmitter)
  }
}

// Usage
const processor = await realtimeMultiModalProcessor()

processor.on('quick-result', ({ type, result, latency }) => {
  console.log(`Quick ${type} result in ${latency}ms:`, result)
})

processor.on('full-result', ({ type, result, latency }) => {
  console.log(`Full ${type} result in ${latency}ms:`, result)
})

// Process media
await processor.process(imageBuffer, 'image')
```

## Troubleshooting

### Common Issues

1. **Out of Memory**
   - Process files in chunks
   - Reduce concurrent operations
   - Increase Node.js memory: `node --max-old-space-size=4096`

2. **Slow Processing**
   - Enable caching
   - Use parallel processing
   - Optimize media before processing

3. **Format Not Supported**
   - Check supported formats
   - Convert to supported format
   - Add custom adapter

4. **Poor Quality Results**
   - Enhance media quality first
   - Adjust processing parameters
   - Use multiple processing passes

## Next Steps

1. **Start Simple** - Process single media types first
2. **Add Complexity** - Combine multiple media types
3. **Optimize** - Implement caching and parallel processing
4. **Production** - Add error handling and monitoring
5. **Extend** - Create custom adapters for specific needs

Happy multi-modal processing! 🎨🎵📄