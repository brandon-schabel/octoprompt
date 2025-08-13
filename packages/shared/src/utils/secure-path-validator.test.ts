import { describe, test, expect, beforeEach } from 'bun:test'
import { SecurePathValidator } from './secure-path-validator'
import * as path from 'path'
import * as os from 'os'

describe('SecurePathValidator', () => {
  let validator: SecurePathValidator

  beforeEach(() => {
    validator = new SecurePathValidator()
  })

  describe('validatePath', () => {
    describe('happy path', () => {
      test('validates absolute path in home directory', () => {
        const homePath = path.join(os.homedir(), 'Documents', 'test.txt')
        const result = validator.validatePath(homePath)
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe(path.normalize(homePath))
        expect(result.error).toBeUndefined()
      })

      test('validates relative path with base path', () => {
        const basePath = os.homedir()
        const result = validator.validatePath('Documents/test.txt', basePath)
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBeDefined()
        expect(result.error).toBeUndefined()
      })

      test('validates path in current working directory', () => {
        const cwdPath = path.join(process.cwd(), 'test.txt')
        const result = validator.validatePath(cwdPath)
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe(path.normalize(cwdPath))
      })

      test('validates custom allowed path', () => {
        const customPath = '/custom/allowed/path'
        validator.addAllowedPath(customPath)
        
        const testPath = path.join(customPath, 'file.txt')
        const result = validator.validatePath(testPath)
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe(path.normalize(testPath))
      })
    })

    describe('edge cases', () => {
      test('rejects empty path', () => {
        const result = validator.validatePath('')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Path cannot be empty')
        expect(result.safePath).toBeUndefined()
      })

      test('rejects whitespace-only path', () => {
        const result = validator.validatePath('   ')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Path cannot be empty')
      })

      test('rejects null byte in path', () => {
        const result = validator.validatePath('/home/user\0/file.txt')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Path contains null bytes')
      })

      test('normalizes redundant path separators', () => {
        const homePath = path.join(os.homedir(), '//Documents///test.txt')
        const result = validator.validatePath(homePath)
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe(path.normalize(path.join(os.homedir(), 'Documents', 'test.txt')))
      })
    })

    describe('security tests', () => {
      test('rejects directory traversal attempts', () => {
        const result = validator.validatePath('../../etc/passwd', os.homedir())
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Path is outside allowed directories')
      })

      test('rejects absolute path outside allowed directories', () => {
        const result = validator.validatePath('/etc/passwd')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Path is outside allowed directories')
      })

      test('rejects system directory paths on Unix', () => {
        const systemPaths = [
          '/etc/shadow',
          '/sys/kernel',
          '/proc/1/maps',
          '/bin/bash',
          '/sbin/init',
          '/usr/bin/sudo',
          '/usr/sbin/service'
        ]

        for (const sysPath of systemPaths) {
          // Add parent directory as allowed to test the system path check
          validator.addAllowedPath(path.dirname(sysPath))
          const result = validator.validatePath(sysPath)
          
          expect(result.valid).toBe(false)
          expect(result.error).toBe('Path points to system directory')
        }
      })

      test('rejects system directory paths on Windows', () => {
        const windowsPaths = [
          'C:\\Windows\\System32\\cmd.exe',
          'C:\\Windows\\System\\config',
          'C:\\Program Files\\test.exe'
        ]

        for (const winPath of windowsPaths) {
          // Skip this test on non-Windows systems as paths behave differently
          if (process.platform !== 'win32') {
            continue
          }
          
          // Add parent as allowed to test the system path check
          validator.addAllowedPath('C:\\')
          const result = validator.validatePath(winPath)
          
          expect(result.valid).toBe(false)
          expect(result.error).toBe('Path points to system directory')
        }
      })

      test('rejects sneaky traversal patterns', () => {
        const sneakyPaths = [
          './../../../etc/passwd',
          '~/../../../etc/passwd',
          'Documents/../../../../../../etc/passwd'
        ]

        for (const sneaky of sneakyPaths) {
          const result = validator.validatePath(sneaky, os.homedir())
          
          expect(result.valid).toBe(false)
          expect(result.error).toBe('Path is outside allowed directories')
        }
      })
    })

    describe('error handling', () => {
      test('handles invalid path characters gracefully', () => {
        // This might not cause an error on all systems, but should be handled
        const result = validator.validatePath('test\r\nfile.txt', os.homedir())
        
        // Should either validate or reject safely
        expect(result.valid).toBeDefined()
        if (!result.valid) {
          expect(result.error).toBeDefined()
        }
      })
    })
  })

  describe('sanitizeFilename', () => {
    describe('happy path', () => {
      test('returns clean filename unchanged', () => {
        const result = validator.sanitizeFilename('document.txt')
        expect(result).toBe('document.txt')
      })

      test('preserves alphanumeric and basic punctuation', () => {
        const result = validator.sanitizeFilename('file-name_123.txt')
        expect(result).toBe('file-name_123.txt')
      })
    })

    describe('sanitization cases', () => {
      test('replaces path separators', () => {
        expect(validator.sanitizeFilename('folder/file.txt')).toBe('folder_file.txt')
        expect(validator.sanitizeFilename('folder\\file.txt')).toBe('folder_file.txt')
      })

      test('replaces directory traversal sequences', () => {
        expect(validator.sanitizeFilename('../file.txt')).toBe('__file.txt')
        expect(validator.sanitizeFilename('..\\..\\file.txt')).toBe('____file.txt')
      })

      test('replaces invalid filename characters', () => {
        expect(validator.sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt')
      })

      test('replaces null bytes', () => {
        expect(validator.sanitizeFilename('file\0name.txt')).toBe('file_name.txt')
      })

      test('replaces leading dots', () => {
        expect(validator.sanitizeFilename('...hidden.txt')).toBe('_.hidden.txt')
      })

      test('replaces whitespace', () => {
        expect(validator.sanitizeFilename('file name with spaces.txt')).toBe('file_name_with_spaces.txt')
        expect(validator.sanitizeFilename('file\t\n\rname.txt')).toBe('file_name.txt')
      })

      test('truncates long filenames to 255 characters', () => {
        const longName = 'a'.repeat(300) + '.txt'
        const result = validator.sanitizeFilename(longName)
        
        expect(result.length).toBe(255)
        expect(result.startsWith('aaa')).toBe(true)
      })

      test('handles complex malicious patterns', () => {
        const malicious = '../../etc/passwd<script>alert(1)</script>'
        const result = validator.sanitizeFilename(malicious)
        
        expect(result).toBe('____etc_passwd_script_alert(1)__script_')
        expect(result).not.toContain('/')
        expect(result).not.toContain('..')
        expect(result).not.toContain('<')
        expect(result).not.toContain('>')
      })
    })

    describe('edge cases', () => {
      test('handles empty string', () => {
        const result = validator.sanitizeFilename('')
        expect(result).toBe('')
      })

      test('handles only invalid characters', () => {
        const result = validator.sanitizeFilename('//\\\\<<>>')
        expect(result).toBe('________')
      })

      test('handles unicode characters', () => {
        const result = validator.sanitizeFilename('文件名.txt')
        expect(result).toBe('文件名.txt')
      })
    })
  })

  describe('validateCommandName', () => {
    describe('happy path', () => {
      test('validates simple command name', () => {
        const result = validator.validateCommandName('test')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('test')
        expect(result.error).toBeUndefined()
      })

      test('validates command with hyphens', () => {
        const result = validator.validateCommandName('test-command')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('test-command')
      })

      test('validates command with numbers', () => {
        const result = validator.validateCommandName('command123')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('command123')
      })

      test('validates complex valid command', () => {
        const result = validator.validateCommandName('my-complex-command-v2')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('my-complex-command-v2')
      })
    })

    describe('validation failures', () => {
      test('rejects empty command name', () => {
        const result = validator.validateCommandName('')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Command name cannot be empty')
      })

      test('rejects whitespace-only command', () => {
        const result = validator.validateCommandName('   ')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Command name cannot be empty')
      })

      test('rejects command starting with number', () => {
        const result = validator.validateCommandName('123command')
        
        expect(result.valid).toBe(false)
        expect(result.error).toContain('must start with a letter')
      })

      test('rejects command ending with hyphen', () => {
        const result = validator.validateCommandName('command-')
        
        expect(result.valid).toBe(false)
        expect(result.error).toContain('end with a letter or number')
      })

      test('rejects uppercase letters', () => {
        const result = validator.validateCommandName('MyCommand')
        
        expect(result.valid).toBe(false)
        expect(result.error).toContain('lowercase letters')
      })

      test('rejects special characters', () => {
        const invalidNames = [
          'command_name',
          'command.name',
          'command@name',
          'command!name',
          'command name',
          'command/name'
        ]

        for (const name of invalidNames) {
          const result = validator.validateCommandName(name)
          expect(result.valid).toBe(false)
          expect(result.error).toContain('lowercase letters, numbers, and hyphens')
        }
      })

      test('rejects command name too long', () => {
        const longName = 'a'.repeat(51)
        const result = validator.validateCommandName(longName)
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Command name too long (max 50 characters)')
      })

      test('accepts maximum length command', () => {
        const maxName = 'a' + 'b'.repeat(48) + 'c' // 50 chars
        const result = validator.validateCommandName(maxName)
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe(maxName)
      })
    })
  })

  describe('validateNamespace', () => {
    describe('happy path', () => {
      test('validates empty namespace (root)', () => {
        const result = validator.validateNamespace('')
        
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      test('validates simple namespace', () => {
        const result = validator.validateNamespace('utils')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('utils')
      })

      test('validates nested namespace', () => {
        const result = validator.validateNamespace('utils/helpers/string')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('utils/helpers/string')
      })

      test('validates namespace with hyphens', () => {
        const result = validator.validateNamespace('my-utils/string-helpers')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('my-utils/string-helpers')
      })

      test('validates single letter segments', () => {
        const result = validator.validateNamespace('a/b/c')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('a/b/c')
      })

      test('validates maximum depth namespace', () => {
        const result = validator.validateNamespace('a/b/c/d/e')
        
        expect(result.valid).toBe(true)
        expect(result.safePath).toBe('a/b/c/d/e')
      })
    })

    describe('validation failures', () => {
      test('rejects empty segments', () => {
        const result = validator.validateNamespace('utils//helpers')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Namespace segments cannot be empty')
      })

      test('rejects segments starting with hyphen', () => {
        const result = validator.validateNamespace('-utils/helpers')
        
        expect(result.valid).toBe(false)
        expect(result.error).toContain('Invalid namespace segment')
      })

      test('rejects segments with uppercase', () => {
        const result = validator.validateNamespace('Utils/Helpers')
        
        expect(result.valid).toBe(false)
        expect(result.error).toContain('lowercase letters')
      })

      test('rejects segments with special characters', () => {
        const invalidNamespaces = [
          'utils_helpers',
          'utils.helpers',
          'utils@helpers',
          'utils helpers',
          'utils!helpers'
        ]

        for (const ns of invalidNamespaces) {
          const result = validator.validateNamespace(ns)
          expect(result.valid).toBe(false)
          expect(result.error).toContain('Invalid namespace segment')
        }
      })

      test('rejects directory traversal', () => {
        const result = validator.validateNamespace('../utils')
        
        expect(result.valid).toBe(false)
        // The error could be for invalid segment or directory traversal
        expect(result.error).toContain('Invalid namespace segment')
      })

      test('rejects namespace too deep', () => {
        const result = validator.validateNamespace('a/b/c/d/e/f')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Namespace too deep (max 5 levels)')
      })

      test('rejects trailing slash', () => {
        const result = validator.validateNamespace('utils/')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Namespace segments cannot be empty')
      })

      test('rejects leading slash', () => {
        const result = validator.validateNamespace('/utils')
        
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Namespace segments cannot be empty')
      })
    })
  })

  describe('addAllowedPath', () => {
    test('adds and normalizes custom paths', () => {
      const customPath = '/custom/path/../allowed'
      validator.addAllowedPath(customPath)
      
      const testPath = path.join('/custom/allowed', 'file.txt')
      const result = validator.validatePath(testPath)
      
      expect(result.valid).toBe(true)
    })

    test('handles relative paths by resolving them', () => {
      validator.addAllowedPath('./relative/path')
      
      const expectedPath = path.resolve('./relative/path')
      const testPath = path.join(expectedPath, 'file.txt')
      const result = validator.validatePath(testPath)
      
      expect(result.valid).toBe(true)
    })
  })
})