import { describe, test, expect } from 'bun:test'
import { createSCoTOptimizer } from '../src/optimizers/scot'
import { E } from '../src/fp'

describe('SCoT Optimizer', () => {
  const optimizer = createSCoTOptimizer({
    depth: 'detailed',
    includeExamples: true,
    includePerformanceAnalysis: true
  })

  describe('Basic Functionality', () => {
    test('should optimize a simple prompt', () => {
      const prompt = 'Write a function to sort an array of numbers'
      const result = optimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.originalPrompt).toBe(prompt)
        expect(optimized.optimizedPrompt).toContain('SEQUENCE')
        expect(optimized.improvementScore).toBeGreaterThan(10)
      }
    })

    test('should extract sequences from step-based description', () => {
      const prompt = `First, validate the input. Then, process the data. 
                      Next, transform the results. Finally, return the output.`
      const result = optimizer.analyze(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const analysis = result.right
        expect(analysis.structure.sequences).toHaveLength(4)
        expect(analysis.structure.sequences[0].description).toContain('validate')
        expect(analysis.structure.sequences[3].description).toContain('return')
      }
    })

    test('should detect branch conditions', () => {
      const prompt = `If the user is authenticated, show the dashboard. 
                      Otherwise, redirect to login. When the session expires, 
                      refresh the token.`
      const result = optimizer.analyze(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const analysis = result.right
        expect(analysis.structure.branches.length).toBeGreaterThan(0)
        const authBranch = analysis.structure.branches.find(b =>
          b.condition.includes('authenticated')
        )
        expect(authBranch).toBeDefined()
      }
    })

    test('should identify loop structures', () => {
      const prompt = 'Iterate through each item in the array and apply the transformation'
      const result = optimizer.analyze(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const analysis = result.right
        expect(analysis.structure.loops.length).toBeGreaterThan(0)
        expect(analysis.structure.loops[0].type).toBeDefined()
        expect(analysis.structure.loops[0].iterationTarget).toContain('item')
      }
    })
  })

  describe('Complex Scenarios', () => {
    test('should handle algorithmic problems', () => {
      const prompt = `Implement a binary search algorithm. The function should take 
                      a sorted array and a target value. If the target is found, 
                      return its index. Otherwise, return -1.`
      const result = optimizer.optimize(prompt, {
        language: 'typescript',
        examples: [
          { input: '[1,2,3,4,5], 3', output: '2' },
          { input: '[1,2,3,4,5], 6', output: '-1' }
        ]
      })

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.systemPrompt).toContain('TypeScript')
        expect(optimized.userPrompt).toContain('EXAMPLES')
        expect(optimized.reasoningStructure.branches.length).toBeGreaterThan(0)
        expect(optimized.improvementScore).toBeGreaterThanOrEqual(13.79)
      }
    })

    test('should calculate complexity scores', () => {
      const complexPrompt = `
        First, load the data from the database. Then, for each record, 
        check if it meets the criteria. If it does, apply transformation A, 
        otherwise apply transformation B. Repeat this process until all 
        records are processed. Finally, aggregate the results and return.
      `
      const result = optimizer.analyze(complexPrompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const analysis = result.right
        expect(analysis.complexity.cognitive).toBeGreaterThan(0)
        expect(analysis.complexity.computational).toBeGreaterThan(0)
        expect(analysis.complexity.structural).toBeGreaterThan(0)
        expect(analysis.complexity.overall).toBeGreaterThan(0)
      }
    })

    test('should handle edge cases extraction', () => {
      const prompt = 'Process an array of strings and handle empty arrays properly'
      const result = optimizer.analyze(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const analysis = result.right
        // Check that we have branches with edge cases
        expect(analysis.structure.branches.length).toBeGreaterThan(0)
        const edgeCases = analysis.structure.branches[0]?.edgeCases || []
        expect(edgeCases.length).toBeGreaterThan(0)
        // The actual edge cases will vary based on the analysis
        expect(edgeCases).toContain('empty input')
      }
    })
  })

  describe('Configuration Options', () => {
    test('should respect minimal depth configuration', () => {
      const minimalOptimizer = createSCoTOptimizer({ depth: 'minimal' })
      const prompt = 'Sort an array'
      const result = minimalOptimizer.optimize(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        // Minimal depth should produce shorter output than detailed
        const detailedOptimizer = createSCoTOptimizer({ depth: 'detailed' })
        const detailedResult = detailedOptimizer.optimize(prompt)
        if (E.isRight(detailedResult)) {
          expect(optimized.userPrompt.length).toBeLessThan(detailedResult.right.userPrompt.length)
        }
      }
    })

    test('should respect maxSequenceSteps limit', () => {
      const limitedOptimizer = createSCoTOptimizer({ maxSequenceSteps: 3 })
      const prompt = 'Step 1. A Step 2. B Step 3. C Step 4. D Step 5. E'
      const result = limitedOptimizer.analyze(prompt)

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const analysis = result.right
        expect(analysis.structure.sequences).toHaveLength(3)
      }
    })

    test('should include performance analysis when configured', () => {
      const perfOptimizer = createSCoTOptimizer({
        includePerformanceAnalysis: true
      })
      const prompt = 'Optimize the algorithm for speed'
      const result = perfOptimizer.optimize(prompt, {
        performance: 'Must handle 1 million records in under 1 second'
      })

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.userPrompt).toContain('PERFORMANCE REQUIREMENTS')
      }
    })
  })

  describe('Feature Support', () => {
    test('should correctly report supported features', () => {
      expect(optimizer.supports('sequence-analysis')).toBe(true)
      expect(optimizer.supports('branch-detection')).toBe(true)
      expect(optimizer.supports('loop-identification')).toBe(true)
      expect(optimizer.supports('data-flow-mapping')).toBe(true)
      expect(optimizer.supports('unknown-feature')).toBe(false)
    })
  })

  describe('Async Operations', () => {
    test('should optimize asynchronously', async () => {
      const prompt = 'Calculate fibonacci sequence'
      const result = await optimizer.optimizeAsync(prompt)()

      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        const optimized = result.right
        expect(optimized.metadata.duration).toBeGreaterThanOrEqual(0)
        expect(optimized.metadata.optimizerId).toBe('scot-optimizer')
      }
    })
  })
})