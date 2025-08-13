import { describe, test, expect } from 'bun:test'
import {
  isBinaryFile,
  categorizeFile,
  categorizeProjectFiles,
  getSummarizationStats,
  getFileCountDescription
} from './file-categorization'
import type { ProjectFile } from '@promptliano/schemas'

// Helper to create test files
function createTestFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: 1,
    projectId: 1,
    name: 'test.ts',
    path: '/src/test.ts',
    extension: 'ts',
    size: 1000,
    content: 'test content',
    summary: null,
    summaryLastUpdated: null,
    meta: null,
    checksum: 'abc123',
    imports: [],
    exports: [],
    created: Date.now(),
    updated: Date.now(),
    ...overrides
  }
}

describe('file-categorization', () => {
  describe('isBinaryFile', () => {
    test('identifies common binary image formats', () => {
      const imageFiles = [
        'photo.jpg',
        'photo.jpeg',
        'image.png',
        'animated.gif',
        'icon.ico',
        'vector.svg',
        'modern.webp'
      ]

      imageFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('identifies video formats', () => {
      const videoFiles = [
        'movie.mp4',
        'video.avi',
        'clip.mov',
        'film.mkv',
        'web.webm'
      ]

      videoFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('identifies audio formats', () => {
      const audioFiles = [
        'song.mp3',
        'sound.wav',
        'music.flac',
        'audio.aac',
        'track.ogg'
      ]

      audioFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('identifies archive formats', () => {
      const archiveFiles = [
        'archive.zip',
        'backup.tar',
        'compressed.gz',
        'archive.rar',
        'package.7z'
      ]

      archiveFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('identifies document formats', () => {
      const docFiles = [
        'document.pdf',
        'report.doc',
        'presentation.pptx',
        'spreadsheet.xlsx'
      ]

      docFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('identifies executable formats', () => {
      const execFiles = [
        'program.exe',
        'library.dll',
        'shared.so',
        'dynamic.dylib'
      ]

      execFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('identifies font formats', () => {
      const fontFiles = [
        'font.ttf',
        'font.otf',
        'web.woff',
        'web2.woff2'
      ]

      fontFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('identifies model/data formats', () => {
      const dataFiles = [
        'model.pkl',
        'weights.h5',
        'network.onnx',
        'data.sqlite'
      ]

      dataFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(true)
      })
    })

    test('returns false for text files', () => {
      const textFiles = [
        'script.js',
        'component.tsx',
        'styles.css',
        'config.json',
        'README.md',
        'index.html',
        'config.yaml',
        'script.py',
        'Makefile',
        '.gitignore'
      ]

      textFiles.forEach(file => {
        expect(isBinaryFile(file)).toBe(false)
      })
    })

    test('is case insensitive', () => {
      expect(isBinaryFile('IMAGE.JPG')).toBe(true)
      expect(isBinaryFile('Document.PDF')).toBe(true)
      expect(isBinaryFile('ARCHIVE.ZIP')).toBe(true)
    })

    test('handles paths with directories', () => {
      expect(isBinaryFile('/path/to/image.jpg')).toBe(true)
      expect(isBinaryFile('C:\\Users\\Documents\\file.pdf')).toBe(true)
      expect(isBinaryFile('./relative/path/video.mp4')).toBe(true)
    })

    test('handles files without extensions', () => {
      expect(isBinaryFile('README')).toBe(false)
      expect(isBinaryFile('Makefile')).toBe(false)
      expect(isBinaryFile('LICENSE')).toBe(false)
    })

    test('handles dotfiles', () => {
      expect(isBinaryFile('.gitignore')).toBe(false)
      expect(isBinaryFile('.env')).toBe(false)
      expect(isBinaryFile('.DS_Store')).toBe(false)
    })
  })

  describe('categorizeFile', () => {
    test('categorizes summarized files', () => {
      const file = createTestFile({ summary: 'This file does something' })
      const result = categorizeFile(file)

      expect(result.category).toBe('summarized')
      expect(result.reason).toBeUndefined()
    })

    test('categorizes binary files', () => {
      const file = createTestFile({ path: '/assets/logo.png' })
      const result = categorizeFile(file)

      expect(result.category).toBe('binary')
      expect(result.reason).toBe('Binary file type')
    })

    test('categorizes large files', () => {
      const file = createTestFile({ 
        size: 2 * 1024 * 1024, // 2MB
        content: 'large content'
      })
      const result = categorizeFile(file)

      expect(result.category).toBe('too-large')
      expect(result.reason).toContain('exceeds 1MB limit')
      expect(result.reason).toContain('2.00MB')
    })

    test('categorizes empty files', () => {
      const emptyContentFile = createTestFile({ content: '' })
      const nullContentFile = createTestFile({ content: null })
      const whitespaceFile = createTestFile({ content: '   \n\t  ' })

      expect(categorizeFile(emptyContentFile).category).toBe('empty')
      expect(categorizeFile(nullContentFile).category).toBe('empty')
      expect(categorizeFile(whitespaceFile).category).toBe('empty')
      
      expect(categorizeFile(emptyContentFile).reason).toContain('empty')
    })

    test('categorizes pending files', () => {
      const file = createTestFile({ 
        summary: null,
        content: 'valid content',
        size: 500
      })
      const result = categorizeFile(file)

      expect(result.category).toBe('pending')
      expect(result.reason).toBe('Awaiting summarization')
    })

    test('prioritizes summarized over binary', () => {
      const file = createTestFile({ 
        path: '/image.jpg',
        summary: 'An image file'
      })
      const result = categorizeFile(file)

      expect(result.category).toBe('summarized')
    })

    test('handles edge case file sizes', () => {
      const exactLimit = createTestFile({ 
        size: 1024 * 1024, // Exactly 1MB
        content: 'content'
      })
      const justOver = createTestFile({ 
        size: 1024 * 1024 + 1, // Just over 1MB
        content: 'content'
      })

      expect(categorizeFile(exactLimit).category).toBe('pending')
      expect(categorizeFile(justOver).category).toBe('too-large')
    })
  })

  describe('categorizeProjectFiles', () => {
    test('categorizes multiple files correctly', () => {
      const files = [
        createTestFile({ id: 1, summary: 'Summarized file' }),
        createTestFile({ id: 2, path: '/image.jpg' }),
        createTestFile({ id: 3, size: 2 * 1024 * 1024 }),
        createTestFile({ id: 4, content: '' }),
        createTestFile({ id: 5, content: 'pending content' })
      ]

      const result = categorizeProjectFiles(files)

      expect(result.summarized).toHaveLength(1)
      expect(result.binary).toHaveLength(1)
      expect(result.tooLarge).toHaveLength(1)
      expect(result.empty).toHaveLength(1)
      expect(result.pending).toHaveLength(1)
      expect(result.error).toHaveLength(0)
    })

    test('populates summarizable array correctly', () => {
      const files = [
        createTestFile({ id: 1, content: 'pending' }), // pending - summarizable
        createTestFile({ id: 2, path: '/image.jpg' }), // binary - not summarizable
        createTestFile({ id: 3, summary: 'done' }) // summarized - not in summarizable
      ]

      const result = categorizeProjectFiles(files)

      expect(result.summarizable).toHaveLength(1)
      expect(result.summarizable[0].id).toBe(1)
    })

    test('populates nonSummarizable array correctly', () => {
      const files = [
        createTestFile({ id: 1, path: '/image.jpg' }), // binary
        createTestFile({ id: 2, size: 2 * 1024 * 1024 }), // too large
        createTestFile({ id: 3, content: '' }), // empty
        createTestFile({ id: 4, content: 'valid' }) // pending - not included
      ]

      const result = categorizeProjectFiles(files)

      expect(result.nonSummarizable).toHaveLength(3)
      expect(result.nonSummarizable.map(f => f.id)).toEqual([1, 2, 3])
    })

    test('handles empty file list', () => {
      const result = categorizeProjectFiles([])

      expect(result.summarized).toEqual([])
      expect(result.pending).toEqual([])
      expect(result.binary).toEqual([])
      expect(result.tooLarge).toEqual([])
      expect(result.empty).toEqual([])
      expect(result.error).toEqual([])
      expect(result.summarizable).toEqual([])
      expect(result.nonSummarizable).toEqual([])
    })

    test('handles all files of same category', () => {
      const allSummarized = Array.from({ length: 5 }, (_, i) => 
        createTestFile({ id: i, summary: `Summary ${i}` })
      )

      const result = categorizeProjectFiles(allSummarized)

      expect(result.summarized).toHaveLength(5)
      expect(result.pending).toHaveLength(0)
      expect(result.summarizable).toHaveLength(0)
    })
  })

  describe('getSummarizationStats', () => {
    test('calculates statistics correctly', () => {
      const files = [
        createTestFile({ id: 1, summary: 'done' }),
        createTestFile({ id: 2, summary: 'done' }),
        createTestFile({ id: 3, content: 'pending' }),
        createTestFile({ id: 4, path: '/image.jpg' }),
        createTestFile({ id: 5, size: 2 * 1024 * 1024 }),
        createTestFile({ id: 6, content: '' })
      ]

      const stats = getSummarizationStats(files)

      expect(stats.total).toBe(6)
      expect(stats.summarized).toBe(2)
      expect(stats.pending).toBe(1)
      expect(stats.binary).toBe(1)
      expect(stats.tooLarge).toBe(1)
      expect(stats.empty).toBe(1)
      expect(stats.error).toBe(0)
      expect(stats.summarizable).toBe(3) // summarized + pending + error
      expect(stats.nonSummarizable).toBe(3) // binary + tooLarge + empty
    })

    test('calculates coverage percentage correctly', () => {
      const files = [
        createTestFile({ id: 1, summary: 'done' }),
        createTestFile({ id: 2, summary: 'done' }),
        createTestFile({ id: 3, content: 'pending' }),
        createTestFile({ id: 4, content: 'pending' })
      ]

      const stats = getSummarizationStats(files)

      expect(stats.coveragePercentage).toBe(50) // 2 of 4 summarizable
      expect(stats.totalPercentage).toBe(50) // 2 of 4 total
    })

    test('handles zero summarizable files', () => {
      const files = [
        createTestFile({ id: 1, path: '/image.jpg' }),
        createTestFile({ id: 2, content: '' })
      ]

      const stats = getSummarizationStats(files)

      expect(stats.summarizable).toBe(0)
      expect(stats.coveragePercentage).toBe(0)
    })

    test('handles all files summarized', () => {
      const files = [
        createTestFile({ id: 1, summary: 'done' }),
        createTestFile({ id: 2, summary: 'done' })
      ]

      const stats = getSummarizationStats(files)

      expect(stats.coveragePercentage).toBe(100)
      expect(stats.totalPercentage).toBe(100)
    })

    test('handles empty file list', () => {
      const stats = getSummarizationStats([])

      expect(stats.total).toBe(0)
      expect(stats.summarized).toBe(0)
      expect(stats.coveragePercentage).toBe(0)
      expect(stats.totalPercentage).toBe(0)
    })

    test('correctly counts each category', () => {
      const files = [
        // 3 summarized
        ...Array.from({ length: 3 }, (_, i) => 
          createTestFile({ id: i, summary: 'done' })
        ),
        // 2 pending
        ...Array.from({ length: 2 }, (_, i) => 
          createTestFile({ id: i + 3, content: 'pending' })
        ),
        // 1 binary
        createTestFile({ id: 5, path: '/file.jpg' }),
        // 1 too large
        createTestFile({ id: 6, size: 2 * 1024 * 1024 }),
        // 1 empty
        createTestFile({ id: 7, content: '' })
      ]

      const stats = getSummarizationStats(files)

      expect(stats.summarized).toBe(3)
      expect(stats.pending).toBe(2)
      expect(stats.binary).toBe(1)
      expect(stats.tooLarge).toBe(1)
      expect(stats.empty).toBe(1)
    })
  })

  describe('getFileCountDescription', () => {
    test('formats single file correctly', () => {
      const result = getFileCountDescription(1, 10)
      
      expect(result).toBe('1 file (10.0%)')
    })

    test('formats multiple files correctly', () => {
      const result = getFileCountDescription(5, 10)
      
      expect(result).toBe('5 files (50.0%)')
    })

    test('handles zero files', () => {
      const result = getFileCountDescription(0, 10)
      
      expect(result).toBe('0 files (0.0%)')
    })

    test('handles zero total', () => {
      const result = getFileCountDescription(0, 0)
      
      expect(result).toBe('0 files (0%)')
    })

    test('handles 100% coverage', () => {
      const result = getFileCountDescription(10, 10)
      
      expect(result).toBe('10 files (100.0%)')
    })

    test('rounds percentage to one decimal', () => {
      const result = getFileCountDescription(1, 3)
      
      expect(result).toBe('1 file (33.3%)')
    })

    test('handles very small percentages', () => {
      const result = getFileCountDescription(1, 1000)
      
      expect(result).toBe('1 file (0.1%)')
    })

    test('handles count greater than total (edge case)', () => {
      const result = getFileCountDescription(11, 10)
      
      expect(result).toBe('11 files (110.0%)')
    })
  })
})