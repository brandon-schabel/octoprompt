#!/usr/bin/env bun

import { PromptEngineer } from './src'

async function testBasic() {
  const engineer = new PromptEngineer()

  // Test SCoT
  console.log('Testing SCoT optimizer...')
  const scotResult = await engineer.optimize('Sort an array', {
    optimizer: 'scot'
  })
  console.log('SCoT works:', scotResult.improvementScore > 0)

  // Test Self-Consistency
  console.log('\nTesting Self-Consistency optimizer...')
  const scResult = await engineer.optimize('Sort an array', {
    optimizer: 'self-consistency'
  })
  console.log('Self-Consistency works:', scResult.improvementScore > 0)

  // Test Context
  console.log('\nTesting Context optimizer...')
  const contextResult = await engineer.optimize('Sort an array', {
    optimizer: 'context'
  })
  console.log('Context works:', contextResult.improvementScore > 0)

  // Test analysis
  console.log('\nTesting analysis...')
  const analysis = engineer.analyze('Sort an array')
  console.log('Analysis works:', analysis.complexity !== undefined)
}

testBasic().catch(console.error)
