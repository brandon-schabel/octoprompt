/**
 * Code Quality Analyzer for Prompt Engineering
 * Implements AST parsing, security detection, and code quality metrics
 */

import * as ts from 'typescript'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CodeAnalysisResult {
  ast: ASTMetrics
  security: SecurityAnalysis
  maintainability: MaintainabilityMetrics
  testability: TestabilityMetrics
  smells: CodeSmell[]
  cognitive: CognitiveComplexity
  recommendations: QualityRecommendation[]
  overallScore: number
}

export interface ASTMetrics {
  nodes: number
  depth: number
  breadth: number
  functions: FunctionMetrics[]
  classes: ClassMetrics[]
  imports: ImportMetrics[]
  exports: ExportMetrics[]
  complexity: {
    cyclomatic: number
    cognitive: number
    structural: number
  }
}

export interface FunctionMetrics {
  name: string
  parameters: number
  lines: number
  complexity: number
  returns: number
  asyncOperations: number
  errorHandling: boolean
}

export interface ClassMetrics {
  name: string
  methods: number
  properties: number
  inheritance: string[]
  coupling: number
  cohesion: number
  size: number
}

export interface ImportMetrics {
  module: string
  type: 'default' | 'named' | 'namespace'
  items: string[]
  isExternal: boolean
}

export interface ExportMetrics {
  name: string
  type: 'default' | 'named' | 'type' | 'namespace'
  isReexport: boolean
}

export interface SecurityAnalysis {
  vulnerabilities: SecurityVulnerability[]
  score: number
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  owasp: OWASPAnalysis
  cwe: CWEAnalysis[]
}

export interface SecurityVulnerability {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  location: CodeLocation
  description: string
  recommendation: string
  cwe?: string
  owasp?: string
}

export interface CodeLocation {
  file?: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
}

export interface OWASPAnalysis {
  injectionRisk: number
  authenticationIssues: number
  exposureRisk: number
  xxeRisk: number
  accessControlIssues: number
  securityMisconfiguration: number
  xssRisk: number
  deserializationRisk: number
  componentsRisk: number
  loggingIssues: number
}

export interface CWEAnalysis {
  id: string
  name: string
  severity: number
  instances: number
}

export interface MaintainabilityMetrics {
  index: number
  volume: number
  complexity: number
  effort: number
  timeToUnderstand: number
  technicalDebt: number
  codeChurn: number
}

export interface TestabilityMetrics {
  coverage: number
  mockability: number
  isolationScore: number
  assertability: number
  observability: number
  controllability: number
}

export interface CodeSmell {
  type: string
  severity: 'minor' | 'major' | 'critical'
  location: CodeLocation
  description: string
  refactoringSuggestion: string
}

export interface CognitiveComplexity {
  score: number
  nesting: number
  conditions: number
  switches: number
  sequences: number
  recursion: number
  details: ComplexityDetail[]
}

export interface ComplexityDetail {
  location: CodeLocation
  type: string
  contribution: number
  reason: string
}

export interface QualityRecommendation {
  category: 'security' | 'maintainability' | 'performance' | 'testability' | 'design'
  priority: 'low' | 'medium' | 'high'
  description: string
  impact: string
  effort: 'low' | 'medium' | 'high'
}

// ============================================================================
// Code Quality Analyzer Implementation
// ============================================================================

export class CodeQualityAnalyzer {
  private sourceFile?: ts.SourceFile
  private program?: ts.Program

  /**
   * Analyze code quality from string
   */
  analyze(code: string, fileName: string = 'temp.ts'): CodeAnalysisResult {
    // Create TypeScript source file
    this.sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true)

    // Analyze different aspects
    const ast = this.analyzeAST()
    const security = this.analyzeSecurity(code)
    const maintainability = this.analyzeMaintainability(code)
    const testability = this.analyzeTestability()
    const smells = this.detectCodeSmells()
    const cognitive = this.analyzeCognitiveComplexity()

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      ast,
      security,
      maintainability,
      testability,
      smells,
      cognitive
    })

    // Calculate overall score
    const overallScore = this.calculateOverallScore({
      security: security.score,
      maintainability: maintainability.index,
      testability: testability.coverage,
      complexity: cognitive.score,
      smells: smells.length
    })

    return {
      ast,
      security,
      maintainability,
      testability,
      smells,
      cognitive,
      recommendations,
      overallScore
    }
  }

  /**
   * Analyze AST structure
   */
  private analyzeAST(): ASTMetrics {
    if (!this.sourceFile) {
      throw new Error('Source file not initialized')
    }

    const functions: FunctionMetrics[] = []
    const classes: ClassMetrics[] = []
    const imports: ImportMetrics[] = []
    const exports: ExportMetrics[] = []

    let nodeCount = 0
    let maxDepth = 0
    let currentDepth = 0
    const depthMap = new Map<number, number>()

    // Visit all nodes
    const visit = (node: ts.Node) => {
      nodeCount++
      currentDepth++
      maxDepth = Math.max(maxDepth, currentDepth)

      // Count nodes at each depth
      depthMap.set(currentDepth, (depthMap.get(currentDepth) || 0) + 1)

      // Analyze specific node types
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        functions.push(this.analyzeFunctionNode(node))
      } else if (ts.isClassDeclaration(node)) {
        classes.push(this.analyzeClassNode(node))
      } else if (ts.isImportDeclaration(node)) {
        const importMetric = this.analyzeImportNode(node)
        if (importMetric) imports.push(importMetric)
      } else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        const exportMetric = this.analyzeExportNode(node)
        if (exportMetric) exports.push(exportMetric)
      }

      ts.forEachChild(node, visit)
      currentDepth--
    }

    visit(this.sourceFile)

    // Calculate breadth (max nodes at any depth)
    const breadth = Math.max(...Array.from(depthMap.values()))

    // Calculate complexity
    const cyclomatic = this.calculateCyclomaticComplexity(this.sourceFile)
    const cognitive = this.calculateCognitiveScore(this.sourceFile)
    const structural = Math.log2(nodeCount) * (maxDepth / 10)

    return {
      nodes: nodeCount,
      depth: maxDepth,
      breadth,
      functions,
      classes,
      imports,
      exports,
      complexity: {
        cyclomatic,
        cognitive,
        structural
      }
    }
  }

  /**
   * Analyze function node
   */
  private analyzeFunctionNode(node: ts.FunctionDeclaration | ts.MethodDeclaration): FunctionMetrics {
    const name = node.name?.getText() || 'anonymous'
    const parameters = node.parameters.length
    const lines = this.countLines(node)
    const complexity = this.calculateNodeComplexity(node)
    const returns = this.countReturns(node)
    const asyncOperations = this.countAsyncOperations(node)
    const errorHandling = this.hasErrorHandling(node)

    return {
      name,
      parameters,
      lines,
      complexity,
      returns,
      asyncOperations,
      errorHandling
    }
  }

  /**
   * Analyze class node
   */
  private analyzeClassNode(node: ts.ClassDeclaration): ClassMetrics {
    const name = node.name?.getText() || 'anonymous'
    let methods = 0
    let properties = 0
    const inheritance: string[] = []

    // Count members
    node.members.forEach((member) => {
      if (ts.isMethodDeclaration(member)) {
        methods++
      } else if (ts.isPropertyDeclaration(member)) {
        properties++
      }
    })

    // Check inheritance
    if (node.heritageClauses) {
      node.heritageClauses.forEach((clause) => {
        clause.types.forEach((type) => {
          inheritance.push(type.expression.getText())
        })
      })
    }

    // Calculate coupling and cohesion (simplified)
    const coupling = this.calculateCoupling(node)
    const cohesion = this.calculateCohesion(node)
    const size = methods + properties

    return {
      name,
      methods,
      properties,
      inheritance,
      coupling,
      cohesion,
      size
    }
  }

  /**
   * Analyze import node
   */
  private analyzeImportNode(node: ts.ImportDeclaration): ImportMetrics | null {
    const moduleSpecifier = node.moduleSpecifier
    if (!ts.isStringLiteral(moduleSpecifier)) return null

    const module = moduleSpecifier.text
    const isExternal = !module.startsWith('.') && !module.startsWith('/')

    let type: 'default' | 'named' | 'namespace' = 'named'
    const items: string[] = []

    if (node.importClause) {
      if (node.importClause.name) {
        type = 'default'
        items.push(node.importClause.name.getText())
      }

      if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          type = 'namespace'
          items.push(node.importClause.namedBindings.name.getText())
        } else if (ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach((element) => {
            items.push(element.name.getText())
          })
        }
      }
    }

    return { module, type, items, isExternal }
  }

  /**
   * Analyze export node
   */
  private analyzeExportNode(node: ts.ExportDeclaration | ts.ExportAssignment): ExportMetrics | null {
    if (ts.isExportAssignment(node)) {
      return {
        name: 'default',
        type: 'default',
        isReexport: false
      }
    }

    if (ts.isExportDeclaration(node)) {
      const isReexport = !!node.moduleSpecifier

      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        // For simplicity, take first export
        const firstExport = node.exportClause.elements[0]
        if (firstExport) {
          return {
            name: firstExport.name.getText(),
            type: 'named',
            isReexport
          }
        }
      }
    }

    return null
  }

  /**
   * Analyze security vulnerabilities
   */
  private analyzeSecurity(code: string): SecurityAnalysis {
    const vulnerabilities: SecurityVulnerability[] = []

    // Check for common security issues
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        type: 'Code Injection',
        severity: 'critical' as const,
        description: 'Use of eval() can lead to code injection',
        recommendation: 'Avoid eval() and use safer alternatives',
        cwe: 'CWE-94',
        owasp: 'A03:2021'
      },
      {
        pattern: /innerHTML\s*=/g,
        type: 'XSS Vulnerability',
        severity: 'high' as const,
        description: 'Direct innerHTML assignment can lead to XSS',
        recommendation: 'Use textContent or sanitize HTML input',
        cwe: 'CWE-79',
        owasp: 'A03:2021'
      },
      {
        pattern: /document\.write/g,
        type: 'DOM-based XSS',
        severity: 'high' as const,
        description: 'document.write can lead to XSS vulnerabilities',
        recommendation: 'Use safer DOM manipulation methods',
        cwe: 'CWE-79',
        owasp: 'A03:2021'
      },
      {
        pattern: /require\s*\(\s*[^'"]/g,
        type: 'Dynamic Require',
        severity: 'medium' as const,
        description: 'Dynamic require can lead to arbitrary code execution',
        recommendation: 'Use static imports or validate input',
        cwe: 'CWE-829',
        owasp: 'A08:2021'
      },
      {
        pattern: /process\.env\./g,
        type: 'Environment Variable Exposure',
        severity: 'low' as const,
        description: 'Direct use of environment variables',
        recommendation: 'Validate and sanitize environment variables',
        cwe: 'CWE-526',
        owasp: 'A05:2021'
      },
      {
        pattern: /crypto\.createHash\(['"]md5['"]\)/g,
        type: 'Weak Cryptography',
        severity: 'medium' as const,
        description: 'MD5 is cryptographically broken',
        recommendation: 'Use SHA-256 or stronger algorithms',
        cwe: 'CWE-327',
        owasp: 'A02:2021'
      },
      {
        pattern: /password|secret|token|api[_-]?key/gi,
        type: 'Potential Secret',
        severity: 'medium' as const,
        description: 'Potential hardcoded secret detected',
        recommendation: 'Use environment variables or secret management',
        cwe: 'CWE-798',
        owasp: 'A07:2021'
      }
    ]

    // Find vulnerabilities
    const lines = code.split('\n')
    for (const pattern of securityPatterns) {
      let match
      while ((match = pattern.pattern.exec(code)) !== null) {
        const position = this.getLineColumn(code, match.index)
        vulnerabilities.push({
          type: pattern.type,
          severity: pattern.severity,
          location: position,
          description: pattern.description,
          recommendation: pattern.recommendation,
          cwe: pattern.cwe,
          owasp: pattern.owasp
        })
      }
    }

    // Calculate OWASP scores
    const owasp = this.calculateOWASPScores(vulnerabilities)

    // Group by CWE
    const cweGroups = new Map<string, CWEAnalysis>()
    vulnerabilities.forEach((vuln) => {
      if (vuln.cwe) {
        const existing = cweGroups.get(vuln.cwe) || {
          id: vuln.cwe,
          name: vuln.type,
          severity: 0,
          instances: 0
        }
        existing.instances++
        existing.severity = Math.max(existing.severity, this.severityToNumber(vuln.severity))
        cweGroups.set(vuln.cwe, existing)
      }
    })

    const cwe = Array.from(cweGroups.values())

    // Calculate security score
    const score = this.calculateSecurityScore(vulnerabilities)
    const level = this.getSecurityLevel(score)

    return {
      vulnerabilities,
      score,
      level,
      owasp,
      cwe
    }
  }

  /**
   * Analyze maintainability metrics
   */
  private analyzeMaintainability(code: string): MaintainabilityMetrics {
    const lines = code.split('\n')
    const loc = lines.filter((line) => line.trim().length > 0).length

    // Halstead metrics (simplified)
    const operators = code.match(/[+\-*/%=<>!&|^~?:,;(){}[\]]/g) || []
    const operands = code.match(/\b\w+\b/g) || []

    const n1 = new Set(operators).size // Unique operators
    const n2 = new Set(operands).size // Unique operands
    const N1 = operators.length // Total operators
    const N2 = operands.length // Total operands

    const vocabulary = n1 + n2
    const length = N1 + N2
    const volume = length * Math.log2(vocabulary || 1)

    // Calculate complexity (cyclomatic)
    const complexity = this.calculateCyclomaticComplexity(this.sourceFile!)

    // Calculate effort
    const difficulty = (n1 / 2) * (N2 / (n2 || 1))
    const effort = difficulty * volume

    // Calculate maintainability index
    // MI = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC)
    const index = Math.max(
      0,
      Math.min(100, 171 - 5.2 * Math.log(volume || 1) - 0.23 * complexity - 16.2 * Math.log(loc || 1))
    )

    // Time to understand (in minutes, estimated)
    const timeToUnderstand = effort / 18000 // Stroud number

    // Technical debt (in hours, estimated)
    const technicalDebt = ((100 - index) * loc) / 1000

    // Code churn (simplified - would need git history)
    const codeChurn = 0

    return {
      index,
      volume,
      complexity,
      effort,
      timeToUnderstand,
      technicalDebt,
      codeChurn
    }
  }

  /**
   * Analyze testability metrics
   */
  private analyzeTestability(): TestabilityMetrics {
    if (!this.sourceFile) {
      return {
        coverage: 0,
        mockability: 0,
        isolationScore: 0,
        assertability: 0,
        observability: 0,
        controllability: 0
      }
    }

    let coverage = 50 // Base coverage
    let mockability = 50
    let isolationScore = 50
    let assertability = 50
    let observability = 50
    let controllability = 50

    // Check for test-friendly patterns
    const code = this.sourceFile.getText()

    // Dependency injection increases mockability
    if (code.includes('constructor(')) {
      mockability += 10
    }

    // Interfaces increase mockability
    if (code.includes('interface ')) {
      mockability += 10
    }

    // Pure functions increase testability
    if (code.includes('export function')) {
      isolationScore += 10
      assertability += 10
    }

    // Return types increase assertability
    if (code.includes(': ')) {
      assertability += 10
    }

    // Logging increases observability
    if (code.includes('console.') || code.includes('logger.')) {
      observability += 10
    }

    // Error handling increases observability
    if (code.includes('try') && code.includes('catch')) {
      observability += 10
    }

    // Parameters increase controllability
    if (code.match(/function.*\(.*\)/g)) {
      controllability += 10
    }

    // Async code decreases testability slightly
    if (code.includes('async') || code.includes('await')) {
      coverage -= 5
      isolationScore -= 5
    }

    // Global state decreases testability
    if (code.includes('global') || code.includes('window.')) {
      isolationScore -= 10
      mockability -= 10
    }

    return {
      coverage: Math.max(0, Math.min(100, coverage)),
      mockability: Math.max(0, Math.min(100, mockability)),
      isolationScore: Math.max(0, Math.min(100, isolationScore)),
      assertability: Math.max(0, Math.min(100, assertability)),
      observability: Math.max(0, Math.min(100, observability)),
      controllability: Math.max(0, Math.min(100, controllability))
    }
  }

  /**
   * Detect code smells
   */
  private detectCodeSmells(): CodeSmell[] {
    if (!this.sourceFile) return []

    const smells: CodeSmell[] = []
    const code = this.sourceFile.getText()
    const lines = code.split('\n')

    // Long method smell
    this.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        const funcLines = this.countLines(node)
        if (funcLines > 50) {
          smells.push({
            type: 'Long Method',
            severity: funcLines > 100 ? 'critical' : 'major',
            location: this.getNodeLocation(node),
            description: `Method has ${funcLines} lines (threshold: 50)`,
            refactoringSuggestion: 'Extract smaller methods or use composition'
          })
        }

        // Too many parameters
        if (node.parameters.length > 4) {
          smells.push({
            type: 'Too Many Parameters',
            severity: node.parameters.length > 7 ? 'major' : 'minor',
            location: this.getNodeLocation(node),
            description: `Function has ${node.parameters.length} parameters`,
            refactoringSuggestion: 'Use parameter object or builder pattern'
          })
        }
      }

      // Large class smell
      if (ts.isClassDeclaration(node)) {
        const classLines = this.countLines(node)
        if (classLines > 200) {
          smells.push({
            type: 'Large Class',
            severity: classLines > 500 ? 'critical' : 'major',
            location: this.getNodeLocation(node),
            description: `Class has ${classLines} lines`,
            refactoringSuggestion: 'Split into smaller, focused classes'
          })
        }
      }
    })

    // Duplicate code smell (simplified)
    const duplicateThreshold = 10
    for (let i = 0; i < lines.length - duplicateThreshold; i++) {
      const block = lines.slice(i, i + duplicateThreshold).join('\n')
      const remaining = lines.slice(i + duplicateThreshold).join('\n')

      if (remaining.includes(block) && block.trim().length > 100) {
        smells.push({
          type: 'Duplicate Code',
          severity: 'major',
          location: { line: i + 1, column: 0 },
          description: 'Potential duplicate code block detected',
          refactoringSuggestion: 'Extract common code into a shared function'
        })
        break // Only report first occurrence
      }
    }

    // Magic numbers
    const magicNumbers = code.match(/\b\d{2,}\b/g) || []
    if (magicNumbers.length > 3) {
      smells.push({
        type: 'Magic Numbers',
        severity: 'minor',
        location: { line: 1, column: 0 },
        description: `Found ${magicNumbers.length} magic numbers`,
        refactoringSuggestion: 'Extract constants with meaningful names'
      })
    }

    // Deep nesting
    let maxNesting = 0
    let currentNesting = 0
    for (const char of code) {
      if (char === '{') {
        currentNesting++
        maxNesting = Math.max(maxNesting, currentNesting)
      } else if (char === '}') {
        currentNesting--
      }
    }

    if (maxNesting > 4) {
      smells.push({
        type: 'Deep Nesting',
        severity: maxNesting > 6 ? 'major' : 'minor',
        location: { line: 1, column: 0 },
        description: `Maximum nesting depth: ${maxNesting}`,
        refactoringSuggestion: 'Use early returns or extract nested logic'
      })
    }

    return smells
  }

  /**
   * Analyze cognitive complexity
   */
  private analyzeCognitiveComplexity(): CognitiveComplexity {
    if (!this.sourceFile) {
      return {
        score: 0,
        nesting: 0,
        conditions: 0,
        switches: 0,
        sequences: 0,
        recursion: 0,
        details: []
      }
    }

    let score = 0
    let nesting = 0
    let conditions = 0
    let switches = 0
    let sequences = 0
    let recursion = 0
    const details: ComplexityDetail[] = []

    const analyze = (node: ts.Node, depth: number = 0) => {
      // Increment for control flow
      if (ts.isIfStatement(node)) {
        score += 1 + depth
        conditions++
        details.push({
          location: this.getNodeLocation(node),
          type: 'if statement',
          contribution: 1 + depth,
          reason: `If statement at nesting level ${depth}`
        })
      } else if (ts.isForStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
        score += 1 + depth
        sequences++
        details.push({
          location: this.getNodeLocation(node),
          type: 'loop',
          contribution: 1 + depth,
          reason: `Loop at nesting level ${depth}`
        })
      } else if (ts.isSwitchStatement(node)) {
        score += 1
        switches++
        details.push({
          location: this.getNodeLocation(node),
          type: 'switch',
          contribution: 1,
          reason: 'Switch statement'
        })
      } else if (ts.isCatchClause(node)) {
        score += 1
        details.push({
          location: this.getNodeLocation(node),
          type: 'catch',
          contribution: 1,
          reason: 'Exception handling'
        })
      }

      // Check for logical operators
      if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.getText()
        if (op === '&&' || op === '||') {
          score += 1
          conditions++
          details.push({
            location: this.getNodeLocation(node),
            type: 'logical operator',
            contribution: 1,
            reason: `Logical operator ${op}`
          })
        }
      }

      // Track nesting
      const increasesNesting =
        ts.isIfStatement(node) ||
        ts.isForStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isSwitchStatement(node)

      if (increasesNesting) {
        nesting = Math.max(nesting, depth + 1)
      }

      // Recurse
      ts.forEachChild(node, (child) => analyze(child, increasesNesting ? depth + 1 : depth))
    }

    analyze(this.sourceFile)

    return {
      score,
      nesting,
      conditions,
      switches,
      sequences,
      recursion,
      details
    }
  }

  /**
   * Generate quality recommendations
   */
  private generateRecommendations(analysis: Partial<CodeAnalysisResult>): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = []

    // Security recommendations
    if (analysis.security && analysis.security.vulnerabilities.length > 0) {
      const critical = analysis.security.vulnerabilities.filter((v) => v.severity === 'critical')
      if (critical.length > 0) {
        recommendations.push({
          category: 'security',
          priority: 'high',
          description: `Fix ${critical.length} critical security vulnerabilities`,
          impact: 'Prevents potential security breaches',
          effort: 'medium'
        })
      }
    }

    // Maintainability recommendations
    if (analysis.maintainability && analysis.maintainability.index < 50) {
      recommendations.push({
        category: 'maintainability',
        priority: 'medium',
        description: 'Improve code maintainability index',
        impact: 'Reduces technical debt and improves readability',
        effort: 'high'
      })
    }

    // Complexity recommendations
    if (analysis.cognitive && analysis.cognitive.score > 15) {
      recommendations.push({
        category: 'design',
        priority: 'medium',
        description: 'Reduce cognitive complexity',
        impact: 'Makes code easier to understand and maintain',
        effort: 'medium'
      })
    }

    // Code smell recommendations
    if (analysis.smells && analysis.smells.length > 5) {
      recommendations.push({
        category: 'maintainability',
        priority: 'low',
        description: `Address ${analysis.smells.length} code smells`,
        impact: 'Improves code quality and prevents future issues',
        effort: 'low'
      })
    }

    // Testability recommendations
    if (analysis.testability && analysis.testability.coverage < 60) {
      recommendations.push({
        category: 'testability',
        priority: 'medium',
        description: 'Improve test coverage and testability',
        impact: 'Increases confidence in code changes',
        effort: 'medium'
      })
    }

    return recommendations
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private calculateCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1

    const visit = (n: ts.Node) => {
      if (
        ts.isIfStatement(n) ||
        ts.isForStatement(n) ||
        ts.isWhileStatement(n) ||
        ts.isDoStatement(n) ||
        ts.isConditionalExpression(n)
      ) {
        complexity++
      } else if (ts.isCaseClause(n)) {
        complexity++
      } else if (ts.isCatchClause(n)) {
        complexity++
      } else if (ts.isBinaryExpression(n)) {
        const op = n.operatorToken.getText()
        if (op === '&&' || op === '||') {
          complexity++
        }
      }

      ts.forEachChild(n, visit)
    }

    if (node) visit(node)

    return complexity
  }

  private calculateCognitiveScore(node: ts.Node): number {
    // Simplified cognitive complexity
    return this.calculateCyclomaticComplexity(node) * 1.5
  }

  private countLines(node: ts.Node): number {
    const text = node.getText()
    return text.split('\n').length
  }

  private calculateNodeComplexity(node: ts.Node): number {
    return this.calculateCyclomaticComplexity(node)
  }

  private countReturns(node: ts.Node): number {
    let count = 0
    const visit = (n: ts.Node) => {
      if (ts.isReturnStatement(n)) count++
      ts.forEachChild(n, visit)
    }
    visit(node)
    return count
  }

  private countAsyncOperations(node: ts.Node): number {
    let count = 0
    const visit = (n: ts.Node) => {
      if (ts.isAwaitExpression(n)) count++
      ts.forEachChild(n, visit)
    }
    visit(node)
    return count
  }

  private hasErrorHandling(node: ts.Node): boolean {
    let hasHandling = false
    const visit = (n: ts.Node) => {
      if (ts.isTryStatement(n)) hasHandling = true
      if (!hasHandling) ts.forEachChild(n, visit)
    }
    visit(node)
    return hasHandling
  }

  private calculateCoupling(node: ts.ClassDeclaration): number {
    // Count external references (simplified)
    let coupling = 0
    const visit = (n: ts.Node) => {
      if (ts.isPropertyAccessExpression(n)) {
        const text = n.expression.getText()
        if (text !== 'this' && text !== 'super') {
          coupling++
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(node)
    return Math.min(coupling, 100)
  }

  private calculateCohesion(node: ts.ClassDeclaration): number {
    // Simplified cohesion (100 - coupling/2)
    return Math.max(0, 100 - this.calculateCoupling(node) / 2)
  }

  private getLineColumn(text: string, index: number): CodeLocation {
    const lines = text.substring(0, index).split('\n')
    return {
      line: lines.length,
      column: lines[lines.length - 1].length
    }
  }

  private getNodeLocation(node: ts.Node): CodeLocation {
    if (!this.sourceFile) {
      return { line: 0, column: 0 }
    }

    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart())
    return {
      line: line + 1,
      column: character
    }
  }

  private calculateOWASPScores(vulnerabilities: SecurityVulnerability[]): OWASPAnalysis {
    const scores: OWASPAnalysis = {
      injectionRisk: 0,
      authenticationIssues: 0,
      exposureRisk: 0,
      xxeRisk: 0,
      accessControlIssues: 0,
      securityMisconfiguration: 0,
      xssRisk: 0,
      deserializationRisk: 0,
      componentsRisk: 0,
      loggingIssues: 0
    }

    vulnerabilities.forEach((vuln) => {
      const score = this.severityToNumber(vuln.severity)

      switch (vuln.owasp) {
        case 'A03:2021':
          scores.injectionRisk += score
          break
        case 'A07:2021':
          scores.authenticationIssues += score
          break
        case 'A01:2021':
          scores.accessControlIssues += score
          break
        case 'A05:2021':
          scores.securityMisconfiguration += score
          break
        case 'A03:2021':
          if (vuln.type.includes('XSS')) {
            scores.xssRisk += score
          }
          break
        case 'A08:2021':
          scores.deserializationRisk += score
          break
        case 'A06:2021':
          scores.componentsRisk += score
          break
        case 'A09:2021':
          scores.loggingIssues += score
          break
      }
    })

    return scores
  }

  private severityToNumber(severity: string): number {
    switch (severity) {
      case 'critical':
        return 10
      case 'high':
        return 7
      case 'medium':
        return 4
      case 'major':
        return 4
      case 'low':
        return 2
      case 'minor':
        return 1
      default:
        return 0
    }
  }

  private calculateSecurityScore(vulnerabilities: SecurityVulnerability[]): number {
    if (vulnerabilities.length === 0) return 100

    let totalPenalty = 0
    vulnerabilities.forEach((vuln) => {
      totalPenalty += this.severityToNumber(vuln.severity)
    })

    return Math.max(0, 100 - totalPenalty)
  }

  private getSecurityLevel(score: number): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'safe'
    if (score >= 70) return 'low'
    if (score >= 50) return 'medium'
    if (score >= 30) return 'high'
    return 'critical'
  }

  private calculateOverallScore(metrics: {
    security: number
    maintainability: number
    testability: number
    complexity: number
    smells: number
  }): number {
    // Weighted average
    const weights = {
      security: 0.3,
      maintainability: 0.25,
      testability: 0.2,
      complexity: 0.15,
      smells: 0.1
    }

    // Normalize complexity and smells (inverse)
    const normalizedComplexity = Math.max(0, 100 - metrics.complexity * 2)
    const normalizedSmells = Math.max(0, 100 - metrics.smells * 10)

    return (
      metrics.security * weights.security +
      metrics.maintainability * weights.maintainability +
      metrics.testability * weights.testability +
      normalizedComplexity * weights.complexity +
      normalizedSmells * weights.smells
    )
  }
}

// ============================================================================
// Export Factory
// ============================================================================

export function createCodeQualityAnalyzer(): CodeQualityAnalyzer {
  return new CodeQualityAnalyzer()
}
