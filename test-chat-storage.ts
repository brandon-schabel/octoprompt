#!/usr/bin/env bun
import { chatStorage } from './packages/storage/src/chat-storage'

async function testChatStorage() {
  try {
    console.log('🧪 Testing chat storage...')
    
    const chats = await chatStorage.readChats()
    console.log('✅ Chat storage working! Found chats:', Object.keys(chats).length)
    console.log('Chats:', JSON.stringify(chats, null, 2))
    
  } catch (error) {
    console.error('❌ Chat storage failed:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
  }
}

testChatStorage()