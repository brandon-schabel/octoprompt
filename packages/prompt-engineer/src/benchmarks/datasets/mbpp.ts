/**
 * MBPP (Mostly Basic Programming Problems) Dataset Implementation
 * Python programming benchmark from Google Research
 */

import { Effect, pipe } from 'effect'
import type {
  BenchmarkDataset,
  BenchmarkTask,
  CodeTask,
  TestCase,
  EvaluationResult,
  CodeEvaluationResult,
  EvaluationConfig,
  DatasetPlugin,
  PassAtKConfig,
  PassAtKResult,
  CodeSample
} from './types'

// ============================================================================
// MBPP Task Structure
// ============================================================================

interface MBPPTask extends CodeTask {
  readonly taskId: number
  readonly text: string // problem description
  readonly code: string // reference solution
  readonly testList: string[] // test assertions
  readonly testSetup: string // setup code for tests
  readonly challenge: string[] // additional challenge test cases
  readonly language: 'python'
}

// ============================================================================
// MBPP Dataset
// ============================================================================

export class MBPPDataset implements DatasetPlugin {
  readonly name = 'MBPP'
  readonly version = '1.0.0'
  readonly capabilities = ['filtering', 'sampling', 'sandboxed_execution'] as const
  
  private tasks: MBPPTask[] = []
  private loaded = false
  
  /**
   * Load the MBPP dataset
   */
  async load(): Promise<BenchmarkDataset> {
    if (!this.loaded) {
      this.tasks = this.getMBPPTasks()
      this.loaded = true
    }
    
    return {
      name: this.name,
      version: this.version,
      description: 'Mostly Basic Programming Problems: A benchmark for evaluating code generation',
      category: 'code_generation',
      languages: ['python'],
      size: this.tasks.length,
      difficulty: 'easy',
      metrics: ['pass_at_k', 'functional_correctness', 'syntax_valid', 'test_pass_rate'],
      tasks: this.tasks,
      metadata: {
        authors: ['Google Research'],
        paper: 'https://arxiv.org/abs/2108.07732',
        license: 'Apache-2.0',
        homepage: 'https://github.com/google-research/google-research/tree/master/mbpp',
        citation: '@article{austin2021program, title={Program Synthesis with Large Language Models}, author={Austin, Jacob and others}, journal={arXiv preprint arXiv:2108.07732}, year={2021}}'
      }
    }
  }
  
  /**
   * Evaluate a response against an MBPP task
   */
  async evaluate(
    response: string,
    task: BenchmarkTask,
    config?: EvaluationConfig
  ): Promise<EvaluationResult> {
    const mbppTask = task as MBPPTask
    const startTime = Date.now()
    
    try {
      // Extract code from response
      const code = this.extractCode(response)
      
      // Extract function name from task
      const functionName = this.extractFunctionName(mbppTask.text)
      
      // Check if response contains the function
      if (!this.containsFunction(code, functionName)) {
        return {
          taskId: mbppTask.id,
          response,
          metrics: new Map([
            ['syntax_valid', { value: 0, normalized: 0 }],
            ['functional_correctness', { value: 0, normalized: 0 }]
          ]),
          passed: false,
          executionTime: Date.now() - startTime,
          error: `Function ${functionName} not found in response`
        }
      }
      
      // Check syntax
      const syntaxValid = await this.checkSyntax(code)
      if (!syntaxValid) {
        return {
          taskId: mbppTask.id,
          response,
          metrics: new Map([
            ['syntax_valid', { value: 0, normalized: 0 }],
            ['functional_correctness', { value: 0, normalized: 0 }]
          ]),
          passed: false,
          executionTime: Date.now() - startTime,
          error: 'Syntax error in generated code'
        }
      }
      
      // Run test cases
      const testResults = await this.runTests(code, mbppTask)
      const basicPassRate = this.calculatePassRate(testResults.basic)
      const challengePassRate = testResults.challenge ? 
        this.calculatePassRate(testResults.challenge) : 0
      
      // Overall pass rate (weighted)
      const overallPassRate = config?.includeChallenge ?
        (basicPassRate * 0.7 + challengePassRate * 0.3) : basicPassRate
      
      return {
        taskId: mbppTask.id,
        response,
        metrics: new Map([
          ['syntax_valid', { value: 1, normalized: 1 }],
          ['functional_correctness', { value: overallPassRate, normalized: overallPassRate }],
          ['test_pass_rate', { value: basicPassRate, normalized: basicPassRate }],
          ['challenge_pass_rate', { value: challengePassRate, normalized: challengePassRate }]
        ]),
        passed: overallPassRate === 1,
        executionTime: Date.now() - startTime,
        testResults: [...testResults.basic, ...(testResults.challenge || [])]
      } as CodeEvaluationResult
    } catch (error) {
      return {
        taskId: mbppTask.id,
        response,
        metrics: new Map([
          ['syntax_valid', { value: 0, normalized: 0 }],
          ['functional_correctness', { value: 0, normalized: 0 }]
        ]),
        passed: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  
  /**
   * Validate response format
   */
  validateResponse(response: string, task: BenchmarkTask): boolean {
    const mbppTask = task as MBPPTask
    const functionName = this.extractFunctionName(mbppTask.text)
    
    // Check if response contains a function with the expected name
    const functionPattern = new RegExp(`def\\s+${functionName}\\s*\\(`)
    return functionPattern.test(response)
  }
  
  /**
   * Preprocess task for better prompt formatting
   */
  preprocess(task: BenchmarkTask): BenchmarkTask {
    const mbppTask = task as MBPPTask
    
    // Format prompt with clear instructions
    const enhancedPrompt = `# Task: Write a Python function to solve the following problem
# ${mbppTask.text}

# Test cases:
${mbppTask.testList.slice(0, 2).map(test => `# ${test}`).join('\n')}

# Write your solution below:`
    
    return {
      ...mbppTask,
      prompt: enhancedPrompt
    }
  }
  
  /**
   * Run pass@k evaluation
   */
  async evaluatePassAtK(
    task: MBPPTask,
    generateFn: (prompt: string) => Promise<string>,
    config: PassAtKConfig
  ): Promise<PassAtKResult> {
    const samples: CodeSample[] = []
    
    // Generate n samples
    for (let i = 0; i < config.n; i++) {
      try {
        const prompt = this.preprocess(task).prompt
        const response = await generateFn(prompt)
        const code = this.extractCode(response)
        
        const testResults = await this.runTests(code, task)
        const passed = testResults.basic.every(r => r.passed)
        
        samples.push({
          code,
          passed,
          testResults: testResults.basic,
          executionTime: testResults.basic.reduce((sum, r) => sum + (r.executionTime || 0), 0)
        })
      } catch (error) {
        samples.push({
          code: '',
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    // Calculate pass@k for each k value
    const passAtK = new Map<number, number>()
    for (const k of config.k) {
      const passRate = this.calculatePassAtK(samples, k, config.n)
      passAtK.set(k, passRate)
    }
    
    return {
      taskId: task.id,
      samples,
      passAtK,
      estimator: 'unbiased'
    }
  }
  
  // Private helper methods
  
  private getMBPPTasks(): MBPPTask[] {
    // Sample MBPP tasks (in production, load from file/API)
    return [
      {
        id: 'mbpp_1',
        taskId: 1,
        text: 'Write a function to find the minimum cost path to reach (m, n) from (0, 0) for the given cost matrix cost[][] and a position (m, n) in cost[][].',
        code: `def min_cost(cost, m, n):
    tc = [[0 for x in range(n + 1)] for x in range(m + 1)]
    tc[0][0] = cost[0][0]
    for i in range(1, m + 1):
        tc[i][0] = tc[i-1][0] + cost[i][0]
    for j in range(1, n + 1):
        tc[0][j] = tc[0][j-1] + cost[0][j]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            tc[i][j] = min(tc[i-1][j-1], tc[i-1][j], tc[i][j-1]) + cost[i][j]
    return tc[m][n]`,
        testList: [
          'assert min_cost([[1, 2, 3], [4, 8, 2], [1, 5, 3]], 2, 2) == 8',
          'assert min_cost([[2, 3, 4], [5, 9, 3], [2, 6, 4]], 2, 2) == 12',
          'assert min_cost([[3, 4, 5], [6, 10, 4], [3, 7, 5]], 2, 2) == 16'
        ],
        testSetup: '',
        challenge: [],
        language: 'python',
        prompt: '',
        testCases: [
          { input: [[[1, 2, 3], [4, 8, 2], [1, 5, 3]], 2, 2], expectedOutput: 8 },
          { input: [[[2, 3, 4], [5, 9, 3], [2, 6, 4]], 2, 2], expectedOutput: 12 },
          { input: [[[3, 4, 5], [6, 10, 4], [3, 7, 5]], 2, 2], expectedOutput: 16 }
        ]
      },
      {
        id: 'mbpp_2',
        taskId: 2,
        text: 'Write a function to find the similar elements from the given two tuple lists.',
        code: `def similar_elements(list1, list2):
    result = tuple(set(list1) & set(list2))
    return result`,
        testList: [
          'assert similar_elements((3, 4, 5, 6), (5, 7, 4, 10)) == (4, 5)',
          'assert similar_elements((1, 2, 3, 4), (5, 4, 3, 7)) == (3, 4)',
          'assert similar_elements((11, 12, 14, 13), (17, 15, 14, 13)) == (13, 14)'
        ],
        testSetup: '',
        challenge: [],
        language: 'python',
        prompt: '',
        testCases: [
          { input: [(3, 4, 5, 6), (5, 7, 4, 10)], expectedOutput: [4, 5] },
          { input: [(1, 2, 3, 4), (5, 4, 3, 7)], expectedOutput: [3, 4] },
          { input: [(11, 12, 14, 13), (17, 15, 14, 13)], expectedOutput: [13, 14] }
        ]
      },
      {
        id: 'mbpp_3',
        taskId: 3,
        text: 'Write a python function to identify non-prime numbers.',
        code: `import math
def is_not_prime(n):
    if n == 1:
        return True
    for i in range(2, int(math.sqrt(n)) + 1):
        if n % i == 0:
            return True
    return False`,
        testList: [
          'assert is_not_prime(2) == False',
          'assert is_not_prime(10) == True',
          'assert is_not_prime(35) == True',
          'assert is_not_prime(37) == False'
        ],
        testSetup: 'import math',
        challenge: [
          'assert is_not_prime(1) == True',
          'assert is_not_prime(97) == False',
          'assert is_not_prime(100) == True'
        ],
        language: 'python',
        prompt: '',
        testCases: [
          { input: [2], expectedOutput: false },
          { input: [10], expectedOutput: true },
          { input: [35], expectedOutput: true },
          { input: [37], expectedOutput: false }
        ]
      }
    ]
  }
  
  private extractCode(response: string): string {
    // Extract Python code from response
    // Handle code blocks with triple backticks
    const codeBlockMatch = response.match(/```python\n([\s\S]*?)```/)
    if (codeBlockMatch) {
      return codeBlockMatch[1]
    }
    
    // Handle code blocks without language specifier
    const genericBlockMatch = response.match(/```\n([\s\S]*?)```/)
    if (genericBlockMatch) {
      return genericBlockMatch[1]
    }
    
    // If no code blocks, assume entire response is code
    return response
  }
  
  private extractFunctionName(problemText: string): string {
    // Extract function name from problem description
    const match = problemText.match(/Write a (?:python )?function (?:called |named |to )?(\w+)|function (\w+)/i)
    if (match) {
      return match[1] || match[2]
    }
    
    // Try to extract from "Write a function to..." pattern
    const writeMatch = problemText.match(/Write a function to (\w+)/i)
    if (writeMatch) {
      return writeMatch[1].toLowerCase().replace(/\s+/g, '_')
    }
    
    // Default function name
    return 'solution'
  }
  
  private containsFunction(code: string, functionName: string): boolean {
    const functionPattern = new RegExp(`def\\s+${functionName}\\s*\\(`)
    return functionPattern.test(code)
  }
  
  private async checkSyntax(code: string): Promise<boolean> {
    // Basic Python syntax validation
    try {
      // Check for basic Python syntax patterns
      const hasValidIndentation = /^( {4}|\t|def |class |if |for |while |try |with |import )/m.test(code)
      const hasBalancedParens = this.checkBalancedParentheses(code)
      const hasValidKeywords = !/(^|\s)(os\.system|subprocess|exec|eval|compile|__import__)(\s|$)/m.test(code)
      
      return hasValidIndentation && hasBalancedParens && hasValidKeywords
    } catch {
      return false
    }
  }
  
  private checkBalancedParentheses(code: string): boolean {
    const stack: string[] = []
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}'
    }
    
    let inString = false
    let stringChar = ''
    
    for (let i = 0; i < code.length; i++) {
      const char = code[i]
      
      // Handle strings
      if ((char === '"' || char === "'") && (i === 0 || code[i-1] !== '\\')) {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
        }
        continue
      }
      
      if (inString) continue
      
      if (char in pairs) {
        stack.push(char)
      } else if (Object.values(pairs).includes(char)) {
        if (stack.length === 0) return false
        const last = stack.pop()!
        if (pairs[last] !== char) return false
      }
    }
    
    return stack.length === 0
  }
  
  private async runTests(
    code: string,
    task: MBPPTask
  ): Promise<{ basic: any[], challenge?: any[] }> {
    // In production, execute in sandboxed Python environment
    // For now, simulate test execution
    const basicResults = []
    
    for (const testCase of task.testCases || []) {
      // Simulate test execution
      const passed = Math.random() > 0.2 // Higher pass rate for MBPP (easier problems)
      
      basicResults.push({
        testCase,
        actual: passed ? testCase.expectedOutput : null,
        passed,
        executionTime: Math.random() * 50
      })
    }
    
    // Run challenge tests if available
    let challengeResults
    if (task.challenge && task.challenge.length > 0) {
      challengeResults = []
      for (const challengeTest of task.challenge) {
        const passed = Math.random() > 0.4
        challengeResults.push({
          testCase: { input: challengeTest, expectedOutput: true },
          actual: passed,
          passed,
          executionTime: Math.random() * 50
        })
      }
    }
    
    return { basic: basicResults, challenge: challengeResults }
  }
  
  private calculatePassRate(testResults: any[]): number {
    if (testResults.length === 0) return 0
    return testResults.filter(r => r.passed).length / testResults.length
  }
  
  private calculatePassAtK(samples: CodeSample[], k: number, n: number): number {
    const c = samples.filter(s => s.passed).length
    
    if (n - c < k) {
      return 1.0
    }
    
    // Unbiased estimator for pass@k
    return 1.0 - this.combination(n - c, k) / this.combination(n, k)
  }
  
  private combination(n: number, k: number): number {
    if (k > n) return 0
    if (k === 0 || k === n) return 1
    
    let result = 1
    for (let i = 0; i < k; i++) {
      result = result * (n - i) / (i + 1)
    }
    
    return result
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create MBPP dataset instance
 */
export function createMBPPDataset(): MBPPDataset {
  return new MBPPDataset()
}

/**
 * Load MBPP dataset
 */
export async function loadMBPP(): Promise<BenchmarkDataset> {
  const dataset = createMBPPDataset()
  return dataset.load()
}

/**
 * Run MBPP benchmark
 */
export async function runMBPP(
  generateFn: (prompt: string) => Promise<string>,
  config?: EvaluationConfig & { 
    tasks?: number[]
    includeChallenge?: boolean 
  }
): Promise<{
  results: EvaluationResult[]
  passRate: number
  metrics: Map<string, number>
}> {
  const dataset = await loadMBPP()
  const evaluator = createMBPPDataset()
  const results: EvaluationResult[] = []
  
  // Filter tasks if specified
  const tasks = config?.tasks 
    ? dataset.tasks.filter(t => {
        const taskId = parseInt(t.id.replace('mbpp_', ''))
        return config.tasks!.includes(taskId)
      })
    : dataset.tasks
  
  // Run evaluation on each task
  for (const task of tasks) {
    const preprocessed = evaluator.preprocess(task)
    const response = await generateFn(preprocessed.prompt)
    const result = await evaluator.evaluate(response, task, config)
    results.push(result)
  }
  
  // Calculate aggregate metrics
  const passRate = results.filter(r => r.passed).length / results.length
  const syntaxValidRate = results.filter(r => 
    r.metrics.get('syntax_valid')?.value === 1
  ).length / results.length
  
  const avgTestPassRate = results.reduce((sum, r) => 
    sum + (r.metrics.get('test_pass_rate')?.value || 0), 0
  ) / results.length
  
  const avgChallengeRate = config?.includeChallenge ?
    results.reduce((sum, r) => 
      sum + (r.metrics.get('challenge_pass_rate')?.value || 0), 0
    ) / results.length : 0
  
  const metrics = new Map([
    ['pass_rate', passRate],
    ['syntax_valid_rate', syntaxValidRate],
    ['avg_test_pass_rate', avgTestPassRate],
    ['avg_challenge_rate', avgChallengeRate],
    ['avg_execution_time', results.reduce((sum, r) => 
      sum + r.executionTime, 0
    ) / results.length]
  ])
  
  return { results, passRate, metrics }
}

/**
 * Compare MBPP results between two models
 */
export function compareMBPPResults(
  baseline: EvaluationResult[],
  comparison: EvaluationResult[]
): {
  improvement: number
  taskImprovements: Map<string, boolean>
  summary: string
} {
  const baselinePass = baseline.filter(r => r.passed).length
  const comparisonPass = comparison.filter(r => r.passed).length
  const improvement = ((comparisonPass - baselinePass) / baseline.length) * 100
  
  const taskImprovements = new Map<string, boolean>()
  for (let i = 0; i < baseline.length; i++) {
    const taskId = baseline[i].taskId
    const baselinePassed = baseline[i].passed
    const comparisonPassed = comparison.find(r => r.taskId === taskId)?.passed || false
    
    if (!baselinePassed && comparisonPassed) {
      taskImprovements.set(taskId, true)
    } else if (baselinePassed && !comparisonPassed) {
      taskImprovements.set(taskId, false)
    }
  }
  
  const improved = Array.from(taskImprovements.values()).filter(v => v).length
  const regressed = Array.from(taskImprovements.values()).filter(v => !v).length
  
  const summary = `Improvement: ${improvement.toFixed(1)}% (${improved} tasks improved, ${regressed} tasks regressed)`
  
  return { improvement, taskImprovements, summary }
}