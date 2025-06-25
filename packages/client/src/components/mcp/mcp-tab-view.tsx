import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, TestTube } from 'lucide-react'
import { MCPServerList } from './mcp-server-list'
import { MCPTestingPanel } from './mcp-testing-panel'

interface MCPTabViewProps {
  projectId: number
}

export function MCPTabView({ projectId }: MCPTabViewProps) {
  return (
    <div className='h-full flex flex-col'>
      <Tabs defaultValue='testing' className='flex-1 flex flex-col'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='testing' className='flex items-center gap-2'>
            <TestTube className='h-4 w-4' />
            MCP Testing
          </TabsTrigger>
          <TabsTrigger value='servers' className='flex items-center gap-2'>
            <Settings className='h-4 w-4' />
            Server Management
          </TabsTrigger>
        </TabsList>

        <div className='flex-1 overflow-hidden'>
          <TabsContent value='testing' className='h-full'>
            <MCPTestingPanel projectId={projectId} />
          </TabsContent>

          <TabsContent value='servers' className='h-full'>
            <MCPServerList projectId={projectId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
