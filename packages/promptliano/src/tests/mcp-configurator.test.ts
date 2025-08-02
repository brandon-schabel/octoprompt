import { describe, test, expect } from 'bun:test'
import { MCPConfigurator } from '../lib/mcp-configurator.js'

describe('MCPConfigurator', () => {
  const configurator = new MCPConfigurator()

  describe('sanitizeProjectName', () => {
    test('should handle normal project names', () => {
      const sanitize = (configurator as any).sanitizeProjectName.bind(configurator)

      expect(sanitize('/Users/test/my-project')).toBe('my-project')
      expect(sanitize('/Users/test/MyProject')).toBe('myproject')
      expect(sanitize('/Users/test/my_project_123')).toBe('my-project-123')
    })

    test('should handle empty or invalid paths', () => {
      const sanitize = (configurator as any).sanitizeProjectName.bind(configurator)

      expect(sanitize('')).toBe('default-project')
      expect(sanitize('   ')).toBe('default-project')
      expect(sanitize('/')).toBe('project')
      expect(sanitize('//')).toBe('project')
    })

    test('should handle paths with special characters', () => {
      const sanitize = (configurator as any).sanitizeProjectName.bind(configurator)

      expect(sanitize('/Users/test/my@project!')).toBe('my-project-')
      expect(sanitize('/Users/test/###')).toBe('---') // All special chars become dashes
      expect(sanitize('/Users/test/project.name')).toBe('project-name')
    })

    test('should handle Windows paths', () => {
      const sanitize = (configurator as any).sanitizeProjectName.bind(configurator)

      expect(sanitize('C:\\Users\\test\\my-project')).toBe('my-project')
      expect(sanitize('C:\\Users\\test\\MyProject')).toBe('myproject')
    })
  })

  describe('generateProjectId', () => {
    test('should generate consistent IDs for same path', () => {
      const generateId = (configurator as any).generateProjectId.bind(configurator)

      const path = '/Users/test/my-project'
      const id1 = generateId(path)
      const id2 = generateId(path)

      expect(id1).toBe(id2)
      expect(typeof id1).toBe('number')
      expect(id1).toBeGreaterThan(0)
    })

    test('should generate different IDs for different paths', () => {
      const generateId = (configurator as any).generateProjectId.bind(configurator)

      const id1 = generateId('/Users/test/project1')
      const id2 = generateId('/Users/test/project2')

      expect(id1).not.toBe(id2)
    })

    test('should handle case-sensitive paths', () => {
      const generateId = (configurator as any).generateProjectId.bind(configurator)

      const id1 = generateId('/Users/test/MyProject')
      const id2 = generateId('/Users/test/myproject')

      expect(id1).not.toBe(id2)
    })
  })
})
