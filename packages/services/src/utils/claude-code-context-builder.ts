import { type ProjectFile } from '@octoprompt/schemas'
import { getSafeAllProjectFiles } from './get-full-project-summary'
// import { getProjectFileSuggestion } from '../file-services/file-suggestion-service'

export interface ClaudeCodeContext {
  projectSummary: string
  relevantFiles: ProjectFile[]
  suggestedFiles: string[]
  taskComplexity: 'simple' | 'medium' | 'complex'
  suggestedApproach: string
  potentialRisks: string[]
  requiredFiles: Array<{
    path: string
    action: 'create' | 'modify' | 'delete'
    reason: string
  }>
}

/**
 * Build an intelligent context for Claude Code based on the prompt and project files
 * Enhanced with planning capabilities from former Mastra agents
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

  // Analyze task complexity (replaces Mastra planning agent analysis)
  const taskComplexity = analyzeTaskComplexity(prompt, relevantFiles, allFiles)

  // Generate suggested approach (replaces Mastra planning agent suggestions)
  const suggestedApproach = generateSuggestedApproach(prompt, taskComplexity, relevantFiles)

  // Identify potential risks (replaces Mastra risk analysis)
  const potentialRisks = identifyPotentialRisks(prompt, taskComplexity, relevantFiles, allFiles)

  // Suggest required files (replaces Mastra file targeting)
  const requiredFiles = suggestRequiredFiles(prompt, relevantFiles, allFiles)

  return {
    projectSummary,
    relevantFiles,
    suggestedFiles: relevantFiles.map((f) => f.name),
    taskComplexity,
    suggestedApproach,
    potentialRisks,
    requiredFiles
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

/**
 * Analyze task complexity based on prompt content and file scope
 * Replaces Mastra planning agent complexity analysis
 */
function analyzeTaskComplexity(
  prompt: string,
  relevantFiles: ProjectFile[],
  allFiles: ProjectFile[]
): 'simple' | 'medium' | 'complex' {
  let complexityScore = 0
  const promptLower = prompt.toLowerCase()

  // Simple task indicators (score += 1)
  if (promptLower.includes('fix bug') || promptLower.includes('fix error')) complexityScore += 1
  if (promptLower.includes('update text') || promptLower.includes('change text')) complexityScore += 1
  if (promptLower.includes('add comment') || promptLower.includes('add documentation')) complexityScore += 1

  // Medium task indicators (score += 2-3)
  if (promptLower.includes('refactor') || promptLower.includes('optimize')) complexityScore += 2
  if (promptLower.includes('add feature') || promptLower.includes('implement')) complexityScore += 2
  if (promptLower.includes('test') || promptLower.includes('unit test')) complexityScore += 2
  if (relevantFiles.length > 5) complexityScore += 2

  // Complex task indicators (score += 3-5)
  if (promptLower.includes('architecture') || promptLower.includes('redesign')) complexityScore += 4
  if (promptLower.includes('migration') || promptLower.includes('upgrade')) complexityScore += 4
  if (promptLower.includes('security') || promptLower.includes('authentication')) complexityScore += 3
  if (promptLower.includes('database') || promptLower.includes('schema')) complexityScore += 3
  if (relevantFiles.length > 10) complexityScore += 3
  if (allFiles.length > 100) complexityScore += 2

  // Multiple file types involved
  const fileTypes = new Set(relevantFiles.map((f) => f.extension))
  if (fileTypes.size > 3) complexityScore += 2

  if (complexityScore <= 3) return 'simple'
  if (complexityScore <= 7) return 'medium'
  return 'complex'
}

/**
 * Generate suggested approach based on task analysis
 * Replaces Mastra planning agent approach suggestions
 */
function generateSuggestedApproach(
  prompt: string,
  complexity: 'simple' | 'medium' | 'complex',
  relevantFiles: ProjectFile[]
): string {
  const promptLower = prompt.toLowerCase()
  const approaches: string[] = []

  // Base approach based on complexity
  if (complexity === 'simple') {
    approaches.push('This appears to be a straightforward task that can be completed in a single session.')
  } else if (complexity === 'medium') {
    approaches.push('This is a moderate complexity task that may require careful planning and testing.')
  } else {
    approaches.push('This is a complex task that should be broken down into smaller, manageable steps.')
  }

  // Specific approach suggestions based on prompt content
  if (promptLower.includes('refactor')) {
    approaches.push('Consider creating backup branches before refactoring. Start with the most critical files first.')
  }
  if (promptLower.includes('test')) {
    approaches.push('Follow TDD principles: write tests first, then implement the functionality.')
  }
  if (promptLower.includes('api') || promptLower.includes('endpoint')) {
    approaches.push(
      'Design the API contract first, then implement the backend logic, followed by frontend integration.'
    )
  }
  if (promptLower.includes('database') || promptLower.includes('schema')) {
    approaches.push('Plan database migrations carefully. Consider backwards compatibility and data preservation.')
  }
  if (promptLower.includes('security')) {
    approaches.push('Security changes require thorough testing. Consider penetration testing and code review.')
  }

  // File-based suggestions
  if (relevantFiles.length > 5) {
    approaches.push('Multiple files are involved - consider the order of changes to minimize breaking dependencies.')
  }

  return approaches.join(' ')
}

/**
 * Identify potential risks based on task analysis
 * Replaces Mastra planning agent risk assessment
 */
function identifyPotentialRisks(
  prompt: string,
  complexity: 'simple' | 'medium' | 'complex',
  relevantFiles: ProjectFile[],
  allFiles: ProjectFile[]
): string[] {
  const risks: string[] = []
  const promptLower = prompt.toLowerCase()

  // Complexity-based risks
  if (complexity === 'complex') {
    risks.push('High complexity task may introduce unexpected side effects')
    risks.push('May require significant testing and validation')
  }

  // Content-based risks
  if (promptLower.includes('database') || promptLower.includes('migration')) {
    risks.push('Database changes can cause data loss if not handled carefully')
    risks.push('May require downtime for production deployment')
  }

  if (promptLower.includes('security') || promptLower.includes('auth')) {
    risks.push('Security changes can lock out users if implemented incorrectly')
    risks.push('May introduce new vulnerabilities if not thoroughly tested')
  }

  if (promptLower.includes('refactor')) {
    risks.push('Refactoring can break existing functionality')
    risks.push('May affect dependent modules not immediately obvious')
  }

  if (promptLower.includes('api') || promptLower.includes('breaking')) {
    risks.push('API changes may break existing integrations')
    risks.push('Version compatibility issues with clients')
  }

  // File-based risks
  if (relevantFiles.length > 10) {
    risks.push('Large number of files increases chance of merge conflicts')
  }

  const coreFiles = relevantFiles.filter(
    (f) => f.name.includes('index') || f.name.includes('main') || f.name.includes('app') || f.name.includes('config')
  )
  if (coreFiles.length > 0) {
    risks.push('Changes to core files may have widespread impact')
  }

  return risks.length > 0 ? risks : ['Low risk task with minimal side effects expected']
}

/**
 * Suggest required files for the task
 * Replaces Mastra file targeting functionality
 */
function suggestRequiredFiles(
  prompt: string,
  relevantFiles: ProjectFile[],
  allFiles: ProjectFile[]
): Array<{ path: string; action: 'create' | 'modify' | 'delete'; reason: string }> {
  const suggestions: Array<{ path: string; action: 'create' | 'modify' | 'delete'; reason: string }> = []
  const promptLower = prompt.toLowerCase()

  // Analyze existing relevant files
  relevantFiles.forEach((file) => {
    if (promptLower.includes('delete') || promptLower.includes('remove')) {
      suggestions.push({
        path: file.path,
        action: 'delete',
        reason: 'File appears to be targeted for removal based on prompt'
      })
    } else {
      suggestions.push({
        path: file.path,
        action: 'modify',
        reason: 'File is relevant to the requested changes'
      })
    }
  })

  // Suggest new files based on prompt content
  if (promptLower.includes('test') && !relevantFiles.some((f) => f.name.includes('test') || f.name.includes('spec'))) {
    suggestions.push({
      path: 'tests/new-feature.test.ts',
      action: 'create',
      reason: 'Tests needed for new functionality'
    })
  }

  if (promptLower.includes('component') && !relevantFiles.some((f) => f.name.includes('component'))) {
    suggestions.push({
      path: 'components/NewComponent.tsx',
      action: 'create',
      reason: 'New component required based on prompt'
    })
  }

  if (promptLower.includes('api') || promptLower.includes('endpoint')) {
    if (!relevantFiles.some((f) => f.name.includes('route') || f.name.includes('api'))) {
      suggestions.push({
        path: 'api/new-endpoint.ts',
        action: 'create',
        reason: 'New API endpoint required'
      })
    }
  }

  if (promptLower.includes('config') || promptLower.includes('environment')) {
    if (!relevantFiles.some((f) => f.name.includes('config') || f.name.includes('env'))) {
      suggestions.push({
        path: 'config/new-config.ts',
        action: 'create',
        reason: 'Configuration file needed'
      })
    }
  }

  return suggestions
}
