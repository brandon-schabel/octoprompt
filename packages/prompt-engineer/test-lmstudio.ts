#!/usr/bin/env bun

import { createSCoTOptimizer } from './src/optimizers/scot'
import { createSelfConsistencyOptimizer } from './src/optimizers/self-consistency'
import { E } from './src/fp'

// Simple LMStudio provider
class SimpleLMStudioProvider {
  async generate(prompt: string, temperature: number, topP: number): Promise<string> {
    const response = await fetch('http://192.168.1.38:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature,
        top_p: topP,
        max_tokens: 500
      })
    })

    const data = await response.json()
    return data.choices[0].message.content
  }
}

async function test() {
  console.log('Testing with LMStudio...\n')

  // Test SCoT optimizer
  console.log('1. Testing SCoT Optimizer:')
  const scotOptimizer = createSCoTOptimizer()
  const scotResult = scotOptimizer.optimize('Write a function to sort an array')

  if (E.isRight(scotResult)) {
    console.log('✅ SCoT optimization successful')
    console.log('   Improvement score:', scotResult.right.improvementScore + '%')

    // Generate with LMStudio
    const provider = new SimpleLMStudioProvider()
    const solution = await provider.generate(scotResult.right.userPrompt, 0.7, 0.9)
    console.log('   Generated solution length:', solution.length, 'characters')
  } else {
    console.log('❌ SCoT optimization failed:', scotResult.left)
  }

  // Test Self-Consistency with real LLM
  console.log('\n2. Testing Self-Consistency Optimizer:')
  const provider = new SimpleLMStudioProvider()
  const scOptimizer = createSelfConsistencyOptimizer(provider as any, {
    samples: 3,
    temperatureRange: [0.5, 0.9],
    topPRange: [0.8, 0.95],
    votingStrategy: 'majority',
    maxRetries: 2,
    timeoutMs: 30000
  })

  const scResult = await scOptimizer.optimizeAsync('Calculate fibonacci number')()

  if (E.isRight(scResult)) {
    console.log('✅ Self-Consistency optimization successful')
    console.log('   Improvement score:', scResult.right.improvementScore + '%')
    console.log('   Confidence:', scResult.right.optimizationStrategy.confidence)
  } else {
    console.log('❌ Self-Consistency optimization failed:', scResult.left)
  }

  console.log('\n✨ LMStudio integration test complete!')
}

test().catch(console.error)