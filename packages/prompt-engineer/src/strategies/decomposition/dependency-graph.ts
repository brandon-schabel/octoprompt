import { E, A, O, pipe } from '../../fp'
import { type DecomposedTask, type TaskGraph, type TaskDependency } from '../../types'

// ============================================================================
// Advanced Dependency Graph Operations
// ============================================================================

export interface GraphAnalysis {
  hasCycles: boolean
  longestPath: number
  maxParallelism: number
  bottlenecks: string[]
  estimatedDuration: number
}

export interface ExecutionPlan {
  stages: ExecutionStage[]
  estimatedTotalTime: number
  maxConcurrency: number
  criticalPathLength: number
}

export interface ExecutionStage {
  stageNumber: number
  tasks: string[]
  canParallelize: boolean
  estimatedDuration: number
  dependencies: string[]
}

// ============================================================================
// Dependency Graph Analyzer
// ============================================================================

export class DependencyGraphAnalyzer {
  // Analyze graph for cycles, bottlenecks, and optimization opportunities
  analyzeGraph(graph: TaskGraph): GraphAnalysis {
    const hasCycles = this.detectCycles(graph)
    const longestPath = this.calculateLongestPath(graph)
    const maxParallelism = this.calculateMaxParallelism(graph)
    const bottlenecks = this.identifyBottlenecks(graph)
    const estimatedDuration = this.estimateTotalDuration(graph)

    return {
      hasCycles,
      longestPath,
      maxParallelism,
      bottlenecks,
      estimatedDuration
    }
  }

  // Detect cycles in the dependency graph using DFS
  private detectCycles(graph: TaskGraph): boolean {
    const visited = new Set<string>()
    const recStack = new Set<string>()
    const adjList = this.buildAdjacencyList(graph.edges)

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId)
      recStack.add(nodeId)

      const neighbors = adjList.get(nodeId) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true
        } else if (recStack.has(neighbor)) {
          return true // Found a cycle
        }
      }

      recStack.delete(nodeId)
      return false
    }

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) return true
      }
    }

    return false
  }

  // Calculate longest path (critical path) through the graph
  private calculateLongestPath(graph: TaskGraph): number {
    const adjList = this.buildAdjacencyList(graph.edges)
    const memo = new Map<string, number>()

    const dfs = (nodeId: string): number => {
      if (memo.has(nodeId)) return memo.get(nodeId)!

      const neighbors = adjList.get(nodeId) || []
      if (neighbors.length === 0) {
        memo.set(nodeId, 1)
        return 1
      }

      let maxLength = 0
      for (const neighbor of neighbors) {
        maxLength = Math.max(maxLength, dfs(neighbor))
      }

      const result = maxLength + 1
      memo.set(nodeId, result)
      return result
    }

    let longestPath = 0
    for (const node of graph.nodes) {
      longestPath = Math.max(longestPath, dfs(node.id))
    }

    return longestPath
  }

  // Calculate maximum possible parallelism
  private calculateMaxParallelism(graph: TaskGraph): number {
    // Maximum parallelism is the maximum number of tasks at any dependency level
    const levels = this.topologicalLevels(graph)
    return Math.max(...levels.map((level) => level.length), 1)
  }

  // Identify bottleneck tasks (high in-degree or out-degree)
  private identifyBottlenecks(graph: TaskGraph): string[] {
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()

    // Initialize degrees
    graph.nodes.forEach((node) => {
      inDegree.set(node.id, 0)
      outDegree.set(node.id, 0)
    })

    // Calculate degrees
    graph.edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
        outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1)
      }
    })

    const bottlenecks: string[] = []
    const avgDegree = (graph.edges.length * 2) / graph.nodes.length

    graph.nodes.forEach((node) => {
      const inDeg = inDegree.get(node.id) || 0
      const outDeg = outDegree.get(node.id) || 0

      // Bottleneck if significantly higher degree than average
      if (inDeg > avgDegree * 2 || outDeg > avgDegree * 2) {
        bottlenecks.push(node.id)
      }
    })

    return bottlenecks
  }

  // Estimate total duration based on complexity and parallelization
  private estimateTotalDuration(graph: TaskGraph): number {
    // Simple estimation: critical path length * average complexity
    const criticalPathLength = graph.criticalPath.length

    let totalComplexity = 0
    let taskCount = 0

    graph.criticalPath.forEach((taskId) => {
      const task = graph.nodes.find((n) => n.id === taskId)
      if (task) {
        totalComplexity += task.estimatedComplexity || 1
        taskCount++
      }
    })

    const avgComplexity = taskCount > 0 ? totalComplexity / taskCount : 1

    // Assume each complexity unit = ~10 minutes
    return Math.ceil(criticalPathLength * avgComplexity * 10)
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

  // Get topological levels (for parallelization analysis)
  private topologicalLevels(graph: TaskGraph): string[][] {
    const levels: string[][] = []
    const inDegree = new Map<string, number>()
    const adjList = this.buildAdjacencyList(graph.edges)

    // Calculate in-degrees
    graph.nodes.forEach((node) => {
      inDegree.set(node.id, 0)
    })

    graph.edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
      }
    })

    const processed = new Set<string>()

    while (processed.size < graph.nodes.length) {
      const currentLevel: string[] = []

      graph.nodes.forEach((node) => {
        if (!processed.has(node.id) && inDegree.get(node.id) === 0) {
          currentLevel.push(node.id)
        }
      })

      if (currentLevel.length === 0) break // Prevent infinite loop

      levels.push(currentLevel)

      // Update in-degrees
      currentLevel.forEach((nodeId) => {
        processed.add(nodeId)
        const neighbors = adjList.get(nodeId) || []
        neighbors.forEach((neighbor) => {
          inDegree.set(neighbor, (inDegree.get(neighbor) || 1) - 1)
        })
      })
    }

    return levels
  }
}

// ============================================================================
// Execution Planner
// ============================================================================

export class ExecutionPlanner {
  // Create an optimized execution plan from the task graph
  createExecutionPlan(graph: TaskGraph, maxConcurrency: number = 5): ExecutionPlan {
    const stages = this.buildExecutionStages(graph)
    const estimatedTotalTime = this.estimateExecutionTime(stages, maxConcurrency)
    const criticalPathLength = graph.criticalPath.length

    return {
      stages,
      estimatedTotalTime,
      maxConcurrency,
      criticalPathLength
    }
  }

  // Build execution stages based on dependencies
  private buildExecutionStages(graph: TaskGraph): ExecutionStage[] {
    const stages: ExecutionStage[] = []
    const completed = new Set<string>()
    const inProgress = new Set<string>()

    // Build dependency map
    const dependencies = new Map<string, Set<string>>()
    graph.edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        if (!dependencies.has(edge.to)) {
          dependencies.set(edge.to, new Set())
        }
        dependencies.get(edge.to)!.add(edge.from)
      }
    })

    let stageNumber = 0

    while (completed.size < graph.nodes.length) {
      const stageTasks: string[] = []

      // Find tasks ready to execute
      graph.nodes.forEach((node) => {
        if (!completed.has(node.id) && !inProgress.has(node.id)) {
          const deps = dependencies.get(node.id) || new Set()
          if ([...deps].every((dep) => completed.has(dep))) {
            stageTasks.push(node.id)
            inProgress.add(node.id)
          }
        }
      })

      if (stageTasks.length === 0) {
        // Handle remaining tasks (possible cycle or error)
        const remaining = graph.nodes.filter((n) => !completed.has(n.id)).map((n) => n.id)

        if (remaining.length > 0) {
          stages.push({
            stageNumber: stageNumber++,
            tasks: remaining,
            canParallelize: false,
            estimatedDuration: remaining.length * 10,
            dependencies: []
          })
          remaining.forEach((id) => completed.add(id))
        }
        break
      }

      // Calculate stage properties
      const stageDeps = [
        ...new Set(
          stageTasks.flatMap((taskId) => [...(dependencies.get(taskId) || [])].filter((dep) => !completed.has(dep)))
        )
      ]

      const canParallelize = stageTasks.length > 1 && this.tasksCanParallelize(stageTasks, graph)

      const estimatedDuration = this.estimateStageDuration(stageTasks, graph)

      stages.push({
        stageNumber: stageNumber++,
        tasks: stageTasks,
        canParallelize,
        estimatedDuration,
        dependencies: stageDeps
      })

      // Mark tasks as completed
      stageTasks.forEach((id) => {
        inProgress.delete(id)
        completed.add(id)
      })
    }

    return stages
  }

  // Check if tasks in a stage can run in parallel
  private tasksCanParallelize(taskIds: string[], graph: TaskGraph): boolean {
    // Check if any tasks depend on each other
    for (const edge of graph.edges) {
      if (edge.type === 'blocks' && taskIds.includes(edge.from) && taskIds.includes(edge.to)) {
        return false
      }
    }

    // Check if tasks are marked as parallelizable
    const tasks = taskIds.map((id) => graph.nodes.find((n) => n.id === id)).filter((t) => t !== undefined)

    return tasks.every((task) => task.parallelizable !== false)
  }

  // Estimate duration for a stage
  private estimateStageDuration(taskIds: string[], graph: TaskGraph): number {
    const tasks = taskIds.map((id) => graph.nodes.find((n) => n.id === id)).filter((t) => t !== undefined)

    if (tasks.length === 0) return 10

    // If parallel, duration is the max; if sequential, it's the sum
    const complexities = tasks.map((t) => t.estimatedComplexity || 1)

    const canParallelize = this.tasksCanParallelize(taskIds, graph)

    if (canParallelize) {
      return Math.max(...complexities) * 10
    } else {
      return complexities.reduce((sum, c) => sum + c, 0) * 10
    }
  }

  // Estimate total execution time considering concurrency limits
  private estimateExecutionTime(stages: ExecutionStage[], maxConcurrency: number): number {
    let totalTime = 0

    stages.forEach((stage) => {
      if (stage.canParallelize && stage.tasks.length > 1) {
        // Account for concurrency limit
        const batches = Math.ceil(stage.tasks.length / maxConcurrency)
        totalTime += stage.estimatedDuration * batches
      } else {
        totalTime += stage.estimatedDuration
      }
    })

    return totalTime
  }
}

// ============================================================================
// Graph Optimizer
// ============================================================================

export class GraphOptimizer {
  // Optimize task graph for better parallelization
  optimizeGraph(graph: TaskGraph): TaskGraph {
    // Remove redundant dependencies
    const optimizedEdges = this.removeRedundantDependencies(graph)

    // Rebalance task distribution
    const rebalancedGroups = this.rebalanceParallelGroups(graph)

    // Recalculate critical path
    const newCriticalPath = this.recalculateCriticalPath(graph.nodes, optimizedEdges)

    return {
      nodes: graph.nodes,
      edges: optimizedEdges,
      criticalPath: newCriticalPath,
      parallelGroups: rebalancedGroups
    }
  }

  // Remove transitive/redundant dependencies
  private removeRedundantDependencies(graph: TaskGraph): TaskDependency[] {
    const edges = [...graph.edges]
    const toRemove = new Set<number>()

    // Build transitive closure
    const closure = this.transitiveClosuare(graph.nodes, edges)

    // Check each edge for redundancy
    edges.forEach((edge, index) => {
      if (edge.type === 'blocks') {
        // Check if there's an indirect path
        const otherEdges = edges.filter((_, i) => i !== index)
        const hasIndirectPath = this.hasPath(edge.from, edge.to, otherEdges)

        if (hasIndirectPath) {
          toRemove.add(index)
        }
      }
    })

    return edges.filter((_, index) => !toRemove.has(index))
  }

  // Check if path exists between two nodes
  private hasPath(from: string, to: string, edges: TaskDependency[]): boolean {
    const adjList = new Map<string, string[]>()
    edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        if (!adjList.has(edge.from)) {
          adjList.set(edge.from, [])
        }
        adjList.get(edge.from)!.push(edge.to)
      }
    })

    const visited = new Set<string>()
    const queue = [from]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === to) return true

      if (!visited.has(current)) {
        visited.add(current)
        const neighbors = adjList.get(current) || []
        queue.push(...neighbors)
      }
    }

    return false
  }

  // Calculate transitive closure
  private transitiveClosuare(nodes: DecomposedTask[], edges: TaskDependency[]): Map<string, Set<string>> {
    const closure = new Map<string, Set<string>>()

    // Initialize with direct dependencies
    nodes.forEach((node) => {
      closure.set(node.id, new Set())
    })

    edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        closure.get(edge.from)?.add(edge.to)
      }
    })

    // Floyd-Warshall for transitive closure
    nodes.forEach((k) => {
      nodes.forEach((i) => {
        nodes.forEach((j) => {
          if (closure.get(i.id)?.has(k.id) && closure.get(k.id)?.has(j.id)) {
            closure.get(i.id)?.add(j.id)
          }
        })
      })
    })

    return closure
  }

  // Rebalance parallel groups for better distribution
  private rebalanceParallelGroups(graph: TaskGraph): string[][] {
    const groups = [...graph.parallelGroups]

    // Try to balance group sizes
    const avgSize = Math.ceil(graph.nodes.length / Math.max(groups.length, 1))

    const balanced: string[][] = []
    let currentGroup: string[] = []

    groups.forEach((group) => {
      group.forEach((taskId) => {
        currentGroup.push(taskId)
        if (currentGroup.length >= avgSize) {
          balanced.push([...currentGroup])
          currentGroup = []
        }
      })
    })

    if (currentGroup.length > 0) {
      balanced.push(currentGroup)
    }

    return balanced
  }

  // Recalculate critical path after optimization
  private recalculateCriticalPath(nodes: DecomposedTask[], edges: TaskDependency[]): string[] {
    const adjList = new Map<string, string[]>()
    edges.forEach((edge) => {
      if (edge.type === 'blocks') {
        if (!adjList.has(edge.from)) {
          adjList.set(edge.from, [])
        }
        adjList.get(edge.from)!.push(edge.to)
      }
    })

    // Find longest path using DFS
    const memo = new Map<string, string[]>()

    const dfs = (nodeId: string): string[] => {
      if (memo.has(nodeId)) return memo.get(nodeId)!

      const neighbors = adjList.get(nodeId) || []
      if (neighbors.length === 0) {
        memo.set(nodeId, [nodeId])
        return [nodeId]
      }

      let longestPath: string[] = []
      for (const neighbor of neighbors) {
        const path = dfs(neighbor)
        if (path.length > longestPath.length) {
          longestPath = path
        }
      }

      const result = [nodeId, ...longestPath]
      memo.set(nodeId, result)
      return result
    }

    let criticalPath: string[] = []
    nodes.forEach((node) => {
      const path = dfs(node.id)
      if (path.length > criticalPath.length) {
        criticalPath = path
      }
    })

    return criticalPath
  }
}

// Export factory functions
export function createDependencyGraphAnalyzer(): DependencyGraphAnalyzer {
  return new DependencyGraphAnalyzer()
}

export function createExecutionPlanner(): ExecutionPlanner {
  return new ExecutionPlanner()
}

export function createGraphOptimizer(): GraphOptimizer {
  return new GraphOptimizer()
}
