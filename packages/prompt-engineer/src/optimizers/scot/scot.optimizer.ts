import { pipe, E, TE, A, O } from '../../fp'
import {
  type ProblemDescription,
  type StructuralAnalysis,
  type SequenceStep,
  type BranchCondition,
  type LoopStructure,
  type DataFlowPattern,
  type OptimizedPrompt,
  type Optimizer,
  type ComplexityScore,
  type OptimizationStrategy,
  type PromptAnalysis
} from '../../types'

// ============================================================================
// SCoT Optimizer Configuration
// ============================================================================

export interface SCoTConfig {
  depth: 'minimal' | 'standard' | 'detailed'
  includeExamples: boolean
  includePerformanceAnalysis: boolean
  maxSequenceSteps: number
  maxBranches: number
  maxLoops: number
  enableParallelAnalysis: boolean
}

const defaultConfig: SCoTConfig = {
  depth: 'standard',
  includeExamples: true,
  includePerformanceAnalysis: true,
  maxSequenceSteps: 10,
  maxBranches: 5,
  maxLoops: 3,
  enableParallelAnalysis: false
}

// ============================================================================
// Main SCoT Optimizer Factory
// ============================================================================

export const createSCoTOptimizer = (config?: Partial<SCoTConfig>): Optimizer => {
  const finalConfig = { ...defaultConfig, ...config }

  // Core analysis pipeline (avoids heavy typing on pipe)
  const analyzeAndOptimize = (problem: ProblemDescription): E.Either<Error, OptimizedPrompt> => {
    const structure = extractStructuralElements(problem)
    if (E.isLeft(structure)) return structure
    return buildOptimizedPrompt(structure.right, problem)
  }

  // Extract structural elements from problem description
  const extractStructuralElements = (problem: ProblemDescription): E.Either<Error, StructuralAnalysis> => {
    try {
      const sequences = extractSequences(problem)
      const branches = extractBranches(problem)
      const loops = extractLoops(problem)
      const dataFlow = extractDataFlow(problem)
      const complexity = calculateComplexity(sequences, branches, loops, dataFlow)

      return E.right({
        sequences,
        branches,
        loops,
        dataFlow,
        complexity
      })
    } catch (error: any) {
      return E.left(new Error(`Failed to extract structural elements: ${String(error)}`))
    }
  }

  // Extract sequential steps
  const extractSequences = (problem: ProblemDescription): SequenceStep[] => {
    const keywords = ['first', 'then', 'next', 'after', 'finally', 'step', 'begin', 'start', 'continue', 'proceed']
    const sentences = problem.description.split(/[.!?]+/).filter((s) => s.trim().length > 0)

    const steps: SequenceStep[] = []
    let order = 1

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase()
      const hasKeyword = keywords.some((kw) => lowerSentence.includes(kw))
      const hasNumbering = sentence.match(/^\s*\d+[\.\)]\s*/) || sentence.match(/^\s*[a-z][\.\)]\s*/i)

      if (hasKeyword || hasNumbering) {
        steps.push({
          order: order++,
          description: sentence
            .trim()
            .replace(/^\s*\d+[\.\)]\s*/, '')
            .replace(/^\s*[a-z][\.\)]\s*/i, ''),
          dependencies: extractDependencies(sentence),
          output: extractOutput(sentence),
          estimatedTokens: Math.ceil(sentence.length / 4)
        })
      }
    })

    // If no explicit sequences found, create logical flow
    if (steps.length === 0 && problem.description.length > 0) {
      steps.push(
        {
          order: 1,
          description: 'Parse and validate input',
          dependencies: [],
          output: 'validated_input',
          estimatedTokens: 20
        },
        {
          order: 2,
          description: 'Execute core algorithm',
          dependencies: ['validated_input'],
          output: 'result',
          estimatedTokens: 30
        },
        {
          order: 3,
          description: 'Format and return output',
          dependencies: ['result'],
          output: 'formatted_output',
          estimatedTokens: 20
        }
      )
    }

    return steps.slice(0, finalConfig.maxSequenceSteps)
  }

  // Extract branching conditions
  const extractBranches = (problem: ProblemDescription): BranchCondition[] => {
    const branchKeywords = ['if', 'when', 'unless', 'otherwise', 'else', 'case', 'switch', 'whether', 'depending']
    const branches: BranchCondition[] = []

    const description = problem.description.toLowerCase()

    // Look for explicit conditions
    branchKeywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\s+([^,\\.]+)`, 'gi')
      const matches = Array.from(description.matchAll(regex))

      for (const match of matches) {
        const condition = match[1].trim()
        if (condition.length > 3) {
          // Avoid tiny matches
          branches.push({
            condition,
            trueBranch: `Handle ${condition} case`,
            falseBranch: 'Continue with default flow',
            edgeCases: extractEdgeCases(problem),
            probability: 0.5 // Default probability
          })
        }
      }
    })

    // Add standard edge cases if none found
    if (branches.length === 0 && problem.description.length > 0) {
      branches.push({
        condition: 'input is valid',
        trueBranch: 'Process input normally',
        falseBranch: 'Return error or handle invalid input',
        edgeCases: ['empty input', 'null values', 'type mismatch', 'boundary values'],
        probability: 0.9
      })
    }

    // Deduplicate similar conditions
    const uniqueBranches = branches.reduce((acc, branch) => {
      const exists = acc.some((b) => b.condition.includes(branch.condition.substring(0, 10)))
      if (!exists) acc.push(branch)
      return acc
    }, [] as BranchCondition[])

    return uniqueBranches.slice(0, finalConfig.maxBranches)
  }

  // Extract loop structures
  const extractLoops = (problem: ProblemDescription): LoopStructure[] => {
    const loops: LoopStructure[] = []
    const loopKeywords = [
      'iterate',
      'loop',
      'repeat',
      'while',
      'for each',
      'traverse',
      'recursive',
      'map',
      'reduce',
      'filter',
      'every',
      'some'
    ]

    const description = problem.description.toLowerCase()

    loopKeywords.forEach((keyword) => {
      if (description.includes(keyword)) {
        const loopType = determineLoopType(keyword, description)
        loops.push({
          type: loopType,
          iterationTarget: extractIterationTarget(description, keyword),
          terminationCondition: extractTerminationCondition(description, loopType),
          invariants: extractInvariants(problem),
          estimatedIterations: estimateIterations(description, keyword)
        })
      }
    })

    // Add default if processing collections
    if (loops.length === 0 && description.match(/array|list|collection|sequence|items|elements/)) {
      loops.push({
        type: 'for',
        iterationTarget: 'each element in the collection',
        terminationCondition: 'all elements processed',
        invariants: ['maintain data integrity', 'preserve order if required'],
        estimatedIterations: 10 // Default estimate
      })
    }

    return loops.slice(0, finalConfig.maxLoops)
  }

  // Extract data flow patterns
  const extractDataFlow = (problem: ProblemDescription): DataFlowPattern[] => {
    const patterns: DataFlowPattern[] = []

    // Analyze examples for data flow
    if (problem.examples && problem.examples.length > 0) {
      problem.examples.forEach((example) => {
        patterns.push({
          input: example.input,
          transformations: inferTransformations(example.input, example.output),
          output: example.output,
          sideEffects: []
        })
      })
    } else {
      // Create generic data flow
      patterns.push({
        input: 'raw input data',
        transformations: ['validation', 'normalization', 'core processing', 'formatting'],
        output: 'processed result',
        sideEffects: []
      })
    }

    return patterns
  }

  // Calculate complexity score
  const calculateComplexity = (
    sequences: SequenceStep[],
    branches: BranchCondition[],
    loops: LoopStructure[],
    dataFlow: DataFlowPattern[]
  ): ComplexityScore => {
    const cognitive = Math.min(10, sequences.length * 0.5 + branches.length * 1.5 + loops.length * 2)
    const computational = Math.min(10, sequences.length * 0.3 + branches.length * 1 + loops.length * 2.5)
    const structural = Math.min(10, (sequences.length + branches.length + loops.length + dataFlow.length) / 2)
    const overall = (cognitive * 0.3 + computational * 0.4 + structural * 0.3) / 1

    return {
      cognitive: Number(cognitive.toFixed(2)),
      computational: Number(computational.toFixed(2)),
      structural: Number(structural.toFixed(2)),
      overall: Number(overall.toFixed(2))
    }
  }

  // Build the optimized prompt
  const buildOptimizedPrompt = (
    analysis: StructuralAnalysis,
    problem: ProblemDescription
  ): E.Either<Error, OptimizedPrompt> => {
    const systemPrompt = buildSystemPrompt(problem.language)
    const userPrompt = buildStructuredUserPrompt(problem, analysis)
    const estimatedTokens = estimateTokenCount(systemPrompt + userPrompt)
    const improvementScore = calculateImprovementScore(analysis)

    const strategy: OptimizationStrategy = {
      name: 'Structured Chain-of-Thought (SCoT)',
      techniques: ['sequence analysis', 'branch detection', 'loop identification', 'data flow mapping'],
      parameters: {
        depth: finalConfig.depth,
        includeExamples: finalConfig.includeExamples,
        includePerformanceAnalysis: finalConfig.includePerformanceAnalysis
      },
      confidence: improvementScore / 35 // Normalize to 0-1
    }

    return E.right({
      originalPrompt: problem.description,
      optimizedPrompt: userPrompt,
      systemPrompt,
      userPrompt,
      reasoningStructure: analysis,
      optimizationStrategy: strategy,
      estimatedTokens,
      improvementScore,
      metadata: {
        optimizerId: 'scot-optimizer',
        timestamp: Date.now(),
        duration: 0, // Will be calculated in async version
        cacheable: true,
        ttl: 3600000 // 1 hour
      }
    })
  }

  // Build system prompt with language-specific optimizations
  const buildSystemPrompt = (language?: string): string => {
    const basePrompt = `You are an expert ${language || 'software'} developer who thinks in structured patterns.`

    const languageSpecific: Record<string, string> = {
      python: 'Follow PEP 8, use type hints, leverage Python idioms like comprehensions and context managers.',
      typescript: 'Use strict TypeScript, prefer const assertions, discriminated unions, and functional patterns.',
      javascript: 'Follow modern ES6+ patterns, use const/let appropriately, handle async operations properly.',
      rust: 'Ensure memory safety, use idiomatic Rust patterns, handle Result/Option types correctly.',
      go: 'Follow Go conventions, handle errors explicitly, use goroutines and channels appropriately.',
      java: 'Follow Java best practices, use appropriate design patterns, handle exceptions properly.',
      cpp: 'Follow RAII principles, use modern C++ features, ensure memory safety.',
      csharp: 'Follow .NET conventions, use LINQ appropriately, handle async/await patterns.'
    }

    const specific = language ? languageSpecific[language.toLowerCase()] || '' : ''
    return `${basePrompt}\n${specific}`.trim()
  }

  // Build structured user prompt using SCoT methodology
  const buildStructuredUserPrompt = (problem: ProblemDescription, analysis: StructuralAnalysis): string => {
    const depth = finalConfig.depth

    let prompt = `Solve this problem using structured thinking:\n\n`
    prompt += `PROBLEM: ${problem.description}\n\n`

    // Add constraints if present
    if (problem.constraints && problem.constraints.length > 0) {
      prompt += `CONSTRAINTS:\n`
      problem.constraints.forEach((c) => (prompt += `- ${c}\n`))
      prompt += '\n'
    }

    // SEQUENCE section
    if (analysis.sequences.length > 0) {
      prompt += `STEP 1 - SEQUENCE ANALYSIS:\n`
      prompt += `Break down the solution into these sequential steps:\n`
      analysis.sequences.forEach((seq) => {
        prompt += `${seq.order}. ${seq.description}\n`
        if (depth !== 'minimal' && seq.dependencies.length > 0) {
          prompt += `   Dependencies: ${seq.dependencies.join(', ')}\n`
        }
        if (depth === 'detailed') {
          prompt += `   Output: ${seq.output}\n`
        }
      })
      prompt += '\n'
    }

    // BRANCH section
    if (analysis.branches.length > 0) {
      prompt += `STEP 2 - BRANCH CONDITIONS:\n`
      prompt += `Handle these conditional cases:\n`
      analysis.branches.forEach((branch) => {
        prompt += `- IF ${branch.condition}:\n`
        prompt += `  THEN: ${branch.trueBranch}\n`
        if (depth !== 'minimal') {
          prompt += `  ELSE: ${branch.falseBranch}\n`
        }
        if (depth === 'detailed' && branch.edgeCases.length > 0) {
          prompt += `  EDGE CASES: ${branch.edgeCases.join(', ')}\n`
        }
      })
      prompt += '\n'
    }

    // LOOP section
    if (analysis.loops.length > 0) {
      prompt += `STEP 3 - ITERATION STRUCTURES:\n`
      analysis.loops.forEach((loop) => {
        prompt += `- ${loop.type.toUpperCase()} loop:\n`
        prompt += `  Iterate over: ${loop.iterationTarget}\n`
        prompt += `  Termination: ${loop.terminationCondition}\n`
        if (depth === 'detailed' && loop.invariants.length > 0) {
          prompt += `  Invariants: ${loop.invariants.join(', ')}\n`
        }
      })
      prompt += '\n'
    }

    // Data flow section for detailed depth
    if (depth === 'detailed' && analysis.dataFlow.length > 0) {
      prompt += `STEP 4 - DATA FLOW:\n`
      analysis.dataFlow.forEach((flow) => {
        prompt += `Input: ${flow.input}\n`
        prompt += `Transformations: ${flow.transformations.join(' → ')}\n`
        prompt += `Output: ${flow.output}\n`
      })
      prompt += '\n'
    }

    // Add examples if configured
    if (finalConfig.includeExamples && problem.examples) {
      prompt += `EXAMPLES:\n`
      problem.examples.forEach((ex, i) => {
        prompt += `Example ${i + 1}:\n`
        prompt += `  Input: ${ex.input}\n`
        prompt += `  Expected Output: ${ex.output}\n`
      })
      prompt += '\n'
    }

    // Performance requirements
    if (finalConfig.includePerformanceAnalysis && problem.performance) {
      prompt += `PERFORMANCE REQUIREMENTS: ${problem.performance}\n\n`
    }

    // Final instruction
    prompt += `Now implement the complete solution incorporating all the structural elements above.\n`
    prompt += `Ensure the code handles all edge cases, follows the sequence properly, and includes appropriate error handling.\n`

    return prompt
  }

  // Helper functions
  const extractDependencies = (sentence: string): string[] => {
    const deps: string[] = []
    const lowerSentence = sentence.toLowerCase()
    if (lowerSentence.includes('after')) deps.push('previous_step')
    if (lowerSentence.includes('using')) deps.push('input_data')
    if (lowerSentence.includes('from')) deps.push('source_data')
    if (lowerSentence.includes('based on')) deps.push('context_data')
    return deps
  }

  const extractOutput = (sentence: string): string => {
    const lowerSentence = sentence.toLowerCase()
    if (lowerSentence.includes('return')) return 'return_value'
    if (lowerSentence.includes('output')) return 'output_data'
    if (lowerSentence.includes('result')) return 'computed_result'
    if (lowerSentence.includes('produce')) return 'produced_value'
    if (lowerSentence.includes('generate')) return 'generated_data'
    return 'intermediate_value'
  }

  const extractEdgeCases = (problem: ProblemDescription): string[] => {
    const standardEdgeCases = ['empty input', 'null values', 'boundary conditions']
    const description = problem.description.toLowerCase()

    if (description.includes('array') || description.includes('list')) {
      standardEdgeCases.push('empty array', 'single element', 'duplicates')
    }
    if (description.includes('number') || description.includes('integer')) {
      standardEdgeCases.push('zero', 'negative numbers', 'overflow', 'floating point precision')
    }
    if (description.includes('string')) {
      standardEdgeCases.push('empty string', 'special characters', 'unicode', 'very long strings')
    }
    if (description.includes('file') || description.includes('path')) {
      standardEdgeCases.push('missing file', 'invalid path', 'permission denied', 'large files')
    }
    if (description.includes('network') || description.includes('api')) {
      standardEdgeCases.push('timeout', 'connection error', 'rate limiting', 'invalid response')
    }

    return [...new Set(standardEdgeCases)] // Remove duplicates
  }

  const determineLoopType = (
    keyword: string,
    description: string
  ): 'for' | 'while' | 'recursive' | 'map' | 'reduce' => {
    if (keyword === 'recursive' || description.includes('recursiv')) return 'recursive'
    if (keyword === 'while' || description.includes('until')) return 'while'
    if (keyword === 'map') return 'map'
    if (keyword === 'reduce' || keyword === 'fold') return 'reduce'
    return 'for'
  }

  const extractIterationTarget = (description: string, keyword: string): string => {
    const afterKeyword = description.substring(description.indexOf(keyword) + keyword.length)
    const words = afterKeyword.split(/\s+/).slice(0, 5)
    const target = words.join(' ').replace(/[.,;:]/, '')
    return target || 'collection items'
  }

  const extractTerminationCondition = (
    description: string,
    loopType: 'for' | 'while' | 'recursive' | 'map' | 'reduce'
  ): string => {
    if (loopType === 'for' || loopType === 'map') return 'all elements processed'
    if (loopType === 'recursive') return 'base case reached'
    if (loopType === 'reduce') return 'single value produced'

    const untilMatch = description.match(/until\s+([^,\.]+)/)
    if (untilMatch) return untilMatch[1]

    const whileMatch = description.match(/while\s+([^,\.]+)/)
    if (whileMatch) return `not (${whileMatch[1]})`

    return 'condition is met'
  }

  const extractInvariants = (problem: ProblemDescription): string[] => {
    const invariants: string[] = []
    const desc = problem.description.toLowerCase()

    if (desc.includes('sort')) invariants.push('maintain sorted order')
    if (desc.includes('unique')) invariants.push('no duplicates')
    if (desc.includes('valid')) invariants.push('maintain validity')
    if (desc.includes('consistent')) invariants.push('maintain consistency')
    if (desc.includes('balance')) invariants.push('maintain balance')

    if (invariants.length === 0) {
      invariants.push('maintain data integrity')
    }

    return invariants
  }

  const inferTransformations = (input: string, output: string): string[] => {
    const transformations: string[] = []

    // Simple heuristics for transformation detection
    if (input.includes('[') && output.includes('[')) {
      transformations.push('array manipulation')
    }
    if (input.length > output.length) {
      transformations.push('reduction/filtering')
    }
    if (input.length < output.length) {
      transformations.push('expansion/generation')
    }
    if (input.match(/\d+/) && output.match(/\d+/)) {
      transformations.push('numerical computation')
    }
    if (input !== output) {
      transformations.push('transformation')
    }

    return transformations.length > 0 ? transformations : ['processing']
  }

  const estimateIterations = (description: string, keyword: string): number => {
    const numberMatch = description.match(/(\d+)\s*(times|iterations|elements|items)/)
    if (numberMatch) {
      return parseInt(numberMatch[1], 10)
    }

    // Default estimates based on context
    if (description.includes('all')) return 100
    if (description.includes('each')) return 50
    if (description.includes('some')) return 10
    if (description.includes('few')) return 5

    return 10 // Default
  }

  const estimateTokenCount = (text: string): number => {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }

  const calculateImprovementScore = (analysis: StructuralAnalysis): number => {
    // Base improvement from SCoT methodology: 13.79%
    let score = 13.79

    // Additional improvements based on structural complexity
    score += Math.min(analysis.sequences.length * 1.5, 7.5)
    score += Math.min(analysis.branches.length * 2.0, 10)
    score += Math.min(analysis.loops.length * 2.5, 7.5)
    score += Math.min(analysis.dataFlow.length * 1.0, 5)

    // Cap at reasonable maximum
    return Math.min(Number(score.toFixed(2)), 35.0)
  }

  // Public API implementation
  const optimizer: Optimizer = {
    name: 'Structured Chain-of-Thought (SCoT) Optimizer',

    optimize: (prompt: string, context?: any): E.Either<Error, OptimizedPrompt> => {
      const problem: ProblemDescription = {
        description: prompt,
        language: context?.language,
        constraints: context?.constraints,
        examples: context?.examples,
        performance: context?.performance,
        context: context?.context
      }

      return analyzeAndOptimize(problem)
    },

    optimizeAsync: (prompt: string, context?: any): TE.TaskEither<Error, OptimizedPrompt> => {
      return TE.tryCatch(
        async () => {
          const startTime = Date.now()
          const result = optimizer.optimize(prompt, context)

          if (E.isLeft(result)) {
            throw result.left
          }

          // Update duration in metadata
          const optimized = result.right
          optimized.metadata.duration = Date.now() - startTime

          return optimized
        },
        (error) => new Error(`Async optimization failed: ${error}`)
      )
    },

    analyze: (prompt: string): E.Either<Error, PromptAnalysis> => {
      const problem: ProblemDescription = { description: prompt }
      const structureResult = extractStructuralElements(problem)

      if (E.isLeft(structureResult)) {
        return structureResult
      }

      const structure = structureResult.right
      const tokenCount = estimateTokenCount(prompt)

      const analysis: PromptAnalysis = {
        structure,
        complexity: structure.complexity,
        tokenCount,
        estimatedCost: tokenCount * 0.0001, // Rough estimate
        recommendedOptimizations: [
          'Add sequential structure',
          'Identify decision branches',
          'Clarify iteration requirements'
        ],
        potentialIssues: [],
        improvementPotential: calculateImprovementScore(structure)
      }

      return E.right(analysis)
    },

    supports: (feature: string): boolean => {
      const supportedFeatures = [
        'sequence-analysis',
        'branch-detection',
        'loop-identification',
        'data-flow-mapping',
        'complexity-scoring',
        'language-specific',
        'examples',
        'performance-analysis'
      ]
      return supportedFeatures.includes(feature.toLowerCase())
    }
  }

  return optimizer
}

// Export default instance
export const scotOptimizer = createSCoTOptimizer()
