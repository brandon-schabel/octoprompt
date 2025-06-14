import React, { useState } from 'react'
import { Bot, Play, Loader2, Settings, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ClaudeCodeAgent } from './claude-code-agent'
import { useExecuteClaudeCode } from '@/hooks/api/use-claude-code-api'

interface ClaudeCodeCardProps {
  projectPath?: string
  projectName?: string
  projectId?: number
  className?: string
}

export function ClaudeCodeCard({ projectPath, projectName, projectId, className }: ClaudeCodeCardProps) {
  const [prompt, setPrompt] = useState('')
  const [showFullAgent, setShowFullAgent] = useState(false)

  const executeMutation = useExecuteClaudeCode()

  const quickExecute = () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    executeMutation.mutate(
      {
        prompt,
        maxTurns: 3,
        projectPath,
        projectId,
        includeProjectContext: !!projectId,
        outputFormat: 'json'
      },
      {
        onSuccess: () => {
          setPrompt('')
        }
      }
    )
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <Bot className='h-4 w-4' />
              <CardTitle className='text-sm'>Claude Code Agent</CardTitle>
            </div>
            <div className='flex items-center space-x-1'>
              <Button variant='ghost' size='sm' onClick={() => setShowFullAgent(true)}>
                <ExternalLink className='h-3 w-3' />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {(projectPath || projectName) && (
            <Badge variant='outline' className='text-xs'>
              Project: {projectName || projectPath?.split('/').pop()}
            </Badge>
          )}

          <Textarea
            placeholder='Quick coding task...'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            disabled={executeMutation.isPending}
          />

          <div className='flex items-center justify-between'>
            <div className='text-xs text-muted-foreground'>Quick execution with 3 turns max</div>
            <Button onClick={quickExecute} disabled={executeMutation.isPending || !prompt.trim()} size='sm'>
              {executeMutation.isPending ? <Loader2 className='h-3 w-3 animate-spin' /> : <Play className='h-3 w-3' />}
              Execute
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showFullAgent} onOpenChange={setShowFullAgent}>
        <DialogContent className='max-w-7xl max-h-[90vh] overflow-hidden'>
          <DialogHeader>
            <DialogTitle>Claude Code Agent</DialogTitle>
          </DialogHeader>
          <div className='h-[80vh] overflow-hidden'>
            <ClaudeCodeAgent
              projectPath={projectPath}
              projectName={projectName}
              projectId={projectId}
              onSessionChange={(sessionId) => {
                // Handle session changes if needed
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
