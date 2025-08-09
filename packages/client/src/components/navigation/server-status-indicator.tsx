import { useServerConnection } from '@/hooks/use-server-connection'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  Badge
} from '@promptliano/ui'
import { CheckCircle, XCircle, AlertCircle, Loader2, Server, RefreshCw, Settings } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export function ServerStatusIndicator() {
  const {
    serverUrl,
    connectionStatus,
    connectionError,
    isConnected,
    isConnecting,
    hasError,
    savedServers,
    setServerUrl,
    reconnect
  } = useServerConnection()

  const navigate = useNavigate()

  const getStatusIcon = () => {
    if (isConnecting) return <Loader2 className='h-4 w-4 animate-spin' />
    if (isConnected) return <CheckCircle className='h-4 w-4 text-green-500' />
    if (hasError) return <XCircle className='h-4 w-4 text-red-500' />
    return <AlertCircle className='h-4 w-4 text-yellow-500' />
  }

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...'
    if (isConnected) return 'Connected'
    if (hasError) return 'Error'
    return 'Disconnected'
  }

  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500'
    if (hasError) return 'bg-red-500'
    if (isConnecting) return 'bg-yellow-500'
    return 'bg-gray-500'
  }

  const extractHostname = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname === 'localhost' ? `localhost:${urlObj.port}` : urlObj.host
    } catch {
      return url
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='sm' className='h-9 px-3'>
          <div className='flex items-center gap-2'>
            <Server className='h-4 w-4' />
            <span className='text-xs hidden sm:inline'>{extractHostname(serverUrl)}</span>
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-72'>
        <DropdownMenuLabel>Server Connection</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Connection Status */}
        <div className='px-2 py-3'>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              {getStatusIcon()}
              <span className='text-sm font-medium'>{getStatusText()}</span>
            </div>
            <Button onClick={reconnect} variant='ghost' size='sm' className='h-7 px-2' disabled={isConnecting}>
              <RefreshCw className='h-3 w-3' />
            </Button>
          </div>

          <div className='space-y-1'>
            <p className='text-xs text-muted-foreground truncate'>{serverUrl}</p>
            {connectionError && <p className='text-xs text-red-500'>{connectionError}</p>}
          </div>
        </div>

        {/* Quick Server Switch */}
        {savedServers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className='text-xs'>Quick Switch</DropdownMenuLabel>
            {savedServers.map((server) => (
              <DropdownMenuItem
                key={server.url}
                onClick={() => setServerUrl(server.url)}
                disabled={server.url === serverUrl}
                className='flex items-center justify-between'
              >
                <span className='text-sm'>{server.name}</span>
                {server.url === serverUrl && (
                  <Badge variant='secondary' className='text-xs h-5'>
                    Active
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Settings Link */}
        <DropdownMenuItem
          onClick={() => navigate({ to: '/settings', search: { tab: 'server' } })}
          className='flex items-center gap-2'
        >
          <Settings className='h-4 w-4' />
          <span>Server Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
