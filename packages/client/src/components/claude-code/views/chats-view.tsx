import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyableInline, CopyableBlock, CopyableCode } from '@/components/ui/copyable-text'
import { TokenBadge } from '@/components/ui/token-usage-tooltip'
import {
  ArrowLeft,
  MessageSquare,
  User,
  Bot,
  GitBranch,
  FolderOpen,
  Clock,
  Copy,
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Link2,
  Hash,
  MessageCircle
} from 'lucide-react'
import {
  useClaudeMessages,
  useClaudeSessions,
  useFormatClaudeMessage,
  useSessionDuration
} from '@/hooks/api/use-claude-code-api'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { ClaudeMessage } from '@promptliano/schemas'
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useMutation } from '@tanstack/react-query'
import { promptlianoClient } from '@/hooks/promptliano-client'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'

interface ChatsViewProps {
  projectId: number
  projectName?: string
  sessionId?: string
  onBack?: () => void
}

interface MessageBubbleProps {
  message: ClaudeMessage
  isLast: boolean
  onJumpToMessage?: (uuid: string) => void
  allMessages?: ClaudeMessage[]
}

function MessageBubble({ message, isLast, onJumpToMessage, allMessages }: MessageBubbleProps) {
  const formatMessage = useFormatClaudeMessage()
  const content = formatMessage(message.message.content)
  const isUser = message.message.role === 'user'
  const messageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isLast && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [isLast])

  return (
    <div
      ref={messageRef}
      id={message.uuid}
      className={cn('flex gap-3 mb-6 transition-all duration-300', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('flex gap-3 max-w-[80%]', isUser && 'flex-row-reverse')}>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          {isUser ? <User className='h-4 w-4' /> : <Bot className='h-4 w-4' />}
        </div>

        <div className='flex flex-col gap-2'>
          <div className={cn('rounded-lg px-4 py-3', isUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
            {isUser ? (
              <div className='whitespace-pre-wrap break-words'>{content}</div>
            ) : (
              <div className='prose prose-sm dark:prose-invert max-w-none'>
                <Markdown
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const inline = !match
                      const lang = match ? match[1] : ''
                      const text = String(children).replace(/\n$/, '')

                      if (inline) {
                        return (
                          <code className='px-1 py-0.5 rounded bg-muted text-sm font-mono' {...props}>
                            {children}
                          </code>
                        )
                      }

                      return (
                        <div className='relative group my-2'>
                          <CopyableCode text={text} showIcon={true}>
                            <SyntaxHighlighter
                              style={oneDark}
                              language={lang}
                              PreTag='div'
                              customStyle={{
                                margin: 0,
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem'
                              }}
                            >
                              {text}
                            </SyntaxHighlighter>
                          </CopyableCode>
                        </div>
                      )
                    }
                  }}
                >
                  {content}
                </Markdown>
              </div>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <div className='flex items-center gap-3 text-xs text-muted-foreground flex-wrap'>
              <div className='flex items-center gap-1'>
                <Clock className='h-3 w-3' />
                <span>{format(new Date(message.timestamp), 'h:mm a')}</span>
              </div>

              {message.uuid && (
                <CopyableInline text={message.uuid} className='font-mono'>
                  <Hash className='h-3 w-3 inline mr-1' />
                  {message.uuid}
                </CopyableInline>
              )}

              {message.parentUuid && onJumpToMessage && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-5 px-2 text-xs gap-1'
                  onClick={() => onJumpToMessage(message.parentUuid!)}
                >
                  <Link2 className='h-3 w-3' />
                  Parent
                </Button>
              )}

              {message.cwd && (
                <CopyableInline text={message.cwd} className='font-mono' truncate maxLength={30}>
                  <FolderOpen className='h-3 w-3 inline mr-1' />
                  {message.cwd}
                </CopyableInline>
              )}

              {message.gitBranch && (
                <CopyableInline text={message.gitBranch} className='font-mono'>
                  <GitBranch className='h-3 w-3 inline mr-1' />
                  {message.gitBranch}
                </CopyableInline>
              )}

              {/* Token usage from message.usage */}
              {message.message.usage && <TokenBadge tokenUsage={message.message.usage} />}

              {/* Legacy token display */}
              {!message.message.usage && message.tokensUsed && (
                <span>{message.tokensUsed.toLocaleString()} tokens</span>
              )}

              {message.costUsd && <span>${message.costUsd.toFixed(4)}</span>}

              {message.userType && (
                <Badge variant='outline' className='text-xs py-0 px-1'>
                  {message.userType}
                </Badge>
              )}

              {message.isSidechain && (
                <Badge variant='secondary' className='text-xs py-0 px-1'>
                  Sidechain
                </Badge>
              )}

              {message.message.usage?.service_tier && (
                <Badge variant='outline' className='text-xs py-0 px-1'>
                  {message.message.usage.service_tier}
                </Badge>
              )}
            </div>

            {/* Show todo changes if present */}
            {message.toolUseResult && (message.toolUseResult.oldTodos || message.toolUseResult.newTodos) && (
              <div className='mt-2 p-2 bg-muted/50 rounded text-xs'>
                <span className='font-semibold'>Todo Changes</span>
                {/* TODO: Create TodoChangeDisplay component */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChatsView({ projectId, projectName, sessionId, onBack }: ChatsViewProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<{ [key: string]: HTMLDivElement }>({})
  const navigate = useNavigate()

  const { data: sessions } = useClaudeSessions(projectId)
  const currentSession = sessions?.find((s) => s.sessionId === sessionId)

  const {
    data: messages,
    isLoading,
    error,
    refetch
  } = useClaudeMessages(projectId, sessionId || undefined, undefined, {
    enabled: !!sessionId,
    refetchInterval: 5000 // Poll every 5 seconds for new messages
  })

  const handleBack = () => {
    if (onBack) {
      onBack()
    }
  }

  const handleJumpToMessage = (uuid: string) => {
    const messageElement = messageRefs.current[uuid]
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Add highlight effect
      messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
      }, 2000)
    }
  }

  // Import session mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No session ID')
      const response = await promptlianoClient.claudeCode.importSession(projectId, sessionId)
      return response.data
    },
    onSuccess: (chat) => {
      toast.success('Session imported to chat')
      // Navigate to the new chat
      navigate({ to: '/chat', search: { chatId: chat.id } })
    },
    onError: (error) => {
      toast.error(`Failed to import session: ${error.message}`)
    }
  })

  if (!sessionId) {
    return (
      <div className='p-6'>
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <MessageSquare className='h-16 w-16 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No session selected</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              Select a session from the sessions view to see the chat messages.
            </p>
            <Button onClick={handleBack}>
              <ArrowLeft className='h-4 w-4 mr-2' />
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='p-6 space-y-4'>
        <Skeleton className='h-20 w-full' />
        <div className='space-y-4'>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn('flex gap-3', i % 2 === 0 ? 'justify-end' : 'justify-start')}>
              <Skeleton className='h-24 w-[60%]' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-6'>
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Terminal className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>Failed to load messages</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
            <div className='flex gap-2'>
              <Button onClick={handleBack} variant='outline' size='sm'>
                <ArrowLeft className='h-4 w-4 mr-2' />
                Back
              </Button>
              <Button onClick={() => refetch()} variant='outline' size='sm'>
                <RefreshCw className='h-4 w-4 mr-2' />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasNoMessages = !messages || messages.length === 0
  const sessionDuration = currentSession
    ? useSessionDuration(currentSession.startTime, currentSession.lastUpdate)
    : null

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='p-6 pb-4 border-b'>
        <div className='flex items-center justify-between mb-4'>
          <Button variant='ghost' size='sm' onClick={handleBack} className='gap-2'>
            <ArrowLeft className='h-4 w-4' />
            Sessions
          </Button>

          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !messages || messages.length === 0}
            >
              <MessageCircle className='h-4 w-4 mr-2' />
              {importMutation.isPending ? 'Importing...' : 'Import to Chat'}
            </Button>

            <Button variant='outline' size='sm' onClick={() => refetch()}>
              <RefreshCw className='h-4 w-4 mr-2' />
              Refresh
            </Button>
          </div>
        </div>

        {currentSession && (
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <h2 className='text-xl font-semibold'>Chat Session</h2>
              <CopyableInline text={currentSession.sessionId} className='font-mono text-sm'>
                {currentSession.sessionId}...
              </CopyableInline>
            </div>

            <div className='flex items-center gap-4 text-sm text-muted-foreground flex-wrap'>
              <span>{format(new Date(currentSession.startTime), 'MMM d, yyyy h:mm a')}</span>
              {sessionDuration && <span>• {sessionDuration}</span>}
              <span>• {currentSession.messageCount} messages</span>

              {/* Token usage with tooltip */}
              {currentSession.tokenUsage && (
                <>
                  <span>•</span>
                  <TokenBadge tokenUsage={currentSession.tokenUsage} />
                </>
              )}

              {/* Legacy tokens */}
              {!currentSession.tokenUsage && currentSession.totalTokensUsed && (
                <span>• {currentSession.totalTokensUsed.toLocaleString()} tokens</span>
              )}

              {currentSession.totalCostUsd && <span>• ${currentSession.totalCostUsd.toFixed(4)}</span>}

              {/* Service tiers */}
              {currentSession.serviceTiers && currentSession.serviceTiers.length > 0 && (
                <>
                  <span>•</span>
                  <Badge variant='secondary' className='text-xs'>
                    {currentSession.serviceTiers.join(', ')}
                  </Badge>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {hasNoMessages ? (
        <div className='flex-1 flex items-center justify-center p-6'>
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
              <MessageSquare className='h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold mb-2'>No messages in this session</h3>
              <p className='text-sm text-muted-foreground'>This session appears to be empty.</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <ScrollArea className='flex-1 p-6' ref={scrollAreaRef}>
          <div className='max-w-4xl mx-auto'>
            {messages.map((message, index) => (
              <div
                key={`${message.sessionId}-${message.timestamp}-${index}`}
                ref={(el) => {
                  if (el && message.uuid) {
                    messageRefs.current[message.uuid] = el
                  }
                }}
              >
                <MessageBubble
                  message={message}
                  isLast={index === messages.length - 1}
                  onJumpToMessage={handleJumpToMessage}
                  allMessages={messages}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
