#!/usr/bin/env bun
import { providerKeyStorage } from './packages/storage'

async function testProviderStorage() {
  try {
    console.log('🧪 Testing provider key storage...')
    
    const keys = await providerKeyStorage.readProviderKeys()
    console.log('✅ Provider key storage working! Found keys:', Object.keys(keys).length)
    console.log('Keys:', JSON.stringify(keys, null, 2))
    
  } catch (error) {
    console.error('❌ Provider key storage failed:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
  }
}

testProviderStorage()