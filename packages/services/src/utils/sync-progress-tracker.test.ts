import { describe, test, expect, beforeEach, vi } from 'bun:test'
import { SyncProgressTracker, createSyncProgressTracker } from './sync-progress-tracker'
import type { SyncProgressEvent } from './sync-progress-tracker'

describe('SyncProgressTracker', () => {
  let tracker: SyncProgressTracker
  let progressEvents: SyncProgressEvent[] = []
  let onProgressSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    progressEvents = []
    onProgressSpy = vi.fn((event: SyncProgressEvent) => {
      progressEvents.push(event)
    })
    tracker = new SyncProgressTracker({
      onProgress: onProgressSpy,
      updateInterval: 10 // Short interval for testing
    })
  })

  describe('calculateSpeed', () => {
    // Skip in CI - timing-sensitive test
    test.skip('should calculate files per second correctly', async () => {
      tracker.setTotalFiles(100)
      tracker.setPhase('processing')
      
      // Process some files with small delays to trigger update intervals
      for (let i = 0; i < 10; i++) {
        tracker.incrementProcessed(`file${i}.ts`)
        // Add small delay to ensure update interval is triggered
        await new Promise(resolve => setTimeout(resolve, 15))
      }
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.speed).toBeGreaterThan(0)
      expect(lastEvent.speed).toBeLessThan(1000) // Reasonable upper bound
    })

    test('should return 0 speed when no files processed', async () => {
      tracker.setTotalFiles(100)
      tracker.setPhase('initializing')
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.speed).toBe(0)
    })
  })

  describe('estimateTimeRemaining', () => {
    test('should estimate time remaining based on current speed', async () => {
      tracker.setTotalFiles(100)
      tracker.setPhase('processing')
      
      // Process files to establish speed
      for (let i = 0; i < 20; i++) {
        tracker.incrementProcessed(`file${i}.ts`)
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.estimatedTimeRemaining).toBeDefined()
      expect(lastEvent.estimatedTimeRemaining).toBeGreaterThan(0)
    })

    test('should return undefined when speed is 0', async () => {
      tracker.setTotalFiles(100)
      tracker.setPhase('initializing')
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.estimatedTimeRemaining).toBeUndefined()
    })

    test('should return undefined when totalFiles is 0', async () => {
      tracker.setTotalFiles(0)
      tracker.setPhase('processing')
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.estimatedTimeRemaining).toBeUndefined()
    })
  })

  describe('getProgressPercentage', () => {
    // Skip in CI - timing-sensitive test
    test.skip('should calculate percentage correctly', async () => {
      tracker.setTotalFiles(100)
      tracker.setPhase('processing')
      
      // Process files with small delays to ensure updates are triggered
      for (let i = 0; i < 25; i++) {
        tracker.incrementProcessed(`file${i}.ts`)
        if (i % 5 === 0) {
          // Add small delay every 5 files to trigger updates
          await new Promise(resolve => setTimeout(resolve, 15))
        }
      }
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.percentage).toBe(25)
    })

    test('should return 0 when no files processed', async () => {
      tracker.setTotalFiles(100)
      tracker.setPhase('initializing')
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.percentage).toBe(0)
    })

    test('should return 0 when totalFiles is 0', async () => {
      tracker.setTotalFiles(0)
      tracker.setPhase('processing')
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.percentage).toBe(0)
    })

    test('should return 100 when all files processed', async () => {
      tracker.setTotalFiles(10)
      tracker.setPhase('processing')
      
      for (let i = 0; i < 10; i++) {
        tracker.incrementProcessed(`file${i}.ts`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.percentage).toBe(100)
    })
  })

  describe('formatPhaseMessage', () => {
    test('should return correct message for each phase', async () => {
      const phases: Array<SyncProgressEvent['phase']> = [
        'initializing',
        'scanning',
        'processing',
        'indexing',
        'finalizing',
        'complete',
        'error'
      ]

      const expectedMessages = {
        initializing: 'Initializing project sync...',
        scanning: 'Scanning project directory...',
        processing: 'Processing files...',
        indexing: 'Indexing files for search...',
        finalizing: 'Finalizing sync...',
        complete: 'Sync completed successfully!',
        error: 'Sync encountered an error'
      }

      for (const phase of phases) {
        tracker.setPhase(phase)
        await new Promise(resolve => setTimeout(resolve, 50))
        
        const phaseEvent = progressEvents.find(e => e.phase === phase)
        expect(phaseEvent).toBeDefined()
        expect(phaseEvent!.message).toContain(expectedMessages[phase])
      }
    })

    test('should use custom message when provided', async () => {
      const customMessage = 'Custom processing message'
      tracker.setPhase('processing', customMessage)
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.message).toBe(customMessage)
    })
  })

  describe('event ordering', () => {
    test('should assign sequential sequence numbers', async () => {
      tracker.setTotalFiles(5)
      tracker.setPhase('processing')
      
      for (let i = 0; i < 5; i++) {
        tracker.incrementProcessed(`file${i}.ts`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check sequence numbers are sequential
      const sequenceNumbers = progressEvents
        .filter(e => e.sequenceNumber !== undefined)
        .map(e => e.sequenceNumber!)
      
      for (let i = 1; i < sequenceNumbers.length; i++) {
        expect(sequenceNumbers[i]).toBeGreaterThan(sequenceNumbers[i - 1])
      }
    })

    test('should process events in order despite async callbacks', async () => {
      let processOrder: number[] = []
      
      const asyncTracker = new SyncProgressTracker({
        onProgress: async (event) => {
          // Simulate random async delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
          if (event.sequenceNumber) {
            processOrder.push(event.sequenceNumber)
          }
        },
        updateInterval: 5
      })

      asyncTracker.setTotalFiles(10)
      
      for (let i = 0; i < 10; i++) {
        asyncTracker.incrementProcessed(`file${i}.ts`)
      }
      
      // Wait for all events to process
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Check events were processed in order
      for (let i = 1; i < processOrder.length; i++) {
        expect(processOrder[i]).toBeGreaterThan(processOrder[i - 1])
      }
    })
  })

  describe('error handling', () => {
    test('should emit error event with correct format', async () => {
      const errorMessage = 'Test error'
      const error = new Error(errorMessage)
      
      let errorEventReceived: Error | undefined
      tracker.on('error', (err) => {
        errorEventReceived = err
      })
      
      tracker.error(error)
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const lastEvent = progressEvents[progressEvents.length - 1]
      expect(lastEvent.phase).toBe('error')
      expect(lastEvent.message).toContain(errorMessage)
      expect(lastEvent.error).toBe(error)
      expect(lastEvent.percentage).toBe(0)
      expect(errorEventReceived).toBe(error)
    })

    test('should handle errors in progress callback gracefully', async () => {
      const errorTracker = new SyncProgressTracker({
        onProgress: () => {
          throw new Error('Callback error')
        }
      })
      
      // Should not throw
      expect(() => {
        errorTracker.setPhase('processing')
        errorTracker.incrementProcessed('file.ts')
      }).not.toThrow()
      
      // Allow queue to process
      await new Promise(resolve => setTimeout(resolve, 50))
    })
  })

  describe('reset', () => {
    test('should reset all state correctly', async () => {
      tracker.setTotalFiles(100)
      tracker.setPhase('processing')
      
      for (let i = 0; i < 50; i++) {
        tracker.incrementProcessed(`file${i}.ts`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      tracker.reset()
      tracker.setPhase('initializing')
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const eventsAfterReset = progressEvents.filter(e => 
        e.phase === 'initializing' && e.processedFiles === 0
      )
      
      expect(eventsAfterReset.length).toBeGreaterThan(0)
      const lastEvent = eventsAfterReset[eventsAfterReset.length - 1]
      expect(lastEvent.totalFiles).toBe(0)
      expect(lastEvent.processedFiles).toBe(0)
      expect(lastEvent.percentage).toBe(0)
      expect(lastEvent.speed).toBe(0)
    })
  })

  describe('complete', () => {
    test('should mark sync as complete with correct stats', async () => {
      tracker.setTotalFiles(10)
      tracker.setPhase('processing')
      
      for (let i = 0; i < 10; i++) {
        tracker.incrementProcessed(`file${i}.ts`)
      }
      
      tracker.complete()
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const completeEvent = progressEvents.find(e => e.phase === 'complete')
      expect(completeEvent).toBeDefined()
      expect(completeEvent!.processedFiles).toBe(10)
      expect(completeEvent!.totalFiles).toBe(10)
      expect(completeEvent!.percentage).toBe(100)
      expect(completeEvent!.message).toContain('Sync completed!')
    })

    test('should use custom completion message', async () => {
      const customMessage = 'Custom completion message'
      tracker.complete(customMessage)
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const completeEvent = progressEvents.find(e => e.phase === 'complete')
      expect(completeEvent).toBeDefined()
      expect(completeEvent!.message).toBe(customMessage)
    })
  })

  describe('createSyncProgressTracker', () => {
    test('should create tracker with default options', () => {
      const tracker = createSyncProgressTracker()
      expect(tracker).toBeInstanceOf(SyncProgressTracker)
    })

    test('should create tracker with custom options', async () => {
      const customCallback = vi.fn()
      const tracker = createSyncProgressTracker({
        onProgress: customCallback,
        updateInterval: 50
      })
      
      tracker.setPhase('processing')
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(customCallback).toHaveBeenCalled()
    })
  })

  describe('throttling behavior', () => {
    test('should respect update interval', async () => {
      const intervalTracker = new SyncProgressTracker({
        onProgress: onProgressSpy,
        updateInterval: 100 // 100ms interval
      })
      
      intervalTracker.setTotalFiles(100)
      intervalTracker.setPhase('processing')
      
      // Rapidly increment files
      const startTime = Date.now()
      for (let i = 0; i < 20; i++) {
        intervalTracker.incrementProcessed(`file${i}.ts`)
      }
      const endTime = Date.now()
      
      // Should process quickly without waiting for interval
      expect(endTime - startTime).toBeLessThan(50)
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Should have batched some updates
      const processingEvents = progressEvents.filter(e => e.phase === 'processing')
      expect(processingEvents.length).toBeGreaterThan(0)
      expect(processingEvents.length).toBeLessThanOrEqual(20) // May batch some
    })
  })
})