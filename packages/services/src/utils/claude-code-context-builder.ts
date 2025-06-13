import { type ProjectFile } from '@octoprompt/schemas'
import { getSafeAllProjectFiles } from './get-full-project-summary'
// import { getProjectFileSuggestion } from '../file-services/file-suggestion-service'

export interface ClaudeCodeContext {
  projectSummary: string
  relevantFiles: ProjectFile[]
  suggestedFiles: string[]
}

/**
 * Build an intelligent context for Claude Code based on the prompt and project files
 */
export async function buildClaudeCodeContext(
  projectId: number,
  prompt: string,
  maxFiles: number = 10
): Promise<ClaudeCodeContext> {
  // Get all project files
  const allFiles = await getSafeAllProjectFiles(projectId)

  // Find relevant files based on the prompt using simple keyword matching
  const relevantFiles = findRelevantFiles(allFiles, prompt, maxFiles)

  // Build a focused project summary
  const projectSummary = buildFocusedProjectSummary(relevantFiles, allFiles)

  return {
    projectSummary,
    relevantFiles,
    suggestedFiles: relevantFiles.map((f) => f.name)
  }
}

/**
 * Find relevant files based on keywords in the prompt
 */
function findRelevantFiles(files: ProjectFile[], prompt: string, maxFiles: number): ProjectFile[] {
  const promptLower = prompt.toLowerCase()
  const keywords = extractKeywords(promptLower)

  // Score each file based on relevance
  const scoredFiles = files.map((file) => {
    let score = 0
    const nameLower = file.name.toLowerCase()
    const summaryLower = (file.summary || '').toLowerCase()

    // Check for exact filename matches
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        score += 5
      }
      if (summaryLower.includes(keyword)) {
        score += 3
      }
    }

    // Check for file type relevance
    if (promptLower.includes('test') && (nameLower.includes('test') || nameLower.includes('spec'))) {
      score += 4
    }
    if (promptLower.includes('style') && (nameLower.endsWith('.css') || nameLower.endsWith('.scss'))) {
      score += 4
    }
    if (promptLower.includes('component') && (nameLower.includes('component') || nameLower.endsWith('.tsx'))) {
      score += 3
    }
    if (promptLower.includes('api') && (nameLower.includes('api') || nameLower.includes('route'))) {
      score += 3
    }

    return { file, score }
  })

  // Sort by score and return top files
  return scoredFiles
    .filter((sf) => sf.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles)
    .map((sf) => sf.file)
}

/**
 * Extract meaningful keywords from a prompt
 */
function extractKeywords(prompt: string): string[] {
  // Common stop words to ignore
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'what',
    'which',
    'who',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'every',
    'some',
    'any',
    'need',
    'want',
    'please',
    'help',
    'create',
    'add',
    'update',
    'fix',
    'change'
  ])

  // Extract words and filter out stop words
  const words = prompt
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9-_]/g, ''))
    .filter((w) => w.length > 2 && !stopWords.has(w))

  return [...new Set(words)]
}

/**
 * Build a focused project summary that includes:
 * 1. Project structure overview
 * 2. Relevant file summaries
 * 3. Key technical details
 */
function buildFocusedProjectSummary(relevantFiles: ProjectFile[], allFiles: ProjectFile[]): string {
  const sections: string[] = []

  // Project structure overview
  sections.push('## Project Structure Overview')
  sections.push(buildProjectTree(allFiles))
  sections.push('')

  // Relevant file summaries
  if (relevantFiles.length > 0) {
    sections.push('## Relevant Files')
    for (const file of relevantFiles) {
      sections.push(`### ${file.name}`)
      if (file.summary) {
        sections.push(file.summary)
      } else {
        sections.push('(No summary available)')
      }
      sections.push('')
    }
  }

  // Technical stack detection
  const techStack = detectTechStack(allFiles)
  if (techStack.length > 0) {
    sections.push('## Technology Stack')
    sections.push(techStack.join(', '))
    sections.push('')
  }

  return sections.join('\n')
}

/**
 * Build a simple tree structure of the project
 */
function buildProjectTree(files: ProjectFile[]): string {
  // Group files by directory
  const tree: { [key: string]: string[] } = {}

  for (const file of files) {
    const parts = file.name.split('/')
    const dir = parts.slice(0, -1).join('/') || '.'
    const filename = parts[parts.length - 1]

    if (!tree[dir]) {
      tree[dir] = []
    }
    tree[dir].push(filename)
  }

  // Build tree string
  const lines: string[] = []
  const sortedDirs = Object.keys(tree).sort()

  for (const dir of sortedDirs) {
    if (dir !== '.') {
      lines.push(`${dir}/`)
    }

    const files = tree[dir].sort()
    for (const file of files) {
      const indent = dir === '.' ? '' : '  '
      lines.push(`${indent}├── ${file}`)
    }
  }

  return lines.join('\n')
}

/**
 * Detect the technology stack based on file names and extensions
 */
function detectTechStack(files: ProjectFile[]): string[] {
  const stack = new Set<string>()

  for (const file of files) {
    const name = file.name.toLowerCase()

    // Package managers
    if (name === 'package.json') stack.add('Node.js')
    if (name === 'bun.lockb' || name === 'bun.lock') stack.add('Bun')
    if (name === 'yarn.lock') stack.add('Yarn')
    if (name === 'pnpm-lock.yaml') stack.add('pnpm')
    if (name === 'cargo.toml') stack.add('Rust')
    if (name === 'go.mod') stack.add('Go')
    if (name === 'requirements.txt' || name === 'setup.py') stack.add('Python')

    // Frameworks
    if (name === 'next.config.js' || name === 'next.config.ts') stack.add('Next.js')
    if (name.includes('vite.config')) stack.add('Vite')
    if (name === 'nuxt.config.js' || name === 'nuxt.config.ts') stack.add('Nuxt')
    if (name === 'angular.json') stack.add('Angular')
    if (name === 'vue.config.js') stack.add('Vue')

    // Testing
    if (name.includes('jest.config')) stack.add('Jest')
    if (name.includes('vitest.config')) stack.add('Vitest')
    if (name.includes('cypress.config')) stack.add('Cypress')

    // Databases
    if (name.includes('prisma')) stack.add('Prisma')
    if (name.includes('drizzle')) stack.add('Drizzle')

    // File extensions
    if (name.endsWith('.ts') || name.endsWith('.tsx')) stack.add('TypeScript')
    if (name.endsWith('.jsx')) stack.add('React')
    if (name.endsWith('.vue')) stack.add('Vue')
    if (name.endsWith('.svelte')) stack.add('Svelte')
  }

  return Array.from(stack).sort()
}
