import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { SystemChecker } from '../../lib/system-checker'
import { TestEnvironment, MockProcess, MockFetch } from '../test-utils'
import { join } from 'path'
import { homedir } from 'os'
import * as os from 'os'

describe('SystemChecker', () => {
  let testEnv: TestEnvironment
  let checker: SystemChecker

  beforeEach(() => {
    testEnv = new TestEnvironment()
    checker = new SystemChecker()
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  describe('checkNodeVersion', () => {
    test('should detect valid Node.js version', async () => {
      const result = await checker.checkNodeVersion()

      expect(result.valid).toBeDefined()
      expect(result.version).toBeDefined()
      expect(result.required).toBe('18.0.0')

      // Since we're running in Node/Bun, it should be valid
      expect(result.valid).toBe(true)
    })
  })

  describe('checkBun', () => {
    test('should detect Bun installation', async () => {
      const result = await checker.checkBun()

      expect(result.installed).toBeDefined()
      // In Bun test environment, this should be true
      expect(result.installed).toBe(true)
      expect(result.version).toBeDefined()
      expect(result.path).toBeDefined()
    })
  })

  describe('checkPromptliano', () => {
    test('should detect missing Promptliano installation', async () => {
      const tempDir = await testEnv.createTempDir()
      const fakePath = join(tempDir, '.promptliano')

      // Override homedir for this test
      const originalHomedir = os.homedir
      const homedirSpy = spyOn(os, 'homedir')
      homedirSpy.mockReturnValue(tempDir)

      const result = await checker.checkPromptliano()

      expect(result.installed).toBe(false)

      // Restore
      homedirSpy.mockRestore()
    })

    test('should detect valid Promptliano installation', async () => {
      const tempDir = await testEnv.createTempDir()
      const installPath = join(tempDir, '.promptliano')

      // Create mock installation
      await testEnv.createMockInstallation(installPath)

      // Override homedir for this test
      const homedirSpy = spyOn(os, 'homedir')
      homedirSpy.mockReturnValue(tempDir)

      const result = await checker.checkPromptliano()

      expect(result.installed).toBe(true)
      expect(result.path).toBe(installPath)
      expect(result.version).toBe('0.8.2')

      // Restore
      homedirSpy.mockRestore()
    })
  })

  describe('checkNetwork', () => {
    test('should check network connectivity', async () => {
      // This will make actual network call in tests
      // In real unit tests, we'd mock this
      const result = await checker.checkNetwork()

      expect(result.connected).toBeDefined()
      if (result.connected) {
        expect(result.latency).toBeDefined()
        expect(result.latency).toBeGreaterThan(0)
      }
    })
  })

  describe('checkServer', () => {
    test('should detect server not running', async () => {
      // Mock fetch to simulate server not running
      const originalFetch = global.fetch
      global.fetch = Object.assign(
        mock(() => Promise.reject(new Error('Connection refused'))),
        { preconnect: () => {} }
      ) as typeof fetch

      const result = await checker.checkServer()

      expect(result.running).toBe(false)

      // Restore
      global.fetch = originalFetch
    })

    test('should detect running server', async () => {
      // Mock fetch to simulate running server
      const originalFetch = global.fetch
      global.fetch = Object.assign(
        mock(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ status: 'healthy' }),
            text: async () => '{"status":"healthy"}',
            headers: new Headers(),
            redirected: false,
            status: 200,
            statusText: 'OK',
            type: 'basic' as ResponseType,
            url: 'http://localhost:3579/api/health',
            clone: () => ({}) as Response,
            body: null,
            bodyUsed: false,
            arrayBuffer: async () => new ArrayBuffer(0),
            blob: async () => new Blob(),
            formData: async () => new FormData()
          } as Response)
        ),
        { preconnect: () => {} }
      ) as typeof fetch

      const result = await checker.checkServer()

      expect(result.running).toBe(true)
      expect(result.port).toBe(3579)

      // Restore
      global.fetch = originalFetch
    })
  })
})
