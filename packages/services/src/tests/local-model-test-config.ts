import { LOW_MODEL_CONFIG } from '@promptliano/config'
import type { AiSdkOptions } from '@promptliano/schemas'

// Test configuration for LMStudio local model testing
export const LOCAL_MODEL_TEST_CONFIG = {
  // LMStudio connection settings
  baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://192.168.1.38:1234/v1',
  model: 'openai/gpt-oss-20b',
  
  // Test timeouts (AI responses can be slow)
  timeouts: {
    singleFile: 30000,      // 30 seconds for single file
    batchFiles: 60000,      // 60 seconds for batch
    projectSummary: 90000,  // 90 seconds for full project
    default: 20000          // 20 seconds default
  },

  // Retry configuration for network issues
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2
  },

  // Test model configuration (extends LOW_MODEL_CONFIG)
  modelOptions: {
    ...LOW_MODEL_CONFIG,
    temperature: 0.3,  // Lower for consistent test results
    maxTokens: 1000    // Smaller for faster tests
  } as AiSdkOptions,

  // Performance thresholds for benchmarking
  performance: {
    maxResponseTime: {
      singleFile: 10000,     // 10s max for single file
      batchFiles: 30000,     // 30s max for batch
      projectSummary: 60000  // 60s max for project
    },
    minTokensPerSecond: 10,
    maxTokenUsage: {
      singleFile: 2000,
      batchFiles: 10000,
      projectSummary: 20000
    }
  },

  // Quality thresholds
  quality: {
    minSummaryLength: 50,
    maxSummaryLength: 500,
    requiredElements: ['PURPOSE', 'TYPE'],
    bannedPhrases: ['...', 'undefined', 'null', 'error']
  }
}

// Helper to check if LMStudio is available
export async function isLMStudioAvailable(): Promise<boolean> {
  try {
    const baseUrl = LOCAL_MODEL_TEST_CONFIG.baseUrl.replace(/\/v1$/, '')
    const response = await fetch(`${baseUrl}/v1/models`)
    if (!response.ok) return false
    
    const data = await response.json()
    const models = data.data || []
    
    // Check if our target model is loaded
    return models.some((m: any) => 
      m.id === LOCAL_MODEL_TEST_CONFIG.model || 
      m.id.includes('gpt-oss')
    )
  } catch (error) {
    console.warn('LMStudio not available:', error)
    return false
  }
}

// Skip test if LMStudio not available
export function requireLMStudio() {
  const skip = process.env.SKIP_LMSTUDIO_TESTS === 'true'
  if (skip) {
    console.log('Skipping LMStudio tests (SKIP_LMSTUDIO_TESTS=true)')
    return false
  }
  return true
}

// Test data factory for creating mock files
export function createMockFile(overrides: Partial<{
  name: string
  path: string
  content: string
  type: string
  size: number
}> = {}) {
  const defaults = {
    name: 'test-file.ts',
    path: 'src/test-file.ts',
    content: `export function testFunction() {
  return "Hello from test"
}

export class TestClass {
  constructor(private value: string) {}
  
  getValue(): string {
    return this.value
  }
}`,
    type: 'typescript',
    size: 200
  }

  return { ...defaults, ...overrides }
}

// Create a large file for truncation testing
export function createLargeFile(sizeInKB: number = 100) {
  const chunks: string[] = []
  const chunkSize = 1024 // 1KB chunks
  const targetSize = sizeInKB * 1024
  
  // Generate realistic code content
  let currentSize = 0
  let classCounter = 0
  
  while (currentSize < targetSize) {
    const chunk = `
export class GeneratedClass${classCounter++} {
  private data: Map<string, any> = new Map()
  
  constructor(private id: string) {
    this.initialize()
  }
  
  private initialize(): void {
    // Initialize with sample data
    for (let i = 0; i < 100; i++) {
      this.data.set(\`key-\${i}\`, {
        value: Math.random(),
        timestamp: Date.now(),
        metadata: { index: i }
      })
    }
  }
  
  public processData(): any[] {
    return Array.from(this.data.values())
      .filter(item => item.value > 0.5)
      .map(item => ({
        ...item,
        processed: true
      }))
  }
}
`
    chunks.push(chunk)
    currentSize += chunk.length
  }
  
  return {
    name: 'large-file.ts',
    path: 'src/large-file.ts',
    content: chunks.join('\n'),
    type: 'typescript',
    size: currentSize
  }
}

// Create edge case files for testing
export const edgeCaseFiles = {
  empty: {
    name: 'empty.ts',
    path: 'src/empty.ts',
    content: '',
    type: 'typescript',
    size: 0
  },
  
  whitespaceOnly: {
    name: 'whitespace.ts',
    path: 'src/whitespace.ts',
    content: '   \n\n\t\t\n   ',
    type: 'typescript',
    size: 10
  },
  
  commentsOnly: {
    name: 'comments.ts',
    path: 'src/comments.ts',
    content: `// This file only contains comments
/* 
 * Multi-line comment
 * No actual code here
 */
// Another comment`,
    type: 'typescript',
    size: 100
  },
  
  malformed: {
    name: 'malformed.ts',
    path: 'src/malformed.ts',
    content: `export function broken( {
  // Syntax error - unclosed function
  return "This won't compile"
}}}`,
    type: 'typescript',
    size: 80
  },
  
  binary: {
    name: 'image.png',
    path: 'assets/image.png',
    content: Buffer.from([0x89, 0x50, 0x4E, 0x47]).toString(),
    type: 'binary',
    size: 4
  }
}

// Multi-language test corpus
export const multiLanguageFiles = {
  typescript: createMockFile({ name: 'example.ts', type: 'typescript' }),
  
  javascript: {
    name: 'example.js',
    path: 'src/example.js',
    content: `function processData(input) {
  return input.map(item => ({
    ...item,
    processed: true
  }))
}

module.exports = { processData }`,
    type: 'javascript',
    size: 150
  },
  
  python: {
    name: 'example.py',
    path: 'src/example.py',
    content: `def process_data(input_data):
    """Process input data and return results."""
    return [
        {**item, 'processed': True}
        for item in input_data
    ]

class DataProcessor:
    def __init__(self):
        self.data = []
    
    def process(self):
        return process_data(self.data)`,
    type: 'python',
    size: 250
  },
  
  rust: {
    name: 'example.rs',
    path: 'src/example.rs',
    content: `pub struct DataProcessor {
    data: Vec<String>,
}

impl DataProcessor {
    pub fn new() -> Self {
        DataProcessor { data: Vec::new() }
    }
    
    pub fn process(&self) -> Vec<String> {
        self.data.iter().cloned().collect()
    }
}`,
    type: 'rust',
    size: 200
  }
}