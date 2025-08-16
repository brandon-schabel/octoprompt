import { E, A, O, pipe } from '../../fp'
import { type DecomposedTask, type TaskGraph, type TaskDependency, type ComplexityScore } from '../../types'

// ============================================================================
// Task Analysis and Decomposition
// ============================================================================

export interface TaskAnalysisConfig {
  maxDepth: number
  minTaskSize: number
  maxTaskSize: number
  parallelizationThreshold: number
}

const defaultConfig: TaskAnalysisConfig = {
  maxDepth: 3,
  minTaskSize: 10, // Min tokens for a task
  maxTaskSize: 500, // Max tokens for a task
  parallelizationThreshold: 0.3 // 30% similarity = can parallelize
}

// ============================================================================
// Task Analyzer
// ============================================================================

export class TaskAnalyzer {
  constructor(private config: TaskAnalysisConfig = defaultConfig) { }

  // Analyze and decompose a complex task
  analyzeTask(taskDescription: string, depth: number = 0): E.Either<Error, DecomposedTask> {
    try {
      // Parse task structure
      const taskId = this.generateTaskId()
      const title = this.extractTitle(taskDescription)
      const subtasks = depth < this.config.maxDepth ? this.identifySubtasks(taskDescription) : []
      const dependencies = this.extractDependencies(taskDescription)
      const complexity = this.calculateComplexity(taskDescription, subtasks.length)

      const decomposed: DecomposedTask = {
        id: taskId,
        title,
        description: taskDescription,
        dependencies,
        parallelizable: this.canParallelize(taskDescription, dependencies),
        estimatedComplexity: complexity.overall,
        suggestedAgent: this.suggestAgent(taskDescription),
        suggestedModel: this.suggestModel(complexity),
        subtasks: subtasks.map((st) => {
          const result = this.analyzeTask(st, depth + 1)
          return E.isRight(result) ? result.right : this.createSimpleTask(st)
        })
      }

      return E.right(decomposed)
    } catch (error) {
      return E.left(new Error(`Task analysis failed: ${error}`))
    }
  }

  // Extract task title from description
  private extractTitle(description: string): string {
    // Try to extract from common patterns
    const patterns = [
      /^(implement|create|build|design|develop|write|add|fix|update|refactor)\s+(.+?)(?:\.|$)/i,
      /^(.+?)(?:\.|:|\n|$)/,
      /^([A-Z][^.!?]{10,50})/
    ]

    for (const pattern of patterns) {
      const match = description.match(pattern)
      if (match) {
        const title = match[2] || match[1]
        return title.substring(0, 100).trim()
      }
    }

    // Fallback: first 50 characters
    return description.substring(0, 50).trim() + (description.length > 50 ? '...' : '')
  }

  // Identify subtasks within a task description
  private identifySubtasks(description: string): string[] {
    const subtasks: string[] = []

    // Pattern 1: Numbered or bulleted lists
    const listPattern = /(?:^|\n)\s*(?:\d+\.|-|\*)\s+([^\n]+)/gm
    let match: RegExpExecArray | null
    while ((match = listPattern.exec(description)) !== null) {
      subtasks.push(match[1].trim())
    }

    // Pattern 2: Sequential keywords
    const sequentialPattern = /(first|then|next|after that|finally),?\s+([^.]+)/gi
    while ((match = sequentialPattern.exec(description)) !== null) {
      const seg = match[2]?.trim()
      if (seg && !subtasks.some((st) => st.includes(seg))) subtasks.push(seg)
    }

    // Pattern 3: Action verbs at sentence start
    if (subtasks.length === 0) {
      const sentences = description.split(/[.!?]+/).filter((s) => s.trim())
      const actionVerbs = [
        'implement',
        'create',
        'build',
        'design',
        'write',
        'add',
        'update',
        'refactor',
        'test',
        'validate',
        'check',
        'ensure',
        'setup',
        'configure',
        'install',
        'deploy',
        'migrate'
      ]

      sentences.forEach((sentence) => {
        const trimmed = sentence.trim().toLowerCase()
        if (actionVerbs.some((verb) => trimmed.startsWith(verb))) {
          subtasks.push(sentence.trim())
        }
      })
    }

    // Pattern 4: Split by "and" for compound tasks
    if (subtasks.length === 0 && description.includes(' and ')) {
      const parts = description.split(/\s+and\s+/i)
      if (parts.length <= 4) {
        // Don't split if too many "and"s
        subtasks.push(...parts.map((p) => p.trim()))
      }
    }

    return subtasks.filter((st) => st.length > this.config.minTaskSize)
  }

  // Extract dependencies from task description
  private extractDependencies(description: string): string[] {
    const dependencies: string[] = []
    const lowerDesc = description.toLowerCase()

    // Dependency keywords
    const depPatterns = [
      /requires?\s+(.+?)(?:\.|,|$)/gi,
      /depends?\s+on\s+(.+?)(?:\.|,|$)/gi,
      /after\s+(.+?)(?:\.|,|$)/gi,
      /needs?\s+(.+?)(?:\.|,|$)/gi,
      /must\s+have\s+(.+?)(?:\.|,|$)/gi
    ]

    depPatterns.forEach((pattern) => {
      let match
      while ((match = pattern.exec(description)) !== null) {
        dependencies.push(match[1].trim())
      }
    })

    // Implicit dependencies based on keywords
    if (lowerDesc.includes('test')) dependencies.push('implementation')
    if (lowerDesc.includes('deploy')) dependencies.push('build', 'test')
    if (lowerDesc.includes('refactor')) dependencies.push('existing_code')
    if (lowerDesc.includes('migration')) dependencies.push('current_state', 'target_state')
    if (lowerDesc.includes('integration')) dependencies.push('components')

    return [...new Set(dependencies)] // Remove duplicates
  }

  // Calculate task complexity
  private calculateComplexity(description: string, subtaskCount: number): ComplexityScore {
    const length = description.length
    const sentences = (description.match(/[.!?]+/g) || []).length
    const technicalTerms = this.countTechnicalTerms(description)
    const conditionals = (description.match(/\b(if|when|unless|while|for)\b/gi) || []).length

    // Cognitive complexity (how hard for humans)
    const cognitive = Math.min(10, sentences * 0.5 + technicalTerms * 0.3 + subtaskCount * 0.8)

    // Computational complexity (how hard for LLMs)
    const computational = Math.min(10, length / 100 + conditionals * 1.5 + subtaskCount * 0.5)

    // Structural complexity
    const structural = Math.min(
      10,
      subtaskCount * 1.2 + conditionals * 0.8 + this.extractDependencies(description).length * 0.5
    )

    const overall = cognitive * 0.3 + computational * 0.4 + structural * 0.3

    return {
      cognitive: Number(cognitive.toFixed(2)),
      computational: Number(computational.toFixed(2)),
      structural: Number(structural.toFixed(2)),
      overall: Number(overall.toFixed(2))
    }
  }

  // Count technical terms in description
  private countTechnicalTerms(description: string): number {
    const technicalTerms = [
      'api',
      'database',
      'algorithm',
      'function',
      'class',
      'interface',
      'component',
      'service',
      'endpoint',
      'schema',
      'migration',
      'deployment',
      'authentication',
      'authorization',
      'encryption',
      'cache',
      'queue',
      'async',
      'promise',
      'callback',
      'stream',
      'buffer',
      'thread',
      'microservice',
      'container',
      'kubernetes',
      'docker',
      'ci/cd'
    ]

    const lowerDesc = description.toLowerCase()
    return technicalTerms.filter((term) => lowerDesc.includes(term)).length
  }

  // Check if task can be parallelized
  private canParallelize(description: string, dependencies: string[]): boolean {
    // Can't parallelize if has dependencies
    if (dependencies.length > 0) return false

    // Check for sequential keywords
    const sequentialKeywords = ['then', 'after', 'before', 'first', 'finally', 'sequence']
    const hasSequential = sequentialKeywords.some((kw) => description.toLowerCase().includes(kw))

    if (hasSequential) return false

    // Check for parallelization hints
    const parallelKeywords = ['parallel', 'concurrent', 'simultaneous', 'independent']
    const hasParallel = parallelKeywords.some((kw) => description.toLowerCase().includes(kw))

    return hasParallel || !hasSequential
  }

  // Suggest appropriate agent for task
  private suggestAgent(description: string): string | undefined {
    const lowerDesc = description.toLowerCase()

    const agentMappings: Record<string, string[]> = {
      'promptliano-ui-architect': ['ui', 'component', 'frontend', 'react', 'button', 'form'],
      'hono-bun-api-architect': ['api', 'endpoint', 'route', 'rest', 'http'],
      'zod-schema-architect': ['schema', 'validation', 'type', 'zod'],
      'promptliano-sqlite-expert': ['database', 'migration', 'sqlite', 'table'],
      'staff-engineer-code-reviewer': ['review', 'quality', 'refactor', 'improve'],
      'promptliano-service-architect': ['service', 'business logic', 'architecture'],
      'test-writer': ['test', 'spec', 'testing', 'coverage'],
      'documentation-writer': ['document', 'docs', 'readme', 'guide']
    }

    for (const [agent, keywords] of Object.entries(agentMappings)) {
      if (keywords.some((kw) => lowerDesc.includes(kw))) {
        return agent
      }
    }

    return undefined
  }

  // Suggest appropriate model based on complexity
  private suggestModel(complexity: ComplexityScore): string | undefined {
    if (complexity.overall > 7) {
      return 'claude-3-opus' // Most capable for complex tasks
    } else if (complexity.overall > 5) {
      return 'gpt-4-turbo' // Good balance
    } else if (complexity.overall > 3) {
      return 'claude-3-sonnet' // Efficient for medium tasks
    } else {
      return 'mixtral-8x7b' // Fast for simple tasks
    }
  }

  // Generate unique task ID
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Create simple task when recursion limit reached
  private createSimpleTask(description: string): DecomposedTask {
    return {
      id: this.generateTaskId(),
      title: this.extractTitle(description),
      description,
      dependencies: [],
      parallelizable: true,
      estimatedComplexity: 1,
      subtasks: []
    }
  }
}

// ============================================================================
// Task Graph Builder
// ============================================================================

export class TaskGraphBuilder {
  // Build a task graph from decomposed tasks
  buildGraph(rootTask: DecomposedTask): TaskGraph {
    const nodes: DecomposedTask[] = []
    const edges: TaskDependency[] = []

    // Flatten task tree into nodes
    this.flattenTasks(rootTask, nodes)

    // Build edges from dependencies
    nodes.forEach((task) => {
      task.dependencies.forEach((dep) => {
        // Try to find matching task
        const depTask = nodes.find(
          (n) =>
            n.title.toLowerCase().includes(dep.toLowerCase()) || n.description.toLowerCase().includes(dep.toLowerCase())
        )

        if (depTask) {
          edges.push({
            from: depTask.id,
            to: task.id,
            type: 'blocks',
            weight: 1
          })
        }
      })

      // Add parent-child relationships
      if (task.subtasks) {
        task.subtasks.forEach((subtask) => {
          edges.push({
            from: task.id,
            to: subtask.id,
            type: 'informs',
            weight: 0.5
          })
        })
      }
    })

    // Calculate critical path
    const criticalPath = this.findCriticalPath(nodes, edges)

    // Identify parallel groups
    const parallelGroups = this.identifyParallelGroups(nodes, edges)

    return {
      nodes,
      edges,
      criticalPath,
      parallelGroups
    }
  }

  // Flatten task tree into array
  private flattenTasks(task: DecomposedTask, result: DecomposedTask[]): void {
    result.push(task)
    if (task.subtasks) {
      task.subtasks.forEach((subtask) => this.flattenTasks(subtask, result))
    }
  }

  // Find critical path through task graph
  private findCriticalPath(nodes: DecomposedTask[], edges: TaskDependency[]): string[] {
    // Simple implementation: find longest path
    const adjList = this.buildAdjacencyList(edges)
    const visited = new Set<string>()
    const path: string[] = []

    // Find starting nodes (no incoming edges)
    const startNodes = nodes.filter((node) => !edges.some((edge) => edge.to === node.id && edge.type === 'blocks'))

    if (startNodes.length === 0) return []

    // DFS to find longest path
    let longestPath: string[] = []

    const dfs = (nodeId: string, currentPath: string[]) => {
      if (visited.has(nodeId)) return

      visited.add(nodeId)
      currentPath.push(nodeId)

      const neighbors = adjList.get(nodeId) || []
      if (neighbors.length === 0) {
        // Leaf node - check if this is the longest path
        if (currentPath.length > longestPath.length) {
          longestPath = [...currentPath]
        }
      } else {
        neighbors.forEach((neighbor) => {
          dfs(neighbor, [...currentPath])
        })
      }

      visited.delete(nodeId)
    }

    startNodes.forEach((node) => {
      dfs(node.id, [])
    })

    return longestPath
  }

  // Identify groups of tasks that can run in parallel
  private identifyParallelGroups(nodes: DecomposedTask[], edges: TaskDependency[]): string[][] {
    const groups: string[][] = []
    const assigned = new Set<string>()

    // Build dependency map
    const dependencies = new Map<string, Set<string>>()
    edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        if (!dependencies.has(edge.to)) {
          dependencies.set(edge.to, new Set())
        }
        dependencies.get(edge.to)!.add(edge.from)
      }
    })

    // Group tasks by dependency level
    let level = 0
    while (assigned.size < nodes.length) {
      const currentGroup: string[] = []

      nodes.forEach((node) => {
        if (!assigned.has(node.id)) {
          const deps = dependencies.get(node.id) || new Set()
          // Can add to current group if all dependencies are already assigned
          if ([...deps].every((dep) => assigned.has(dep))) {
            currentGroup.push(node.id)
          }
        }
      })

      if (currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup.forEach((id) => assigned.add(id))
      } else {
        // Prevent infinite loop
        break
      }

      level++
      if (level > 100) break // Safety limit
    }

    return groups
  }

  // Build adjacency list from edges
  private buildAdjacencyList(edges: TaskDependency[]): Map<string, string[]> {
    const adjList = new Map<string, string[]>()

    edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        if (!adjList.has(edge.from)) {
          adjList.set(edge.from, [])
        }
        adjList.get(edge.from)!.push(edge.to)
      }
    })

    return adjList
  }
}

// ============================================================================
// Task Similarity Calculator
// ============================================================================

export class TaskSimilarityCalculator {
  // Calculate similarity between two tasks
  calculateSimilarity(task1: DecomposedTask, task2: DecomposedTask): number {
    const desc1 = task1.description.toLowerCase()
    const desc2 = task2.description.toLowerCase()

    // Method 1: Jaccard similarity of words
    const words1 = new Set(desc1.split(/\s+/))
    const words2 = new Set(desc2.split(/\s+/))

    const intersection = new Set([...words1].filter((w) => words2.has(w)))
    const union = new Set([...words1, ...words2])

    const jaccard = intersection.size / union.size

    // Method 2: Common substring similarity
    const lcs = this.longestCommonSubstring(desc1, desc2)
    const lcsScore = (lcs.length * 2) / (desc1.length + desc2.length)

    // Method 3: Agent similarity
    const agentScore = task1.suggestedAgent === task2.suggestedAgent ? 0.3 : 0

    // Weighted average
    return jaccard * 0.4 + lcsScore * 0.3 + agentScore * 0.3
  }

  // Find longest common substring
  private longestCommonSubstring(str1: string, str2: string): string {
    const m = str1.length
    const n = str2.length
    let maxLength = 0
    let endPos = 0

    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0))

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
          if (dp[i][j] > maxLength) {
            maxLength = dp[i][j]
            endPos = i
          }
        }
      }
    }

    return str1.substring(endPos - maxLength, endPos)
  }
}

// Export factory functions
export function createTaskAnalyzer(config?: Partial<TaskAnalysisConfig>): TaskAnalyzer {
  return new TaskAnalyzer({ ...defaultConfig, ...config })
}

export function createTaskGraphBuilder(): TaskGraphBuilder {
  return new TaskGraphBuilder()
}

export function createTaskSimilarityCalculator(): TaskSimilarityCalculator {
  return new TaskSimilarityCalculator()
}
