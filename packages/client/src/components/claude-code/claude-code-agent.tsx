import React, { useState, useRef, useEffect } from 'react'
import {
  Bot,
  Play,
  Square,
  Settings,
  RotateCcw,
  Trash2,
  Terminal,
  FileText,
  Loader2,
  Send,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  useGetClaudeCodeSessions,
  useDeleteClaudeCodeSession,
  useContinueClaudeCodeSession,
  useClaudeCodeStream
} from '@/hooks/api/use-claude-code-api'
import { ClaudeCodeTemplates } from './claude-code-templates'

export interface ClaudeCodeSession {
  id: string
  created: number
  projectPath?: string
  status: 'idle' | 'running' | 'error'
  lastActivity: number
}

export interface ClaudeCodeMessage {
  type: 'user' | 'assistant' | 'system' | 'result'
  content?: string
  timestamp: number
  [key: string]: any
}

interface ClaudeCodeAgentProps {
  projectPath?: string
  initialPrompt?: string
  projectName?: string
  onSessionChange?: (sessionId: string | null) => void
  projectId?: number
  className?: string
}

export function ClaudeCodeAgent({
  projectPath,
  projectName,
  onSessionChange,
  initialPrompt,
  projectId,
  className
}: ClaudeCodeAgentProps) {
  const [prompt, setPrompt] = useState(initialPrompt || '')
  const [isRunning, setIsRunning] = useState(false)
  const [currentSession, setCurrentSession] = useState<ClaudeCodeSession | null>(null)
  const [messages, setMessages] = useState<ClaudeCodeMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Settings
  const [maxTurns, setMaxTurns] = useState(5)
  const [allowedTools, setAllowedTools] = useState<string[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [outputFormat, setOutputFormat] = useState<'text' | 'json' | 'stream-json'>('stream-json')
  const [showSettings, setShowSettings] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  // API hooks
  const { data: sessions = [], refetch: refetchSessions } = useGetClaudeCodeSessions()
  const deleteSessionMutation = useDeleteClaudeCodeSession()
  const continueSessionMutation = useContinueClaudeCodeSession()
  const { executeStream } = useClaudeCodeStream()

  // Common allowed tools for Claude Code
  const availableTools = [
    'Read',
    'Write',
    'Edit',
    'Bash',
    'Grep',
    'Glob',
    'LS',
    'Task',
    'TodoRead',
    'TodoWrite',
    'WebFetch',
    'WebSearch'
  ]

  useEffect(() => {
    onSessionChange?.(currentSession?.id || null)
  }, [currentSession, onSessionChange])

  const executeQuery = async (isStream = true) => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setIsRunning(true)
    setIsStreaming(isStream)
    setMessages((prev) => [
      ...prev,
      {
        type: 'user',
        content: prompt,
        timestamp: Date.now()
      }
    ])

    const requestBody = {
      prompt,
      sessionId: currentSession?.id,
      maxTurns,
      projectPath,
      projectId,
      allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
      systemPrompt: systemPrompt || undefined,
      outputFormat: isStream ? 'stream-json' : 'json'
    }

    try {
      if (isStream) {
        for await (const message of executeStream(
          {
            ...requestBody,
            outputFormat: 'stream-json' as const
          },
          handleStreamMessage
        )) {
          // Messages are handled in handleStreamMessage
        }
      } else {
        // For non-streaming, we'd use the execute mutation
        // This is simplified for now
        toast.info('Non-streaming execution not implemented yet')
      }
    } catch (error) {
      console.error('Query execution failed:', error)
      toast.error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        }
      ])
    } finally {
      setIsRunning(false)
      setIsStreaming(false)
      setPrompt('')
      refetchSessions()
    }
  }

  const handleStreamMessage = (message: any) => {
    const timestamp = Date.now()

    setMessages((prev) => [
      ...prev,
      {
        ...message,
        timestamp
      }
    ])

    // Update session info
    if (message.type === 'result') {
      const updatedSession: ClaudeCodeSession = {
        id: message.session_id,
        created: currentSession?.created || timestamp,
        projectPath,
        status: message.is_error ? 'error' : 'idle',
        lastActivity: timestamp
      }
      setCurrentSession(updatedSession)

      if (message.total_cost_usd) {
        toast.success(`Completed - Cost: $${message.total_cost_usd.toFixed(4)}`)
      }
    }

    if (message.type === 'system' && message.subtype === 'init') {
      const updatedSession: ClaudeCodeSession = {
        id: message.session_id,
        created: timestamp,
        projectPath,
        status: 'running',
        lastActivity: timestamp
      }
      setCurrentSession(updatedSession)
    }
  }

  const stopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsRunning(false)
    setIsStreaming(false)
  }

  const createNewSession = () => {
    setCurrentSession(null)
    setMessages([])
    toast.success('Started new session')
  }

  const deleteSession = async (sessionId: string) => {
    if (currentSession?.id === sessionId) {
      setCurrentSession(null)
      setMessages([])
    }
    deleteSessionMutation.mutate(sessionId)
  }

  const continueSession = async (sessionId: string) => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        type: 'user',
        content: prompt,
        timestamp: Date.now()
      }
    ])

    continueSessionMutation.mutate(
      { sessionId, prompt },
      {
        onSuccess: (result) => {
          if (result.messages) {
            result.messages.forEach((message: any) => handleStreamMessage(message))
          }
          setPrompt('')
        }
      }
    )
  }

  const toggleTool = (tool: string) => {
    setAllowedTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]))
  }

  const formatMessage = (message: ClaudeCodeMessage) => {
    if (message.type === 'user') {
      return { role: 'user', content: message.content || '', timestamp: message.timestamp }
    }
    if (message.type === 'assistant') {
      return {
        role: 'assistant',
        content: message.content || message.message?.content || '',
        timestamp: message.timestamp
      }
    }
    if (message.type === 'result') {
      return {
        role: 'system',
        content: `Result: ${message.result || 'Completed'} (${message.num_turns} turns, $${message.total_cost_usd?.toFixed(4) || '0.0000'})`,
        timestamp: message.timestamp
      }
    }
    return { role: 'system', content: JSON.stringify(message, null, 2), timestamp: message.timestamp }
  }

  return (
    <div className={`flex flex-col h-full max-w-6xl mx-auto p-4 space-y-4 ${className || ''}`}>
      {/* Header */}
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <Bot className='h-5 w-5' />
              <CardTitle>Claude Code Agent</CardTitle>
              {currentSession && (
                <Badge
                  variant={
                    currentSession.status === 'running'
                      ? 'default'
                      : currentSession.status === 'error'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {currentSession.status}
                </Badge>
              )}
              {projectName && (
                <Badge variant='outline' className='ml-2'>
                  {projectName}
                </Badge>
              )}
            </div>
            <div className='flex items-center space-x-2'>
              <Button variant='outline' size='sm' onClick={() => setShowSettings(!showSettings)}>
                <Settings className='h-4 w-4' />
              </Button>
              <Button variant='outline' size='sm' onClick={createNewSession}>
                <RotateCcw className='h-4 w-4' />
                New Session
              </Button>
            </div>
          </div>
        </CardHeader>

        {showSettings && (
          <CardContent className='pt-0'>
            <Collapsible>
              <CollapsibleContent className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='maxTurns'>Max Turns</Label>
                    <Input
                      id='maxTurns'
                      type='number'
                      min='1'
                      max='20'
                      value={maxTurns}
                      onChange={(e) => setMaxTurns(parseInt(e.target.value) || 5)}
                    />
                  </div>
                  <div>
                    <Label htmlFor='outputFormat'>Output Format</Label>
                    <Select value={outputFormat} onValueChange={(value: any) => setOutputFormat(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='stream-json'>Stream JSON</SelectItem>
                        <SelectItem value='json'>JSON</SelectItem>
                        <SelectItem value='text'>Text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor='systemPrompt'>System Prompt (Optional)</Label>
                  <Textarea
                    id='systemPrompt'
                    placeholder='Additional system instructions...'
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Allowed Tools</Label>
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {availableTools.map((tool) => (
                      <div key={tool} className='flex items-center space-x-2'>
                        <Switch
                          id={`tool-${tool}`}
                          checked={allowedTools.includes(tool)}
                          onCheckedChange={() => toggleTool(tool)}
                        />
                        <Label htmlFor={`tool-${tool}`} className='text-sm'>
                          {tool}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {projectId && (
                  <div className='flex items-center space-x-2 mt-4'>
                    <Switch
                      id='includeProjectContext'
                      checked={includeProjectContext}
                      onCheckedChange={setIncludeProjectContext}
                    />
                    <Label htmlFor='includeProjectContext'>Include project file summaries in context</Label>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        )}
      </Card>

      {/* Messages Area */}
      <Card className='flex-1'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>Conversation</CardTitle>
        </CardHeader>
        <CardContent className='h-96'>
          <ScrollArea className='h-full'>
            <div className='space-y-3'>
              {messages.length === 0 ? (
                <div className='text-center text-muted-foreground py-8'>
                  <Terminal className='h-12 w-12 mx-auto mb-4 opacity-50' />
                  <p>Start a conversation with Claude Code</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const formatted = formatMessage(message)
                  return (
                    <div key={index} className={`flex ${formatted.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          formatted.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : formatted.role === 'assistant'
                              ? 'bg-muted'
                              : 'bg-yellow-50 border border-yellow-200'
                        }`}
                      >
                        <div className='text-sm'>
                          {formatted.role === 'system' ? (
                            <code className='whitespace-pre-wrap'>{formatted.content}</code>
                          ) : (
                            <div className='whitespace-pre-wrap'>{formatted.content}</div>
                          )}
                        </div>
                        <div className='text-xs opacity-70 mt-1'>
                          {new Date(formatted.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {isStreaming && (
                <div className='flex justify-start'>
                  <div className='bg-muted p-3 rounded-lg'>
                    <div className='flex items-center space-x-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      <span className='text-sm'>Claude is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Input Area */}
      <Card>
        <CardContent className='pt-6'>
          <div className='space-y-3'>
            <Textarea
              placeholder='Enter your coding task or question...'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={isRunning}
            />
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <Button variant='outline' size='sm' onClick={() => setShowTemplates(true)} disabled={isRunning}>
                  <Sparkles className='h-4 w-4 mr-1' />
                  Templates
                </Button>
                {projectPath && (
                  <Badge variant='outline'>
                    <FileText className='h-3 w-3 mr-1' />
                    {projectPath.split('/').pop()}
                  </Badge>
                )}
                {currentSession && <Badge variant='secondary'>Session: {currentSession.id.slice(0, 8)}...</Badge>}
              </div>
              <div className='flex items-center space-x-2'>
                {isRunning && (
                  <Button variant='outline' size='sm' onClick={stopExecution}>
                    <Square className='h-4 w-4' />
                    Stop
                  </Button>
                )}
                <Button onClick={() => executeQuery(true)} disabled={isRunning || !prompt.trim()} size='sm'>
                  {isRunning ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                  Execute
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm'>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} className='flex items-center justify-between p-2 border rounded'>
                  <div className='flex items-center space-x-2'>
                    <Badge
                      variant={
                        session.status === 'running'
                          ? 'default'
                          : session.status === 'error'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {session.status}
                    </Badge>
                    <span className='text-sm font-mono'>{session.id.slice(0, 8)}...</span>
                    <span className='text-xs text-muted-foreground'>
                      {new Date(session.lastActivity).toLocaleString()}
                    </span>
                  </div>
                  <div className='flex items-center space-x-1'>
                    {currentSession?.id !== session.id && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => continueSession(session.id)}
                        disabled={isRunning || !prompt.trim()}
                      >
                        <Play className='h-3 w-3' />
                      </Button>
                    )}
                    <Button variant='ghost' size='sm' onClick={() => deleteSession(session.id)}>
                      <Trash2 className='h-3 w-3' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Dialog */}
      <ClaudeCodeTemplates
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={(templatePrompt) => {
          setPrompt(templatePrompt)
          setShowTemplates(false)
        }}
      />
    </div>
  )
}
