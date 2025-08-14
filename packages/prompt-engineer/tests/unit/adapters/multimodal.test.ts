/**
 * Multi-Modal Adapter Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { Effect } from 'effect'
import {
  createMultiModalManager,
  createImageAdapter,
  createAudioAdapter,
  createDocumentAdapter
} from '../../../src/adapters/multimodal'

describe('MultiModalManager', () => {
  let manager: ReturnType<typeof createMultiModalManager>
  
  beforeEach(() => {
    manager = createMultiModalManager()
  })
  
  describe('media type detection', () => {
    it('should detect image types', async () => {
      const imageBuffer = Buffer.from('fake-image-data')
      const result = await Effect.runPromise(
        manager.detectMediaType(imageBuffer, 'image.jpg')
      )
      
      expect(result.type).toBe('image')
      expect(result.subtype).toBe('jpeg')
      expect(result.confidence).toBeGreaterThan(0.8)
    })
    
    it('should detect audio types', async () => {
      const audioBuffer = Buffer.from('fake-audio-data')
      const result = await Effect.runPromise(
        manager.detectMediaType(audioBuffer, 'audio.mp3')
      )
      
      expect(result.type).toBe('audio')
      expect(result.subtype).toBe('mp3')
    })
    
    it('should detect document types', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4')
      const result = await Effect.runPromise(
        manager.detectMediaType(pdfBuffer, 'document.pdf')
      )
      
      expect(result.type).toBe('document')
      expect(result.subtype).toBe('pdf')
    })
    
    it('should handle unknown types', async () => {
      const unknownBuffer = Buffer.from('unknown-data')
      const result = await Effect.runPromise(
        manager.detectMediaType(unknownBuffer, 'file.xyz')
      )
      
      expect(result.type).toBe('unknown')
      expect(result.confidence).toBeLessThan(0.5)
    })
  })
  
  describe('unified processing', () => {
    it('should process images', async () => {
      const imageData = Buffer.from('fake-image')
      const result = await Effect.runPromise(
        manager.processMedia({
          data: imageData,
          type: 'image',
          options: {
            includeOCR: true,
            detectObjects: true
          }
        })
      )
      
      expect(result.type).toBe('image')
      expect(result.analysis).toBeDefined()
      expect(result.extracted).toBeDefined()
    })
    
    it('should process audio', async () => {
      const audioData = Buffer.from('fake-audio')
      const result = await Effect.runPromise(
        manager.processMedia({
          data: audioData,
          type: 'audio',
          options: {
            transcribe: true,
            detectSpeakers: true
          }
        })
      )
      
      expect(result.type).toBe('audio')
      expect(result.analysis).toBeDefined()
    })
    
    it('should process documents', async () => {
      const docData = Buffer.from('fake-document')
      const result = await Effect.runPromise(
        manager.processMedia({
          data: docData,
          type: 'document',
          options: {
            extractTables: true,
            extractForms: true
          }
        })
      )
      
      expect(result.type).toBe('document')
      expect(result.analysis).toBeDefined()
    })
    
    it('should handle batch processing', async () => {
      const items = [
        { data: Buffer.from('image1'), type: 'image' as const },
        { data: Buffer.from('audio1'), type: 'audio' as const },
        { data: Buffer.from('doc1'), type: 'document' as const }
      ]
      
      const results = await Effect.runPromise(
        manager.processBatch(items)
      )
      
      expect(results).toHaveLength(3)
      expect(results[0].type).toBe('image')
      expect(results[1].type).toBe('audio')
      expect(results[2].type).toBe('document')
    })
  })
  
  describe('cross-modal analysis', () => {
    it('should analyze relationships between media', async () => {
      const items = [
        { 
          id: 'img1',
          data: Buffer.from('image-with-text'),
          type: 'image' as const,
          metadata: { caption: 'Test image' }
        },
        {
          id: 'audio1',
          data: Buffer.from('audio-narration'),
          type: 'audio' as const,
          metadata: { transcript: 'Test narration' }
        }
      ]
      
      const result = await Effect.runPromise(
        manager.analyzeMultiModal(items)
      )
      
      expect(result.items).toHaveLength(2)
      expect(result.relationships).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(result.insights).toBeDefined()
    })
    
    it('should extract unified content', async () => {
      const items = [
        { data: Buffer.from('presentation-slide'), type: 'image' as const },
        { data: Buffer.from('narration'), type: 'audio' as const }
      ]
      
      const result = await Effect.runPromise(
        manager.extractUnifiedContent(items)
      )
      
      expect(result.text).toBeDefined()
      expect(result.entities).toBeDefined()
      expect(result.topics).toBeDefined()
      expect(result.sentiment).toBeDefined()
    })
  })
})

describe('ImageAdapter', () => {
  let adapter: ReturnType<typeof createImageAdapter>
  
  beforeEach(() => {
    adapter = createImageAdapter()
  })
  
  describe('image processing', () => {
    it('should extract text via OCR', async () => {
      const imageWithText = Buffer.from('image-with-text')
      const result = await Effect.runPromise(
        adapter.process(imageWithText, { ocr: true })
      )
      
      expect(result.text).toBeDefined()
      expect(result.text.content).toContain('Sample')
      expect(result.text.confidence).toBeGreaterThan(0)
    })
    
    it('should detect objects', async () => {
      const imageWithObjects = Buffer.from('image-with-objects')
      const result = await Effect.runPromise(
        adapter.process(imageWithObjects, { detectObjects: true })
      )
      
      expect(result.objects).toBeDefined()
      expect(result.objects.length).toBeGreaterThan(0)
      expect(result.objects[0].label).toBeDefined()
      expect(result.objects[0].confidence).toBeGreaterThan(0)
    })
    
    it('should detect faces', async () => {
      const imageWithFaces = Buffer.from('image-with-faces')
      const result = await Effect.runPromise(
        adapter.process(imageWithFaces, { detectFaces: true })
      )
      
      expect(result.faces).toBeDefined()
      expect(result.faces.length).toBeGreaterThan(0)
      expect(result.faces[0].boundingBox).toBeDefined()
    })
    
    it('should classify scenes', async () => {
      const scenicImage = Buffer.from('scenic-image')
      const result = await Effect.runPromise(
        adapter.process(scenicImage, { classifyScene: true })
      )
      
      expect(result.scene).toBeDefined()
      expect(result.scene.category).toBeDefined()
      expect(result.scene.tags).toBeDefined()
    })
    
    it('should extract colors', async () => {
      const colorfulImage = Buffer.from('colorful-image')
      const result = await Effect.runPromise(
        adapter.process(colorfulImage, { extractColors: true })
      )
      
      expect(result.colors).toBeDefined()
      expect(result.colors.dominant).toBeDefined()
      expect(result.colors.palette).toHaveLength(5)
    })
    
    it('should assess quality', async () => {
      const image = Buffer.from('test-image')
      const result = await Effect.runPromise(
        adapter.process(image, { assessQuality: true })
      )
      
      expect(result.quality).toBeDefined()
      expect(result.quality.sharpness).toBeGreaterThanOrEqual(0)
      expect(result.quality.sharpness).toBeLessThanOrEqual(100)
      expect(result.quality.brightness).toBeDefined()
      expect(result.quality.contrast).toBeDefined()
    })
  })
  
  describe('image comparison', () => {
    it('should compare two images', async () => {
      const image1 = Buffer.from('image1')
      const image2 = Buffer.from('image2')
      
      const result = await Effect.runPromise(
        adapter.compare(image1, image2)
      )
      
      expect(result.similarity).toBeGreaterThanOrEqual(0)
      expect(result.similarity).toBeLessThanOrEqual(1)
      expect(result.differences).toBeDefined()
      expect(result.matchingFeatures).toBeDefined()
    })
    
    it('should detect duplicates', async () => {
      const original = Buffer.from('original-image')
      const duplicate = Buffer.from('original-image')
      
      const result = await Effect.runPromise(
        adapter.compare(original, duplicate)
      )
      
      expect(result.similarity).toBeGreaterThan(0.95)
      expect(result.isDuplicate).toBe(true)
    })
  })
})

describe('AudioAdapter', () => {
  let adapter: ReturnType<typeof createAudioAdapter>
  
  beforeEach(() => {
    adapter = createAudioAdapter()
  })
  
  describe('audio processing', () => {
    it('should transcribe speech', async () => {
      const audioWithSpeech = Buffer.from('audio-speech')
      const result = await Effect.runPromise(
        adapter.process(audioWithSpeech, { transcribe: true })
      )
      
      expect(result.transcript).toBeDefined()
      expect(result.transcript.text).toContain('Hello')
      expect(result.transcript.confidence).toBeGreaterThan(0)
      expect(result.transcript.words).toBeDefined()
    })
    
    it('should detect speakers', async () => {
      const multiSpeakerAudio = Buffer.from('multi-speaker')
      const result = await Effect.runPromise(
        adapter.process(multiSpeakerAudio, { diarization: true })
      )
      
      expect(result.speakers).toBeDefined()
      expect(result.speakers.length).toBeGreaterThan(1)
      expect(result.speakers[0].id).toBeDefined()
      expect(result.speakers[0].segments).toBeDefined()
    })
    
    it('should detect emotions', async () => {
      const emotionalAudio = Buffer.from('emotional-speech')
      const result = await Effect.runPromise(
        adapter.process(emotionalAudio, { detectEmotions: true })
      )
      
      expect(result.emotions).toBeDefined()
      expect(result.emotions.primary).toBeDefined()
      expect(result.emotions.confidence).toBeGreaterThan(0)
    })
    
    it('should analyze music', async () => {
      const musicAudio = Buffer.from('music-track')
      const result = await Effect.runPromise(
        adapter.process(musicAudio, { analyzeMusic: true })
      )
      
      expect(result.music).toBeDefined()
      expect(result.music.tempo).toBeGreaterThan(0)
      expect(result.music.key).toBeDefined()
      expect(result.music.genre).toBeDefined()
    })
    
    it('should detect sound events', async () => {
      const audioWithEvents = Buffer.from('audio-with-events')
      const result = await Effect.runPromise(
        adapter.process(audioWithEvents, { detectEvents: true })
      )
      
      expect(result.events).toBeDefined()
      expect(result.events.length).toBeGreaterThan(0)
      expect(result.events[0].type).toBeDefined()
      expect(result.events[0].timestamp).toBeDefined()
    })
  })
  
  describe('audio analysis', () => {
    it('should extract audio features', async () => {
      const audio = Buffer.from('test-audio')
      const result = await Effect.runPromise(
        adapter.extractFeatures(audio)
      )
      
      expect(result.duration).toBeGreaterThan(0)
      expect(result.sampleRate).toBeGreaterThan(0)
      expect(result.channels).toBeGreaterThanOrEqual(1)
      expect(result.bitRate).toBeDefined()
    })
    
    it('should detect silence', async () => {
      const audioWithSilence = Buffer.from('audio-with-silence')
      const result = await Effect.runPromise(
        adapter.detectSilence(audioWithSilence)
      )
      
      expect(result.segments).toBeDefined()
      expect(result.totalSilence).toBeGreaterThan(0)
      expect(result.silenceRatio).toBeGreaterThan(0)
    })
  })
})

describe('DocumentAdapter', () => {
  let adapter: ReturnType<typeof createDocumentAdapter>
  
  beforeEach(() => {
    adapter = createDocumentAdapter()
  })
  
  describe('document processing', () => {
    it('should extract text from PDF', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test content')
      const result = await Effect.runPromise(
        adapter.process(pdfBuffer, { format: 'pdf' })
      )
      
      expect(result.text).toBeDefined()
      expect(result.pages).toBeGreaterThan(0)
      expect(result.metadata).toBeDefined()
    })
    
    it('should extract tables', async () => {
      const docWithTables = Buffer.from('document-with-tables')
      const result = await Effect.runPromise(
        adapter.process(docWithTables, { 
          format: 'pdf',
          extractTables: true 
        })
      )
      
      expect(result.tables).toBeDefined()
      expect(result.tables.length).toBeGreaterThan(0)
      expect(result.tables[0].headers).toBeDefined()
      expect(result.tables[0].rows).toBeDefined()
    })
    
    it('should extract forms', async () => {
      const formDocument = Buffer.from('form-document')
      const result = await Effect.runPromise(
        adapter.process(formDocument, {
          format: 'pdf',
          extractForms: true
        })
      )
      
      expect(result.forms).toBeDefined()
      expect(result.forms.length).toBeGreaterThan(0)
      expect(result.forms[0].fields).toBeDefined()
    })
    
    it('should extract entities', async () => {
      const document = Buffer.from('document-with-entities')
      const result = await Effect.runPromise(
        adapter.process(document, {
          format: 'pdf',
          extractEntities: true
        })
      )
      
      expect(result.entities).toBeDefined()
      expect(result.entities.people).toBeDefined()
      expect(result.entities.organizations).toBeDefined()
      expect(result.entities.locations).toBeDefined()
    })
    
    it('should parse markdown', async () => {
      const markdown = Buffer.from('# Title\n\nContent with **bold**')
      const result = await Effect.runPromise(
        adapter.process(markdown, { format: 'markdown' })
      )
      
      expect(result.text).toContain('Title')
      expect(result.structure).toBeDefined()
      expect(result.structure.headings).toBeDefined()
    })
    
    it('should parse HTML', async () => {
      const html = Buffer.from('<html><body><h1>Title</h1></body></html>')
      const result = await Effect.runPromise(
        adapter.process(html, { format: 'html' })
      )
      
      expect(result.text).toContain('Title')
      expect(result.structure).toBeDefined()
    })
  })
  
  describe('document analysis', () => {
    it('should calculate readability scores', async () => {
      const document = Buffer.from('Complex document text...')
      const result = await Effect.runPromise(
        adapter.analyzeReadability(document)
      )
      
      expect(result.fleschKincaid).toBeDefined()
      expect(result.fleschReading).toBeDefined()
      expect(result.gradeLevel).toBeGreaterThan(0)
    })
    
    it('should detect language', async () => {
      const document = Buffer.from('This is English text')
      const result = await Effect.runPromise(
        adapter.detectLanguage(document)
      )
      
      expect(result.language).toBe('en')
      expect(result.confidence).toBeGreaterThan(0.8)
    })
    
    it('should extract summary', async () => {
      const longDocument = Buffer.from('Long document content...')
      const result = await Effect.runPromise(
        adapter.extractSummary(longDocument, { maxLength: 100 })
      )
      
      expect(result.summary).toBeDefined()
      expect(result.summary.length).toBeLessThanOrEqual(100)
      expect(result.keyPoints).toBeDefined()
    })
  })
})

describe('Cross-Modal Integration', () => {
  it('should process presentation with slides and narration', async () => {
    const manager = createMultiModalManager()
    
    const presentation = [
      { 
        data: Buffer.from('slide1'),
        type: 'image' as const,
        metadata: { slideNumber: 1 }
      },
      {
        data: Buffer.from('narration1'),
        type: 'audio' as const,
        metadata: { slideNumber: 1 }
      },
      {
        data: Buffer.from('slide2'),
        type: 'image' as const,
        metadata: { slideNumber: 2 }
      },
      {
        data: Buffer.from('narration2'),
        type: 'audio' as const,
        metadata: { slideNumber: 2 }
      }
    ]
    
    const result = await Effect.runPromise(
      manager.analyzeMultiModal(presentation)
    )
    
    expect(result.items).toHaveLength(4)
    expect(result.relationships.length).toBeGreaterThan(0)
    expect(result.insights.synchronization).toBeDefined()
    expect(result.insights.contentAlignment).toBeDefined()
  })
  
  it('should process video-like content', async () => {
    const manager = createMultiModalManager()
    
    const frames = Array.from({ length: 5 }, (_, i) => ({
      data: Buffer.from(`frame${i}`),
      type: 'image' as const,
      metadata: { timestamp: i * 1000 }
    }))
    
    const audio = {
      data: Buffer.from('audio-track'),
      type: 'audio' as const,
      metadata: { duration: 5000 }
    }
    
    const result = await Effect.runPromise(
      manager.analyzeMultiModal([...frames, audio])
    )
    
    expect(result.timeline).toBeDefined()
    expect(result.insights.temporal).toBeDefined()
  })
  
  it('should handle mixed document types', async () => {
    const manager = createMultiModalManager()
    
    const items = [
      {
        data: Buffer.from('research-paper'),
        type: 'document' as const,
        metadata: { format: 'pdf' }
      },
      {
        data: Buffer.from('figure1'),
        type: 'image' as const,
        metadata: { caption: 'Figure 1' }
      },
      {
        data: Buffer.from('dataset'),
        type: 'document' as const,
        metadata: { format: 'csv' }
      }
    ]
    
    const result = await Effect.runPromise(
      manager.analyzeMultiModal(items)
    )
    
    expect(result.insights.dataRelationships).toBeDefined()
    expect(result.insights.contentHierarchy).toBeDefined()
  })
})