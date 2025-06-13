import { createFileRoute, redirect } from '@tanstack/react-router'
import { ChatPage } from './chat'

export const Route = createFileRoute('/chat/$chatId')({
  beforeLoad: ({ params }) => {
    const chatId = parseInt(params.chatId)
    
    if (isNaN(chatId)) {
      throw redirect({
        to: '/chat'
      })
    }
    
    return { chatId }
  },
  component: ChatPage
})