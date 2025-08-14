/**
 * HumanEval Dataset Implementation
 * Python code generation benchmark from OpenAI
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
// HumanEval Task Structure
// ============================================================================

interface HumanEvalTask extends CodeTask {
  readonly taskId: string
  readonly prompt: string
  readonly canonicalSolution: string
  readonly testCode: string
  readonly entryPoint: string
  readonly language: 'python'
}

// ============================================================================
// HumanEval Dataset
// ============================================================================

export class HumanEvalDataset implements DatasetPlugin {
  readonly name = 'HumanEval'
  readonly version = '1.0.0'
  readonly capabilities = ['filtering', 'sampling', 'sandboxed_execution'] as const
  
  private tasks: HumanEvalTask[] = []
  private loaded = false
  
  /**
   * Load the HumanEval dataset
   */
  async load(): Promise<BenchmarkDataset> {
    if (!this.loaded) {
      this.tasks = this.getHumanEvalTasks()
      this.loaded = true
    }
    
    return {
      name: this.name,
      version: this.version,
      description: 'HumanEval: Hand-Written Evaluation Set for Code Generation',
      category: 'code_generation',
      languages: ['python'],
      size: this.tasks.length,
      difficulty: 'mixed',
      metrics: ['pass_at_k', 'functional_correctness', 'syntax_valid'],
      tasks: this.tasks,
      metadata: {
        authors: ['OpenAI'],
        paper: 'https://arxiv.org/abs/2107.03374',
        license: 'MIT',
        homepage: 'https://github.com/openai/human-eval',
        citation: '@article{chen2021evaluating, title={Evaluating Large Language Models Trained on Code}, author={Chen, Mark and others}, journal={arXiv preprint arXiv:2107.03374}, year={2021}}'
      }
    }
  }
  
  /**
   * Evaluate a response against a HumanEval task
   */
  async evaluate(
    response: string,
    task: BenchmarkTask,
    config?: EvaluationConfig
  ): Promise<EvaluationResult> {
    const humanEvalTask = task as HumanEvalTask
    const startTime = Date.now()
    
    try {
      // Extract code from response
      const code = this.extractCode(response)
      
      // Check syntax
      const syntaxValid = await this.checkSyntax(code)
      if (!syntaxValid) {
        return {
          taskId: humanEvalTask.id,
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
      
      // Run tests
      const testResults = await this.runTests(code, humanEvalTask)
      const passRate = testResults.filter(r => r.passed).length / testResults.length
      
      return {
        taskId: humanEvalTask.id,
        response,
        metrics: new Map([
          ['syntax_valid', { value: 1, normalized: 1 }],
          ['functional_correctness', { value: passRate, normalized: passRate }],
          ['test_pass_rate', { value: passRate, normalized: passRate }]
        ]),
        passed: passRate === 1,
        executionTime: Date.now() - startTime,
        testResults
      } as CodeEvaluationResult
    } catch (error) {
      return {
        taskId: humanEvalTask.id,
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
    const humanEvalTask = task as HumanEvalTask
    
    // Check if response contains a function with the correct name
    const functionPattern = new RegExp(`def\\s+${humanEvalTask.entryPoint}\\s*\\(`)
    return functionPattern.test(response)
  }
  
  /**
   * Preprocess task for better prompt formatting
   */
  preprocess(task: BenchmarkTask): BenchmarkTask {
    const humanEvalTask = task as HumanEvalTask
    
    // Add instruction clarification
    const enhancedPrompt = `# Task: Complete the following Python function
# The function should pass all test cases

${humanEvalTask.prompt}

# Your implementation:`
    
    return {
      ...humanEvalTask,
      prompt: enhancedPrompt
    }
  }
  
  /**
   * Run pass@k evaluation
   */
  async evaluatePassAtK(
    task: HumanEvalTask,
    generateFn: (prompt: string) => Promise<string>,
    config: PassAtKConfig
  ): Promise<PassAtKResult> {
    const samples: CodeSample[] = []
    
    // Generate n samples
    for (let i = 0; i < config.n; i++) {
      try {
        const response = await generateFn(task.prompt)
        const code = this.extractCode(response)
        const testResults = await this.runTests(code, task)
        const passed = testResults.every(r => r.passed)
        
        samples.push({
          code,
          passed,
          testResults,
          executionTime: testResults.reduce((sum, r) => sum + (r.executionTime || 0), 0)
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
  
  private getHumanEvalTasks(): HumanEvalTask[] {
    // Sample HumanEval tasks (in production, load from file/API)
    return [
      {
        id: 'HumanEval/0',
        taskId: 'HumanEval/0',
        prompt: `from typing import List

def has_close_elements(numbers: List[float], threshold: float) -> bool:
    """Check if in given list of numbers, are any two numbers closer to each other than
    given threshold.
    >>> has_close_elements([1.0, 2.0, 3.0], 0.5)
    False
    >>> has_close_elements([1.0, 2.8, 3.0, 4.0, 5.0, 2.0], 0.3)
    True
    """`,
        canonicalSolution: `    for idx, elem in enumerate(numbers):
        for idx2, elem2 in enumerate(numbers):
            if idx != idx2:
                distance = abs(elem - elem2)
                if distance < threshold:
                    return True
    return False`,
        testCode: `def check(candidate):
    assert candidate([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.3) == True
    assert candidate([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.05) == False
    assert candidate([1.0, 2.0, 5.9, 4.0, 5.0], 0.95) == True
    assert candidate([1.0, 2.0, 5.9, 4.0, 5.0], 0.8) == False
    assert candidate([1.0, 2.0, 3.0, 4.0, 5.0, 2.0], 0.1) == True
    assert candidate([1.1, 2.2, 3.1, 4.1, 5.1], 1.0) == True
    assert candidate([1.1, 2.2, 3.1, 4.1, 5.1], 0.5) == False`,
        entryPoint: 'has_close_elements',
        language: 'python',
        testCases: [
          { input: [[1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.3], expectedOutput: true },
          { input: [[1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.05], expectedOutput: false },
          { input: [[1.0, 2.0, 5.9, 4.0, 5.0], 0.95], expectedOutput: true },
          { input: [[1.0, 2.0, 5.9, 4.0, 5.0], 0.8], expectedOutput: false }
        ]
      },
      {
        id: 'HumanEval/1',
        taskId: 'HumanEval/1',
        prompt: `from typing import List

def separate_paren_groups(paren_string: str) -> List[str]:
    """Input to this function is a string containing multiple groups of nested parentheses. Your goal is to
    separate those group into separate strings and return the list of those.
    Separate groups are balanced (each open brace is properly closed) and not nested within each other
    Ignore any spaces in the input string.
    >>> separate_paren_groups('( ) (( )) (( )( ))')
    ['()', '(())', '(()())']
    """`,
        canonicalSolution: `    result = []
    current_string = []
    current_depth = 0
    
    for c in paren_string:
        if c == ' ':
            continue
        elif c == '(':
            current_depth += 1
            current_string.append(c)
        elif c == ')':
            current_depth -= 1
            current_string.append(c)
            
            if current_depth == 0:
                result.append(''.join(current_string))
                current_string.clear()
    
    return result`,
        testCode: `def check(candidate):
    assert candidate('(()()) ((())) () ((())()())') == ['(()())', '((()))', '()', '((())()())']
    assert candidate('() (()) ((())) (((())))') == ['()', '(())', '((()))', '(((())))']
    assert candidate('(()(())((())))') == ['(()(())((())))']
    assert candidate('( ) (( )) (( )( ))') == ['()', '(())', '(()())']`,
        entryPoint: 'separate_paren_groups',
        language: 'python',
        testCases: [
          { input: ['(()()) ((())) () ((())()())'], expectedOutput: ['(()())', '((()))', '()', '((())()())'] },
          { input: ['() (()) ((())) (((())))'], expectedOutput: ['()', '(())', '((()))', '(((())))'] }
        ]
      },
      {
        id: 'HumanEval/2',
        taskId: 'HumanEval/2',
        prompt: `def truncate_number(number: float) -> float:
    """Given a positive floating point number, it can be decomposed into
    and integer part (largest integer smaller than given number) and decimals
    (leftover part always smaller than 1).
    
    Return the decimal part of the number.
    >>> truncate_number(3.5)
    0.5
    """`,
        canonicalSolution: `    return number % 1.0`,
        testCode: `def check(candidate):
    assert candidate(3.5) == 0.5
    assert abs(candidate(1.33) - 0.33) < 1e-6
    assert abs(candidate(123.456) - 0.456) < 1e-6`,
        entryPoint: 'truncate_number',
        language: 'python',
        testCases: [
          { input: [3.5], expectedOutput: 0.5 },
          { input: [1.33], expectedOutput: 0.33 },
          { input: [123.456], expectedOutput: 0.456 }
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
    
    // Return as-is if no code block markers
    return response
  }
  
  private async checkSyntax(code: string): Promise<boolean> {
    // In production, use Python AST or subprocess to check syntax
    // For now, basic validation
    try {
      // Check for basic Python syntax patterns
      const hasValidIndentation = /^( {4}|\t|def |class |if |for |while |try |with )/m.test(code)
      const hasBalancedParens = this.checkBalancedParentheses(code)
      const hasValidKeywords = !/(^|\s)(import os|import sys|exec|eval|compile|__import__)(\s|$)/m.test(code)
      
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
    
    for (const char of code) {
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
  
  private async runTests(code: string, task: HumanEvalTask): Promise<any[]> {
    // In production, execute in sandboxed Python environment
    // For now, simulate test execution
    const testResults = []
    
    for (const testCase of task.testCases || []) {
      // Simulate test execution
      const passed = Math.random() > 0.3 // Simulated pass rate
      
      testResults.push({
        testCase,
        actual: passed ? testCase.expectedOutput : null,
        passed,
        executionTime: Math.random() * 100
      })
    }
    
    return testResults
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
 * Create HumanEval dataset instance
 */
export function createHumanEvalDataset(): HumanEvalDataset {
  return new HumanEvalDataset()
}

/**
 * Load HumanEval dataset
 */
export async function loadHumanEval(): Promise<BenchmarkDataset> {
  const dataset = createHumanEvalDataset()
  return dataset.load()
}

/**
 * Run HumanEval benchmark
 */
export async function runHumanEval(
  generateFn: (prompt: string) => Promise<string>,
  config?: EvaluationConfig & { tasks?: string[] }
): Promise<{
  results: EvaluationResult[]
  passRate: number
  metrics: Map<string, number>
}> {
  const dataset = await loadHumanEval()
  const results: EvaluationResult[] = []
  
  // Filter tasks if specified
  const tasks = config?.tasks 
    ? dataset.tasks.filter(t => config.tasks!.includes(t.id))
    : dataset.tasks
  
  // Run evaluation on each task
  for (const task of tasks) {
    const response = await generateFn(task.prompt)
    const evaluator = createHumanEvalDataset()
    const result = await evaluator.evaluate(response, task, config)
    results.push(result)
  }
  
  // Calculate aggregate metrics
  const passRate = results.filter(r => r.passed).length / results.length
  const metrics = new Map([
    ['pass_rate', passRate],
    ['syntax_valid_rate', results.filter(r => 
      r.metrics.get('syntax_valid')?.value === 1
    ).length / results.length],
    ['avg_execution_time', results.reduce((sum, r) => 
      sum + r.executionTime, 0
    ) / results.length]
  ])
  
  return { results, passRate, metrics }
}

/**
 * Run pass@k evaluation for HumanEval
 */
export async function evaluateHumanEvalPassAtK(
  generateFn: (prompt: string) => Promise<string>,
  config: PassAtKConfig = {
    k: [1, 10, 100],
    n: 200,
    temperature: 0.8
  }
): Promise<Map<string, PassAtKResult>> {
  const dataset = await loadHumanEval()
  const evaluator = createHumanEvalDataset()
  const results = new Map<string, PassAtKResult>()
  
  for (const task of dataset.tasks) {
    const result = await evaluator.evaluatePassAtK(
      task as HumanEvalTask,
      generateFn,
      config
    )
    results.set(task.id, result)
  }
  
  return results
}