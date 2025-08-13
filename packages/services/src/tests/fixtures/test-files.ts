import type { ProjectFile } from '@promptliano/schemas'

// Sample TypeScript files for testing
export const typescriptFiles = {
  simpleClass: {
    id: 1,
    projectId: 1,
    path: 'src/models/User.ts',
    name: 'User.ts',
    content: `import { z } from 'zod'
import { BaseModel } from './BaseModel'

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.date()
})

export type User = z.infer<typeof UserSchema>

export class UserModel extends BaseModel<User> {
  constructor(data: User) {
    super(data)
  }
  
  getDisplayName(): string {
    return this.data.name || this.data.email
  }
  
  isActive(): boolean {
    const daysSinceCreation = (Date.now() - this.data.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceCreation < 30
  }
}`,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 500,
    checksum: 'mock-checksum-1'
  } as ProjectFile,

  serviceWithImports: {
    id: 2,
    projectId: 1,
    path: 'src/services/AuthService.ts',
    name: 'AuthService.ts',
    content: `import { UserModel } from '../models/User'
import { TokenManager } from '../utils/TokenManager'
import { DatabaseConnection } from '../database/Connection'
import type { LoginCredentials, AuthToken } from '../types/auth'

export class AuthService {
  private tokenManager: TokenManager
  private db: DatabaseConnection
  
  constructor() {
    this.tokenManager = new TokenManager()
    this.db = DatabaseConnection.getInstance()
  }
  
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const user = await this.db.findUser(credentials.email)
    if (!user || !this.validatePassword(credentials.password, user.passwordHash)) {
      throw new Error('Invalid credentials')
    }
    
    return this.tokenManager.generateToken(user)
  }
  
  async logout(token: string): Promise<void> {
    await this.tokenManager.revokeToken(token)
  }
  
  private validatePassword(password: string, hash: string): boolean {
    // Password validation logic
    return true
  }
}

export default new AuthService()`,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 800,
    checksum: 'mock-checksum-2'
  } as ProjectFile,

  utilityFunctions: {
    id: 3,
    projectId: 1,
    path: 'src/utils/helpers.ts',
    name: 'helpers.ts',
    content: `export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxAttempts - 1) throw error
      await sleep(1000 * Math.pow(2, i))
    }
  }
  throw new Error('Retry failed')
}`,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 600,
    checksum: 'mock-checksum-3'
  } as ProjectFile
}

// Sample Python files
export const pythonFiles = {
  dataProcessor: {
    id: 4,
    projectId: 1,
    path: 'src/processors/data_processor.py',
    name: 'data_processor.py',
    content: `import pandas as pd
import numpy as np
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class ProcessingResult:
    """Result of data processing operation."""
    success: bool
    data: Optional[pd.DataFrame]
    errors: List[str]
    metrics: Dict[str, float]

class DataProcessor:
    """Main data processing class for ETL operations."""
    
    def __init__(self, config: Dict[str, any]):
        self.config = config
        self.cache = {}
        
    def process_csv(self, filepath: str) -> ProcessingResult:
        """Process CSV file and return results."""
        try:
            df = pd.read_csv(filepath)
            df = self._clean_data(df)
            df = self._transform_data(df)
            
            metrics = {
                'rows': len(df),
                'columns': len(df.columns),
                'null_percentage': df.isnull().sum().sum() / df.size
            }
            
            return ProcessingResult(
                success=True,
                data=df,
                errors=[],
                metrics=metrics
            )
        except Exception as e:
            return ProcessingResult(
                success=False,
                data=None,
                errors=[str(e)],
                metrics={}
            )
    
    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove duplicates and handle missing values."""
        df = df.drop_duplicates()
        df = df.fillna(method='ffill')
        return df
    
    def _transform_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply transformations to the dataframe."""
        # Custom transformations here
        return df`,
    type: 'file',
    extension: '.py',
    created: Date.now(),
    updated: Date.now(),
    size: 1200,
    checksum: 'mock-checksum-4'
  } as ProjectFile
}

// Large file for testing truncation
export function createLargeProjectFile(sizeInKB: number = 100): ProjectFile {
  const lines: string[] = []
  const targetLines = Math.floor((sizeInKB * 1024) / 80) // Assuming ~80 chars per line
  
  // Add imports at the top
  lines.push(`import { Component, Injectable, OnInit } from '@angular/core'`)
  lines.push(`import { HttpClient } from '@angular/common/http'`)
  lines.push(`import { Observable, Subject, BehaviorSubject } from 'rxjs'`)
  lines.push(`import { map, filter, debounceTime } from 'rxjs/operators'`)
  lines.push('')
  
  // Generate multiple classes
  for (let i = 0; i < targetLines / 50; i++) {
    lines.push(`@Injectable({ providedIn: 'root' })`)
    lines.push(`export class GeneratedService${i} {`)
    lines.push(`  private data$ = new BehaviorSubject<any[]>([])`)
    lines.push(`  `)
    lines.push(`  constructor(private http: HttpClient) {`)
    lines.push(`    this.initialize()`)
    lines.push(`  }`)
    lines.push(`  `)
    lines.push(`  private initialize(): void {`)
    lines.push(`    // Initialize service with default data`)
    lines.push(`    const defaultData = []`)
    lines.push(`    for (let j = 0; j < 100; j++) {`)
    lines.push(`      defaultData.push({`)
    lines.push(`        id: j,`)
    lines.push(`        name: \`Item \${j}\`,`)
    lines.push(`        value: Math.random() * 1000,`)
    lines.push(`        timestamp: new Date().toISOString(),`)
    lines.push(`        metadata: {`)
    lines.push(`          source: 'generated',`)
    lines.push(`          version: '1.0.0',`)
    lines.push(`          tags: ['auto', 'test', 'sample']`)
    lines.push(`        }`)
    lines.push(`      })`)
    lines.push(`    }`)
    lines.push(`    this.data$.next(defaultData)`)
    lines.push(`  }`)
    lines.push(`  `)
    lines.push(`  getData(): Observable<any[]> {`)
    lines.push(`    return this.data$.asObservable()`)
    lines.push(`  }`)
    lines.push(`  `)
    lines.push(`  async processItem(item: any): Promise<any> {`)
    lines.push(`    // Simulate async processing`)
    lines.push(`    await new Promise(resolve => setTimeout(resolve, 100))`)
    lines.push(`    return {`)
    lines.push(`      ...item,`)
    lines.push(`      processed: true,`)
    lines.push(`      processedAt: new Date().toISOString()`)
    lines.push(`    }`)
    lines.push(`  }`)
    lines.push(`}`)
    lines.push('')
  }
  
  const content = lines.join('\n')
  
  return {
    id: 100,
    projectId: 1,
    path: 'src/generated/large-service.ts',
    name: 'large-service.ts',
    content,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: content.length,
    checksum: 'mock-checksum-large'
  } as ProjectFile
}

// Edge case files
export const edgeCaseProjectFiles = {
  emptyFile: {
    id: 10,
    projectId: 1,
    path: 'src/empty.ts',
    name: 'empty.ts',
    content: '',
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 0,
    checksum: 'mock-checksum-empty'
  } as ProjectFile,

  onlyComments: {
    id: 11,
    projectId: 1,
    path: 'src/comments-only.ts',
    name: 'comments-only.ts',
    content: `// This file contains only comments
// No actual code here
/* 
 * Multi-line comment block
 * Still no code
 */
// TODO: Add actual implementation`,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 150,
    checksum: 'mock-checksum-comments'
  } as ProjectFile,

  minifiedCode: {
    id: 12,
    projectId: 1,
    path: 'dist/bundle.min.js',
    name: 'bundle.min.js',
    content: `!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).MyLib=t()}(this,(function(){"use strict";var e=function(e,t){return e+t},t=function(e){return e*e};return{add:e,square:t}}));`,
    type: 'file',
    extension: '.js',
    created: Date.now(),
    updated: Date.now(),
    size: 300,
    checksum: 'mock-checksum-minified'
  } as ProjectFile,

  binaryFile: {
    id: 13,
    projectId: 1,
    path: 'assets/logo.png',
    name: 'logo.png',
    content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString('base64'),
    type: 'file',
    extension: '.png',
    created: Date.now(),
    updated: Date.now(),
    size: 8,
    checksum: 'mock-checksum-binary'
  } as ProjectFile,

  syntaxError: {
    id: 14,
    projectId: 1,
    path: 'src/broken.ts',
    name: 'broken.ts',
    content: `export function broken( {
  // Missing closing parenthesis
  return "This won't compile"
}}} // Extra closing braces

class Incomplete {
  constructor() {
    // Missing closing brace`,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 200,
    checksum: 'mock-checksum-syntax-error'
  } as ProjectFile
}

// Batch of files for testing batch operations
export function createBatchFiles(count: number = 10): ProjectFile[] {
  const files: ProjectFile[] = []
  
  for (let i = 0; i < count; i++) {
    files.push({
      id: 100 + i,
      projectId: 1,
      path: `src/batch/file-${i}.ts`,
      name: `file-${i}.ts`,
      content: `export class BatchClass${i} {
  private id: number = ${i}
  
  constructor() {
    this.initialize()
  }
  
  private initialize(): void {
    console.log('Initializing BatchClass${i}')
  }
  
  public process(): number {
    return this.id * 2
  }
}

export function batchFunction${i}(input: string): string {
  return \`Processed: \${input} by function ${i}\`
}`,
      type: 'file',
      extension: '.ts',
      created: Date.now() - (i * 1000 * 60), // Different timestamps
      updated: Date.now() - (i * 1000 * 30),
      size: 300 + (i * 10),
      checksum: `mock-checksum-batch-${i}`
    } as ProjectFile)
  }
  
  return files
}

// Files with complex import/export relationships
export const complexRelationshipFiles = {
  moduleA: {
    id: 20,
    projectId: 1,
    path: 'src/modules/moduleA.ts',
    name: 'moduleA.ts',
    content: `import { ServiceB } from './moduleB'
import { UtilC, HelperC } from './moduleC'
import type { ConfigType } from '../types/config'

export class ModuleA {
  private serviceB: ServiceB
  
  constructor(config: ConfigType) {
    this.serviceB = new ServiceB(config)
  }
  
  processData(): void {
    const util = new UtilC()
    const helper = new HelperC()
    this.serviceB.execute()
  }
}

export { ServiceB } from './moduleB'
export * from './moduleC'`,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 400,
    checksum: 'mock-checksum-moduleA',
    imports: [
      { source: './moduleB', specifiers: ['ServiceB'] },
      { source: './moduleC', specifiers: ['UtilC', 'HelperC'] },
      { source: '../types/config', specifiers: ['ConfigType'] }
    ],
    exports: [
      { name: 'ModuleA', type: 'class' },
      { name: 'ServiceB', type: 're-export' }
    ]
  } as ProjectFile,

  moduleB: {
    id: 21,
    projectId: 1,
    path: 'src/modules/moduleB.ts',
    name: 'moduleB.ts',
    content: `import { ModuleA } from './moduleA' // Circular dependency
import { Database } from '../database'

export class ServiceB {
  private db: Database
  
  constructor(config: any) {
    this.db = new Database(config)
  }
  
  execute(): void {
    // Implementation
  }
}`,
    type: 'file',
    extension: '.ts',
    created: Date.now(),
    updated: Date.now(),
    size: 250,
    checksum: 'mock-checksum-moduleB',
    imports: [
      { source: './moduleA', specifiers: ['ModuleA'] },
      { source: '../database', specifiers: ['Database'] }
    ],
    exports: [
      { name: 'ServiceB', type: 'class' }
    ]
  } as ProjectFile
}