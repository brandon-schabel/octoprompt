import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bot, X } from 'lucide-react'
import { ClaudeCodeModal } from './claude-code-modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ClaudeCodeFabProps {
  projectId?: number
}

export function ClaudeCodeFab({ projectId }: ClaudeCodeFabProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className='fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50'
              size='icon'
              onClick={() => setIsOpen(true)}
            >
              <Bot className='h-6 w-6' />
            </Button>
          </TooltipTrigger>
          <TooltipContent side='left'>
            <p>Open Claude Code Assistant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ClaudeCodeModal isOpen={isOpen} onClose={() => setIsOpen(false)} projectId={projectId} />
    </>
  )
}
