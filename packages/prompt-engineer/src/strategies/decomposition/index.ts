// ============================================================================
// Task Decomposition Strategy
// ============================================================================

export {
  TaskAnalyzer,
  TaskGraphBuilder,
  TaskSimilarityCalculator,
  createTaskAnalyzer,
  createTaskGraphBuilder,
  createTaskSimilarityCalculator,
  type TaskAnalysisConfig
} from './task-analyzer'

export {
  DependencyGraphAnalyzer,
  ExecutionPlanner,
  GraphOptimizer,
  createDependencyGraphAnalyzer,
  createExecutionPlanner,
  createGraphOptimizer,
  type GraphAnalysis,
  type ExecutionPlan,
  type ExecutionStage
} from './dependency-graph'

export {
  AgentRegistry,
  TaskAssignmentEngine,
  AssignmentOptimizer,
  createAgentRegistry,
  createTaskAssignmentEngine,
  createAssignmentOptimizer,
  type AgentProfile,
  type TaskAssignment,
  type AssignmentStrategy
} from './task-assignment'

// ============================================================================
// Unified Task Decomposition API
// ============================================================================

import { TaskAnalyzer, createTaskAnalyzer } from './task-analyzer'
import { TaskGraphBuilder, createTaskGraphBuilder } from './task-analyzer'
import { DependencyGraphAnalyzer, createDependencyGraphAnalyzer } from './dependency-graph'
import { ExecutionPlanner, createExecutionPlanner } from './dependency-graph'
import { TaskAssignmentEngine, createTaskAssignmentEngine } from './task-assignment'
import type { DecomposedTask, TaskGraph } from '../../types'
import { E, TE, pipe } from '../../fp'

export interface TaskDecompositionConfig {
  maxDepth?: number
  minTaskSize?: number
  maxTaskSize?: number
  parallelizationThreshold?: number
  optimize?: 'speed' | 'cost' | 'quality' | 'balanced'
  maxConcurrency?: number
}

export class TaskDecompositionStrategy {
  private taskAnalyzer: TaskAnalyzer
  private graphBuilder: TaskGraphBuilder
  private graphAnalyzer: DependencyGraphAnalyzer
  private executionPlanner: ExecutionPlanner
  private assignmentEngine: TaskAssignmentEngine

  constructor(config?: TaskDecompositionConfig) {
    this.taskAnalyzer = createTaskAnalyzer({
      maxDepth: config?.maxDepth,
      minTaskSize: config?.minTaskSize,
      maxTaskSize: config?.maxTaskSize,
      parallelizationThreshold: config?.parallelizationThreshold
    })

    this.graphBuilder = createTaskGraphBuilder()
    this.graphAnalyzer = createDependencyGraphAnalyzer()
    this.executionPlanner = createExecutionPlanner()
    this.assignmentEngine = createTaskAssignmentEngine(undefined, {
      optimize: config?.optimize || 'balanced',
      maxAgentsPerTask: 1,
      allowParallelAgents: false,
      preferSpecialists: true
    })
  }

  // Full decomposition pipeline
  decompose(taskDescription: string): E.Either<Error, {
    task: DecomposedTask
    graph: TaskGraph
    analysis: ReturnType<DependencyGraphAnalyzer['analyzeGraph']>
    executionPlan: ReturnType<ExecutionPlanner['createExecutionPlan']>
    assignments: ReturnType<TaskAssignmentEngine['assignAgents']>
  }> {
    return pipe(
      // Step 1: Analyze and decompose task
      this.taskAnalyzer.analyzeTask(taskDescription),

      // Step 2: Build task graph
      E.chain(task => {
        const graph = this.graphBuilder.buildGraph(task)
        return E.right({ task, graph })
      }),

      // Step 3: Analyze graph
      E.chain(({ task, graph }) => {
        const analysis = this.graphAnalyzer.analyzeGraph(graph)
        return E.right({ task, graph, analysis })
      }),

      // Step 4: Create execution plan
      E.chain(({ task, graph, analysis }) => {
        const executionPlan = this.executionPlanner.createExecutionPlan(
          graph,
          this.config?.maxConcurrency || 5
        )
        return E.right({ task, graph, analysis, executionPlan })
      }),

      // Step 5: Assign agents
      E.chain(({ task, graph, analysis, executionPlan }) => {
        const assignments = this.assignmentEngine.assignAgents(graph)
        return E.isRight(assignments)
          ? E.right({ task, graph, analysis, executionPlan, assignments })
          : E.left(assignments.left)
      })
    )
  }

  // Async version
  decomposeAsync(taskDescription: string): TE.TaskEither<Error, {
    task: DecomposedTask
    graph: TaskGraph
    analysis: ReturnType<DependencyGraphAnalyzer['analyzeGraph']>
    executionPlan: ReturnType<ExecutionPlanner['createExecutionPlan']>
    assignments: ReturnType<TaskAssignmentEngine['assignAgents']>
  }> {
    return TE.fromEither(this.decompose(taskDescription))
  }

  // Just analyze without full decomposition
  analyze(taskDescription: string): E.Either<Error, DecomposedTask> {
    return this.taskAnalyzer.analyzeTask(taskDescription)
  }

  // Build graph from existing task
  buildGraph(task: DecomposedTask): TaskGraph {
    return this.graphBuilder.buildGraph(task)
  }

  private config?: TaskDecompositionConfig
}

// Export factory function
export function createTaskDecompositionStrategy(
  config?: TaskDecompositionConfig
): TaskDecompositionStrategy {
  return new TaskDecompositionStrategy(config)
}