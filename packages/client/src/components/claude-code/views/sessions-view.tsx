import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyableInline, CopyableBlock } from '@/components/ui/copyable-text'
import { TokenBadge } from '@/components/ui/token-usage-tooltip'
import { Search, MessageSquare, Clock, GitBranch, FolderOpen, RefreshCw, ChevronRight, Terminal } from 'lucide-react'
import { useClaudeSessions, useSessionDuration } from '@/hooks/api/use-claude-code-api'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface SessionsViewProps {
  projectId: number
  projectName?: string
  onSelectSession?: (sessionId: string) => void
}

interface SessionCardProps {
  session: {
    sessionId: string
    projectPath: string
    startTime: string
    lastUpdate: string
    messageCount: number
    gitBranch?: string
    cwd?: string
    totalTokensUsed?: number
    totalCostUsd?: number
  }
  isSelected: boolean
  onClick: () => void
}

function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  const duration = useSessionDuration(session.startTime, session.lastUpdate)

  return (
    <Card
      className={cn('cursor-pointer transition-all hover:shadow-md', isSelected && 'ring-2 ring-primary')}
      onClick={onClick}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='space-y-1 flex-1'>
            <CardTitle className='text-base flex items-center gap-2'>
              <MessageSquare className='h-4 w-4' />
              <CopyableInline text={session.sessionId} className='font-mono text-sm'>
                {session.sessionId}
              </CopyableInline>
            </CardTitle>
            <CardDescription className='text-xs'>
              {format(new Date(session.startTime), 'MMM d, yyyy h:mm a')}
            </CardDescription>
          </div>
          <ChevronRight className='h-4 w-4 text-muted-foreground' />
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex items-center gap-4 text-sm'>
          <div className='flex items-center gap-1'>
            <Clock className='h-3 w-3 text-muted-foreground' />
            <span>{duration}</span>
          </div>
          <div className='flex items-center gap-1'>
            <MessageSquare className='h-3 w-3 text-muted-foreground' />
            <span>{session.messageCount} messages</span>
          </div>
        </div>

        {session.gitBranch && (
          <div className='flex items-center gap-2'>
            <GitBranch className='h-3 w-3 text-muted-foreground' />
            <CopyableInline text={session.gitBranch} className='text-sm font-mono'>
              {session.gitBranch}
            </CopyableInline>
          </div>
        )}

        {session.cwd && (
          <div className='flex items-start gap-2'>
            <FolderOpen className='h-3 w-3 text-muted-foreground mt-0.5' />
            <CopyableInline text={session.cwd} className='text-sm font-mono break-all' truncate maxLength={50}>
              {session.cwd}
            </CopyableInline>
          </div>
        )}

        {/* Token usage with detailed breakdown */}
        <div className='flex items-center gap-3 flex-wrap'>
          {session.tokenUsage && <TokenBadge tokenUsage={session.tokenUsage} className='text-xs' />}

          {/* Legacy token display */}
          {!session.tokenUsage && session.totalTokensUsed && (
            <Badge variant='outline' className='text-xs'>
              {session.totalTokensUsed.toLocaleString()} tokens
            </Badge>
          )}

          {session.totalCostUsd && (
            <span className='text-xs text-muted-foreground'>${session.totalCostUsd.toFixed(4)}</span>
          )}

          {/* Service tiers */}
          {session.serviceTiers && session.serviceTiers.length > 0 && (
            <Badge variant='secondary' className='text-xs'>
              {session.serviceTiers[0]}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function SessionsView({ projectId, projectName, onSelectSession }: SessionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const {
    data: sessions,
    isLoading,
    error,
    refetch
  } = useClaudeSessions(projectId, {
    search: searchQuery || undefined
  })

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    if (onSelectSession) {
      onSelectSession(sessionId)
    }
  }

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading) {
    return (
      <div className='p-6 space-y-4'>
        <Skeleton className='h-10 w-full' />
        <div className='space-y-3'>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className='h-32 w-full' />
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
            <h3 className='text-lg font-semibold mb-2'>Failed to load sessions</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
            <Button onClick={handleRefresh} variant='outline' size='sm'>
              <RefreshCw className='h-4 w-4 mr-2' />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasNoSessions = !sessions || sessions.length === 0

  return (
    <div className='p-6 space-y-6'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Claude Code Sessions</h2>
            <p className='text-muted-foreground'>Browse your chat history from Claude Code</p>
          </div>
          <Button variant='outline' size='sm' onClick={handleRefresh}>
            <RefreshCw className='h-4 w-4 mr-2' />
            Refresh
          </Button>
        </div>

        {!hasNoSessions && (
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search sessions by ID, branch, or path...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>
        )}
      </div>

      {hasNoSessions ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <Terminal className='h-16 w-16 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Claude Code sessions found</h3>
            <p className='text-sm text-muted-foreground max-w-sm'>
              Start a conversation with Claude Code in this project to see your chat history here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className='h-[calc(100vh-250px)]'>
          <div className='grid gap-4 pr-4'>
            {sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                isSelected={session.sessionId === selectedSessionId}
                onClick={() => handleSessionClick(session.sessionId)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
