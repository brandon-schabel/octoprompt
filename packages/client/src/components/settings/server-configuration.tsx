import { useState } from 'react'
import { useServerConnection } from '@/hooks/use-server-connection'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Alert,
  AlertDescription,
  Separator
} from '@promptliano/ui'
import { Loader2, CheckCircle, XCircle, AlertCircle, Plus, Trash2, RefreshCw } from 'lucide-react'

export function ServerConfiguration() {
  const {
    serverUrl,
    setServerUrl,
    connectionStatus,
    connectionError,
    isConnected,
    isConnecting,
    hasError,
    testConnection,
    savedServers,
    addSavedServer,
    removeSavedServer,
    reconnect
  } = useServerConnection()

  const [urlInput, setUrlInput] = useState(serverUrl)
  const [serverName, setServerName] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      const isValid = await testConnection(urlInput)
      setTestResult({
        success: isValid,
        message: isValid ? 'Connection successful!' : 'Failed to connect to server'
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleApplyUrl = async () => {
    if (urlInput !== serverUrl) {
      await setServerUrl(urlInput)
    }
  }

  const handleSaveServer = () => {
    if (serverName && urlInput) {
      addSavedServer({
        name: serverName,
        url: urlInput,
        isDefault: false
      })
      setServerName('')
    }
  }

  const handleSelectSavedServer = async (url: string) => {
    setUrlInput(url)
    await setServerUrl(url)
  }

  const getStatusIcon = () => {
    if (isConnecting) return <Loader2 className='h-4 w-4 animate-spin' />
    if (isConnected) return <CheckCircle className='h-4 w-4 text-green-500' />
    if (hasError) return <XCircle className='h-4 w-4 text-red-500' />
    return <AlertCircle className='h-4 w-4 text-yellow-500' />
  }

  const getStatusColor = () => {
    if (isConnected) return 'text-green-500'
    if (hasError) return 'text-red-500'
    if (isConnecting) return 'text-yellow-500'
    return 'text-gray-500'
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Server Connection</CardTitle>
          <CardDescription>
            Configure the Promptliano server URL to connect to. You can use a local server or connect to a remote
            instance.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Current Connection Status */}
          <div className='flex items-center justify-between p-4 bg-muted rounded-lg'>
            <div className='flex items-center gap-3'>
              {getStatusIcon()}
              <div>
                <p className='text-sm font-medium'>Connection Status</p>
                <p className={`text-sm ${getStatusColor()}`}>
                  {isConnecting && 'Connecting...'}
                  {isConnected && `Connected to ${serverUrl}`}
                  {hasError && 'Connection Error'}
                  {!isConnecting && !isConnected && !hasError && 'Disconnected'}
                </p>
                {connectionError && <p className='text-xs text-red-500 mt-1'>{connectionError}</p>}
              </div>
            </div>
            <Button onClick={reconnect} variant='outline' size='sm' disabled={isConnecting}>
              <RefreshCw className='h-4 w-4 mr-2' />
              Reconnect
            </Button>
          </div>

          <Separator />

          {/* Server URL Configuration */}
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='server-url'>Server URL</Label>
              <div className='flex gap-2'>
                <Input
                  id='server-url'
                  type='url'
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder='http://localhost:3147'
                  className='flex-1'
                />
                <Button onClick={handleTestConnection} variant='outline' disabled={isTesting || !urlInput}>
                  {isTesting ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Test'}
                </Button>
                <Button onClick={handleApplyUrl} disabled={urlInput === serverUrl || !urlInput}>
                  Apply
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                Default: http://localhost:3147 | Examples: http://192.168.1.100:3147, https://api.promptliano.com
              </p>
            </div>

            {/* Test Result */}
            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                <AlertDescription className='flex items-center gap-2'>
                  {testResult.success ? <CheckCircle className='h-4 w-4' /> : <XCircle className='h-4 w-4' />}
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Saved Servers */}
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <Label>Saved Servers</Label>
              <Button onClick={handleSaveServer} variant='outline' size='sm' disabled={!serverName || !urlInput}>
                <Plus className='h-4 w-4 mr-2' />
                Save Current
              </Button>
            </div>

            {savedServers.length > 0 ? (
              <div className='space-y-2'>
                {savedServers.map((server) => (
                  <div
                    key={server.url}
                    className='flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors'
                  >
                    <div className='flex items-center gap-3'>
                      <div>
                        <p className='text-sm font-medium'>{server.name}</p>
                        <p className='text-xs text-muted-foreground'>{server.url}</p>
                      </div>
                      {server.url === serverUrl && (
                        <Badge variant='secondary' className='text-xs'>
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        onClick={() => handleSelectSavedServer(server.url)}
                        variant='ghost'
                        size='sm'
                        disabled={server.url === serverUrl}
                      >
                        Connect
                      </Button>
                      <Button onClick={() => removeSavedServer(server.url)} variant='ghost' size='sm'>
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-4 text-sm text-muted-foreground'>
                No saved servers. Add a server by entering a URL and name above.
              </div>
            )}

            {/* Add New Server */}
            {savedServers.length > 0 && (
              <div className='flex gap-2'>
                <Input
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder='Server name (e.g., Production)'
                  className='flex-1'
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
