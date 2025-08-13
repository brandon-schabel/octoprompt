/**
 * Audio Adapter for Multi-Modal Processing
 * Handles audio transcription, analysis, and audio-language tasks
 */

import { Effect, Stream, Schema, pipe, Chunk } from 'effect'

// ============================================================================
// Audio Types
// ============================================================================

export interface AudioMetadata {
  readonly duration: number // seconds
  readonly sampleRate: number // Hz
  readonly channels: number
  readonly bitDepth: number
  readonly format: 'wav' | 'mp3' | 'ogg' | 'flac' | 'm4a' | 'webm'
  readonly codec?: string
  readonly bitrate?: number // kbps
  readonly fileSize: number // bytes
}

export interface AudioAnalysisResult {
  readonly metadata: AudioMetadata
  readonly transcript?: TranscriptionResult
  readonly segments: AudioSegment[]
  readonly speakers?: SpeakerDiarization[]
  readonly emotions?: EmotionAnalysis[]
  readonly music?: MusicAnalysis
  readonly soundEvents?: SoundEvent[]
  readonly quality: AudioQualityMetrics
  readonly language?: LanguageDetection
}

export interface TranscriptionResult {
  readonly text: string
  readonly confidence: number
  readonly words: WordTiming[]
  readonly paragraphs: string[]
  readonly language: string
  readonly alternatives?: AlternativeTranscript[]
}

export interface WordTiming {
  readonly word: string
  readonly start: number // seconds
  readonly end: number // seconds
  readonly confidence: number
  readonly speaker?: string
}

export interface AlternativeTranscript {
  readonly text: string
  readonly confidence: number
}

export interface AudioSegment {
  readonly start: number
  readonly end: number
  readonly type: 'speech' | 'music' | 'silence' | 'noise'
  readonly confidence: number
  readonly features?: SegmentFeatures
}

export interface SegmentFeatures {
  readonly volume: number // 0-1
  readonly pitch?: number // Hz
  readonly tempo?: number // BPM
  readonly energy: number // 0-1
}

export interface SpeakerDiarization {
  readonly speakerId: string
  readonly segments: Array<{
    readonly start: number
    readonly end: number
    readonly confidence: number
  }>
  readonly gender?: 'male' | 'female' | 'unknown'
  readonly age?: 'child' | 'youth' | 'adult' | 'senior'
  readonly embedding?: number[]
}

export interface EmotionAnalysis {
  readonly start: number
  readonly end: number
  readonly emotions: Map<string, number> // emotion -> confidence
  readonly dominantEmotion: string
  readonly arousal: number // -1 to 1
  readonly valence: number // -1 to 1
}

export interface MusicAnalysis {
  readonly genre?: string[]
  readonly key?: string
  readonly tempo?: number // BPM
  readonly timeSignature?: string
  readonly instruments?: string[]
  readonly mood?: string[]
  readonly energy: number // 0-1
  readonly danceability: number // 0-1
}

export interface SoundEvent {
  readonly start: number
  readonly end: number
  readonly type: string // e.g., 'dog_bark', 'car_horn', 'door_slam'
  readonly confidence: number
  readonly loudness: number // dB
}

export interface AudioQualityMetrics {
  readonly signalToNoise: number // dB
  readonly clarity: number // 0-1
  readonly distortion: number // 0-1
  readonly clipping: boolean
  readonly backgroundNoise: number // 0-1
  readonly overallQuality: number // 0-1
}

export interface LanguageDetection {
  readonly primary: string
  readonly confidence: number
  readonly alternatives: Array<{
    readonly language: string
    readonly confidence: number
  }>
}

export interface AudioTransformOptions {
  readonly trimSilence?: boolean
  readonly normalizeVolume?: boolean
  readonly removeNoise?: boolean
  readonly changeTempo?: number // multiplier
  readonly changePitch?: number // semitones
  readonly extractChannel?: number
  readonly resample?: number // target sample rate
  readonly format?: 'wav' | 'mp3' | 'ogg'
}

export interface AudioPromptContext {
  readonly audio: Buffer
  readonly prompt: string
  readonly focusTime?: { start: number; end: number }
  readonly previousContext?: string[]
  readonly outputFormat?: 'text' | 'json' | 'structured' | 'timed'
}

export interface AudioGenerationOptions {
  readonly voice?: string
  readonly speed?: number // 0.5 to 2.0
  readonly pitch?: number // -20 to 20 semitones
  readonly emotion?: string
  readonly style?: 'conversational' | 'narrative' | 'professional'
  readonly language?: string
}

// ============================================================================
// Audio Adapter Implementation
// ============================================================================

export class AudioAdapter {
  private config: {
    readonly maxAudioSize: number
    readonly supportedFormats: string[]
    readonly enableTranscription: boolean
    readonly enableDiarization: boolean
    readonly enableEmotionDetection: boolean
    readonly enableMusicAnalysis: boolean
    readonly cacheResults: boolean
    readonly defaultLanguage: string
  }

  private cache: Map<string, AudioAnalysisResult> = new Map()

  constructor(config?: Partial<typeof AudioAdapter.prototype.config>) {
    this.config = {
      maxAudioSize: 100 * 1024 * 1024, // 100MB
      supportedFormats: ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'webm'],
      enableTranscription: true,
      enableDiarization: false,
      enableEmotionDetection: false,
      enableMusicAnalysis: false,
      cacheResults: true,
      defaultLanguage: 'en',
      ...config
    }
  }

  /**
   * Process audio and extract metadata
   */
  processAudio(audio: Buffer): Effect.Effect<AudioMetadata, Error> {
    return Effect.gen(
      function* (_) {
        // Validate audio size
        if (audio.length > this.config.maxAudioSize) {
          return yield* _(
            Effect.fail(new Error(`Audio size ${audio.length} exceeds maximum ${this.config.maxAudioSize}`))
          )
        }

        // Extract metadata (simplified - would use ffprobe or similar in production)
        const metadata = yield* _(this.extractMetadata(audio))

        // Validate format
        if (!this.config.supportedFormats.includes(metadata.format)) {
          return yield* _(Effect.fail(new Error(`Unsupported audio format: ${metadata.format}`)))
        }

        return metadata
      }.bind(this)
    )
  }

  /**
   * Transcribe audio to text
   */
  transcribe(
    audio: Buffer,
    options?: {
      language?: string
      timestamps?: boolean
      speakerLabels?: boolean
    }
  ): Effect.Effect<TranscriptionResult, Error> {
    return Effect.gen(
      function* (_) {
        if (!this.config.enableTranscription) {
          return yield* _(Effect.fail(new Error('Transcription is disabled')))
        }

        const metadata = yield* _(this.processAudio(audio))

        // Perform transcription (simplified - would use Whisper or similar)
        const transcript = yield* _(
          this.performTranscription(
            audio,
            options?.language || this.config.defaultLanguage,
            options?.timestamps ?? true
          )
        )

        // Add speaker labels if requested and diarization is enabled
        if (options?.speakerLabels && this.config.enableDiarization) {
          const speakers = yield* _(this.performDiarization(audio))
          transcript.words = this.assignSpeakerLabels(transcript.words, speakers)
        }

        return transcript
      }.bind(this)
    )
  }

  /**
   * Perform comprehensive audio analysis
   */
  analyzeAudio(audio: Buffer): Effect.Effect<AudioAnalysisResult, Error> {
    return Effect.gen(
      function* (_) {
        // Check cache
        const cacheKey = this.getCacheKey(audio)
        if (this.config.cacheResults && this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey)!
        }

        // Process audio
        const metadata = yield* _(this.processAudio(audio))

        // Parallel analysis tasks
        const tasks: Effect.Effect<any, Error>[] = [
          this.detectSegments(audio),
          this.assessQuality(audio),
          this.detectLanguage(audio)
        ]

        if (this.config.enableTranscription) {
          tasks.push(this.transcribe(audio))
        }

        if (this.config.enableDiarization) {
          tasks.push(this.performDiarization(audio))
        }

        if (this.config.enableEmotionDetection) {
          tasks.push(this.detectEmotions(audio))
        }

        if (this.config.enableMusicAnalysis) {
          tasks.push(this.analyzeMusic(audio))
        }

        tasks.push(this.detectSoundEvents(audio))

        const results = yield* _(Effect.all(tasks))

        const result: AudioAnalysisResult = {
          metadata,
          segments: results[0],
          quality: results[1],
          language: results[2],
          transcript: this.config.enableTranscription ? results[3] : undefined,
          speakers: this.config.enableDiarization ? results[this.config.enableTranscription ? 4 : 3] : undefined,
          emotions: this.config.enableEmotionDetection
            ? results[this.config.enableTranscription ? (this.config.enableDiarization ? 5 : 4) : 3]
            : undefined,
          music: this.config.enableMusicAnalysis ? results[results.length - 2] : undefined,
          soundEvents: results[results.length - 1]
        }

        // Cache result
        if (this.config.cacheResults) {
          this.cache.set(cacheKey, result)
        }

        return result
      }.bind(this)
    )
  }

  /**
   * Answer questions about audio
   */
  queryAudio(context: AudioPromptContext): Effect.Effect<string, Error> {
    return Effect.gen(
      function* (_) {
        const analysis = yield* _(this.analyzeAudio(context.audio))

        // Process the query based on the prompt
        const response = yield* _(
          this.processAudioQuery(analysis, context.prompt, context.focusTime, context.previousContext)
        )

        // Format output
        if (context.outputFormat === 'json') {
          return JSON.stringify(response, null, 2)
        } else if (context.outputFormat === 'structured') {
          return this.formatStructuredResponse(response)
        } else if (context.outputFormat === 'timed' && analysis.transcript) {
          return this.formatTimedTranscript(analysis.transcript)
        } else {
          return typeof response === 'string' ? response : String(response)
        }
      }.bind(this)
    )
  }

  /**
   * Compare two audio files
   */
  compareAudio(
    audio1: Buffer,
    audio2: Buffer,
    aspects?: ('content' | 'quality' | 'speakers' | 'emotion')[]
  ): Effect.Effect<
    {
      similarity: number
      differences: string[]
      analysis: {
        audio1: AudioAnalysisResult
        audio2: AudioAnalysisResult
      }
    },
    Error
  > {
    return Effect.gen(
      function* (_) {
        const [analysis1, analysis2] = yield* _(Effect.all([this.analyzeAudio(audio1), this.analyzeAudio(audio2)]))

        const aspectsToCompare = aspects || ['content', 'quality']
        const similarities: number[] = []
        const differences: string[] = []

        if (aspectsToCompare.includes('content') && analysis1.transcript && analysis2.transcript) {
          const contentSim = this.compareTranscripts(analysis1.transcript, analysis2.transcript)
          similarities.push(contentSim.similarity)
          differences.push(...contentSim.differences)
        }

        if (aspectsToCompare.includes('quality')) {
          const qualitySim = this.compareQuality(analysis1.quality, analysis2.quality)
          similarities.push(qualitySim.similarity)
          differences.push(...qualitySim.differences)
        }

        if (aspectsToCompare.includes('speakers') && analysis1.speakers && analysis2.speakers) {
          const speakerSim = this.compareSpeakers(analysis1.speakers, analysis2.speakers)
          similarities.push(speakerSim.similarity)
          differences.push(...speakerSim.differences)
        }

        if (aspectsToCompare.includes('emotion') && analysis1.emotions && analysis2.emotions) {
          const emotionSim = this.compareEmotions(analysis1.emotions, analysis2.emotions)
          similarities.push(emotionSim.similarity)
          differences.push(...emotionSim.differences)
        }

        const overallSimilarity =
          similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0

        return {
          similarity: overallSimilarity,
          differences,
          analysis: { audio1: analysis1, audio2: analysis2 }
        }
      }.bind(this)
    )
  }

  /**
   * Transform audio
   */
  transformAudio(audio: Buffer, options: AudioTransformOptions): Effect.Effect<Buffer, Error> {
    return Effect.gen(
      function* (_) {
        let result = audio

        // Apply transformations (simplified - would use ffmpeg in production)
        if (options.trimSilence) {
          result = yield* _(this.trimSilence(result))
        }

        if (options.normalizeVolume) {
          result = yield* _(this.normalizeVolume(result))
        }

        if (options.removeNoise) {
          result = yield* _(this.removeNoise(result))
        }

        if (options.changeTempo) {
          result = yield* _(this.changeTempo(result, options.changeTempo))
        }

        if (options.changePitch) {
          result = yield* _(this.changePitch(result, options.changePitch))
        }

        if (options.resample) {
          result = yield* _(this.resample(result, options.resample))
        }

        if (options.format) {
          result = yield* _(this.convertFormat(result, options.format))
        }

        return result
      }.bind(this)
    )
  }

  /**
   * Generate audio from text
   */
  generateSpeech(text: string, options?: AudioGenerationOptions): Effect.Effect<Buffer, Error> {
    return Effect.gen(
      function* (_) {
        // Simplified TTS generation
        const config = {
          voice: options?.voice || 'default',
          speed: options?.speed || 1.0,
          pitch: options?.pitch || 0,
          emotion: options?.emotion || 'neutral',
          style: options?.style || 'conversational',
          language: options?.language || this.config.defaultLanguage
        }

        // Generate speech (would use TTS service in production)
        const audio = yield* _(this.synthesizeSpeech(text, config))

        return audio
      }.bind(this)
    )
  }

  /**
   * Stream process multiple audio files
   */
  streamProcessAudio(audioFiles: Stream.Stream<Buffer, never>): Stream.Stream<AudioAnalysisResult, Error> {
    return pipe(
      audioFiles,
      Stream.mapEffect((audio) => this.analyzeAudio(audio))
    )
  }

  /**
   * Extract audio snippets based on timestamps
   */
  extractSnippet(audio: Buffer, start: number, end: number): Effect.Effect<Buffer, Error> {
    return Effect.gen(
      function* (_) {
        const metadata = yield* _(this.processAudio(audio))

        if (start < 0 || end > metadata.duration) {
          return yield* _(Effect.fail(new Error('Invalid time range')))
        }

        // Extract snippet (would use ffmpeg in production)
        const snippet = yield* _(this.extractAudioSegment(audio, start, end))

        return snippet
      }.bind(this)
    )
  }

  // Private helper methods

  private extractMetadata(audio: Buffer): Effect.Effect<AudioMetadata, Error> {
    // Simplified metadata extraction
    return Effect.succeed({
      duration: 180, // 3 minutes
      sampleRate: 44100,
      channels: 2,
      bitDepth: 16,
      format: 'mp3' as const,
      codec: 'mp3',
      bitrate: 128,
      fileSize: audio.length
    })
  }

  private performTranscription(
    audio: Buffer,
    language: string,
    timestamps: boolean
  ): Effect.Effect<TranscriptionResult, never> {
    // Simplified transcription
    return Effect.succeed({
      text: 'This is a sample transcription of the audio content.',
      confidence: 0.95,
      words: timestamps
        ? [
            { word: 'This', start: 0, end: 0.3, confidence: 0.98 },
            { word: 'is', start: 0.3, end: 0.5, confidence: 0.99 },
            { word: 'a', start: 0.5, end: 0.6, confidence: 0.99 },
            { word: 'sample', start: 0.6, end: 1.0, confidence: 0.95 },
            { word: 'transcription', start: 1.0, end: 1.8, confidence: 0.93 }
          ]
        : [],
      paragraphs: ['This is a sample transcription of the audio content.'],
      language
    })
  }

  private detectSegments(audio: Buffer): Effect.Effect<AudioSegment[], never> {
    // Simplified segment detection
    return Effect.succeed([
      {
        start: 0,
        end: 10,
        type: 'speech' as const,
        confidence: 0.95,
        features: {
          volume: 0.7,
          pitch: 150,
          energy: 0.8
        }
      },
      {
        start: 10,
        end: 15,
        type: 'silence' as const,
        confidence: 0.99,
        features: {
          volume: 0.1,
          energy: 0.1
        }
      },
      {
        start: 15,
        end: 45,
        type: 'music' as const,
        confidence: 0.88,
        features: {
          volume: 0.6,
          tempo: 120,
          energy: 0.7
        }
      }
    ])
  }

  private performDiarization(audio: Buffer): Effect.Effect<SpeakerDiarization[], never> {
    // Simplified speaker diarization
    return Effect.succeed([
      {
        speakerId: 'speaker1',
        segments: [
          { start: 0, end: 10, confidence: 0.92 },
          { start: 45, end: 60, confidence: 0.88 }
        ],
        gender: 'male' as const,
        age: 'adult' as const
      },
      {
        speakerId: 'speaker2',
        segments: [
          { start: 10, end: 30, confidence: 0.9 },
          { start: 60, end: 80, confidence: 0.85 }
        ],
        gender: 'female' as const,
        age: 'adult' as const
      }
    ])
  }

  private detectEmotions(audio: Buffer): Effect.Effect<EmotionAnalysis[], never> {
    // Simplified emotion detection
    return Effect.succeed([
      {
        start: 0,
        end: 10,
        emotions: new Map([
          ['happy', 0.7],
          ['neutral', 0.2],
          ['sad', 0.1]
        ]),
        dominantEmotion: 'happy',
        arousal: 0.6,
        valence: 0.7
      }
    ])
  }

  private analyzeMusic(audio: Buffer): Effect.Effect<MusicAnalysis, never> {
    // Simplified music analysis
    return Effect.succeed({
      genre: ['pop', 'electronic'],
      key: 'C major',
      tempo: 120,
      timeSignature: '4/4',
      instruments: ['vocals', 'synthesizer', 'drums'],
      mood: ['upbeat', 'energetic'],
      energy: 0.8,
      danceability: 0.75
    })
  }

  private detectSoundEvents(audio: Buffer): Effect.Effect<SoundEvent[], never> {
    // Simplified sound event detection
    return Effect.succeed([
      {
        start: 25,
        end: 26,
        type: 'door_slam',
        confidence: 0.85,
        loudness: -10
      },
      {
        start: 40,
        end: 41,
        type: 'phone_ring',
        confidence: 0.92,
        loudness: -15
      }
    ])
  }

  private assessQuality(audio: Buffer): Effect.Effect<AudioQualityMetrics, never> {
    // Simplified quality assessment
    return Effect.succeed({
      signalToNoise: 35,
      clarity: 0.85,
      distortion: 0.1,
      clipping: false,
      backgroundNoise: 0.2,
      overallQuality: 0.8
    })
  }

  private detectLanguage(audio: Buffer): Effect.Effect<LanguageDetection, never> {
    // Simplified language detection
    return Effect.succeed({
      primary: 'en',
      confidence: 0.95,
      alternatives: [
        { language: 'es', confidence: 0.03 },
        { language: 'fr', confidence: 0.02 }
      ]
    })
  }

  private assignSpeakerLabels(words: WordTiming[], speakers: SpeakerDiarization[]): WordTiming[] {
    return words.map((word) => {
      const speaker = speakers.find((s) => s.segments.some((seg) => word.start >= seg.start && word.end <= seg.end))

      return {
        ...word,
        speaker: speaker?.speakerId
      }
    })
  }

  private processAudioQuery(
    analysis: AudioAnalysisResult,
    prompt: string,
    focusTime?: { start: number; end: number },
    previousContext?: string[]
  ): Effect.Effect<any, never> {
    // Simplified query processing
    const lowerPrompt = prompt.toLowerCase()

    if (lowerPrompt.includes('transcribe') || lowerPrompt.includes('transcript')) {
      return Effect.succeed(analysis.transcript?.text || 'No transcript available')
    }

    if (lowerPrompt.includes('speaker') && analysis.speakers) {
      return Effect.succeed(`Detected ${analysis.speakers.length} speakers`)
    }

    if (lowerPrompt.includes('emotion') && analysis.emotions) {
      const emotions = analysis.emotions[0]
      return Effect.succeed(`Dominant emotion: ${emotions.dominantEmotion}`)
    }

    if (lowerPrompt.includes('music') && analysis.music) {
      return Effect.succeed(`Genre: ${analysis.music.genre?.join(', ')}, Tempo: ${analysis.music.tempo} BPM`)
    }

    if (lowerPrompt.includes('quality')) {
      return Effect.succeed(`Audio quality score: ${analysis.quality.overallQuality.toFixed(2)}`)
    }

    return Effect.succeed(analysis.transcript?.text || 'Audio processed successfully')
  }

  private formatStructuredResponse(response: any): string {
    if (typeof response === 'string') return response

    return Object.entries(response)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
  }

  private formatTimedTranscript(transcript: TranscriptionResult): string {
    return transcript.words.map((w) => `[${w.start.toFixed(2)}s] ${w.word}`).join(' ')
  }

  private getCacheKey(audio: Buffer): string {
    // Simple hash for caching
    return `audio-${audio.length}-${audio[0]}-${audio[audio.length - 1]}`
  }

  private compareTranscripts(
    t1: TranscriptionResult,
    t2: TranscriptionResult
  ): { similarity: number; differences: string[] } {
    const differences: string[] = []

    // Simple text similarity
    const words1 = t1.text.toLowerCase().split(/\s+/)
    const words2 = t2.text.toLowerCase().split(/\s+/)

    const intersection = words1.filter((w) => words2.includes(w))
    const union = new Set([...words1, ...words2])

    const similarity = intersection.length / union.size

    if (similarity < 0.7) {
      differences.push('Different transcription content')
    }

    if (t1.language !== t2.language) {
      differences.push(`Different languages: ${t1.language} vs ${t2.language}`)
    }

    return { similarity, differences }
  }

  private compareQuality(
    q1: AudioQualityMetrics,
    q2: AudioQualityMetrics
  ): { similarity: number; differences: string[] } {
    const differences: string[] = []

    const metrics = ['clarity', 'distortion', 'overallQuality'] as const
    const diffs = metrics.map((metric) => Math.abs(q1[metric] - q2[metric]))

    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const similarity = 1 - avgDiff

    if (avgDiff > 0.3) {
      differences.push('Significant quality differences')
    }

    if (q1.clipping !== q2.clipping) {
      differences.push('Different clipping status')
    }

    return { similarity, differences }
  }

  private compareSpeakers(
    s1: SpeakerDiarization[],
    s2: SpeakerDiarization[]
  ): { similarity: number; differences: string[] } {
    const differences: string[] = []

    if (s1.length !== s2.length) {
      differences.push(`Different speaker count: ${s1.length} vs ${s2.length}`)
    }

    const similarity = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)

    return { similarity, differences }
  }

  private compareEmotions(e1: EmotionAnalysis[], e2: EmotionAnalysis[]): { similarity: number; differences: string[] } {
    const differences: string[] = []

    const emotions1 = e1.map((e) => e.dominantEmotion)
    const emotions2 = e2.map((e) => e.dominantEmotion)

    const common = emotions1.filter((e) => emotions2.includes(e))
    const similarity = common.length / Math.max(emotions1.length, emotions2.length)

    if (similarity < 0.5) {
      differences.push('Different emotional content')
    }

    return { similarity, differences }
  }

  // Transformation methods (simplified - would use ffmpeg in production)

  private trimSilence(audio: Buffer): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio)
  }

  private normalizeVolume(audio: Buffer): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio)
  }

  private removeNoise(audio: Buffer): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio)
  }

  private changeTempo(audio: Buffer, multiplier: number): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio)
  }

  private changePitch(audio: Buffer, semitones: number): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio)
  }

  private resample(audio: Buffer, targetRate: number): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio)
  }

  private convertFormat(audio: Buffer, format: string): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio)
  }

  private synthesizeSpeech(text: string, config: any): Effect.Effect<Buffer, never> {
    // Placeholder TTS
    return Effect.succeed(Buffer.from('synthesized audio'))
  }

  private extractAudioSegment(audio: Buffer, start: number, end: number): Effect.Effect<Buffer, never> {
    return Effect.succeed(audio.slice(0, Math.floor((audio.length * (end - start)) / 180)))
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default audio adapter
 */
export function createAudioAdapter(config?: Partial<AudioAdapter['config']>): AudioAdapter {
  return new AudioAdapter(config)
}

/**
 * Create production audio adapter
 */
export function createProductionAudioAdapter(): AudioAdapter {
  return new AudioAdapter({
    maxAudioSize: 200 * 1024 * 1024, // 200MB
    enableTranscription: true,
    enableDiarization: true,
    enableEmotionDetection: true,
    enableMusicAnalysis: true,
    cacheResults: true
  })
}

/**
 * Create minimal audio adapter
 */
export function createMinimalAudioAdapter(): AudioAdapter {
  return new AudioAdapter({
    enableTranscription: true,
    enableDiarization: false,
    enableEmotionDetection: false,
    enableMusicAnalysis: false,
    cacheResults: false
  })
}

/**
 * Create speech-focused adapter
 */
export function createSpeechAdapter(): AudioAdapter {
  return new AudioAdapter({
    enableTranscription: true,
    enableDiarization: true,
    enableEmotionDetection: true,
    enableMusicAnalysis: false,
    cacheResults: true
  })
}

/**
 * Create music-focused adapter
 */
export function createMusicAdapter(): AudioAdapter {
  return new AudioAdapter({
    enableTranscription: false,
    enableDiarization: false,
    enableEmotionDetection: false,
    enableMusicAnalysis: true,
    cacheResults: true
  })
}
