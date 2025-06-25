import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wifi, Code, Users, TestTube } from 'lucide-react'
import { MCPConnectionTester } from './mcp-connection-tester'
import { MCPMethodTester } from './mcp-method-tester'
import { MCPSessionManager } from './mcp-session-manager'
import { MCPTestScenarios } from './mcp-test-scenarios'

interface MCPTestingPanelProps {
  projectId: number
}

export function MCPTestingPanel({ projectId }: MCPTestingPanelProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()

  return (
    <div className='h-full flex flex-col'>
      <div className='mb-4'>
        <h2 className='text-lg font-semibold mb-2'>MCP Protocol Testing</h2>
        <p className='text-sm text-gray-600'>
          Test the OctoPrompt MCP server implementation with real JSON-RPC requests. Use this to validate protocol
          compliance and debug MCP connections.
        </p>
      </div>

      <Tabs defaultValue='connection' className='flex-1 flex flex-col'>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='connection' className='flex items-center gap-2'>
            <Wifi className='h-4 w-4' />
            Connection
          </TabsTrigger>
          <TabsTrigger value='methods' className='flex items-center gap-2'>
            <Code className='h-4 w-4' />
            Methods
          </TabsTrigger>
          <TabsTrigger value='sessions' className='flex items-center gap-2'>
            <Users className='h-4 w-4' />
            Sessions
          </TabsTrigger>
          <TabsTrigger value='scenarios' className='flex items-center gap-2'>
            <TestTube className='h-4 w-4' />
            Scenarios
          </TabsTrigger>
        </TabsList>

        <div className='flex-1 overflow-auto p-4'>
          <TabsContent value='connection' className='mt-0'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Connection Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <MCPConnectionTester projectId={projectId} onSessionCreated={setActiveSessionId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='methods' className='mt-0'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>JSON-RPC Method Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <MCPMethodTester projectId={projectId} sessionId={activeSessionId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='sessions' className='mt-0'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Active Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <MCPSessionManager onSessionSelect={setActiveSessionId} selectedSessionId={activeSessionId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='scenarios' className='mt-0'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Test Scenarios</CardTitle>
              </CardHeader>
              <CardContent>
                <MCPTestScenarios
                  projectId={projectId}
                  sessionId={activeSessionId}
                  onSessionCreated={setActiveSessionId}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
