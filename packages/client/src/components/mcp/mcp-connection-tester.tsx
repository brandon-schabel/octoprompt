import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useTestMCPConnection, useTestMCPInitialize, useGetMCPTestData } from '@/hooks/api/use-mcp-api'

interface MCPConnectionTesterProps {
  projectId: number
  onSessionCreated?: (sessionId: string) => void
}

export function MCPConnectionTester({ projectId, onSessionCreated }: MCPConnectionTesterProps) {
  const [url, setUrl] = useState('')
  const [connectionResult, setConnectionResult] = useState<any>(null)
  const [initializeResult, setInitializeResult] = useState<any>(null)

  const { data: testData } = useGetMCPTestData(projectId)
  const testConnection = useTestMCPConnection(projectId)
  const testInitialize = useTestMCPInitialize(projectId)

  // Pre-fill URL with project-specific endpoint
  useEffect(() => {
    if (testData?.data?.mcpEndpoints?.projectSpecific) {
      setUrl(testData.data.mcpEndpoints.projectSpecific)
    }
  }, [testData])

  const handleTestConnection = async () => {
    if (!url) {
      toast.error('Please enter a URL')
      return
    }

    try {
      const result = await testConnection.mutateAsync(url)
      setConnectionResult(result.data)

      if (result.data.connected) {
        toast.success(`Connected! Response time: ${result.data.responseTime}ms`)
      } else {
        toast.error(`Connection failed: ${result.data.error}`)
      }
    } catch (error) {
      toast.error('Connection test failed')
      setConnectionResult({ connected: false, error: 'Request failed' })
    }
  }

  const handleTestInitialize = async () => {
    if (!url) {
      toast.error('Please enter a URL')
      return
    }

    try {
      const result = await testInitialize.mutateAsync(url)
      setInitializeResult(result.data)

      if (result.data.initialized) {
        toast.success('Initialization successful!')
        if (result.data.sessionId && onSessionCreated) {
          onSessionCreated(result.data.sessionId)
        }
      } else {
        toast.error(`Initialization failed: ${result.data.error}`)
      }
    } catch (error) {
      toast.error('Initialize test failed')
      setInitializeResult({ initialized: false, error: 'Request failed' })
    }
  }

  const getStatusIcon = (connected: boolean) => {
    return connected ? <CheckCircle className='h-4 w-4 text-green-500' /> : <XCircle className='h-4 w-4 text-red-500' />
  }

  return (
    <div className='space-y-4'>
      {/* URL Input */}
      <div className='space-y-2'>
        <Label htmlFor='mcp-url'>MCP Server URL</Label>
        <div className='flex gap-2'>
          <Input
            id='mcp-url'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='http://localhost:3147/api/projects/1/mcp'
            className='flex-1'
          />
          {testData?.data?.mcpEndpoints && (
            <div className='flex gap-1'>
              <Button size='sm' variant='outline' onClick={() => setUrl(testData.data.mcpEndpoints.main)}>
                Main
              </Button>
              <Button size='sm' variant='outline' onClick={() => setUrl(testData.data.mcpEndpoints.projectSpecific)}>
                Project
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Test Buttons */}
      <div className='flex gap-2'>
        <Button
          onClick={handleTestConnection}
          disabled={testConnection.isPending || !url}
          className='flex items-center gap-2'
        >
          {testConnection.isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Zap className='h-4 w-4' />}
          Test Connection
        </Button>

        <Button
          onClick={handleTestInitialize}
          disabled={testInitialize.isPending || !url}
          variant='outline'
          className='flex items-center gap-2'
        >
          {testInitialize.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <CheckCircle className='h-4 w-4' />
          )}
          Test Initialize
        </Button>
      </div>

      {/* Connection Result */}
      {connectionResult && (
        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center justify-between mb-2'>
              <h4 className='font-medium flex items-center gap-2'>
                {getStatusIcon(connectionResult.connected)}
                Connection Test Result
              </h4>
              <Badge variant={connectionResult.connected ? 'default' : 'destructive'}>
                {connectionResult.connected ? 'Connected' : 'Failed'}
              </Badge>
            </div>

            <div className='space-y-2 text-sm'>
              <div className='flex items-center gap-2'>
                <Clock className='h-3 w-3' />
                <span>Response Time: {connectionResult.responseTime}ms</span>
              </div>

              {connectionResult.error && (
                <div className='text-red-600'>
                  <strong>Error:</strong> {connectionResult.error}
                </div>
              )}

              {connectionResult.serverInfo && (
                <div>
                  <strong>Server Info:</strong>
                  <pre className='mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto'>
                    {JSON.stringify(connectionResult.serverInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initialize Result */}
      {initializeResult && (
        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center justify-between mb-2'>
              <h4 className='font-medium flex items-center gap-2'>
                {getStatusIcon(initializeResult.initialized)}
                Initialize Test Result
              </h4>
              <Badge variant={initializeResult.initialized ? 'default' : 'destructive'}>
                {initializeResult.initialized ? 'Initialized' : 'Failed'}
              </Badge>
            </div>

            <div className='space-y-2 text-sm'>
              {initializeResult.sessionId && (
                <div>
                  <strong>Session ID:</strong>
                  <code className='ml-1 px-1 bg-gray-100 rounded'>{initializeResult.sessionId}</code>
                </div>
              )}

              {initializeResult.error && (
                <div className='text-red-600'>
                  <strong>Error:</strong> {initializeResult.error}
                </div>
              )}

              {initializeResult.capabilities && (
                <div>
                  <strong>Server Capabilities:</strong>
                  <pre className='mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto'>
                    {JSON.stringify(initializeResult.capabilities, null, 2)}
                  </pre>
                </div>
              )}

              {initializeResult.serverInfo && (
                <div>
                  <strong>Server Info:</strong>
                  <pre className='mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto'>
                    {JSON.stringify(initializeResult.serverInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
