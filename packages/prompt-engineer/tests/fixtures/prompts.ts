/**
 * Test prompts for various optimization scenarios
 */

export const TEST_PROMPTS = {
  // Simple prompts for basic testing
  simple: {
    sorting: 'Write a function to sort an array of numbers',
    greeting: 'Create a greeting message for a user',
    calculation: 'Calculate the sum of two numbers'
  },

  // Algorithmic prompts for structured optimization
  algorithmic: {
    palindrome: `Implement a function to find the longest palindromic substring in a given string.
The function should handle edge cases like empty strings and single characters.`,
    
    binarySearch: `Implement a binary search algorithm. The function should take 
a sorted array and a target value. If the target is found, 
return its index. Otherwise, return -1.`,
    
    fibonacci: `Write an efficient function to calculate the nth Fibonacci number.
Consider both recursive and iterative approaches, and optimize for performance.`,
    
    quickSort: `Implement the QuickSort algorithm with the following requirements:
1. Choose a good pivot selection strategy
2. Handle arrays with duplicate values
3. Optimize for nearly sorted arrays
4. Include both in-place and out-of-place versions`
  },

  // Decision-making prompts for self-consistency testing
  decisionMaking: {
    architecture: `Should we migrate our monolithic application to microservices?
Consider factors like team size, technical debt, and scalability needs.`,
    
    technology: `Choose between React and Vue for a new enterprise web application.
Consider developer experience, ecosystem, performance, and long-term maintenance.`,
    
    deployment: `Decide whether to use Kubernetes or traditional VMs for deployment.
Factor in complexity, scalability, cost, and team expertise.`
  },

  // Complex multi-step prompts for advanced testing
  complex: {
    dataProcessing: `First, load the configuration from the file.
Then, validate all the required fields.
If validation passes, process each item in the list.
For each item, apply the transformation and store the result.
Finally, generate a summary report.`,
    
    apiDesign: `Design a RESTful API for a task management system with the following requirements:
- User authentication and authorization
- CRUD operations for tasks
- Task assignment and collaboration features
- Real-time updates via WebSockets
- Rate limiting and caching strategies
- Comprehensive error handling`,
    
    systemDesign: `Design a distributed caching system that:
1. Supports multiple cache eviction policies (LRU, LFU, FIFO)
2. Handles cache invalidation across nodes
3. Provides consistent hashing for distribution
4. Implements cache warming strategies
5. Monitors cache hit/miss ratios
6. Scales horizontally with minimal overhead`
  },

  // Edge cases and error scenarios
  edgeCases: {
    empty: '',
    veryShort: 'Sort',
    veryLong: 'a'.repeat(10000),
    specialChars: 'Implement a function that handles @#$%^&*() special characters',
    unicode: 'Process text with emojis 🚀 and unicode characters ñ, ü, 中文',
    malformed: 'This prompt is incomplete and...',
    contradictory: 'Write a function that returns true and false at the same time'
  },

  // Language-specific prompts
  languageSpecific: {
    typescript: {
      prompt: 'Create a generic TypeScript class for a binary search tree',
      language: 'typescript',
      constraints: ['Use proper type constraints', 'Implement iterator protocol']
    },
    python: {
      prompt: 'Write a Python decorator for memoization with TTL support',
      language: 'python',
      constraints: ['Support async functions', 'Thread-safe implementation']
    },
    rust: {
      prompt: 'Implement a thread-safe concurrent hash map in Rust',
      language: 'rust',
      constraints: ['Zero-cost abstractions', 'No unsafe code']
    }
  },

  // Prompts with examples for testing example handling
  withExamples: {
    arrayTransform: {
      description: 'Transform an array of objects based on rules',
      examples: [
        { input: '[{a:1},{a:2}]', output: '[{b:2},{b:4}]' },
        { input: '[{a:0}]', output: '[{b:0}]' }
      ]
    },
    stringParsing: {
      description: 'Parse a custom format string into structured data',
      examples: [
        { input: 'user:john age:30', output: '{user:"john",age:30}' },
        { input: 'status:active', output: '{status:"active"}' }
      ]
    }
  },

  // Performance-critical prompts
  performance: {
    matrixMultiplication: {
      prompt: 'Implement efficient matrix multiplication',
      performance: 'Must handle 1000x1000 matrices in under 1 second'
    },
    textSearch: {
      prompt: 'Implement a fast text search algorithm',
      performance: 'Should search 1GB of text in under 100ms'
    }
  }
}

// Helper function to get a random prompt for testing
export function getRandomPrompt(): string {
  const categories = Object.values(TEST_PROMPTS)
  const category = categories[Math.floor(Math.random() * categories.length)]
  
  if (typeof category === 'object' && !Array.isArray(category)) {
    const prompts = Object.values(category)
    const prompt = prompts[Math.floor(Math.random() * prompts.length)]
    
    if (typeof prompt === 'string') {
      return prompt
    } else if (typeof prompt === 'object' && 'prompt' in prompt) {
      return prompt.prompt
    } else if (typeof prompt === 'object' && 'description' in prompt) {
      return prompt.description
    }
  }
  
  return TEST_PROMPTS.simple.sorting
}

// Test prompt builder for complex scenarios
export class PromptBuilder {
  private prompt: string = ''
  private constraints: string[] = []
  private examples: Array<{ input: string; output: string }> = []
  private performance?: string
  private language?: string

  withBase(prompt: string): this {
    this.prompt = prompt
    return this
  }

  withConstraints(...constraints: string[]): this {
    this.constraints.push(...constraints)
    return this
  }

  withExamples(examples: Array<{ input: string; output: string }>): this {
    this.examples.push(...examples)
    return this
  }

  withPerformance(requirement: string): this {
    this.performance = requirement
    return this
  }

  withLanguage(language: string): this {
    this.language = language
    return this
  }

  build(): {
    description: string
    constraints?: string[]
    examples?: Array<{ input: string; output: string }>
    performance?: string
    language?: string
  } {
    return {
      description: this.prompt,
      ...(this.constraints.length > 0 && { constraints: this.constraints }),
      ...(this.examples.length > 0 && { examples: this.examples }),
      ...(this.performance && { performance: this.performance }),
      ...(this.language && { language: this.language })
    }
  }
}