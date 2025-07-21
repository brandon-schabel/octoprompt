import { describe, expect, it } from 'bun:test'
import { analyzeCodeImportsExports } from './code-analysis'

describe('analyzeCodeImportsExports', () => {
  it('should return null for non-JS/TS files', () => {
    const result = analyzeCodeImportsExports('# Hello World', 'README.md')
    expect(result).toBeNull()
  })

  it('should analyze TypeScript default imports', () => {
    const code = `
import React from 'react'
import path from 'node:path'
`
    const result = analyzeCodeImportsExports(code, 'test.ts')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(2)
    expect(result!.imports[0]).toEqual({
      source: 'react',
      specifiers: [{ type: 'default', local: 'React' }]
    })
    expect(result!.imports[1]).toEqual({
      source: 'node:path',
      specifiers: [{ type: 'default', local: 'path' }]
    })
  })

  it('should analyze named imports', () => {
    const code = `
import { useState, useEffect } from 'react'
import { readFile, writeFile as write } from 'fs'
`
    const result = analyzeCodeImportsExports(code, 'test.tsx')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(2)
    expect(result!.imports[0]).toEqual({
      source: 'react',
      specifiers: [
        { type: 'named', imported: 'useState', local: 'useState' },
        { type: 'named', imported: 'useEffect', local: 'useEffect' }
      ]
    })
    expect(result!.imports[1]).toEqual({
      source: 'fs',
      specifiers: [
        { type: 'named', imported: 'readFile', local: 'readFile' },
        { type: 'named', imported: 'writeFile', local: 'write' }
      ]
    })
  })

  it('should analyze namespace imports', () => {
    const code = `
import * as fs from 'fs'
import * as React from 'react'
`
    const result = analyzeCodeImportsExports(code, 'test.js')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(2)
    expect(result!.imports[0]).toEqual({
      source: 'fs',
      specifiers: [{ type: 'namespace', local: 'fs' }]
    })
  })

  it('should analyze mixed imports', () => {
    const code = `
import React, { useState, useEffect } from 'react'
`
    const result = analyzeCodeImportsExports(code, 'test.jsx')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(1)
    expect(result!.imports[0]).toEqual({
      source: 'react',
      specifiers: [
        { type: 'default', local: 'React' },
        { type: 'named', imported: 'useState', local: 'useState' },
        { type: 'named', imported: 'useEffect', local: 'useEffect' }
      ]
    })
  })

  it('should analyze default exports', () => {
    const code = `
export default function App() {
  return <div>Hello</div>
}
`
    const result = analyzeCodeImportsExports(code, 'App.tsx')
    expect(result).not.toBeNull()
    expect(result!.exports).toHaveLength(1)
    expect(result!.exports[0]).toEqual({
      type: 'default'
    })
  })

  it('should analyze named exports', () => {
    const code = `
export const API_KEY = 'secret'
export function fetchData() {}
export class DataManager {}
`
    const result = analyzeCodeImportsExports(code, 'utils.ts')
    expect(result).not.toBeNull()
    expect(result!.exports).toHaveLength(3)
    expect(result!.exports[0]).toEqual({
      type: 'named',
      specifiers: [{ exported: 'API_KEY', local: 'API_KEY' }]
    })
    expect(result!.exports[1]).toEqual({
      type: 'named',
      specifiers: [{ exported: 'fetchData', local: 'fetchData' }]
    })
    expect(result!.exports[2]).toEqual({
      type: 'named',
      specifiers: [{ exported: 'DataManager', local: 'DataManager' }]
    })
  })

  it('should analyze re-exports', () => {
    const code = `
export { useState, useEffect } from 'react'
export { default as MyComponent } from './MyComponent'
export * from './types'
`
    const result = analyzeCodeImportsExports(code, 'index.ts')
    expect(result).not.toBeNull()
    expect(result!.exports).toHaveLength(3)
    expect(result!.exports[0]).toEqual({
      type: 'named',
      source: 'react',
      specifiers: [
        { exported: 'useState', local: 'useState' },
        { exported: 'useEffect', local: 'useEffect' }
      ]
    })
    expect(result!.exports[2]).toEqual({
      type: 'all',
      source: './types'
    })
  })

  it('should handle export all declarations', () => {
    const code = `
export * from './components'
export * as utils from './utils'
`
    const result = analyzeCodeImportsExports(code, 'barrel.ts')
    expect(result).not.toBeNull()
    expect(result!.exports).toHaveLength(2)
    expect(result!.exports[0]).toEqual({
      type: 'all',
      source: './components'
    })
  })

  it('should handle syntax errors gracefully', () => {
    const code = `
import { from 'react' // syntax error
export class
`
    const result = analyzeCodeImportsExports(code, 'error.ts')
    expect(result).toBeNull()
  })

  it('should handle empty files', () => {
    const result = analyzeCodeImportsExports('', 'empty.ts')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(0)
    expect(result!.exports).toHaveLength(0)
  })

  it('should handle files with only comments', () => {
    const code = `
// This is a comment
/* 
  Multi-line comment
*/
`
    const result = analyzeCodeImportsExports(code, 'comments.js')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(0)
    expect(result!.exports).toHaveLength(0)
  })

  it('should analyze Python imports', () => {
    const code = `
import os
import sys
from datetime import datetime
from math import pi, sqrt as square_root
import numpy as np
from ..utils import helper
`
    const result = analyzeCodeImportsExports(code, 'test.py')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(6)

    // Check simple import
    expect(result!.imports[0]).toEqual({
      source: '',
      specifiers: [{ type: 'named', imported: 'os', local: 'os' }]
    })

    // Check from import
    expect(result!.imports[2]).toEqual({
      source: 'datetime',
      specifiers: [{ type: 'named', imported: 'datetime', local: 'datetime' }]
    })

    // Check aliased imports
    expect(result!.imports[3]).toEqual({
      source: 'math',
      specifiers: [
        { type: 'named', imported: 'pi', local: 'pi' },
        { type: 'named', imported: 'sqrt', local: 'square_root' }
      ]
    })
  })

  it('should analyze Python exports (top-level functions and classes)', () => {
    const code = `
import os

def calculate_area(radius):
    return 3.14 * radius ** 2

class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height
    
    def area(self):
        return self.width * self.height

def main():
    print("Hello")

async def async_function():
    pass

class _PrivateClass:
    pass
`
    const result = analyzeCodeImportsExports(code, 'module.py')
    expect(result).not.toBeNull()
    expect(result!.exports).toHaveLength(4) // All top-level defs/classes (async_function not matched by regex)

    const exportedNames = result!.exports.flatMap((e) => e.specifiers?.map((s) => s.exported) || [])
    expect(exportedNames).toContain('calculate_area')
    expect(exportedNames).toContain('Rectangle')
    expect(exportedNames).toContain('main')
    expect(exportedNames).toContain('_PrivateClass')
  })

  it('should handle Python files with no imports or exports', () => {
    const code = `
# Just comments and constants
PI = 3.14159
GREETING = "Hello, World!"

if __name__ == "__main__":
    print(GREETING)
`
    const result = analyzeCodeImportsExports(code, 'constants.py')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(0)
    expect(result!.exports).toHaveLength(0) // No functions or classes
  })

  it('should analyze complex real-world example', () => {
    const code = `
import React, { useState, useEffect } from 'react'
import { Button, Input } from '@/components/ui'
import type { User, Settings } from './types'
import * as api from './api'

export interface Props {
  user: User
  settings: Settings
}

export const UserProfile = ({ user, settings }) => {
  const [name, setName] = useState(user.name)
  
  useEffect(() => {
    api.fetchUserData(user.id)
  }, [user.id])

  return <div>{name}</div>
}

export default UserProfile

export { api }
`
    const result = analyzeCodeImportsExports(code, 'UserProfile.tsx')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(4)
    expect(result!.exports.length).toBeGreaterThan(0)

    // Check imports
    expect(result!.imports[0].source).toBe('react')
    expect(result!.imports[1].source).toBe('@/components/ui')
    expect(result!.imports[2].source).toBe('./types')
    expect(result!.imports[3].source).toBe('./api')

    // Check exports include both default and named
    const hasDefaultExport = result!.exports.some((e) => e.type === 'default')
    const hasNamedExports = result!.exports.some((e) => e.type === 'named')
    expect(hasDefaultExport).toBe(true)
    expect(hasNamedExports).toBe(true)
  })
})
