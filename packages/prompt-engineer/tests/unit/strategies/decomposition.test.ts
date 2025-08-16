import { describe, test, expect } from 'bun:test'
import {
  TaskAnalyzer,
  TaskGraphBuilder,
  TaskSimilarityCalculator,
  createTaskAnalyzer,
  createTaskGraphBuilder,
  createTaskSimilarityCalculator
} from '../../../src/strategies/decomposition'
import { TEST_PROMPTS } from '../../fixtures/prompts'

describe('Task Decomposition Strategy', () => {
  describe('TaskAnalyzer', () => {
    const analyzer = createTaskAnalyzer()

    test('should analyze simple task', () => {
      const task = 'Create a user authentication system'
      const result = analyzer.analyzeTask(task)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.id).toBeDefined()
        expect(decomposed.title).toContain('authentication')
        expect(decomposed.description).toBe(task)
        expect(decomposed.estimatedComplexity).toBeGreaterThan(0)
      }
    })

    test('should identify subtasks from numbered list', () => {
      const task = `Build a todo app with:
        1. Create task functionality
        2. Update task status
        3. Delete tasks
        4. Filter by status`

      const result = analyzer.analyzeTask(task)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.subtasks.length).toBe(4)
        expect(decomposed.subtasks[0].title).toContain('Create')
        expect(decomposed.subtasks[1].title).toContain('Update')
      }
    })

    test('should extract dependencies', () => {
      const task = 'Deploy the application after running tests and building the Docker image'
      const result = analyzer.analyzeTask(task)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.dependencies.length).toBeGreaterThan(0)
        expect(decomposed.dependencies).toContain('build')
        expect(decomposed.dependencies).toContain('test')
      }
    })

    test('should calculate complexity scores', () => {
      const simpleTask = 'Add a button to the page'
      const complexTask = TEST_PROMPTS.complex.systemDesign

      const simpleResult = analyzer.analyzeTask(simpleTask)
      const complexResult = analyzer.analyzeTask(complexTask)

      expect(simpleResult._tag).toBe('Right')
      expect(complexResult._tag).toBe('Right')

      if (simpleResult._tag === 'Right' && complexResult._tag === 'Right') {
        expect(simpleResult.right.estimatedComplexity).toBeLessThan(complexResult.right.estimatedComplexity)
      }
    })

    test('should detect parallelizable tasks', () => {
      const parallelTask = 'Run these independent tests in parallel'
      const sequentialTask = 'First build, then test, finally deploy'

      const parallelResult = analyzer.analyzeTask(parallelTask)
      const sequentialResult = analyzer.analyzeTask(sequentialTask)

      expect(parallelResult._tag).toBe('Right')
      expect(sequentialResult._tag).toBe('Right')

      if (parallelResult._tag === 'Right' && sequentialResult._tag === 'Right') {
        expect(parallelResult.right.parallelizable).toBe(true)
        expect(sequentialResult.right.parallelizable).toBe(false)
      }
    })

    test('should suggest appropriate agents', () => {
      const frontendTask = 'Create a React component with shadcn UI'
      const apiTask = 'Create a REST API endpoint with validation'
      const dbTask = 'Create a database migration for user table'

      const frontendResult = analyzer.analyzeTask(frontendTask)
      const apiResult = analyzer.analyzeTask(apiTask)
      const dbResult = analyzer.analyzeTask(dbTask)

      expect(frontendResult._tag).toBe('Right')
      expect(apiResult._tag).toBe('Right')
      expect(dbResult._tag).toBe('Right')

      if (frontendResult._tag === 'Right') {
        expect(frontendResult.right.suggestedAgent).toBe('promptliano-ui-architect')
      }
      if (apiResult._tag === 'Right') {
        expect(apiResult.right.suggestedAgent).toBe('hono-bun-api-architect')
      }
      if (dbResult._tag === 'Right') {
        expect(dbResult.right.suggestedAgent).toBe('promptliano-sqlite-expert')
      }
    })

    test('should suggest model based on complexity', () => {
      const simpleTask = 'Add a console.log statement'
      const mediumTask = 'Implement a sorting algorithm'
      const complexTask = TEST_PROMPTS.complex.systemDesign

      const simpleResult = analyzer.analyzeTask(simpleTask)
      const mediumResult = analyzer.analyzeTask(mediumTask)
      const complexResult = analyzer.analyzeTask(complexTask)

      expect(simpleResult._tag).toBe('Right')
      expect(mediumResult._tag).toBe('Right')
      expect(complexResult._tag).toBe('Right')

      if (simpleResult._tag === 'Right') {
        expect(simpleResult.right.suggestedModel).toBe('mixtral-8x7b')
      }
      if (complexResult._tag === 'Right') {
        expect(['claude-3-opus', 'gpt-4-turbo'].includes(complexResult.right.suggestedModel!)).toBe(true)
      }
    })

    test('should respect maxDepth configuration', () => {
      const deepAnalyzer = createTaskAnalyzer({ maxDepth: 2 })
      const task = `Main task with subtasks:
        1. Subtask A with sub-subtasks:
           a. Sub-subtask A1
           b. Sub-subtask A2
        2. Subtask B`

      const result = deepAnalyzer.analyzeTask(task)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.subtasks.length).toBeGreaterThan(0)
        // Check that recursion stops at maxDepth
        const firstSubtask = decomposed.subtasks[0]
        expect(firstSubtask.subtasks.length).toBeGreaterThan(0)
        // Third level should be simple tasks
        const subSubtask = firstSubtask.subtasks[0]
        expect(subSubtask.subtasks.length).toBe(0)
      }
    })

    test('should handle compound tasks with "and"', () => {
      const task = 'Create the UI and implement the backend and write tests'
      const result = analyzer.analyzeTask(task)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.subtasks.length).toBe(3)
        expect(decomposed.subtasks[0].title).toContain('UI')
        expect(decomposed.subtasks[1].title).toContain('backend')
        expect(decomposed.subtasks[2].title).toContain('tests')
      }
    })

    test('should identify action verb tasks', () => {
      const task = 'Implement user authentication. Create database schema. Add validation rules.'
      const result = analyzer.analyzeTask(task)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.subtasks.length).toBe(3)
        expect(decomposed.subtasks.some((st) => st.title.includes('authentication'))).toBe(true)
        expect(decomposed.subtasks.some((st) => st.title.includes('schema'))).toBe(true)
        expect(decomposed.subtasks.some((st) => st.title.includes('validation'))).toBe(true)
      }
    })
  })

  describe('TaskGraphBuilder', () => {
    const analyzer = createTaskAnalyzer()
    const builder = createTaskGraphBuilder()

    test('should build graph from decomposed task', () => {
      const task = `Build application:
        1. Setup environment
        2. Install dependencies after setup
        3. Run tests after installing
        4. Deploy after tests pass`

      const analysisResult = analyzer.analyzeTask(task)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const graph = builder.buildGraph(analysisResult.right)

        expect(graph.nodes.length).toBeGreaterThan(0)
        expect(graph.edges.length).toBeGreaterThan(0)
        expect(graph.criticalPath.length).toBeGreaterThan(0)
        expect(graph.parallelGroups.length).toBeGreaterThan(0)
      }
    })

    test('should identify critical path', () => {
      const task = `Sequential workflow:
        1. Load data
        2. Process data (depends on load)
        3. Generate report (depends on process)
        4. Send notification (independent)`

      const analysisResult = analyzer.analyzeTask(task)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const graph = builder.buildGraph(analysisResult.right)

        // Critical path should include sequential dependencies
        expect(graph.criticalPath.length).toBeGreaterThanOrEqual(3)
      }
    })

    test('should identify parallel groups', () => {
      const task = `Parallel tasks:
        1. Task A (independent)
        2. Task B (independent)
        3. Task C (depends on A and B)
        4. Task D (independent)`

      const analysisResult = analyzer.analyzeTask(task)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const graph = builder.buildGraph(analysisResult.right)

        // Should have at least 2 parallel groups
        expect(graph.parallelGroups.length).toBeGreaterThanOrEqual(2)
        // First group should have multiple tasks
        expect(graph.parallelGroups[0].length).toBeGreaterThan(1)
      }
    })

    test('should create dependency edges', () => {
      const task = 'Deploy application after running tests'

      const analysisResult = analyzer.analyzeTask(task)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const graph = builder.buildGraph(analysisResult.right)

        // Should have edges representing dependencies
        const blockingEdges = graph.edges.filter((e) => e.type === 'blocks')
        expect(blockingEdges.length).toBeGreaterThan(0)
      }
    })

    test('should handle nested task structures', () => {
      const task = `Main project:
        1. Frontend development:
           - Create components
           - Add styling
        2. Backend development:
           - Create API
           - Setup database`

      const analysisResult = analyzer.analyzeTask(task)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const graph = builder.buildGraph(analysisResult.right)

        // Should flatten nested structure
        expect(graph.nodes.length).toBeGreaterThan(3) // Main + 2 subtasks + their children

        // Should have parent-child edges
        const informEdges = graph.edges.filter((e) => e.type === 'informs')
        expect(informEdges.length).toBeGreaterThan(0)
      }
    })
  })

  describe('TaskSimilarityCalculator', () => {
    const analyzer = createTaskAnalyzer()
    const calculator = createTaskSimilarityCalculator()

    test('should calculate similarity between tasks', () => {
      const task1Result = analyzer.analyzeTask('Create a user authentication system')
      const task2Result = analyzer.analyzeTask('Build a user login system')
      const task3Result = analyzer.analyzeTask('Implement data visualization charts')

      expect(task1Result._tag).toBe('Right')
      expect(task2Result._tag).toBe('Right')
      expect(task3Result._tag).toBe('Right')

      if (task1Result._tag === 'Right' && task2Result._tag === 'Right' && task3Result._tag === 'Right') {
        const similarTasks = calculator.calculateSimilarity(task1Result.right, task2Result.right)
        const differentTasks = calculator.calculateSimilarity(task1Result.right, task3Result.right)

        // Similar tasks should have higher similarity
        expect(similarTasks).toBeGreaterThan(differentTasks)
        expect(similarTasks).toBeGreaterThan(0.3)
        expect(differentTasks).toBeLessThan(0.3)
      }
    })

    test('should consider agent similarity', () => {
      const frontendTask1 = analyzer.analyzeTask('Create React component')
      const frontendTask2 = analyzer.analyzeTask('Build UI with React')
      const backendTask = analyzer.analyzeTask('Create API endpoint')

      expect(frontendTask1._tag).toBe('Right')
      expect(frontendTask2._tag).toBe('Right')
      expect(backendTask._tag).toBe('Right')

      if (frontendTask1._tag === 'Right' && frontendTask2._tag === 'Right' && backendTask._tag === 'Right') {
        const sameDomain = calculator.calculateSimilarity(frontendTask1.right, frontendTask2.right)
        const differentDomain = calculator.calculateSimilarity(frontendTask1.right, backendTask.right)

        // Tasks with same suggested agent should be more similar
        expect(sameDomain).toBeGreaterThan(differentDomain)
      }
    })

    test('should find longest common substring', () => {
      const task1 = analyzer.analyzeTask('Implement binary search algorithm')
      const task2 = analyzer.analyzeTask('Create binary search tree')

      expect(task1._tag).toBe('Right')
      expect(task2._tag).toBe('Right')

      if (task1._tag === 'Right' && task2._tag === 'Right') {
        const similarity = calculator.calculateSimilarity(task1.right, task2.right)

        // Should detect "binary search" as common
        expect(similarity).toBeGreaterThan(0.2)
      }
    })

    test('should return 0 for completely different tasks', () => {
      const task1 = analyzer.analyzeTask('XYZ123')
      const task2 = analyzer.analyzeTask('ABC456')

      expect(task1._tag).toBe('Right')
      expect(task2._tag).toBe('Right')

      if (task1._tag === 'Right' && task2._tag === 'Right') {
        const similarity = calculator.calculateSimilarity(task1.right, task2.right)

        // Completely different tasks should have very low similarity
        expect(similarity).toBeLessThan(0.1)
      }
    })
  })

  describe('Integration Scenarios', () => {
    const analyzer = createTaskAnalyzer()
    const builder = createTaskGraphBuilder()
    const calculator = createTaskSimilarityCalculator()

    test('should handle complete project decomposition', () => {
      const project = TEST_PROMPTS.complex.systemDesign

      const analysisResult = analyzer.analyzeTask(project)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const decomposed = analysisResult.right
        const graph = builder.buildGraph(decomposed)

        // Complex project should have multiple levels
        expect(decomposed.subtasks.length).toBeGreaterThan(0)
        expect(decomposed.estimatedComplexity).toBeGreaterThan(5)

        // Graph should be well-structured
        expect(graph.nodes.length).toBeGreaterThan(1)
        expect(graph.criticalPath.length).toBeGreaterThan(0)
        expect(graph.parallelGroups.length).toBeGreaterThan(0)
      }
    })

    test('should group similar subtasks', () => {
      const task = `Create application features:
        1. User registration form
        2. User login form
        3. Product listing page
        4. Product detail page
        5. Shopping cart functionality`

      const analysisResult = analyzer.analyzeTask(task)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const subtasks = analysisResult.right.subtasks

        // Calculate similarities
        const similarities: number[] = []
        for (let i = 0; i < subtasks.length - 1; i++) {
          for (let j = i + 1; j < subtasks.length; j++) {
            const sim = calculator.calculateSimilarity(subtasks[i], subtasks[j])
            similarities.push(sim)
          }
        }

        // Should find similar tasks (user forms, product pages)
        const highSimilarities = similarities.filter((s) => s > 0.3)
        expect(highSimilarities.length).toBeGreaterThan(0)
      }
    })

    test('should optimize task execution order', () => {
      const task = `Build and deploy:
        1. Write unit tests
        2. Write integration tests
        3. Setup CI/CD pipeline
        4. Configure deployment environment
        5. Run all tests
        6. Deploy to production`

      const analysisResult = analyzer.analyzeTask(task)
      expect(analysisResult._tag).toBe('Right')

      if (analysisResult._tag === 'Right') {
        const graph = builder.buildGraph(analysisResult.right)

        // Parallel groups should identify independent tasks
        expect(graph.parallelGroups[0].length).toBeGreaterThan(1) // Tests and setup can be parallel

        // Critical path should enforce dependencies
        expect(graph.criticalPath.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Error Handling', () => {
    const analyzer = createTaskAnalyzer()

    test('should handle empty task descriptions', () => {
      const result = analyzer.analyzeTask('')

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.title).toBeDefined()
        expect(decomposed.subtasks.length).toBeGreaterThanOrEqual(0)
      }
    })

    test('should handle very long task descriptions', () => {
      const longTask = TEST_PROMPTS.edgeCases.veryLong
      const result = analyzer.analyzeTask(longTask)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.title.length).toBeLessThanOrEqual(103) // 100 + "..."
      }
    })

    test('should handle special characters', () => {
      const specialTask = TEST_PROMPTS.edgeCases.specialChars
      const result = analyzer.analyzeTask(specialTask)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        const decomposed = result.right
        expect(decomposed.id).toBeDefined()
        expect(decomposed.title).toBeDefined()
      }
    })
  })

  describe('Performance', () => {
    const analyzer = createTaskAnalyzer()
    const builder = createTaskGraphBuilder()

    test('should analyze tasks quickly', () => {
      const startTime = performance.now()
      const result = analyzer.analyzeTask(TEST_PROMPTS.complex.apiDesign)
      const duration = performance.now() - startTime

      expect(result._tag).toBe('Right')
      expect(duration).toBeLessThan(100) // Should be very fast
    })

    test('should build graphs efficiently', () => {
      const task = TEST_PROMPTS.complex.systemDesign
      const analysisResult = analyzer.analyzeTask(task)

      expect(analysisResult._tag).toBe('Right')
      if (analysisResult._tag === 'Right') {
        const startTime = performance.now()
        const graph = builder.buildGraph(analysisResult.right)
        const duration = performance.now() - startTime

        expect(graph.nodes.length).toBeGreaterThan(0)
        expect(duration).toBeLessThan(50) // Graph building should be fast
      }
    })

    test('should handle large task hierarchies', () => {
      // Create a large task with many subtasks
      const subtasks = Array.from({ length: 50 }, (_, i) => `${i + 1}. Subtask ${i + 1}`)
      const largeTask = `Large project:\n${subtasks.join('\n')}`

      const startTime = performance.now()
      const result = analyzer.analyzeTask(largeTask)
      const duration = performance.now() - startTime

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right.subtasks.length).toBeLessThanOrEqual(10) // Respects maxSequenceSteps
      }
      expect(duration).toBeLessThan(200) // Should still be reasonably fast
    })
  })
})
