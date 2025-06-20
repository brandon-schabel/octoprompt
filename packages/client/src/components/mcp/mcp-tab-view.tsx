import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Server, Wrench, FileText } from 'lucide-react'
import { MCPServerList } from './mcp-server-list'
import { MCPToolsPanel } from './mcp-tools-panel'
import { MCPResourcesPanel } from './mcp-resources-panel'

interface MCPTabViewProps {
  projectId: number
}

export function MCPTabView({ projectId }: MCPTabViewProps) {
  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="servers" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="servers" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Servers
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Resources
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="servers" className="mt-0">
            <MCPServerList projectId={projectId} />
          </TabsContent>
          
          <TabsContent value="tools" className="mt-0">
            <MCPToolsPanel projectId={projectId} />
          </TabsContent>
          
          <TabsContent value="resources" className="mt-0">
            <MCPResourcesPanel projectId={projectId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}