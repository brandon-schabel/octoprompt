import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, RefreshCw, Clock, User } from 'lucide-react'
import { toast } from 'sonner'
import { useGetMCPSessions, useCloseMCPSession } from '@/hooks/api/use-mcp-api'

interface MCPSessionManagerProps {
  onSessionSelect?: (sessionId: string) => void
  selectedSessionId?: string
}

export function MCPSessionManager({ onSessionSelect, selectedSessionId }: MCPSessionManagerProps) {
  const { data: sessionsData, refetch, isLoading } = useGetMCPSessions()
  const closeMCPSession = useCloseMCPSession()

  const sessions = sessionsData?.data || []

  const handleCloseSession = async (sessionId: string) => {
    try {
      await closeMCPSession.mutateAsync(sessionId)
      toast.success('Session closed')

      // If this was the selected session, clear selection
      if (selectedSessionId === sessionId && onSessionSelect) {
        onSessionSelect('')
      }
    } catch (error) {
      toast.error('Failed to close session')
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const getTimeSince = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`
    } else {
      return `${minutes}m ago`
    }
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <h3 className='font-medium'>Active Sessions</h3>
          <Badge variant='secondary'>{sessions.length}</Badge>
        </div>
        <Button
          size='sm'
          variant='outline'
          onClick={() => refetch()}
          disabled={isLoading}
          className='flex items-center gap-2'
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className='pt-6 text-center text-gray-500'>
            <User className='h-8 w-8 mx-auto mb-2 opacity-50' />
            <p>No active MCP sessions</p>
            <p className='text-xs mt-1'>Sessions will appear here after initialization</p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-2'>
          {sessions.map((session) => (
            <Card
              key={session.id}
              className={`cursor-pointer transition-colors ${
                selectedSessionId === session.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => onSessionSelect?.(session.id)}
            >
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-2'>
                      <code className='text-sm font-mono bg-gray-100 px-2 py-1 rounded'>{session.id}</code>
                      {session.projectId && (
                        <Badge variant='outline' className='text-xs'>
                          Project {session.projectId}
                        </Badge>
                      )}
                    </div>

                    <div className='space-y-1 text-xs text-gray-600'>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        <span>Created: {formatTimestamp(session.createdAt)}</span>
                      </div>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        <span>Last activity: {getTimeSince(session.lastActivity)}</span>
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center gap-2'>
                    {selectedSessionId === session.id && (
                      <Badge variant='default' className='text-xs'>
                        Selected
                      </Badge>
                    )}
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseSession(session.id)
                      }}
                      disabled={closeMCPSession.isPending}
                      className='h-8 w-8 p-0'
                    >
                      <Trash2 className='h-3 w-3' />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Session Info */}
      {selectedSessionId && (
        <Card className='bg-blue-50 border-blue-200'>
          <CardContent className='pt-4'>
            <h4 className='font-medium mb-2'>Selected Session</h4>
            <p className='text-sm text-gray-600'>
              This session ID will be used for subsequent method calls that require session context.
            </p>
            <code className='block mt-2 text-xs bg-white p-2 rounded border'>Mcp-Session-Id: {selectedSessionId}</code>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
