import { describe, it, expect } from 'bun:test'
import { buildPromptContent, calculateTotalTokens, buildFileTree } from './projects-utils'
import { ProjectFile } from 'shared/schema'

// Mock data
const mockPrompts = {
    prompts: [
        { id: 'p1', name: 'Prompt One', content: 'This is prompt one content.' },
        { id: 'p2', name: 'Prompt Two', content: 'Prompt two: Some instructions here.' },
    ]
}

const mockProjectFiles = [
    {
        id: 'f1',
        name: 'App.tsx',
        path: 'src/components/App.tsx',
        projectId: 'project1',
        extension: 'tsx',
        size: 100,
        content: 'console.log("App");',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'f2',
        name: 'helper.ts',
        path: 'src/utils/helper.ts',
        projectId: 'project1',
        extension: 'ts',
        size: 200,
        content: 'export function helper() { return "helped"; }',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'f3',
        name: 'index.ts',
        path: 'src/index.ts',
        projectId: 'project1',
        extension: 'ts',
        size: 50,
        content: 'import "./components/App";',
        createdAt: new Date(),
        updatedAt: new Date()
    }
] satisfies ProjectFile[]

const fileMap = new Map<string, ProjectFile>(mockProjectFiles.map(f => [f.id, f]))

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
        expect(result).not.toContain('<file_contents>')
        expect(result).toContain('<user_instructions>')
    })

    it('should not include user_instructions when user prompt is empty or whitespace', () => {
        const result = buildPromptContent({
            promptData: mockPrompts,
            selectedPrompts: ['p1'],
            userPrompt: '   ',
            selectedFiles: [],
            fileMap
        })
        expect(result).not.toContain('<user_instructions>')
        expect(result).toContain('<meta prompt')
    })

    it('should include selected prompts', () => {
        const result = buildPromptContent({
            promptData: mockPrompts,
            selectedPrompts: ['p1'],
            userPrompt: '',
            selectedFiles: [],
            fileMap
        })
        expect(result).toContain('<meta prompt 1 = "Prompt One">')
        expect(result).toContain('This is prompt one content.')
    })

    it('should include multiple selected prompts in order', () => {
        const result = buildPromptContent({
            promptData: mockPrompts,
            selectedPrompts: ['p1', 'p2'],
            userPrompt: '',
            selectedFiles: [],
            fileMap
        })
        expect(result).toContain('<meta prompt 1 = "Prompt One">')
        expect(result).toContain('<meta prompt 2 = "Prompt Two">')
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
            selectedFiles: ['f1', 'f2'],
            fileMap
        })
        expect(result).toContain('<file_contents>')
        expect(result).toContain('File: src/components/App.tsx')
        expect(result).toContain('console.log("App");')
        expect(result).toContain('File: src/utils/helper.ts')
        expect(result).toContain('return "helped";')
    })

    it('should combine prompts, user instructions, and files correctly', () => {
        const result = buildPromptContent({
            promptData: mockPrompts,
            selectedPrompts: ['p1'],
            userPrompt: 'Do something special',
            selectedFiles: ['f2'],
            fileMap
        })
        expect(result).toContain('<meta prompt 1 = "Prompt One">')
        expect(result).toContain('Do something special')
        expect(result).toContain('File: src/utils/helper.ts')
    })
})


describe('calculateTotalTokens', () => {
    it('should count tokens from selected prompts', () => {
        const result = calculateTotalTokens(mockPrompts, ['p1'], '', [], fileMap)
        // 'This is prompt one content.' is ~30 chars, 30/4=7.5 -> 8 tokens
        expect(result).toBeGreaterThan(0)
    })

    it('should count tokens from user prompt', () => {
        const result = calculateTotalTokens(null, [], 'A user prompt', [], fileMap)
        // 'A user prompt' ~13 chars/4=3.25 -> 4 tokens
        expect(result).toBe(4)
    })

    it('should count tokens from selected files', () => {
        const result = calculateTotalTokens(null, [], '', ['f1', 'f2'], fileMap)
        // f1: 'console.log("App");' ~20 chars/4=5 tokens
        // f2: 'export function helper() { return "helped"; }' ~46 chars/4=11.5 -> 12 tokens
        // total ~17 tokens
        expect(result).toBeGreaterThan(10)
    })

    it('should combine tokens from prompts, user prompt, and files', () => {
        const result = calculateTotalTokens(
            mockPrompts,
            ['p1', 'p2'],
            'Some user instructions',
            ['f1'],
            fileMap
        )
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
        expect(result.src.children.components.children["App.tsx"].file?.id).toBe('f1')
        expect(result.src.children.utils._folder).toBe(true)
        expect(result.src.children.utils.children["helper.ts"].file?.id).toBe('f2')
        expect(result.src.children["index.ts"].file?.id).toBe('f3')
    })

    it('should handle empty file list', () => {
        const result = buildFileTree([])
        expect(result).toEqual({})
    })

    it('should handle files without nested directories', () => {
        const singleFile: ProjectFile[] = [{
            id: 'single',
            name: 'file.ts',
            path: 'file.ts',
            projectId: 'project1',
            extension: 'ts',
            size: 100,
            content: 'test',
            createdAt: new Date(),
            updatedAt: new Date()
        }]
        const result = buildFileTree(singleFile)
        expect(result["file.ts"].file?.id).toBe("single")
    })
})