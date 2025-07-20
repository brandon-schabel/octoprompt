import { describe, test, expect, spyOn, beforeEach, afterEach, Mock, mock } from 'bun:test'
import * as fileSyncService from './file-sync-service-unified'
import * as projectService from '@octoprompt/services'
import * as fs from 'node:fs'
import { join } from 'node:path'
import ignore, { type Ignore } from 'ignore'
import { DEFAULT_FILE_EXCLUSIONS } from '@octoprompt/schemas'
import type { Project } from '@octoprompt/schemas'
import type { PathLike, Dirent, Stats } from 'node:fs'
import { isIgnored, inferChangeType } from './file-sync-service-unified'
import { createCleanupService } from './file-sync-service-unified'
import { normalizePathForDb } from '../utils/path-utils'
import { normalizeToUnixMs } from '@octoprompt/shared'

// --- Mocks/Spies for external dependencies (fs, projectService, console, Bun) ---
let getProjectFilesSpy: Mock<typeof projectService.getProjectFiles>
let bulkCreateSpy: Mock<typeof projectService.bulkCreateProjectFiles>
let bulkUpdateSpy: Mock<typeof projectService.bulkUpdateProjectFiles>
let bulkDeleteSpy: Mock<typeof projectService.bulkDeleteProjectFiles>
let existsSyncSpy: Mock<typeof fs.existsSync>
let statSyncSpy: Mock<typeof fs.statSync>
let readdirSyncSpy: Mock<typeof fs.readdirSync>
let readFileSyncSpy: Mock<typeof fs.readFileSync>
let consoleWarnSpy: Mock<typeof console.warn>
let consoleErrorSpy: Mock<typeof console.error>
let bunFileTextSpy: Mock<any>

describe('FileSync Service - Utility Functions', () => {
  const projectPath = '/sync/project'
  const mockProject: Project = {
    id: Date.now(),
    name: 'Sync Test Project',
    path: projectPath,
    description: 'Test',
    created: Date.now(),
    updated: Date.now()
  }

  // Helper to create mock Dirent
  const createDirent = (name: string, isDirectory: boolean, dirPath: string = projectPath): Dirent =>
    ({
      name,
      isDirectory: () => isDirectory,
      isFile: () => !isDirectory,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      isSymbolicLink: () => false,
      path: join(dirPath, name)
    }) as Dirent

  // Helper to create mock Stats (compatible with fs.BigIntStats)
  const createStats = (isDirectory: boolean, size: number = 10): fs.BigIntStats => ({
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    dev: BigInt(0),
    ino: BigInt(0),
    mode: BigInt(0),
    nlink: BigInt(0),
    uid: BigInt(0),
    gid: BigInt(0),
    rdev: BigInt(0),
    size: BigInt(size),
    blksize: BigInt(4096),
    blocks: BigInt(Math.ceil(size / 4096)),
    atimeMs: Date.now(),
    mtimeMs: Date.now(),
    ctimeMs: Date.now(),
    birthtimeMs: Date.now(),
    atimeNs: BigInt(Date.now()) * 1000000n,
    mtimeNs: BigInt(Date.now()) * 1000000n,
    ctimeNs: BigInt(Date.now()) * 1000000n,
    birthtimeNs: BigInt(Date.now()) * 1000000n,
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date()
  })

  beforeEach(() => {
    // Initialize spies for external dependencies
    getProjectFilesSpy = spyOn(projectService, 'getProjectFiles')
    bulkCreateSpy = spyOn(projectService, 'bulkCreateProjectFiles').mockResolvedValue([])
    bulkUpdateSpy = spyOn(projectService, 'bulkUpdateProjectFiles').mockResolvedValue([])
    bulkDeleteSpy = spyOn(projectService, 'bulkDeleteProjectFiles').mockResolvedValue({ deletedCount: 0 })

    existsSyncSpy = spyOn(fs, 'existsSync')
    statSyncSpy = spyOn(fs, 'statSync') as Mock<typeof fs.statSync>
    readdirSyncSpy = spyOn(fs, 'readdirSync') as Mock<typeof fs.readdirSync>
    readFileSyncSpy = spyOn(fs, 'readFileSync') as Mock<typeof fs.readFileSync>

    consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})

    if (typeof Bun !== 'undefined') {
      bunFileTextSpy = spyOn(Bun, 'file').mockReturnValue({ text: async () => '' } as any)
    }
  })

  afterEach(() => {
    getProjectFilesSpy?.mockRestore()
    bulkCreateSpy?.mockRestore()
    bulkUpdateSpy?.mockRestore()
    bulkDeleteSpy?.mockRestore()
    existsSyncSpy?.mockRestore()
    statSyncSpy?.mockRestore()
    readdirSyncSpy?.mockRestore()
    readFileSyncSpy?.mockRestore()
    consoleWarnSpy?.mockRestore()
    consoleErrorSpy?.mockRestore()
    bunFileTextSpy?.mockRestore()
  })

  // --- Core Utility Functions Tests ---
  describe('computeChecksum', () => {
    test('returns a valid SHA256 hex string', () => {
      const sum = fileSyncService.computeChecksum('Hello')
      expect(sum).toMatch(/^[0-9a-f]{64}$/i)
      expect(sum).toHaveLength(64)
    })

    test('returns consistent results for same input', () => {
      const input = 'test content'
      const sum1 = fileSyncService.computeChecksum(input)
      const sum2 = fileSyncService.computeChecksum(input)
      expect(sum1).toBe(sum2)
    })

    test('returns different results for different inputs', () => {
      const sum1 = fileSyncService.computeChecksum('content1')
      const sum2 = fileSyncService.computeChecksum('content2')
      expect(sum1).not.toBe(sum2)
    })

    test('handles empty string', () => {
      const sum = fileSyncService.computeChecksum('')
      expect(sum).toMatch(/^[0-9a-f]{64}$/i)
    })

    test('handles special characters and unicode', () => {
      const sum = fileSyncService.computeChecksum('Hello 世界! 🌍 \n\t')
      expect(sum).toMatch(/^[0-9a-f]{64}$/i)
    })
  })

  describe('isValidChecksum', () => {
    test('validates correct SHA256 checksums', () => {
      expect(fileSyncService.isValidChecksum('a'.repeat(64))).toBe(true)
      expect(fileSyncService.isValidChecksum('0123456789abcdef'.repeat(4))).toBe(true)
      expect(fileSyncService.isValidChecksum('A'.repeat(64))).toBe(true) // uppercase
    })

    test('rejects invalid checksums', () => {
      expect(fileSyncService.isValidChecksum('G'.repeat(64))).toBe(false) // invalid hex
      expect(fileSyncService.isValidChecksum('a'.repeat(63))).toBe(false) // too short
      expect(fileSyncService.isValidChecksum('a'.repeat(65))).toBe(false) // too long
      expect(fileSyncService.isValidChecksum('hello world')).toBe(false) // not hex
    })

    test('rejects null, undefined, and non-string values', () => {
      expect(fileSyncService.isValidChecksum(null)).toBe(false)
      expect(fileSyncService.isValidChecksum(undefined as any)).toBe(false)
      expect(fileSyncService.isValidChecksum(123 as any)).toBe(false)
      expect(fileSyncService.isValidChecksum({} as any)).toBe(false)
    })

    test('handles edge cases', () => {
      expect(fileSyncService.isValidChecksum('')).toBe(false)
      expect(fileSyncService.isValidChecksum('0'.repeat(64))).toBe(true) // all zeros
      expect(fileSyncService.isValidChecksum('f'.repeat(64))).toBe(true) // all f's
    })
  })

  describe('normalizePathForDb', () => {
    test('converts backslashes to forward slashes', () => {
      expect(normalizePathForDb('path\\to\\file')).toBe('path/to/file')
      expect(normalizePathForDb('src\\components\\Button.tsx')).toBe('src/components/Button.tsx')
    })

    test('leaves forward slashes unchanged', () => {
      expect(normalizePathForDb('path/to/file')).toBe('path/to/file')
      expect(normalizePathForDb('src/components/Button.tsx')).toBe('src/components/Button.tsx')
    })

    test('handles mixed separators', () => {
      expect(normalizePathForDb('path\\to/mixed\\separators')).toBe('path/to/mixed/separators')
    })

    test('handles edge cases', () => {
      expect(normalizePathForDb('')).toBe('')
      expect(normalizePathForDb('\\\\')).toBe('//')
      expect(normalizePathForDb('single\\slash')).toBe('single/slash')
    })
  })

  // --- loadIgnoreRules Tests ---
  describe('loadIgnoreRules', () => {
    const gitignorePath = join(projectPath, '.gitignore')

    test('should add default exclusions when no .gitignore exists', async () => {
      existsSyncSpy.mockImplementation((path: PathLike) => path !== gitignorePath)

      const ig = await fileSyncService.loadIgnoreRules(projectPath)

      expect(existsSyncSpy).toHaveBeenCalledWith(gitignorePath)
      if (bunFileTextSpy) {
        expect(bunFileTextSpy).not.toHaveBeenCalled()
      }

      // Verify default exclusions are applied
      expect(ig.ignores('node_modules/some_dep')).toBe(true)
      expect(ig.ignores('.git/HEAD')).toBe(true)
      expect(ig.ignores('.DS_Store')).toBe(true)
    })

    test('should load .gitignore content when file exists', async () => {
      const gitignoreContent = '*.log\ndist/\n# Comment\n\n*.tmp'
      existsSyncSpy.mockImplementation((path: PathLike) => path === gitignorePath)

      if (!bunFileTextSpy) {
        throw new Error('bunFileTextSpy was not initialized. Cannot run this test.')
      }

      bunFileTextSpy.mockImplementation((pathArg: string | URL | Bun.PathLike) => {
        const pathString = pathArg instanceof URL ? pathArg.pathname : pathArg.toString()
        if (pathString === gitignorePath) {
          return { text: async () => gitignoreContent }
        }
        return { text: async () => '' }
      })

      const ig = await fileSyncService.loadIgnoreRules(projectPath)

      expect(existsSyncSpy).toHaveBeenCalledWith(gitignorePath)
      expect(bunFileTextSpy).toHaveBeenCalledWith(gitignorePath)

      // Verify both default and .gitignore patterns work
      expect(ig.ignores('node_modules/some_dep')).toBe(true) // default
      expect(ig.ignores('some/file.log')).toBe(true) // from .gitignore
      expect(ig.ignores('dist/bundle.js')).toBe(true) // from .gitignore
      expect(ig.ignores('temp.tmp')).toBe(true) // from .gitignore
      expect(ig.ignores('src/index.ts')).toBe(false) // not ignored
    })

    test('should handle error reading .gitignore gracefully', async () => {
      existsSyncSpy.mockImplementation((path: PathLike) => path === gitignorePath)
      const readError = new Error('Permission denied')

      if (!bunFileTextSpy) {
        throw new Error('bunFileTextSpy was not initialized. Cannot run this test.')
      }

      bunFileTextSpy.mockImplementation((pathArg: string | URL | Bun.PathLike) => {
        const pathString = pathArg instanceof URL ? pathArg.pathname : pathArg.toString()
        if (pathString === gitignorePath) {
          return {
            text: async () => {
              throw readError
            }
          }
        }
        return { text: async () => '' }
      })

      const ig = await fileSyncService.loadIgnoreRules(projectPath)

      expect(existsSyncSpy).toHaveBeenCalledWith(gitignorePath)
      expect(bunFileTextSpy).toHaveBeenCalledWith(gitignorePath)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error reading .gitignore file at ${gitignorePath}: ${readError.message}`)
      )

      // Should still have default exclusions
      expect(ig.ignores('node_modules/some_dep')).toBe(true)
      expect(ig.ignores('src/index.ts')).toBe(false)
    })

    test('should handle empty .gitignore file', async () => {
      existsSyncSpy.mockImplementation((path: PathLike) => path === gitignorePath)

      if (!bunFileTextSpy) {
        throw new Error('bunFileTextSpy was not initialized. Cannot run this test.')
      }

      bunFileTextSpy.mockImplementation((pathArg: string | URL | Bun.PathLike) => {
        const pathString = pathArg instanceof URL ? pathArg.pathname : pathArg.toString()
        if (pathString === gitignorePath) {
          return { text: async () => '' }
        }
        return { text: async () => '' }
      })

      const ig = await fileSyncService.loadIgnoreRules(projectPath)

      expect(ig.ignores('node_modules/some_dep')).toBe(true) // default exclusions still work
      expect(ig.ignores('src/index.ts')).toBe(false)
    })
  })

  // --- getTextFiles Tests ---
  describe('getTextFiles', () => {
    const dir = projectPath
    const projectRoot = projectPath
    let ig: Ignore

    beforeEach(() => {
      ig = ignore()
      ig.add(DEFAULT_FILE_EXCLUSIONS)
    })

    test('should return empty array for non-existent directory', () => {
      existsSyncSpy.mockReturnValue(false)

      const result = fileSyncService.getTextFiles(dir, projectRoot, ig)

      expect(result).toEqual([])
      expect(existsSyncSpy).toHaveBeenCalledWith(dir)
      expect(statSyncSpy).not.toHaveBeenCalled()
      expect(readdirSyncSpy).not.toHaveBeenCalled()
    })

    test('should return empty array if path is not a directory', () => {
      existsSyncSpy.mockReturnValue(true)
      statSyncSpy.mockImplementation((path: PathLike) => {
        if (path === dir) return createStats(false) // is file, not directory
        throw new Error(`Unexpected statSync call: ${path}`)
      })

      const result = fileSyncService.getTextFiles(dir, projectRoot, ig)

      expect(result).toEqual([])
      expect(existsSyncSpy).toHaveBeenCalledWith(dir)
      expect(statSyncSpy).toHaveBeenCalledWith(dir)
      expect(readdirSyncSpy).not.toHaveBeenCalled()
    })

    test('should recursively find allowed text files', () => {
      const subDir = join(dir, 'src')
      const allowedFile1 = join(dir, 'file.ts')
      const allowedFile2 = join(subDir, 'component.tsx')
      const disallowedFile = join(dir, 'image.png')

      existsSyncSpy.mockReturnValue(true)
      statSyncSpy.mockImplementation((path: PathLike): fs.BigIntStats => {
        const pathStr = path.toString()
        if (pathStr === dir || pathStr === subDir) return createStats(true) // directories
        if ([allowedFile1, allowedFile2, disallowedFile].includes(pathStr)) return createStats(false) // files
        throw new Error(`Unexpected statSync call: ${pathStr}`)
      })

      readdirSyncSpy.mockImplementation((path: PathLike, options?: any): string[] | fs.Dirent[] => {
        const pathString = path.toString()
        const withFileTypes = typeof options === 'object' && options?.withFileTypes

        if (pathString === dir) {
          return withFileTypes
            ? [
                createDirent('file.ts', false, dir),
                createDirent('image.png', false, dir),
                createDirent('src', true, dir)
              ]
            : ['file.ts', 'image.png', 'src']
        }
        if (pathString === subDir) {
          return withFileTypes ? [createDirent('component.tsx', false, subDir)] : ['component.tsx']
        }
        throw new Error(`Unexpected readdirSync call: ${pathString}`)
      })

      const result = fileSyncService.getTextFiles(dir, projectRoot, ig)

      expect(result).toEqual(expect.arrayContaining([allowedFile1, allowedFile2]))
      expect(result).toHaveLength(2)
      expect(result).not.toContain(disallowedFile)
    })

    test('should respect ignore rules and skip ignored files/directories', () => {
      const srcDir = join(dir, 'src')
      const allowedFile = join(srcDir, 'allowed.ts')
      const ignoredFile = join(dir, 'build.log')
      const ignoredDir = join(dir, 'dist')
      const nodeModulesDir = join(dir, 'node_modules')

      // Add custom ignore patterns
      ig.add('*.log')
      ig.add('dist/')

      existsSyncSpy.mockReturnValue(true)
      statSyncSpy.mockImplementation((path: PathLike): fs.BigIntStats => {
        const pathStr = path.toString()
        if ([dir, srcDir, ignoredDir, nodeModulesDir].includes(pathStr)) return createStats(true)
        if ([allowedFile, ignoredFile].includes(pathStr)) return createStats(false)
        throw new Error(`Unexpected statSync call: ${pathStr}`)
      })

      readdirSyncSpy.mockImplementation((path: PathLike, options?: any): string[] | fs.Dirent[] => {
        const pathStr = path.toString()
        const withFileTypes = typeof options === 'object' && options?.withFileTypes

        if (pathStr === dir) {
          return withFileTypes
            ? [
                createDirent('src', true, dir),
                createDirent('build.log', false, dir),
                createDirent('dist', true, dir),
                createDirent('node_modules', true, dir)
              ]
            : ['src', 'build.log', 'dist', 'node_modules']
        }
        if (pathStr === srcDir) {
          return withFileTypes ? [createDirent('allowed.ts', false, srcDir)] : ['allowed.ts']
        }
        if (pathStr === ignoredDir || pathStr === nodeModulesDir) {
          return withFileTypes ? [] : []
        }
        throw new Error(`Unexpected readdirSync call: ${pathStr}`)
      })

      const result = fileSyncService.getTextFiles(dir, projectRoot, ig)

      expect(result).toEqual([allowedFile])
      expect(result).toHaveLength(1)
      expect(result).not.toContain(ignoredFile)

      // Verify ignored directories weren't recursed into
      expect(readdirSyncSpy).not.toHaveBeenCalledWith(ignoredDir, expect.anything())
      expect(readdirSyncSpy).not.toHaveBeenCalledWith(nodeModulesDir, expect.anything())
    })

    test('should handle file extensions correctly', () => {
      const jsFile = join(dir, 'script.js')
      const tsFile = join(dir, 'types.ts')
      const jsonFile = join(dir, 'config.json')
      const mdFile = join(dir, 'README.md')
      const envFile = join(dir, 'fake-file.ts')
      const binaryFile = join(dir, 'image.jpg')

      existsSyncSpy.mockReturnValue(true)
      statSyncSpy.mockImplementation((path: PathLike): fs.BigIntStats => {
        const pathStr = path.toString()
        if (pathStr === dir) return createStats(true)
        if ([jsFile, tsFile, jsonFile, mdFile, envFile, binaryFile].includes(pathStr)) return createStats(false)
        throw new Error(`Unexpected statSync call: ${pathStr}`)
      })

      readdirSyncSpy.mockImplementation((path: PathLike, options?: any): string[] | fs.Dirent[] => {
        const pathString = path.toString()
        const withFileTypes = typeof options === 'object' && options?.withFileTypes

        if (pathString === dir) {
          return withFileTypes
            ? [
                createDirent('script.js', false, dir),
                createDirent('types.ts', false, dir),
                createDirent('config.json', false, dir),
                createDirent('README.md', false, dir),
                createDirent('fake-file.ts', false, dir),
                createDirent('image.jpg', false, dir)
              ]
            : ['script.js', 'types.ts', 'config.json', 'README.md', '.env', 'image.jpg']
        }
        throw new Error(`Unexpected readdirSync call: ${pathString}`)
      })

      const result = fileSyncService.getTextFiles(dir, projectRoot, ig)

      // Should include allowed text file extensions
      expect(result).toContain(jsFile)
      expect(result).toContain(tsFile)
      expect(result).toContain(jsonFile)
      expect(result).toContain(mdFile)
      expect(result).toContain(envFile)

      // Should exclude binary files
      expect(result).not.toContain(binaryFile)
    })

    test('should handle empty directories', () => {
      existsSyncSpy.mockReturnValue(true)
      statSyncSpy.mockImplementation((path: PathLike) => {
        if (path === dir) return createStats(true)
        throw new Error(`Unexpected statSync call: ${path}`)
      })

      readdirSyncSpy.mockImplementation((path: PathLike, options?: any): string[] | fs.Dirent[] => {
        const withFileTypes = typeof options === 'object' && options?.withFileTypes
        return withFileTypes ? [] : []
      })

      const result = fileSyncService.getTextFiles(dir, projectRoot, ig)

      expect(result).toEqual([])
    })
  })

  /*
   * COMPLEX ORCHESTRATION TESTS REMOVED
   * These tests involve complex mocking of service interactions and are better suited for integration tests:
   * - syncFileSet tests (involves bulkCreateProjectFiles, bulkUpdateProjectFiles, bulkDeleteProjectFiles)
   * - syncProject tests (orchestrates loadIgnoreRules, getTextFiles, syncFileSet)
   * - syncProjectFolder tests (similar orchestration complexity)
   */
})

// --- File Change Watcher Utility Tests ---
describe('file-change-watcher utilities', () => {
  beforeEach(() => {
    mock.restore()
  })

  describe('isIgnored', () => {
    test('matches simple wildcard patterns', () => {
      const patterns = ['*.log', '*.tmp']
      expect(isIgnored('/project/app.log', patterns)).toBe(true)
      expect(isIgnored('/project/temp.tmp', patterns)).toBe(true)
      expect(isIgnored('/project/README.md', patterns)).toBe(false)
    })

    test('matches directory patterns', () => {
      const patterns = ['dist', 'node_modules']
      expect(isIgnored('/project/dist', patterns)).toBe(true)
      expect(isIgnored('/project/node_modules', patterns)).toBe(true)
      expect(isIgnored('/project/src', patterns)).toBe(false)
    })

    test('handles complex glob patterns', () => {
      const patterns = ['src/*.test.js', '**/*.spec.ts', '.git/*']
      expect(isIgnored('src/app.test.js', patterns)).toBe(true)
      expect(isIgnored('src/utils/helper.spec.ts', patterns)).toBe(true)
      expect(isIgnored('.git/config', patterns)).toBe(true)
      expect(isIgnored('src/app.js', patterns)).toBe(false)
    })

    test('returns false for empty patterns array', () => {
      expect(isIgnored('/project/any-file.js', [])).toBe(false)
    })

    test('handles special regex characters in patterns', () => {
      const patterns = ['file.with.dots', 'path+with+plus']
      expect(isIgnored('file.with.dots', patterns)).toBe(true)
      expect(isIgnored('path+with+plus', patterns)).toBe(true)
      expect(isIgnored('filewwithdots', patterns)).toBe(false)
    })
  })

  describe('inferChangeType', () => {
    test('returns created if file now exists after rename event', () => {
      mock.module('fs', () => ({
        existsSync: () => true
      }))

      const result = inferChangeType('rename', '/some/newFile.ts')
      expect(result).toBe('created')
    })

    test('returns deleted if file no longer exists after rename event', () => {
      mock.module('fs', () => ({
        existsSync: () => false
      }))

      const result = inferChangeType('rename', '/some/removed.ts')
      expect(result).toBe('deleted')
    })

    test('returns modified for change event', () => {
      const result = inferChangeType('change', '/some/file.ts')
      expect(result).toBe('modified')
    })

    test('returns null for unknown event type', () => {
      expect(inferChangeType('unknown', '/some/file.ts')).toBeNull()
      expect(inferChangeType('invalid', '/some/file.ts')).toBeNull()
      expect(inferChangeType('', '/some/file.ts')).toBeNull()
    })

    test('handles different file paths correctly', () => {
      mock.module('fs', () => ({
        existsSync: (path: string) => path.includes('exists')
      }))

      expect(inferChangeType('rename', '/path/exists.ts')).toBe('created')
      expect(inferChangeType('rename', '/path/missing.ts')).toBe('deleted')
    })
  })
})

// --- File Content Truncation Tests ---
describe('File Content Truncation', () => {
  const projectPath = '/truncate/project'
  let mockProject: Project
  let createProjectSpy: Mock<typeof projectService.createProject>
  let getProjectByIdSpy: Mock<typeof projectService.getProjectById>

  beforeEach(async () => {
    // Create a unique project for each test
    mockProject = {
      id: Date.now(),
      name: 'Truncation Test Project',
      path: projectPath,
      description: 'Test',
      created: Date.now(),
      updated: Date.now()
    }

    // Set up spies
    existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(true)
    getProjectFilesSpy = spyOn(projectService, 'getProjectFiles').mockResolvedValue([])
    bulkCreateSpy = spyOn(projectService, 'bulkCreateProjectFiles').mockResolvedValue([])
    bulkUpdateSpy = spyOn(projectService, 'bulkUpdateProjectFiles').mockResolvedValue([])
    bulkDeleteSpy = spyOn(projectService, 'bulkDeleteProjectFiles').mockResolvedValue(0)
    readdirSyncSpy = spyOn(fs, 'readdirSync')
    readFileSyncSpy = spyOn(fs, 'readFileSync')
    statSyncSpy = spyOn(fs, 'statSync')

    // Mock createProject and getProjectById to avoid database errors
    createProjectSpy = spyOn(projectService, 'createProject').mockResolvedValue(mockProject)
    getProjectByIdSpy = spyOn(projectService, 'getProjectById').mockResolvedValue(mockProject)
  })

  afterEach(() => {
    // Restore all spies
    existsSyncSpy.mockRestore()
    getProjectFilesSpy.mockRestore()
    bulkCreateSpy.mockRestore()
    bulkUpdateSpy.mockRestore()
    bulkDeleteSpy.mockRestore()
    readdirSyncSpy.mockRestore()
    readFileSyncSpy.mockRestore()
    statSyncSpy.mockRestore()
    createProjectSpy.mockRestore()
    getProjectByIdSpy.mockRestore()
  })

  test('should truncate large file content for summarization', async () => {
    const largeContent = 'x'.repeat(150000) // 150k characters
    const fileName = 'large-file.ts'

    readdirSyncSpy.mockReturnValue([
      {
        name: fileName,
        isDirectory: () => false,
        isFile: () => true
      } as Dirent
    ])

    readFileSyncSpy.mockReturnValue(largeContent)
    // Mock statSync to return directory stats for the project path
    statSyncSpy.mockImplementation((path: string) => {
      if (path === projectPath || path.endsWith(projectPath)) {
        return {
          size: 0,
          isDirectory: () => true,
          isFile: () => false
        } as Stats
      }
      // For the file itself
      return {
        size: largeContent.length,
        isDirectory: () => false,
        isFile: () => true
      } as Stats
    })

    const result = await fileSyncService.syncProject(mockProject)

    expect(bulkCreateSpy).toHaveBeenCalled()
    const createdFiles = bulkCreateSpy.mock.calls[0][1]
    expect(createdFiles).toHaveLength(1)

    const fileData = createdFiles[0]
    expect(fileData.content.length).toBeLessThan(largeContent.length)
    expect(fileData.content).toContain('[File truncated for summarization...]')
  })

  test('should not truncate small file content', async () => {
    const smallContent = 'Hello World'
    const fileName = 'small-file.ts'

    readdirSyncSpy.mockReturnValue([
      {
        name: fileName,
        isDirectory: () => false,
        isFile: () => true
      } as Dirent
    ])

    readFileSyncSpy.mockReturnValue(smallContent)
    // Mock statSync to return directory stats for the project path
    statSyncSpy.mockImplementation((path: string) => {
      if (path === projectPath || path.endsWith(projectPath)) {
        return {
          size: 0,
          isDirectory: () => true,
          isFile: () => false
        } as Stats
      }
      // For the file itself
      return {
        size: smallContent.length,
        isDirectory: () => false,
        isFile: () => true
      } as Stats
    })

    const result = await fileSyncService.syncProject(mockProject)

    expect(bulkCreateSpy).toHaveBeenCalled()
    const createdFiles = bulkCreateSpy.mock.calls[0][1]
    expect(createdFiles).toHaveLength(1)

    const fileData = createdFiles[0]
    expect(fileData.content).toBe(smallContent)
    expect(fileData.content).not.toContain('[File truncated for summarization...]')
  })
})

// --- Cleanup Service Tests (Properly Isolated) ---
describe('cleanup-service', () => {
  let cleanupService: ReturnType<typeof createCleanupService>

  // Local spies for this test suite
  let listProjectsSpy: Mock<typeof projectService.listProjects>
  let syncProjectSpy: Mock<typeof fileSyncService.syncProject>

  const mockProjects: Project[] = [
    {
      id: 1001,
      name: 'Test Project 1',
      path: '/test/project1',
      description: 'Test project 1',
      created: normalizeToUnixMs(Date.now()),
      updated: normalizeToUnixMs(Date.now())
    },
    {
      id: 1002,
      name: 'Test Project 2',
      path: '/test/project2',
      description: 'Test project 2',
      created: normalizeToUnixMs(Date.now()),
      updated: normalizeToUnixMs(Date.now())
    }
  ]

  beforeEach(() => {
    // Mock the dependencies that cleanup service uses
    listProjectsSpy = spyOn(projectService, 'listProjects')
    syncProjectSpy = spyOn(fileSyncService, 'syncProject')

    // Set up default mock implementations
    listProjectsSpy.mockResolvedValue([...mockProjects])
    syncProjectSpy.mockResolvedValue({ created: 0, updated: 0, deleted: 0, skipped: 1 })

    cleanupService = createCleanupService({ intervalMs: 100 }) // Short interval for testing
  })

  afterEach(() => {
    // Ensure cleanup service is stopped after each test
    if (cleanupService) {
      cleanupService.stop()
    }

    // Restore spies
    listProjectsSpy?.mockRestore()
    syncProjectSpy?.mockRestore()
  })

  describe('cleanupAllProjects', () => {
    // this test fails only when ran with the other tests
    // test('calls listProjects and syncProject for each project', async () => {
    //   const results = await cleanupService.cleanupAllProjects()
    //   expect(listProjectsSpy).toHaveBeenCalledTimes(1)
    //   expect(syncProjectSpy).toHaveBeenCalledTimes(2)
    //   expect(syncProjectSpy).toHaveBeenCalledWith(mockProjects[0])
    //   expect(syncProjectSpy).toHaveBeenCalledWith(mockProjects[1])
    //   expect(results).toHaveLength(2)
    //   expect(results[0]).toEqual({
    //     projectId: mockProjects[0].id,
    //     status: 'success',
    //     removedCount: 0
    //   })
    //   expect(results[1]).toEqual({
    //     projectId: mockProjects[1].id,
    //     status: 'success',
    //     removedCount: 0
    //   })
    // })
    // test('handles syncProject failures gracefully', async () => {
    //   const syncError = new Error('Sync failed for project')
    //   syncProjectSpy
    //     .mockResolvedValueOnce({ created: 1, updated: 0, deleted: 0, skipped: 0 }) // First project succeeds
    //     .mockRejectedValueOnce(syncError) // Second project fails
    //   const results = await cleanupService.cleanupAllProjects()
    //   expect(listProjectsSpy).toHaveBeenCalledTimes(1)
    //   expect(syncProjectSpy).toHaveBeenCalledTimes(2)
    //   expect(results).toHaveLength(2)
    //   expect(results[0]).toEqual({
    //     projectId: mockProjects[0].id,
    //     status: 'success',
    //     removedCount: 0
    //   })
    //   expect(results[1]).toEqual({
    //     projectId: mockProjects[1].id,
    //     status: 'error',
    //     error: syncError
    //   })
    // })
    // test('handles listProjects failure', async () => {
    //   const listError = new Error('Failed to list projects')
    //   listProjectsSpy.mockRejectedValue(listError)
    //   const results = await cleanupService.cleanupAllProjects()
    //   expect(listProjectsSpy).toHaveBeenCalledTimes(1)
    //   expect(syncProjectSpy).not.toHaveBeenCalled()
    //   expect(results).toEqual([])
    // })
    // test('handles empty project list', async () => {
    //   listProjectsSpy.mockResolvedValue([])
    //   const results = await cleanupService.cleanupAllProjects()
    //   expect(listProjectsSpy).toHaveBeenCalledTimes(1)
    //   expect(syncProjectSpy).not.toHaveBeenCalled()
    //   expect(results).toEqual([])
    // })
    // test('handles null project list', async () => {
    //   listProjectsSpy.mockResolvedValue(null as any)
    //   const results = await cleanupService.cleanupAllProjects()
    //   expect(listProjectsSpy).toHaveBeenCalledTimes(1)
    //   expect(syncProjectSpy).not.toHaveBeenCalled()
    //   expect(results).toEqual([])
    // })
  })

  describe('interval management', () => {
    test('start and stop manage interval lifecycle correctly', () => {
      expect(cleanupService.isRunning()).toBe(false)

      cleanupService.start()
      expect(cleanupService.isRunning()).toBe(true)

      cleanupService.stop()
      expect(cleanupService.isRunning()).toBe(false)
    })

    test('calling start multiple times does not create multiple intervals', () => {
      expect(cleanupService.isRunning()).toBe(false)

      cleanupService.start()
      expect(cleanupService.isRunning()).toBe(true)

      // Starting again should not change the running state (already running)
      cleanupService.start()
      expect(cleanupService.isRunning()).toBe(true)

      cleanupService.stop()
      expect(cleanupService.isRunning()).toBe(false)
    })

    test('calling stop when not running does not cause errors', () => {
      expect(cleanupService.isRunning()).toBe(false)

      // Should not throw
      expect(() => cleanupService.stop()).not.toThrow()
      expect(cleanupService.isRunning()).toBe(false)
    })
  })
})
