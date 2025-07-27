import { describe, test, expect } from 'bun:test'
import {
  type FileNode,
  estimateTokenCount,
  countTotalFiles,
  collectFiles,
  calculateFolderTokens,
  areAllFolderFilesSelected,
  isFolderPartiallySelected,
  toggleFile,
  toggleFolder
} from './file-node-tree-utils'
import type { ProjectFile } from '@promptliano/schemas'

describe('estimateTokenCount', () => {
  test('should correctly estimate tokens for normal text', () => {
    expect(estimateTokenCount('hello world')).toBe(3) // 11 chars / 4 = 2.75, ceil to 3
  })

  test('should return 0 for empty text', () => {
    expect(estimateTokenCount('')).toBe(0)
  })

  test('should handle custom chars per token', () => {
    expect(estimateTokenCount('hello world', 3)).toBe(4) // 11 chars / 3 = 3.67, ceil to 4
  })
})

describe('countTotalFiles', () => {
  const mockFileTree = {
    src: {
      _folder: true,
      children: {
        components: {
          _folder: true,
          children: {
            'file1.ts': {
              _folder: false,
              file: { id: '1', path: 'src/components/file1.ts' } as ProjectFile
            },
            'file2.ts': {
              _folder: false,
              file: { id: '2', path: 'src/components/file2.ts' } as ProjectFile
            }
          }
        },
        utils: {
          _folder: true,
          children: {
            'file3.ts': {
              _folder: false,
              file: { id: '3', path: 'src/utils/file3.ts' } as ProjectFile
            }
          }
        }
      }
    }
  } satisfies Record<string, FileNode>

  test('should count total files correctly', () => {
    expect(countTotalFiles(mockFileTree)).toBe(3)
  })
})

describe('collectFiles', () => {
  const mockNode: FileNode = {
    _folder: true,
    children: {
      'file1.ts': {
        _folder: false,
        file: { id: '1', path: 'file1.ts' } as ProjectFile
      },
      nested: {
        _folder: true,
        children: {
          'file2.ts': {
            _folder: false,
            file: { id: '2', path: 'nested/file2.ts' } as ProjectFile
          }
        }
      }
    }
  }

  test('should collect all file IDs recursively', () => {
    const fileIds = collectFiles(mockNode)
    expect(fileIds).toEqual(['1', '2'])
  })
})

describe('calculateFolderTokens', () => {
  const mockFolder: FileNode = {
    _folder: true,
    children: {
      'file1.ts': {
        _folder: false,
        file: { id: '1', path: 'file1.ts', content: 'hello world' } as ProjectFile
      },
      nested: {
        _folder: true,
        children: {
          'file2.ts': {
            _folder: false,
            file: { id: '2', path: 'nested/file2.ts', content: 'test content' } as ProjectFile
          }
        }
      }
    }
  }

  test('should calculate tokens correctly', () => {
    const selectedFiles = ['1']
    const result = calculateFolderTokens(mockFolder, selectedFiles)
    expect(result.selectedTokens).toBe(3) // tokens for 'hello world'
    expect(result.totalTokens).toBe(6) // total tokens for both files
  })
})

describe('areAllFolderFilesSelected and isFolderPartiallySelected', () => {
  const mockFolder: FileNode = {
    _folder: true,
    children: {
      'file1.ts': {
        _folder: false,
        file: { id: '1', path: 'file1.ts' } as ProjectFile
      },
      'file2.ts': {
        _folder: false,
        file: { id: '2', path: 'file2.ts' } as ProjectFile
      }
    }
  }

  test('should correctly identify when all files are selected', () => {
    const selectedFiles = ['1', '2']
    expect(areAllFolderFilesSelected(mockFolder, selectedFiles)).toBe(true)
  })

  test('should correctly identify partial selection', () => {
    const selectedFiles = ['1']
    expect(isFolderPartiallySelected(mockFolder, selectedFiles)).toBe(true)
  })
})

describe('toggleFile', () => {
  const mockFileMap = new Map<string, ProjectFile>([
    ['1', { id: '1', path: 'file1.ts' } as ProjectFile],
    ['2', { id: '2', path: 'file2.ts' } as ProjectFile]
  ])

  const mockGetRecursiveImports = () => ['2']
  const mockBuildTsconfigAliasMap = () => ({})

  test('should toggle file selection', () => {
    const selectedFiles: number[] = []
    const result = toggleFile(
      '1',
      selectedFiles,
      false,
      mockFileMap,
      mockGetRecursiveImports,
      mockBuildTsconfigAliasMap
    )
    expect(result).toEqual(['1'])
  })

  test('should handle import resolution', () => {
    const selectedFiles: number[] = []
    const result = toggleFile('1', selectedFiles, true, mockFileMap, mockGetRecursiveImports, mockBuildTsconfigAliasMap)
    expect(result).toEqual(['1', '2'])
  })
})

describe('toggleFolder', () => {
  const mockFolder: FileNode = {
    _folder: true,
    children: {
      'file1.ts': {
        _folder: false,
        file: { id: '1', path: 'file1.ts' } as ProjectFile
      },
      'file2.ts': {
        _folder: false,
        file: { id: '2', path: 'file2.ts' } as ProjectFile
      }
    }
  }

  test('should select all files in folder', () => {
    const result = toggleFolder(mockFolder, true, [])
    expect(result).toEqual(['1', '2'])
  })

  test('should deselect all files in folder', () => {
    const result = toggleFolder(mockFolder, false, ['1', '2'])
    expect(result).toEqual([])
  })
})
