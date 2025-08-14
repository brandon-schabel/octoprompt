import { mkdtemp, rm, mkdir, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import { expect } from 'bun:test'

export class TestEnvironment {
  private tempDirs: string[] = []

  async createTempDir(prefix = 'promptliano-test-'): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), prefix))
    this.tempDirs.push(tempDir)
    return tempDir
  }

  async cleanup(): Promise<void> {
    for (const dir of this.tempDirs) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true })
      }
    }
    this.tempDirs = []
  }

  async createMockInstallation(basePath: string): Promise<void> {
    // Create mock Promptliano installation structure
    const paths = ['packages/server', 'packages/client', 'packages/schemas', 'packages/storage', 'logs']

    for (const path of paths) {
      await mkdir(join(basePath, path), { recursive: true })
    }

    // Create mock package.json
    await writeFile(
      join(basePath, 'package.json'),
      JSON.stringify(
        {
          name: 'promptliano-core',
          version: '0.9.1',
          type: 'module'
        },
        null,
        2
      )
    )

    // Create mock server files
    await writeFile(join(basePath, 'packages/server/server.ts'), 'console.log("Mock server");')
  }

  async createMockMCPConfig(editor: string, configPath: string): Promise<void> {
    const config = {
      mcpServers: {
        'promptliano-test': {
          command: 'node',
          args: ['server.js'],
          cwd: '/test/path'
        }
      }
    }

    await mkdir(join(configPath, '..'), { recursive: true })
    await writeFile(configPath, JSON.stringify(config, null, 2))
  }
}

export class MockProcess {
  static mockSpawn = () => {}
  static mockExec = () => {}

  static setup() {
    // Bun doesn't have doMock, would need different approach
    // For now, just no-op
  }

  static reset() {
    // No-op for Bun
  }
}

export class MockFetch {
  private static responses: Map<string, any> = new Map()

  static mockResponse(url: string, response: any) {
    this.responses.set(url, response)
  }

  static setup() {
    const fetchMock = async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      const response = this.responses.get(urlString)
      if (response) {
        return {
          ok: true,
          json: async () => response,
          text: async () => JSON.stringify(response)
        } as Response
      }
      throw new Error(`No mock response for ${urlString}`)
    }

    global.fetch = Object.assign(fetchMock, { preconnect: () => {} }) as typeof fetch
  }

  static reset() {
    this.responses.clear()
    // @ts-ignore
    delete global.fetch
  }
}

export function mockConsole() {
  const originalLog = console.log
  const originalError = console.error
  const logs: string[] = []
  const errors: string[] = []

  console.log = (...args: any[]) => {
    logs.push(args.join(' '))
  }

  console.error = (...args: any[]) => {
    errors.push(args.join(' '))
  }

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog
      console.error = originalError
    }
  }
}

export async function expectFileExists(path: string): Promise<void> {
  expect(existsSync(path)).toBe(true)
}

export async function expectFileContains(path: string, content: string): Promise<void> {
  const fileContent = await readFile(path, 'utf-8')
  expect(fileContent).toContain(content)
}
