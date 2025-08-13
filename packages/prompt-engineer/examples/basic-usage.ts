#!/usr/bin/env bun
/**
 * Basic usage example for @promptliano/prompt-engineer
 * 
 * This example demonstrates how to use the SCoT and Self-Consistency optimizers
 * to improve prompt quality for different types of tasks.
 */

import { PromptEngineer } from '../src'

async function main() {
  console.log('🚀 Promptliano Prompt Engineer - Basic Usage Example\n')
  
  // Initialize the prompt engineer with default optimizers
  const engineer = new PromptEngineer()
  
  // Example 1: Optimize an algorithmic problem with SCoT
  console.log('═══════════════════════════════════════════════════════')
  console.log('Example 1: Algorithmic Problem with SCoT Optimizer')
  console.log('═══════════════════════════════════════════════════════\n')
  
  const algorithmicPrompt = `
    Implement a function to find the longest palindromic substring in a given string.
    The function should handle edge cases like empty strings and single characters.
  `
  
  try {
    const scotResult = await engineer.optimize(algorithmicPrompt, {
      optimizer: 'scot',
      context: {
        language: 'typescript',
        constraints: [
          'Time complexity should be O(n²) or better',
          'Space complexity should be optimized',
          'Handle Unicode characters correctly'
        ],
        examples: [
          { input: 'babad', output: 'bab' },
          { input: 'cbbd', output: 'bb' }
        ],
        performance: 'Should handle strings up to 1000 characters efficiently'
      }
    })
    
    console.log('Original Prompt:')
    console.log(algorithmicPrompt.trim())
    console.log('\nOptimized Prompt (excerpt):')
    console.log(scotResult.optimizedPrompt.substring(0, 500) + '...')
    console.log(`\n✅ Improvement Score: ${scotResult.improvementScore}%`)
    console.log(`📊 Estimated Tokens: ${scotResult.estimatedTokens}`)
    console.log(`🧩 Complexity Score: ${scotResult.reasoningStructure.complexity.overall}/10`)
  } catch (error) {
    console.error('Error with SCoT optimization:', error)
  }
  
  // Example 2: Decision-making problem with Self-Consistency
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('Example 2: Decision Making with Self-Consistency')
  console.log('═══════════════════════════════════════════════════════\n')
  
  const decisionPrompt = `
    Should we migrate our monolithic application to microservices?
    Consider factors like team size, technical debt, and scalability needs.
  `
  
  try {
    const consistencyResult = await engineer.optimize(decisionPrompt, {
      optimizer: 'self-consistency'
    })
    
    console.log('Original Prompt:')
    console.log(decisionPrompt.trim())
    console.log('\nOptimization Strategy:')
    console.log(`- ${consistencyResult.optimizationStrategy.name}`)
    console.log(`- Techniques: ${consistencyResult.optimizationStrategy.techniques.join(', ')}`)
    console.log(`- Confidence: ${(consistencyResult.optimizationStrategy.confidence * 100).toFixed(1)}%`)
    console.log(`\n✅ Improvement Score: ${consistencyResult.improvementScore}%`)
  } catch (error) {
    console.error('Error with Self-Consistency optimization:', error)
  }
  
  // Example 3: Analyze prompt structure without optimization
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('Example 3: Prompt Structure Analysis')
  console.log('═══════════════════════════════════════════════════════\n')
  
  const complexPrompt = `
    First, load the configuration from the file.
    Then, validate all the required fields.
    If validation passes, process each item in the list.
    For each item, apply the transformation and store the result.
    Finally, generate a summary report.
  `
  
  try {
    const analysis = engineer.analyze(complexPrompt, 'scot')
    
    console.log('Prompt to Analyze:')
    console.log(complexPrompt.trim())
    console.log('\nStructural Analysis:')
    console.log(`- Sequences: ${analysis.sequences.length} steps identified`)
    console.log(`- Branches: ${analysis.branches.length} conditional paths`)
    console.log(`- Loops: ${analysis.loops.length} iteration structures`)
    console.log(`- Data Flow: ${analysis.dataFlow.length} transformation patterns`)
    console.log('\nComplexity Scores:')
    console.log(`- Cognitive: ${analysis.complexity.cognitive}/10`)
    console.log(`- Computational: ${analysis.complexity.computational}/10`)
    console.log(`- Structural: ${analysis.complexity.structural}/10`)
    console.log(`- Overall: ${analysis.complexity.overall}/10`)
  } catch (error) {
    console.error('Error with analysis:', error)
  }
  
  // Example 4: List available optimizers and features
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('Example 4: Available Optimizers and Features')
  console.log('═══════════════════════════════════════════════════════\n')
  
  const optimizers = engineer.listOptimizers()
  console.log('Available Optimizers:')
  optimizers.forEach(opt => {
    console.log(`- ${opt}`)
  })
  
  console.log('\nSCoT Optimizer Features:')
  const scotFeatures = [
    'sequence-analysis',
    'branch-detection',
    'loop-identification',
    'data-flow-mapping',
    'complexity-scoring'
  ]
  scotFeatures.forEach(feature => {
    const supported = engineer.supportsFeature(feature, 'scot')
    console.log(`- ${feature}: ${supported ? '✅' : '❌'}`)
  })
  
  console.log('\nSelf-Consistency Features:')
  const consistencyFeatures = [
    'multi-sampling',
    'voting',
    'confidence-scoring',
    'async-only'
  ]
  consistencyFeatures.forEach(feature => {
    const supported = engineer.supportsFeature(feature, 'self-consistency')
    console.log(`- ${feature}: ${supported ? '✅' : '❌'}`)
  })
  
  console.log('\n✨ Examples completed successfully!')
}

// Run the examples
main().catch(console.error)