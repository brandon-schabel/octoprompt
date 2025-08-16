import { E, A, pipe } from '../../fp'
import { type DecomposedTask, type TaskGraph } from '../../types'

// ============================================================================
// Task Assignment and Agent Matching
// ============================================================================

export interface AgentProfile {
  id: string
  name: string
  capabilities: string[]
  specializations: string[]
  complexity: {
    min: number
    max: number
  }
  costPerToken?: number
  speed?: 'fast' | 'medium' | 'slow'
  reliability?: number // 0-1
}

export interface TaskAssignment {
  taskId: string
  agentId: string
  confidence: number
  alternativeAgents: string[]
  estimatedDuration: number
  priority: number
}

export interface AssignmentStrategy {
  optimize: 'speed' | 'cost' | 'quality' | 'balanced'
  maxAgentsPerTask: number
  allowParallelAgents: boolean
  preferSpecialists: boolean
}

// ============================================================================
// Agent Registry
// ============================================================================

export class AgentRegistry {
  private agents: Map<string, AgentProfile> = new Map()

  constructor() {
    this.registerDefaultAgents()
  }

  // Register default Promptliano agents
  private registerDefaultAgents(): void {
    const defaultAgents: AgentProfile[] = [
      {
        id: 'promptliano-ui-architect',
        name: 'Frontend ShadCN Expert',
        capabilities: ['ui', 'components', 'styling', 'react'],
        specializations: ['shadcn', 'tailwind', 'frontend', 'components'],
        complexity: { min: 2, max: 8 },
        speed: 'medium',
        reliability: 0.95
      },
      {
        id: 'hono-bun-api-architect',
        name: 'Hono Bun API Architect',
        capabilities: ['api', 'backend', 'routing', 'validation'],
        specializations: ['hono', 'bun', 'rest', 'openapi'],
        complexity: { min: 3, max: 9 },
        speed: 'medium',
        reliability: 0.95
      },
      {
        id: 'zod-schema-architect',
        name: 'Zod Schema Architect',
        capabilities: ['validation', 'schemas', 'types'],
        specializations: ['zod', 'typescript', 'validation'],
        complexity: { min: 2, max: 7 },
        speed: 'fast',
        reliability: 0.98
      },
      {
        id: 'promptliano-sqlite-expert',
        name: 'SQLite JSON Migration Expert',
        capabilities: ['database', 'migration', 'sql'],
        specializations: ['sqlite', 'migrations', 'json', 'normalization'],
        complexity: { min: 4, max: 9 },
        speed: 'slow',
        reliability: 0.92
      },
      {
        id: 'staff-engineer-code-reviewer',
        name: 'Staff Engineer Code Reviewer',
        capabilities: ['review', 'quality', 'architecture', 'best-practices'],
        specializations: ['code-review', 'refactoring', 'patterns'],
        complexity: { min: 1, max: 10 },
        speed: 'slow',
        reliability: 0.99
      },
      {
        id: 'typescript-type-safety-auditor',
        name: 'TypeScript Type Safety Auditor',
        capabilities: ['types', 'typescript', 'validation', 'safety'],
        specializations: ['typescript', 'type-safety', 'generics'],
        complexity: { min: 3, max: 8 },
        speed: 'medium',
        reliability: 0.96
      },
      {
        id: 'promptliano-service-architect',
        name: 'Promptliano Service Architect',
        capabilities: ['architecture', 'services', 'patterns'],
        specializations: ['promptliano', 'services', 'business-logic'],
        complexity: { min: 4, max: 9 },
        speed: 'medium',
        reliability: 0.94
      },
      {
        id: 'promptliano-planning-architect',
        name: 'Promptliano Planning Architect',
        capabilities: ['planning', 'tickets', 'tasks', 'organization'],
        specializations: ['project-planning', 'task-breakdown', 'tickets'],
        complexity: { min: 2, max: 7 },
        speed: 'fast',
        reliability: 0.97
      },
      {
        id: 'code-simplifier-auditor',
        name: 'Code Simplifier Auditor',
        capabilities: ['simplification', 'refactoring', 'patterns'],
        specializations: ['code-quality', 'duplication', 'simplification'],
        complexity: { min: 2, max: 8 },
        speed: 'medium',
        reliability: 0.93
      },
      {
        id: 'code-modularization-expert',
        name: 'Code Modularization Expert',
        capabilities: ['modularization', 'refactoring', 'architecture'],
        specializations: ['modules', 'separation', 'boundaries'],
        complexity: { min: 4, max: 9 },
        speed: 'slow',
        reliability: 0.91
      },
      {
        id: 'vercel-ai-sdk-expert',
        name: 'Vercel AI SDK Expert',
        capabilities: ['ai', 'streaming', 'llm', 'integration'],
        specializations: ['vercel-ai', 'streaming', 'tool-calling'],
        complexity: { min: 3, max: 8 },
        speed: 'medium',
        reliability: 0.9
      },
      {
        id: 'tanstack-router-expert',
        name: 'TanStack Router Expert',
        capabilities: ['routing', 'navigation', 'react'],
        specializations: ['tanstack-router', 'routing', 'navigation'],
        complexity: { min: 2, max: 7 },
        speed: 'fast',
        reliability: 0.94
      },
      {
        id: 'github-actions-workflow-architect',
        name: 'GitHub Actions Workflow Architect',
        capabilities: ['ci-cd', 'automation', 'workflows'],
        specializations: ['github-actions', 'ci-cd', 'deployment'],
        complexity: { min: 3, max: 8 },
        speed: 'medium',
        reliability: 0.92
      },
      {
        id: 'simple-git-integration-expert',
        name: 'Simple Git Integration Expert',
        capabilities: ['git', 'version-control', 'integration'],
        specializations: ['simple-git', 'git-operations', 'mcp-tools'],
        complexity: { min: 2, max: 7 },
        speed: 'fast',
        reliability: 0.95
      },
      {
        id: 'markdown-docs-writer',
        name: 'Markdown Docs Writer',
        capabilities: ['documentation', 'writing', 'markdown'],
        specializations: ['docs', 'readme', 'guides'],
        complexity: { min: 1, max: 5 },
        speed: 'fast',
        reliability: 0.98
      }
    ]

    defaultAgents.forEach((agent) => {
      this.agents.set(agent.id, agent)
    })
  }

  // Register custom agent
  registerAgent(agent: AgentProfile): void {
    this.agents.set(agent.id, agent)
  }

  // Get agent by ID
  getAgent(agentId: string): AgentProfile | undefined {
    return this.agents.get(agentId)
  }

  // Get all agents
  getAllAgents(): AgentProfile[] {
    return Array.from(this.agents.values())
  }

  // Find agents matching capabilities
  findAgentsByCapabilities(capabilities: string[]): AgentProfile[] {
    return this.getAllAgents().filter((agent) =>
      capabilities.some((cap) => agent.capabilities.includes(cap) || agent.specializations.includes(cap))
    )
  }

  // Find agents for complexity range
  findAgentsByComplexity(complexity: number): AgentProfile[] {
    return this.getAllAgents().filter(
      (agent) => complexity >= agent.complexity.min && complexity <= agent.complexity.max
    )
  }
}

// ============================================================================
// Task Assignment Engine
// ============================================================================

export class TaskAssignmentEngine {
  constructor(
    private agentRegistry: AgentRegistry,
    private strategy: AssignmentStrategy = {
      optimize: 'balanced',
      maxAgentsPerTask: 1,
      allowParallelAgents: false,
      preferSpecialists: true
    }
  ) { }

  // Assign agents to all tasks in a graph
  assignAgents(graph: TaskGraph): E.Either<Error, TaskAssignment[]> {
    try {
      const assignments: TaskAssignment[] = []

      // Process tasks in dependency order
      graph.parallelGroups.forEach((group, groupIndex) => {
        group.forEach((taskId) => {
          const task = graph.nodes.find((n) => n.id === taskId)
          if (task) {
            const assignment = this.assignAgentToTask(task, groupIndex)
            if (E.isRight(assignment)) {
              assignments.push(assignment.right)
            }
          }
        })
      })

      return E.right(assignments)
    } catch (error) {
      return E.left(new Error(`Agent assignment failed: ${error}`))
    }
  }

  // Assign agent to single task
  private assignAgentToTask(task: DecomposedTask, priority: number): E.Either<Error, TaskAssignment> {
    try {
      // Get candidate agents
      const candidates = this.findCandidateAgents(task)

      if (candidates.length === 0) {
        return E.left(new Error(`No suitable agent for task: ${task.id}`))
      }

      // Score and rank candidates
      const scored = candidates.map((agent) => ({
        agent,
        score: this.scoreAgentForTask(agent, task)
      }))

      // Sort by score
      scored.sort((a, b) => b.score - a.score)

      // Select best agent based on strategy
      const selected = this.selectAgent(scored, task)

      // Create assignment
      const assignment: TaskAssignment = {
        taskId: task.id,
        agentId: selected.agent.id,
        confidence: selected.score,
        alternativeAgents: scored.slice(1, 4).map((s) => s.agent.id),
        estimatedDuration: this.estimateDuration(task, selected.agent),
        priority
      }

      return E.right(assignment)
    } catch (error) {
      return E.left(new Error(`Task assignment failed: ${error}`))
    }
  }

  // Find candidate agents for a task
  private findCandidateAgents(task: DecomposedTask): AgentProfile[] {
    const candidates: AgentProfile[] = []

    // 1. Check if task has suggested agent
    if (task.suggestedAgent) {
      const agent = this.agentRegistry.getAgent(task.suggestedAgent)
      if (agent) candidates.push(agent)
    }

    // 2. Find agents by task keywords
    const keywords = this.extractKeywords(task.description)
    const byCapabilities = this.agentRegistry.findAgentsByCapabilities(keywords)
    candidates.push(...byCapabilities)

    // 3. Find agents by complexity
    const byComplexity = this.agentRegistry.findAgentsByComplexity(task.estimatedComplexity || 5)
    candidates.push(...byComplexity)

    // Remove duplicates
    const unique = new Map<string, AgentProfile>()
    candidates.forEach((agent) => unique.set(agent.id, agent))

    return Array.from(unique.values())
  }

  // Score agent for task
  private scoreAgentForTask(agent: AgentProfile, task: DecomposedTask): number {
    let score = 0

    // 1. Specialization match (40%)
    const keywords = this.extractKeywords(task.description.toLowerCase())
    const specializationMatches = agent.specializations.filter((spec) =>
      keywords.some((kw) => spec.includes(kw) || kw.includes(spec))
    ).length
    score += (specializationMatches / Math.max(agent.specializations.length, 1)) * 0.4

    // 2. Capability match (30%)
    const capabilityMatches = agent.capabilities.filter((cap) =>
      keywords.some((kw) => cap.includes(kw) || kw.includes(cap))
    ).length
    score += (capabilityMatches / Math.max(agent.capabilities.length, 1)) * 0.3

    // 3. Complexity fit (20%)
    const complexity = task.estimatedComplexity || 5
    if (complexity >= agent.complexity.min && complexity <= agent.complexity.max) {
      const range = agent.complexity.max - agent.complexity.min
      const midpoint = agent.complexity.min + range / 2
      const distance = Math.abs(complexity - midpoint)
      score += (1 - distance / range) * 0.2
    }

    // 4. Reliability (10%)
    score += (agent.reliability || 0.9) * 0.1

    // 5. Bonus for exact suggested match
    if (task.suggestedAgent === agent.id) {
      score += 0.2
    }

    return Math.min(score, 1)
  }

  // Select agent based on strategy
  private selectAgent(
    scored: Array<{ agent: AgentProfile; score: number }>,
    task: DecomposedTask
  ): { agent: AgentProfile; score: number } {
    if (scored.length === 0) {
      throw new Error('No agents available')
    }

    switch (this.strategy.optimize) {
      case 'quality':
        // Pick highest scored regardless of other factors
        return scored[0]

      case 'speed':
        // Filter for fast agents, then pick best
        const fast = scored.filter((s) => s.agent.speed !== 'slow')
        return fast.length > 0 ? fast[0] : scored[0]

      case 'cost':
        // Sort by cost if available, otherwise by speed
        const byCost = [...scored].sort((a, b) => {
          const costA = a.agent.costPerToken || 1
          const costB = b.agent.costPerToken || 1
          return costA - costB
        })
        return byCost[0]

      case 'balanced':
      default:
        // Balance score with speed
        const balanced = [...scored].sort((a, b) => {
          const scoreA = a.score * (a.agent.speed === 'fast' ? 1.1 : 1)
          const scoreB = b.score * (b.agent.speed === 'fast' ? 1.1 : 1)
          return scoreB - scoreA
        })
        return balanced[0]
    }
  }

  // Estimate task duration with agent
  private estimateDuration(task: DecomposedTask, agent: AgentProfile): number {
    const baseTime = (task.estimatedComplexity || 5) * 10 // Base: 10 min per complexity

    // Adjust for agent speed
    const speedMultiplier = agent.speed === 'fast' ? 0.7 : agent.speed === 'slow' ? 1.5 : 1

    // Adjust for subtasks
    const subtaskMultiplier = task.subtasks ? 1 + task.subtasks.length * 0.2 : 1

    return Math.ceil(baseTime * speedMultiplier * subtaskMultiplier)
  }

  // Extract keywords from text
  private extractKeywords(text: string): string[] {
    const keywords: string[] = []

    // Common technical terms
    const technicalTerms = [
      'api',
      'ui',
      'database',
      'frontend',
      'backend',
      'component',
      'service',
      'route',
      'schema',
      'validation',
      'test',
      'migration',
      'deployment',
      'authentication',
      'authorization',
      'cache',
      'queue',
      'react',
      'typescript',
      'zod',
      'hono',
      'bun',
      'sqlite',
      'git',
      'docker',
      'ci',
      'cd',
      'workflow',
      'action',
      'review',
      'refactor'
    ]

    const lowerText = text.toLowerCase()
    technicalTerms.forEach((term) => {
      if (lowerText.includes(term)) {
        keywords.push(term)
      }
    })

    // Extract action verbs
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
      'deploy',
      'migrate',
      'review'
    ]

    actionVerbs.forEach((verb) => {
      if (lowerText.includes(verb)) {
        keywords.push(verb)
      }
    })

    return keywords
  }
}

// ============================================================================
// Assignment Optimizer
// ============================================================================

export class AssignmentOptimizer {
  // Optimize assignments for better distribution
  optimizeAssignments(assignments: TaskAssignment[], strategy: AssignmentStrategy): TaskAssignment[] {
    // Balance load across agents
    const balanced = this.balanceAgentLoad(assignments)

    // Handle parallel agent assignments if allowed
    if (strategy.allowParallelAgents && strategy.maxAgentsPerTask > 1) {
      return this.addParallelAgents(balanced, strategy.maxAgentsPerTask)
    }

    return balanced
  }

  // Balance load across agents
  private balanceAgentLoad(assignments: TaskAssignment[]): TaskAssignment[] {
    // Count tasks per agent
    const agentLoad = new Map<string, number>()
    assignments.forEach((assignment) => {
      const count = agentLoad.get(assignment.agentId) || 0
      agentLoad.set(assignment.agentId, count + 1)
    })

    // Find overloaded agents
    const avgLoad = assignments.length / agentLoad.size
    const overloaded = Array.from(agentLoad.entries())
      .filter(([_, count]) => count > avgLoad * 1.5)
      .map(([agentId]) => agentId)

    // Reassign some tasks from overloaded agents
    const optimized = assignments.map((assignment) => {
      if (overloaded.includes(assignment.agentId) && assignment.alternativeAgents.length > 0) {
        // Check if alternative has lower load
        const alt = assignment.alternativeAgents.find((altId) => {
          const altLoad = agentLoad.get(altId) || 0
          return altLoad < avgLoad
        })

        if (alt) {
          // Update load counts
          agentLoad.set(assignment.agentId, (agentLoad.get(assignment.agentId) || 1) - 1)
          agentLoad.set(alt, (agentLoad.get(alt) || 0) + 1)

          return {
            ...assignment,
            agentId: alt,
            confidence: assignment.confidence * 0.9 // Slightly lower confidence
          }
        }
      }
      return assignment
    })

    return optimized
  }

  // Add parallel agents for critical tasks
  private addParallelAgents(assignments: TaskAssignment[], maxAgents: number): TaskAssignment[] {
    const enhanced: TaskAssignment[] = []

    assignments.forEach((assignment) => {
      enhanced.push(assignment)

      // Add parallel agents for high-priority, low-confidence tasks
      if (assignment.priority <= 2 && assignment.confidence < 0.7 && assignment.alternativeAgents.length > 0) {
        const parallelCount = Math.min(assignment.alternativeAgents.length, maxAgents - 1)

        for (let i = 0; i < parallelCount; i++) {
          enhanced.push({
            ...assignment,
            agentId: assignment.alternativeAgents[i],
            confidence: assignment.confidence * 0.8
          })
        }
      }
    })

    return enhanced
  }
}

// Export factory functions
export function createAgentRegistry(): AgentRegistry {
  return new AgentRegistry()
}

export function createTaskAssignmentEngine(
  agentRegistry?: AgentRegistry,
  strategy?: AssignmentStrategy
): TaskAssignmentEngine {
  return new TaskAssignmentEngine(agentRegistry || createAgentRegistry(), strategy)
}

export function createAssignmentOptimizer(): AssignmentOptimizer {
  return new AssignmentOptimizer()
}
