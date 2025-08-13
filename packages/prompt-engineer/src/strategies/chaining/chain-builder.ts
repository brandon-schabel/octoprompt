import { E, TE, A, O, pipe } from '../../fp'
import {
  type PromptChain,
  type ChainLink,
  type ChainExecution,
  type ChainResult
} from '../../types'

// ============================================================================
// Prompt Chain Building and Management
// ============================================================================

export interface ChainConfig {
  maxRetries: number
  timeoutMs: number
  parallelExecution: boolean
  cacheResults: boolean
  errorStrategy: 'fail-fast' | 'continue' | 'retry'
}

const defaultConfig: ChainConfig = {
  maxRetries: 3,
  timeoutMs: 30000,
  parallelExecution: false,
  cacheResults: true,
  errorStrategy: 'retry'
}

export interface ChainContext {
  variables: Map<string, any>
  results: Map<string, any>
  errors: Array<{ linkId: string; error: Error; timestamp: number }>
  metadata: Record<string, any>
}

// ============================================================================
// Chain Builder
// ============================================================================

export class ChainBuilder {
  private links: ChainLink[] = []
  private context: ChainContext = {
    variables: new Map(),
    results: new Map(),
    errors: [],
    metadata: {}
  }

  constructor(private config: ChainConfig = defaultConfig) { }

  // Add a link to the chain
  addLink(link: Omit<ChainLink, 'id'>): ChainBuilder {
    const id = this.generateLinkId()
    this.links.push({
      ...link,
      id
    } as ChainLink)
    return this
  }

  // Add a transformation link
  transform(
    name: string,
    prompt: string,
    transform: (input: any) => any,
    dependencies?: string[]
  ): ChainBuilder {
    return this.addLink({
      name,
      prompt,
      type: 'transform',
      transform,
      dependencies: dependencies || this.getLastLinkId()
    })
  }

  // Add a generation link
  generate(
    name: string,
    prompt: string,
    model?: string,
    dependencies?: string[]
  ): ChainBuilder {
    return this.addLink({
      name,
      prompt,
      type: 'generate',
      model,
      dependencies: dependencies || this.getLastLinkId()
    })
  }

  // Add a validation link
  validate(
    name: string,
    prompt: string,
    validation: (result: any) => boolean,
    dependencies?: string[]
  ): ChainBuilder {
    return this.addLink({
      name,
      prompt,
      type: 'validate',
      validation,
      dependencies: dependencies || this.getLastLinkId()
    })
  }

  // Add a conditional branch
  branch(
    name: string,
    condition: (context: ChainContext) => boolean,
    trueBranch: ChainLink[],
    falseBranch: ChainLink[] = []
  ): ChainBuilder {
    const branchId = this.generateLinkId()

    // Create branch link
    this.links.push({
      id: branchId,
      name,
      prompt: `Branch: ${name}`,
      type: 'branch',
      condition,
      trueBranch: trueBranch.map(l => ({ ...l, id: this.generateLinkId() })),
      falseBranch: falseBranch.map(l => ({ ...l, id: this.generateLinkId() })),
      dependencies: this.getLastLinkId()
    } as ChainLink)

    return this
  }

  // Add a loop
  loop(
    name: string,
    prompt: string,
    condition: (context: ChainContext, iteration: number) => boolean,
    body: ChainLink[],
    maxIterations: number = 10
  ): ChainBuilder {
    const loopId = this.generateLinkId()

    this.links.push({
      id: loopId,
      name,
      prompt,
      type: 'loop',
      condition,
      body: body.map(l => ({ ...l, id: this.generateLinkId() })),
      maxIterations,
      dependencies: this.getLastLinkId()
    } as ChainLink)

    return this
  }

  // Add parallel execution
  parallel(
    name: string,
    links: ChainLink[]
  ): ChainBuilder {
    const parallelId = this.generateLinkId()

    this.links.push({
      id: parallelId,
      name,
      prompt: `Parallel: ${name}`,
      type: 'parallel',
      parallelLinks: links.map(l => ({ ...l, id: this.generateLinkId() })),
      dependencies: this.getLastLinkId()
    } as ChainLink)

    return this
  }

  // Set initial context variables
  withContext(variables: Record<string, any>): ChainBuilder {
    Object.entries(variables).forEach(([key, value]) => {
      this.context.variables.set(key, value)
    })
    return this
  }

  // Build the final chain
  build(): PromptChain {
    return {
      id: this.generateChainId(),
      name: 'Prompt Chain',
      description: `Chain with ${this.links.length} links`,
      links: this.links,
      config: this.config
    }
  }

  // Helper to get last link ID or empty array
  private getLastLinkId(): string[] {
    if (this.links.length === 0) return []
    return [this.links[this.links.length - 1].id]
  }

  // Generate unique link ID
  private generateLinkId(): string {
    return `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Generate unique chain ID
  private generateChainId(): string {
    return `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// ============================================================================
// Chain Validator
// ============================================================================

export class ChainValidator {
  // Validate chain structure
  validateChain(chain: PromptChain): E.Either<Error[], PromptChain> {
    const errors: Error[] = []

    // Check for cycles
    if (this.hasCycles(chain)) {
      errors.push(new Error('Chain contains cycles'))
    }

    // Check for unreachable links
    const unreachable = this.findUnreachableLinks(chain)
    if (unreachable.length > 0) {
      errors.push(new Error(`Unreachable links: ${unreachable.join(', ')}`))
    }

    // Check for missing dependencies
    const missing = this.findMissingDependencies(chain)
    if (missing.length > 0) {
      errors.push(new Error(`Missing dependencies: ${missing.join(', ')}`))
    }

    // Validate individual links
    chain.links.forEach(link => {
      const linkErrors = this.validateLink(link)
      errors.push(...linkErrors)
    })

    return errors.length > 0 ? E.left(errors) : E.right(chain)
  }

  // Check for cycles in chain
  private hasCycles(chain: PromptChain): boolean {
    const visited = new Set<string>()
    const recStack = new Set<string>()

    const hasCycleDFS = (linkId: string): boolean => {
      visited.add(linkId)
      recStack.add(linkId)

      const link = chain.links.find(l => l.id === linkId)
      if (!link) return false

      const nextLinks = this.getNextLinks(link, chain)
      for (const nextId of nextLinks) {
        if (!visited.has(nextId)) {
          if (hasCycleDFS(nextId)) return true
        } else if (recStack.has(nextId)) {
          return true // Found cycle
        }
      }

      recStack.delete(linkId)
      return false
    }

    for (const link of chain.links) {
      if (!visited.has(link.id)) {
        if (hasCycleDFS(link.id)) return true
      }
    }

    return false
  }

  // Find unreachable links
  private findUnreachableLinks(chain: PromptChain): string[] {
    const reachable = new Set<string>()
    const queue: string[] = []

    // Find starting links (no dependencies)
    chain.links.forEach(link => {
      if (!link.dependencies || link.dependencies.length === 0) {
        queue.push(link.id)
      }
    })

    // BFS to find all reachable links
    while (queue.length > 0) {
      const linkId = queue.shift()!
      if (reachable.has(linkId)) continue

      reachable.add(linkId)

      const link = chain.links.find(l => l.id === linkId)
      if (link) {
        const nextLinks = this.getNextLinks(link, chain)
        queue.push(...nextLinks)
      }
    }

    // Find unreachable
    return chain.links
      .filter(link => !reachable.has(link.id))
      .map(link => link.id)
  }

  // Find missing dependencies
  private findMissingDependencies(chain: PromptChain): string[] {
    const linkIds = new Set(chain.links.map(l => l.id))
    const missing: string[] = []

    chain.links.forEach(link => {
      if (link.dependencies) {
        link.dependencies.forEach(depId => {
          if (!linkIds.has(depId)) {
            missing.push(depId)
          }
        })
      }
    })

    return [...new Set(missing)]
  }

  // Validate individual link
  private validateLink(link: ChainLink): Error[] {
    const errors: Error[] = []

    // Check required fields
    if (!link.id) errors.push(new Error(`Link missing ID`))
    if (!link.name) errors.push(new Error(`Link ${link.id} missing name`))
    if (!link.prompt) errors.push(new Error(`Link ${link.id} missing prompt`))

    // Type-specific validation
    switch (link.type) {
      case 'transform':
        if (!link.transform) {
          errors.push(new Error(`Transform link ${link.id} missing transform function`))
        }
        break

      case 'validate':
        if (!link.validation) {
          errors.push(new Error(`Validate link ${link.id} missing validation function`))
        }
        break

      case 'branch':
        if (!link.condition) {
          errors.push(new Error(`Branch link ${link.id} missing condition`))
        }
        if (!link.trueBranch) {
          errors.push(new Error(`Branch link ${link.id} missing true branch`))
        }
        break

      case 'loop':
        if (!link.condition) {
          errors.push(new Error(`Loop link ${link.id} missing condition`))
        }
        if (!link.body) {
          errors.push(new Error(`Loop link ${link.id} missing body`))
        }
        if (!link.maxIterations) {
          errors.push(new Error(`Loop link ${link.id} missing maxIterations`))
        }
        break

      case 'parallel':
        if (!link.parallelLinks || link.parallelLinks.length === 0) {
          errors.push(new Error(`Parallel link ${link.id} has no parallel links`))
        }
        break
    }

    return errors
  }

  // Get next links from current link
  private getNextLinks(link: ChainLink, chain: PromptChain): string[] {
    const next: string[] = []

    // Find links that depend on this one
    chain.links.forEach(l => {
      if (l.dependencies && l.dependencies.includes(link.id)) {
        next.push(l.id)
      }
    })

    // Add branch/loop/parallel children
    if (link.type === 'branch') {
      if (link.trueBranch) next.push(...link.trueBranch.map(l => l.id))
      if (link.falseBranch) next.push(...link.falseBranch.map(l => l.id))
    }

    if (link.type === 'loop' && link.body) {
      next.push(...link.body.map(l => l.id))
    }

    if (link.type === 'parallel' && link.parallelLinks) {
      next.push(...link.parallelLinks.map(l => l.id))
    }

    return next
  }
}

// ============================================================================
// Chain Optimizer
// ============================================================================

export class ChainOptimizer {
  // Optimize chain for better execution
  optimizeChain(chain: PromptChain): PromptChain {
    let optimized = { ...chain, links: [...chain.links] }

    // Remove redundant links
    optimized = this.removeRedundantLinks(optimized)

    // Merge sequential transforms
    optimized = this.mergeSequentialTransforms(optimized)

    // Parallelize independent links
    optimized = this.parallelizeIndependentLinks(optimized)

    // Optimize branch conditions
    optimized = this.optimizeBranches(optimized)

    return optimized
  }

  // Remove redundant links
  private removeRedundantLinks(chain: PromptChain): PromptChain {
    const used = new Set<string>()
    const resultUsed = new Set<string>()

    // Track which links are actually used
    chain.links.forEach(link => {
      if (link.dependencies) {
        link.dependencies.forEach(dep => used.add(dep))
      }

      // Check if link result is used in prompts
      chain.links.forEach(other => {
        if (other.prompt.includes(`{{${link.id}}}`)) {
          resultUsed.add(link.id)
        }
      })
    })

    // Keep only used links or terminal links
    const filtered = chain.links.filter(link =>
      used.has(link.id) ||
      resultUsed.has(link.id) ||
      !link.dependencies ||
      link.dependencies.length === 0
    )

    return { ...chain, links: filtered }
  }

  // Merge sequential transform links
  private mergeSequentialTransforms(chain: PromptChain): PromptChain {
    const merged: ChainLink[] = []
    let i = 0

    while (i < chain.links.length) {
      const link = chain.links[i]

      if (link.type === 'transform') {
        // Look for sequential transforms
        const sequence: ChainLink[] = [link]
        let j = i + 1

        while (j < chain.links.length) {
          const next = chain.links[j]
          if (next.type === 'transform' &&
            next.dependencies?.length === 1 &&
            next.dependencies[0] === sequence[sequence.length - 1].id) {
            sequence.push(next)
            j++
          } else {
            break
          }
        }

        if (sequence.length > 1) {
          // Merge transforms
          const mergedLink: ChainLink = {
            id: sequence[0].id,
            name: `Merged: ${sequence.map(s => s.name).join(' -> ')}`,
            prompt: sequence.map(s => s.prompt).join('\n'),
            type: 'transform',
            transform: (input: any) => {
              let result = input
              sequence.forEach(s => {
                if (s.transform) result = s.transform(result)
              })
              return result
            },
            dependencies: sequence[0].dependencies
          }
          merged.push(mergedLink)
          i = j
        } else {
          merged.push(link)
          i++
        }
      } else {
        merged.push(link)
        i++
      }
    }

    return { ...chain, links: merged }
  }

  // Parallelize independent links
  private parallelizeIndependentLinks(chain: PromptChain): PromptChain {
    const dependencyGroups = this.findIndependentGroups(chain)
    const optimized: ChainLink[] = []

    dependencyGroups.forEach(group => {
      if (group.length > 1) {
        // Create parallel link for independent links
        const parallelLink: ChainLink = {
          id: `parallel_${Date.now()}`,
          name: `Parallel: ${group.map(l => l.name).join(', ')}`,
          prompt: 'Parallel execution',
          type: 'parallel',
          parallelLinks: group,
          dependencies: this.getCommonDependencies(group)
        }
        optimized.push(parallelLink)
      } else {
        optimized.push(...group)
      }
    })

    return { ...chain, links: optimized }
  }

  // Find groups of independent links
  private findIndependentGroups(chain: PromptChain): ChainLink[][] {
    const groups: ChainLink[][] = []
    const processed = new Set<string>()

    // Build dependency map
    const dependsOn = new Map<string, Set<string>>()
    chain.links.forEach(link => {
      if (link.dependencies) {
        dependsOn.set(link.id, new Set(link.dependencies))
      } else {
        dependsOn.set(link.id, new Set())
      }
    })

    // Group by dependency level
    while (processed.size < chain.links.length) {
      const currentGroup: ChainLink[] = []

      chain.links.forEach(link => {
        if (!processed.has(link.id)) {
          const deps = dependsOn.get(link.id) || new Set()
          if ([...deps].every(d => processed.has(d))) {
            currentGroup.push(link)
          }
        }
      })

      if (currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup.forEach(link => processed.add(link.id))
      } else {
        break // Prevent infinite loop
      }
    }

    return groups
  }

  // Get common dependencies of a group
  private getCommonDependencies(group: ChainLink[]): string[] {
    if (group.length === 0) return []

    const allDeps = group
      .flatMap(link => link.dependencies || [])
      .filter((dep, index, self) => self.indexOf(dep) === index)

    return allDeps
  }

  // Optimize branch conditions
  private optimizeBranches(chain: PromptChain): PromptChain {
    const optimized = chain.links.map(link => {
      if (link.type === 'branch') {
        // Check for empty branches
        if ((!link.trueBranch || link.trueBranch.length === 0) &&
          (!link.falseBranch || link.falseBranch.length === 0)) {
          // Convert to simple link
          return {
            ...link,
            type: 'generate'
          }
        }

        // Check for identical branches
        if (link.trueBranch && link.falseBranch &&
          JSON.stringify(link.trueBranch) === JSON.stringify(link.falseBranch)) {
          // Remove branch, just execute the content
          return {
            ...link,
            type: 'generate'
          }
        }
      }

      return link
    })

    return { ...chain, links: optimized }
  }
}

// Export factory functions
export function createChainBuilder(config?: Partial<ChainConfig>): ChainBuilder {
  return new ChainBuilder({ ...defaultConfig, ...config })
}

export function createChainValidator(): ChainValidator {
  return new ChainValidator()
}

export function createChainOptimizer(): ChainOptimizer {
  return new ChainOptimizer()
}