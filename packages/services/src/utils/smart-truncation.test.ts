import { describe, test, expect } from 'bun:test'
import { SmartTruncation } from './smart-truncation'
import type { TruncationOptions } from './smart-truncation'

describe('SmartTruncation', () => {
  describe('estimateTokens', () => {
    test('estimates tokens for simple text', () => {
      const text = 'Hello world'
      const tokens = SmartTruncation.estimateTokens(text)
      
      // ~11 chars / 4 = ~3 tokens
      expect(tokens).toBeGreaterThan(1)
      expect(tokens).toBeLessThan(5)
    })

    test('adjusts for whitespace density', () => {
      const dense = 'abcdefghijklmnop'
      const sparse = 'a b c d e f g h '
      
      expect(SmartTruncation.estimateTokens(dense))
        .toBeGreaterThan(SmartTruncation.estimateTokens(sparse))
    })

    test('handles code with newlines', () => {
      const code = `function test() {
        return true;
      }`
      
      const tokens = SmartTruncation.estimateTokens(code)
      expect(tokens).toBeGreaterThan(5)
      expect(tokens).toBeLessThan(20)
    })

    test('handles empty string', () => {
      expect(SmartTruncation.estimateTokens('')).toBe(0)
    })

    test('handles very long text', () => {
      const longText = 'a'.repeat(10000)
      const tokens = SmartTruncation.estimateTokens(longText)
      
      expect(tokens).toBeGreaterThan(2000)
      expect(tokens).toBeLessThan(3000)
    })
  })

  describe('truncate', () => {
    describe('no truncation needed', () => {
      test('returns content as-is when under limit', () => {
        const content = 'Short content'
        const result = SmartTruncation.truncate(content, { maxTokens: 1000 })
        
        expect(result.content).toBe(content)
        expect(result.wasTruncated).toBe(false)
        expect(result.originalTokens).toBe(result.truncatedTokens)
        expect(result.preservedSections).toEqual(['full'])
      })

      test('handles custom token estimator', () => {
        const content = 'Test content'
        const customEstimator = (text: string) => text.length // Simple estimator
        
        const result = SmartTruncation.truncate(content, {
          maxTokens: 100,
          tokenEstimator: customEstimator
        })
        
        expect(result.wasTruncated).toBe(false)
        expect(result.originalTokens).toBe(12)
      })
    })

    describe('code section extraction', () => {
      test('preserves imports by default', () => {
        const content = `import { something } from 'module';
import React from 'react';

function test() {
  return true;
}`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 20 })
        
        expect(result.wasTruncated).toBe(true)
        expect(result.content).toContain('import')
        expect(result.preservedSections).toContain('imports')
      })

      test('skips imports when disabled', () => {
        const content = `import { something } from 'module';

export function test() {
  return true;
}`
        
        const result = SmartTruncation.truncate(content, {
          maxTokens: 15,
          preserveImports: false
        })
        
        expect(result.preservedSections).not.toContain('imports')
      })

      test('preserves exports', () => {
        const content = `function internal() {}

export function publicFunc() {
  return true;
}

export default class MyClass {}`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 30 })
        
        expect(result.content).toContain('export')
        expect(result.preservedSections.some(s => s.includes('export'))).toBe(true)
      })

      test('preserves classes', () => {
        const content = `class MyClass {
  constructor() {}
  
  public method1() {
    // Long implementation
    ${Array(50).fill('const x = 1;').join('\n')}
  }
  
  private method2() {}
}`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 50 })
        
        expect(result.content).toContain('class MyClass')
        expect(result.content).toContain('constructor')
        expect(result.preservedSections).toContain('class:MyClass')
      })

      test('preserves functions', () => {
        const content = `export function important() {
  return 'critical';
}

function helper() {
  // Long helper function
  ${Array(30).fill('const x = 1;').join('\n')}
}

const arrow = async () => {
  return await something();
}`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 40 })
        
        expect(result.content).toContain('function important')
        expect(result.preservedSections.some(s => s.includes('function'))).toBe(true)
      })

      test('preserves interfaces and types', () => {
        const content = `export interface User {
  id: string;
  name: string;
}

type Config = {
  apiUrl: string;
  timeout: number;
}

const implementation = 'very long ' + ${'code '.repeat(100)}`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 40 })
        
        expect(result.content).toContain('interface User')
        expect(result.content).toContain('type Config')
      })

      test('preserves important comments', () => {
        const content = `/**
 * Important JSDoc comment
 * @param x - The parameter
 */
function documented(x: string) {}

// TODO: Fix this later
const buggy = true;

// Regular comment
const normal = false;`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 40 })
        
        expect(result.content).toContain('Important JSDoc')
        expect(result.content).toContain('TODO')
        expect(result.preservedSections.some(s => s.includes('comment'))).toBe(true)
      })

      test('skips comments when disabled', () => {
        const content = `// TODO: Important note
/** JSDoc */
function test() {}`
        
        const result = SmartTruncation.truncate(content, {
          maxTokens: 10,
          preserveComments: false
        })
        
        expect(result.preservedSections.filter(s => s.includes('comment'))).toHaveLength(0)
      })
    })

    describe('prioritization', () => {
      test('prioritizes imports and exports highest', () => {
        const content = `// Low priority comment
function lowPriority() {}

import { critical } from 'module';
export { important } from 'exports';

class MediumPriority {}`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 20 })
        
        expect(result.content).toContain('import')
        expect(result.content).toContain('export')
        expect(result.content).not.toContain('lowPriority')
      })

      test('includes medium priority items when space allows', () => {
        const content = `import { a } from 'a';

export class Important {}

function medium() {
  return 'medium priority';
}

// Low priority
const x = 1;`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 60 })
        
        expect(result.content).toContain('import')
        expect(result.content).toContain('class Important')
        expect(result.content).toContain('function medium')
      })

      test('truncates other content to fit', () => {
        const content = `import { required } from 'module';

const longContent = \`${'x'.repeat(1000)}\`;`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 50 })
        
        expect(result.content).toContain('import')
        expect(result.content).toContain('... (content truncated)')
        expect(result.preservedSections).toContain('other:truncated')
      })

      test('adds truncation marker when content is cut', () => {
        const content = Array(100).fill('function test() { return true; }').join('\n')
        
        const result = SmartTruncation.truncate(content, { maxTokens: 50 })
        
        expect(result.content).toContain('// ... additional content truncated for summarization ...')
      })
    })

    describe('edge cases', () => {
      test('handles empty content', () => {
        const result = SmartTruncation.truncate('', { maxTokens: 100 })
        
        expect(result.content).toBe('')
        expect(result.wasTruncated).toBe(false)
        expect(result.originalTokens).toBe(0)
      })

      test('handles malformed code gracefully', () => {
        const malformed = `class Unclosed {
  method() {
    // Missing closing braces`
        
        // Should not throw
        const result = SmartTruncation.truncate(malformed, { maxTokens: 20 })
        
        expect(result.wasTruncated).toBe(true)
        expect(result.content).toBeDefined()
      })

      test('handles deeply nested structures', () => {
        const nested = `function outer() {
  function inner() {
    function deeper() {
      function deepest() {
        ${'{ '.repeat(50)}
        ${'} '.repeat(50)}
      }
    }
  }
}`
        
        // Should not hang or throw
        const result = SmartTruncation.truncate(nested, { maxTokens: 30 })
        
        expect(result.wasTruncated).toBe(true)
        expect(result.content).toContain('function')
      })

      test('handles multi-line exports', () => {
        const content = `export {
  one,
  two,
  three,
  four
} from 'module';`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 20 })
        
        expect(result.content).toContain('export')
        expect(result.content).toContain('one')
        expect(result.content).toContain('four')
      })

      test('handles arrow functions with various syntaxes', () => {
        const content = `export const func1 = () => true;
const func2 = async (param) => {
  return await something();
};
export const func3 = (a, b) => a + b;`
        
        const result = SmartTruncation.truncate(content, { maxTokens: 30 })
        
        // Arrow functions should be detected
        expect(result.wasTruncated).toBe(true)
      })

      test('handles maxTokens = 0', () => {
        const content = 'Some content'
        const result = SmartTruncation.truncate(content, { maxTokens: 0 })
        
        expect(result.wasTruncated).toBe(true)
        expect(result.content).toContain('// ... additional content truncated')
      })
    })

    describe('complex real-world scenarios', () => {
      test('handles React component file', () => {
        const component = `import React, { useState, useEffect } from 'react';
import { Button } from './components';
import './styles.css';

interface Props {
  title: string;
  onClose: () => void;
}

/**
 * Main modal component
 */
export const Modal: React.FC<Props> = ({ title, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    // Long effect implementation
    ${Array(30).fill('console.log("effect");').join('\n')}
  }, []);
  
  const handleClose = () => {
    // Long handler
    ${Array(20).fill('const x = 1;').join('\n')}
    onClose();
  };
  
  return (
    <div>
      {/* Long JSX */}
      ${Array(50).fill('<div>Content</div>').join('\n')}
    </div>
  );
};

export default Modal;`
        
        const result = SmartTruncation.truncate(component, { maxTokens: 100 })
        
        expect(result.wasTruncated).toBe(true)
        expect(result.content).toContain('import React')
        expect(result.content).toContain('interface Props')
        expect(result.content).toContain('export const Modal')
        expect(result.preservedSections).toContain('imports')
      })

      test('handles service class file', () => {
        const service = `import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: Repository<User>
  ) {}
  
  async findAll(): Promise<User[]> {
    // Complex query logic
    ${Array(40).fill('const query = {};').join('\n')}
    return this.userRepository.find();
  }
  
  async findOne(id: string): Promise<User> {
    return this.userRepository.findOne(id);
  }
  
  private validateUser(user: User): boolean {
    // Long validation logic
    ${Array(30).fill('if (user.field) return false;').join('\n')}
    return true;
  }
}`
        
        const result = SmartTruncation.truncate(service, { maxTokens: 80 })
        
        expect(result.wasTruncated).toBe(true)
        expect(result.content).toContain('import')
        expect(result.content).toContain('export class UserService')
        expect(result.content).toContain('constructor')
        expect(result.preservedSections).toContain('class:UserService')
      })
    })
  })

  describe('getTruncationSummary', () => {
    test('reports no truncation', () => {
      const result = {
        content: 'Full content',
        wasTruncated: false,
        originalTokens: 100,
        truncatedTokens: 100,
        preservedSections: ['full']
      }
      
      const summary = SmartTruncation.getTruncationSummary(result)
      
      expect(summary).toBe('Full file content preserved.')
    })

    test('reports truncation percentage', () => {
      const result = {
        content: 'Truncated',
        wasTruncated: true,
        originalTokens: 1000,
        truncatedTokens: 400,
        preservedSections: ['imports', 'exports']
      }
      
      const summary = SmartTruncation.getTruncationSummary(result)
      
      expect(summary).toContain('60%')
      expect(summary).toContain('imports, exports')
      expect(summary).toContain('~1000 tokens')
      expect(summary).toContain('~400 tokens')
    })

    test('handles edge case percentages', () => {
      const result = {
        content: '',
        wasTruncated: true,
        originalTokens: 100,
        truncatedTokens: 99,
        preservedSections: []
      }
      
      const summary = SmartTruncation.getTruncationSummary(result)
      
      expect(summary).toContain('1%')
    })

    test('formats section list properly', () => {
      const result = {
        content: '',
        wasTruncated: true,
        originalTokens: 100,
        truncatedTokens: 50,
        preservedSections: ['imports', 'class:MyClass', 'function:test', 'other:truncated']
      }
      
      const summary = SmartTruncation.getTruncationSummary(result)
      
      expect(summary).toContain('imports, class:MyClass, function:test, other:truncated')
    })
  })

  describe('performance', () => {
    test('handles large files efficiently', () => {
      const largeFile = Array(1000).fill(`
function component${Math.random()}() {
  const state = useState();
  return <div>${'content '.repeat(50)}</div>;
}`).join('\n')
      
      const startTime = performance.now()
      const result = SmartTruncation.truncate(largeFile, { maxTokens: 500 })
      const endTime = performance.now()
      
      expect(result.wasTruncated).toBe(true)
      expect(endTime - startTime).toBeLessThan(500) // Should be reasonably fast
    })

    test('token estimation is consistent', () => {
      const text = 'Consistent text for testing'
      
      const estimate1 = SmartTruncation.estimateTokens(text)
      const estimate2 = SmartTruncation.estimateTokens(text)
      
      expect(estimate1).toBe(estimate2)
    })

    test('truncation is deterministic', () => {
      const content = `import { a } from 'b';
export class Test {
  method() { return true; }
}`
      
      const result1 = SmartTruncation.truncate(content, { maxTokens: 30 })
      const result2 = SmartTruncation.truncate(content, { maxTokens: 30 })
      
      expect(result1.content).toBe(result2.content)
      expect(result1.truncatedTokens).toBe(result2.truncatedTokens)
      expect(result1.preservedSections).toEqual(result2.preservedSections)
    })
  })

  describe('options combinations', () => {
    test('respects all preservation options', () => {
      const content = `import { a } from 'b';
export { c } from 'd';
class MyClass {}
function myFunc() {}
// TODO: Important`
      
      const result = SmartTruncation.truncate(content, {
        maxTokens: 100,
        preserveImports: true,
        preserveExports: true,
        preserveClasses: true,
        preserveFunctions: true,
        preserveComments: true
      })
      
      expect(result.content).toContain('import')
      expect(result.content).toContain('export')
      expect(result.content).toContain('class')
      expect(result.content).toContain('function')
      expect(result.content).toContain('TODO')
    })

    test('skips all preservation when disabled', () => {
      const content = `import { a } from 'b';
export class Test {}
// TODO: Fix
Other content here`
      
      const result = SmartTruncation.truncate(content, {
        maxTokens: 10,
        preserveImports: false,
        preserveExports: false,
        preserveClasses: false,
        preserveFunctions: false,
        preserveComments: false
      })
      
      // Should only have 'other' content
      expect(result.preservedSections.every(s => s === 'other' || s === 'other:truncated')).toBe(true)
    })
  })
})