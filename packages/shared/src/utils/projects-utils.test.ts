import { describe, it, expect } from 'bun:test'
import type { ProjectFile } from '../schemas/project.schemas'
import { buildPromptContent, calculateTotalTokens, buildFileTree } from './projects-utils'
import type { Prompt } from '../schemas/prompt.schemas'

// Mock data
const mockPrompts: Prompt[] = [
  {
    id: 1,
    name: 'Prompt One',
    content: 'This is prompt one content.',
    created: Date.now(),
    updated: Date.now()
  },
  {
    id: 2,
    name: 'Prompt Two',
    content: 'Prompt two: Some instructions here.',
    created: Date.now(),
    updated: Date.now()
  }
]

const mockProjectFiles: ProjectFile[] = [
  {
    id: 1,
    name: 'App.tsx',
    path: 'src/components/App.tsx',
    projectId: 1,
    extension: 'tsx',
    size: 100,
    content: 'console.log("App");',
    created: Date.now(),
    updated: Date.now(),
    checksum: 'checksum1',
    summary: 'Summary of App.tsx',
    summaryLastUpdated: Date.now(),
    meta: ''
  },
  {
    id: 2,
    name: 'helper.ts',
    path: 'src/utils/helper.ts',
    projectId: 1,
    extension: 'ts',
    size: 200,
    content: 'export function helper() { return "helped"; }',
    created: Date.now(),
    updated: Date.now(),
    checksum: 'checksum2',
    summary: 'Summary of helper.ts',
    summaryLastUpdated: Date.now(),
    meta: ''
  },
  {
    id: 3,
    name: 'index.ts',
    path: 'src/index.ts',
    projectId: 1,
    extension: 'ts',
    size: 50,
    content: 'import "./components/App";',
    created: Date.now(),
    updated: Date.now(),
    checksum: 'checksum3',
    summary: 'Summary of index.ts',
    summaryLastUpdated: Date.now(),
    meta: ''
  }
]

const fileMap = new Map<number, ProjectFile>(mockProjectFiles.map((f) => [f.id, f]))

describe('buildPromptContent', () => {
  it('should return empty string if no content is provided', () => {
    const result = buildPromptContent({
      promptData: null,
      selectedPrompts: [],
      userPrompt: '',
      selectedFiles: [],
      fileMap
    })
    expect(result).toBe('')
  })

  it('should not include file_contents tags when no files are selected', () => {
    const result = buildPromptContent({
      promptData: null,
      selectedPrompts: [],
      userPrompt: 'test',
      selectedFiles: [],
      fileMap
    })
    expect(result).not.toContain('<file_context>')
    expect(result).toContain('<user_instructions>')
  })

  it('should not include user_instructions when user prompt is empty or whitespace', () => {
    const result = buildPromptContent({
      promptData: mockPrompts,
      selectedPrompts: [1],
      userPrompt: '   ',
      selectedFiles: [],
      fileMap
    })
    expect(result).not.toContain('<user_instructions>')
    expect(result).toContain('<system_prompt index="1" name="Prompt One">')
  })

  it('should include selected prompts', () => {
    const result = buildPromptContent({
      promptData: mockPrompts,
      selectedPrompts: [1],
      userPrompt: '',
      selectedFiles: [],
      fileMap
    })
    expect(result).toContain('<system_prompt index="1" name="Prompt One">')
    expect(result).toContain('This is prompt one content.')
  })

  it('should include multiple selected prompts in order', () => {
    const result = buildPromptContent({
      promptData: mockPrompts,
      selectedPrompts: [1, 2],
      userPrompt: '',
      selectedFiles: [],
      fileMap
    })
    expect(result).toContain('<system_prompt index="1" name="Prompt One">')
    expect(result).toContain('<system_prompt index="2" name="Prompt Two">')
  })

  it('should include user instructions if provided', () => {
    const result = buildPromptContent({
      promptData: mockPrompts,
      selectedPrompts: [],
      userPrompt: 'User wants something',
      selectedFiles: [],
      fileMap
    })
    expect(result).toContain('<user_instructions>')
    expect(result).toContain('User wants something')
  })

  it('should include selected files with file_contents tags', () => {
    const result = buildPromptContent({
      promptData: mockPrompts,
      selectedPrompts: [],
      userPrompt: '',
      selectedFiles: [1, 2],
      fileMap
    })
    expect(result).toContain('<file_context>')
    expect(result).toContain('<path>src/components/App.tsx</path>')
    expect(result).toContain('console.log("App");')
    expect(result).toContain('<path>src/utils/helper.ts</path>')
    expect(result).toContain('return "helped";')
  })

  it('should combine prompts, user instructions, and files correctly', () => {
    const result = buildPromptContent({
      promptData: mockPrompts,
      selectedPrompts: [1],
      userPrompt: 'Do something special',
      selectedFiles: [2],
      fileMap
    })
    expect(result).toContain('<system_prompt index="1" name="Prompt One">')
    expect(result).toContain('<user_instructions>')
    expect(result).toContain('Do something special')
    expect(result).toContain('<file_context>')
    expect(result).toContain('<path>src/utils/helper.ts</path>')
  })
})

describe('calculateTotalTokens', () => {
  it('should count tokens from selected prompts', () => {
    const result = calculateTotalTokens(mockPrompts, [1], '', [], fileMap)
    // 'This is prompt one content.' is ~30 chars, 30/4=7.5 -> 8 tokens
    expect(result).toBeGreaterThan(0)
  })

  it('should count tokens from user prompt', () => {
    const result = calculateTotalTokens(null, [], 'A user prompt', [], fileMap)
    // 'A user prompt' ~13 chars/4=3.25 -> 4 tokens
    expect(result).toBe(4)
  })

  it('should count tokens from selected files', () => {
    const result = calculateTotalTokens(null, [], '', [1, 2], fileMap)
    // f1: 'console.log("App");' ~20 chars/4=5 tokens
    // f2: 'export function helper() { return "helped"; }' ~46 chars/4=11.5 -> 12 tokens
    // total ~17 tokens
    expect(result).toBeGreaterThan(10)
  })

  it('should combine tokens from prompts, user prompt, and files', () => {
    const result = calculateTotalTokens(mockPrompts, [1, 2], 'Some user instructions', [1], fileMap)
    // Rough estimation:
    // p1 ~30 chars/4=8 tokens
    // p2 ~36 chars/4=9 tokens
    // 'Some user instructions' ~24 chars/4=6 tokens
    // f1 ~20 chars/4=5 tokens
    // total ~8+9+6+5=28 tokens
    expect(result).toBeGreaterThan(20)
  })

  it('should return 0 if nothing is selected', () => {
    const result = calculateTotalTokens(null, [], '', [], fileMap)
    expect(result).toBe(0)
  })
})

describe('buildFileTree', () => {
  it('should build a nested file tree structure', () => {
    const result = buildFileTree(mockProjectFiles)
    // Expected:
    // {
    //   src: {
    //     _folder: true,
    //     children: {
    //       components: {
    //         _folder: true,
    //         children: {
    //           "App.tsx": { _folder: false, file: ... }
    //         }
    //       },
    //       utils: {
    //         _folder: true,
    //         children: {
    //           "helper.ts": { _folder: false, file: ... }
    //         }
    //       },
    //       "index.ts": { _folder: false, file: ... }
    //     }
    //   }
    // }
    expect(result.src._folder).toBe(true)
    expect(result.src.children.components._folder).toBe(true)
    expect(result.src.children.components.children['App.tsx'].file?.id).toBe(1)
    expect(result.src.children.utils._folder).toBe(true)
    expect(result.src.children.utils.children['helper.ts'].file?.id).toBe(2)
    expect(result.src.children['index.ts'].file?.id).toBe(3)
  })

  it('should handle empty file list', () => {
    const result = buildFileTree([])
    expect(result).toEqual({})
  })

  it('should handle files without nested directories', () => {
    const singleFile: ProjectFile[] = [
      {
        id: 4,
        name: 'file.ts',
        path: 'file.ts',
        projectId: 1,
        extension: 'ts',
        size: 100,
        content: 'test',
        created: Date.now(),
        updated: Date.now(),
        checksum: 'checksum4',
        summary: 'Summary of file.ts',
        summaryLastUpdated: Date.now(),
        meta: ''
      }
    ]
    const result = buildFileTree(singleFile)
    expect(result['file.ts'].file?.id).toBe(4)
  })
})
