import { describe, it, expect } from 'vitest'
import * as path from 'node:path'
import {
  expandTilde,
  resolvePath,
  normalizePathForDb,
  toPosixPath,
  toOSPath,
  joinPosix,
  relativePosix,
  isAbsolutePath,
  toUrlPath
} from './path-utils'

describe('path-utils', () => {
  describe('normalizePathForDb', () => {
    it('should convert Windows paths to POSIX format', () => {
      expect(normalizePathForDb('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt')
      expect(normalizePathForDb('..\\parent\\file.txt')).toBe('../parent/file.txt')
      expect(normalizePathForDb('.\\current\\file.txt')).toBe('./current/file.txt')
    })

    it('should preserve POSIX paths', () => {
      expect(normalizePathForDb('/home/user/file.txt')).toBe('/home/user/file.txt')
      expect(normalizePathForDb('../parent/file.txt')).toBe('../parent/file.txt')
      expect(normalizePathForDb('./current/file.txt')).toBe('./current/file.txt')
    })

    it('should handle mixed separators', () => {
      expect(normalizePathForDb('C:\\Users/test\\file.txt')).toBe('C:/Users/test/file.txt')
      expect(normalizePathForDb('..\\parent/file.txt')).toBe('../parent/file.txt')
    })
  })

  describe('toPosixPath', () => {
    it('should convert paths to POSIX format', () => {
      const windowsPath = 'C:\\Users\\test\\file.txt'
      const posixPath = 'C:/Users/test/file.txt'
      
      // This test will behave differently on Windows vs Unix
      const result = toPosixPath(windowsPath)
      if (process.platform === 'win32') {
        expect(result).toBe(posixPath)
      } else {
        // On Unix, the input is already seen as one segment
        expect(result).toBe(windowsPath)
      }
    })

    it('should handle relative paths', () => {
      if (process.platform === 'win32') {
        expect(toPosixPath('..\\parent\\file.txt')).toBe('../parent/file.txt')
        expect(toPosixPath('.\\current\\file.txt')).toBe('./current/file.txt')
      }
    })
  })

  describe('toOSPath', () => {
    it('should convert POSIX paths to OS format', () => {
      const posixPath = 'C:/Users/test/file.txt'
      const result = toOSPath(posixPath)
      
      if (process.platform === 'win32') {
        expect(result).toBe('C:\\Users\\test\\file.txt')
      } else {
        expect(result).toBe(posixPath)
      }
    })

    it('should handle relative paths', () => {
      const result1 = toOSPath('../parent/file.txt')
      const result2 = toOSPath('./current/file.txt')
      
      if (process.platform === 'win32') {
        expect(result1).toBe('..\\parent\\file.txt')
        expect(result2).toBe('.\\current\\file.txt')
      } else {
        expect(result1).toBe('../parent/file.txt')
        expect(result2).toBe('./current/file.txt')
      }
    })
  })

  describe('joinPosix', () => {
    it('should join paths and return POSIX format', () => {
      const result = joinPosix('parent', 'child', 'file.txt')
      expect(result).toBe('parent/child/file.txt')
    })

    it('should handle absolute paths', () => {
      if (process.platform === 'win32') {
        const result = joinPosix('C:\\Users', 'test', 'file.txt')
        expect(result).toBe('C:/Users/test/file.txt')
      } else {
        const result = joinPosix('/home', 'user', 'file.txt')
        expect(result).toBe('/home/user/file.txt')
      }
    })

    it('should handle empty segments', () => {
      const result = joinPosix('parent', '', 'file.txt')
      expect(result).toBe('parent/file.txt')
    })
  })

  describe('relativePosix', () => {
    it('should create relative paths in POSIX format', () => {
      if (process.platform === 'win32') {
        const from = 'C:\\Users\\test\\project'
        const to = 'C:\\Users\\test\\project\\src\\file.txt'
        const result = relativePosix(from, to)
        expect(result).toBe('src/file.txt')
      } else {
        const from = '/home/user/project'
        const to = '/home/user/project/src/file.txt'
        const result = relativePosix(from, to)
        expect(result).toBe('src/file.txt')
      }
    })

    it('should handle parent directory navigation', () => {
      if (process.platform === 'win32') {
        const from = 'C:\\Users\\test\\project\\src'
        const to = 'C:\\Users\\test\\file.txt'
        const result = relativePosix(from, to)
        expect(result).toBe('../../file.txt')
      } else {
        const from = '/home/user/project/src'
        const to = '/home/user/file.txt'
        const result = relativePosix(from, to)
        expect(result).toBe('../../file.txt')
      }
    })
  })

  describe('isAbsolutePath', () => {
    it('should detect Windows absolute paths', () => {
      expect(isAbsolutePath('C:\\Users\\test')).toBe(true)
      expect(isAbsolutePath('D:\\file.txt')).toBe(true)
      expect(isAbsolutePath('\\\\server\\share')).toBe(true)
      expect(isAbsolutePath('C:/Users/test')).toBe(true)
    })

    it('should detect POSIX absolute paths', () => {
      expect(isAbsolutePath('/home/user')).toBe(true)
      expect(isAbsolutePath('/file.txt')).toBe(true)
    })

    it('should detect relative paths', () => {
      expect(isAbsolutePath('./file.txt')).toBe(false)
      expect(isAbsolutePath('../parent/file.txt')).toBe(false)
      expect(isAbsolutePath('file.txt')).toBe(false)
      expect(isAbsolutePath('src/file.txt')).toBe(false)
    })
  })

  describe('toUrlPath', () => {
    it('should convert Windows paths to file URLs', () => {
      expect(toUrlPath('C:\\Users\\test\\file.txt')).toBe('file:///C:/Users/test/file.txt')
      expect(toUrlPath('D:\\project\\index.html')).toBe('file:///D:/project/index.html')
    })

    it('should handle POSIX paths', () => {
      expect(toUrlPath('/home/user/file.txt')).toBe('/home/user/file.txt')
      expect(toUrlPath('./relative/path.txt')).toBe('./relative/path.txt')
    })

    it('should handle paths that are already in POSIX format', () => {
      expect(toUrlPath('C:/Users/test/file.txt')).toBe('file:///C:/Users/test/file.txt')
      expect(toUrlPath('relative/path/file.txt')).toBe('relative/path/file.txt')
    })
  })

  describe('cross-platform scenarios', () => {
    it('should handle agent file paths correctly', () => {
      const projectPath = process.platform === 'win32' ? 'C:\\projects\\myapp' : '/home/user/projects/myapp'
      const agentPath = path.join(projectPath, '.claude', 'agents', 'test-agent.md')
      
      // Normalize for storage
      const normalized = toPosixPath(agentPath)
      expect(normalized).toContain('/')
      expect(normalized).not.toContain('\\\\')
      
      // Convert back for OS operations
      const osPath = toOSPath(normalized)
      if (process.platform === 'win32') {
        expect(osPath).toContain('\\')
      } else {
        expect(osPath).toContain('/')
      }
    })

    it('should handle relative paths for file storage', () => {
      const projectPath = process.platform === 'win32' ? 'C:\\projects\\myapp' : '/home/user/projects/myapp'
      const filePath = path.join(projectPath, 'src', 'components', 'Button.tsx')
      
      // Create relative path for storage
      const relativePath = relativePosix(projectPath, filePath)
      expect(relativePath).toBe('src/components/Button.tsx')
      
      // Ensure no backslashes in stored path
      expect(relativePath).not.toContain('\\')
    })

    it('should handle MCP config paths correctly', () => {
      const scriptPath = process.platform === 'win32' 
        ? 'C:\\projects\\promptliano\\packages\\server\\mcp-start.bat'
        : '/home/user/promptliano/packages/server/mcp-start.sh'
      
      // For command execution, use OS path
      const execPath = toOSPath(scriptPath)
      if (process.platform === 'win32') {
        expect(execPath).toMatch(/\\/g)
      }
      
      // For storage/transmission, use POSIX path
      const storagePath = toPosixPath(scriptPath)
      expect(storagePath).toMatch(/\//g)
      expect(storagePath).not.toMatch(/\\/g)
    })
  })
})