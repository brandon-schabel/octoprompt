import { useState } from 'react'
import { Wrench, Play, Loader2, ChevronRight, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useGetMCPTools, useExecuteMCPTool } from '@/hooks/api/use-mcp-api'
import type { MCPTool, MCPToolParameter } from '@octoprompt/schemas'
import { cn } from '@/lib/utils'

interface MCPToolsPanelProps {
  projectId: number
}

interface ToolItemProps {
  tool: MCPTool
  projectId: number
}

function ParameterInput({
  parameter,
  value,
  onChange
}: {
  parameter: MCPToolParameter
  value: any
  onChange: (value: any) => void
}) {
  if (parameter.enum && parameter.enum.length > 0) {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder='Select a value' />
        </SelectTrigger>
        <SelectContent>
          {parameter.enum.map((option) => (
            <SelectItem key={String(option)} value={String(option)}>
              {String(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (parameter.type === 'boolean') {
    return (
      <Select value={String(value || false)} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='true'>true</SelectItem>
          <SelectItem value='false'>false</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (parameter.type === 'number' || parameter.type === 'integer') {
    return (
      <Input
        type='number'
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        placeholder={parameter.default ? String(parameter.default) : 'Enter a number'}
      />
    )
  }

  return (
    <Input
      type='text'
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={parameter.default ? String(parameter.default) : 'Enter a value'}
    />
  )
}

function ToolItem({ tool, projectId }: ToolItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [parameters, setParameters] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)
  const executeMutation = useExecuteMCPTool(projectId)

  const handleExecute = async () => {
    try {
      // Validate required parameters
      const missingParams = tool.parameters.filter((p) => p.required && !parameters[p.name]).map((p) => p.name)

      if (missingParams.length > 0) {
        toast.error(`Missing required parameters: ${missingParams.join(', ')}`)
        return
      }

      const response = await executeMutation.mutateAsync({
        toolId: tool.id,
        serverId: tool.serverId,
        parameters
      })

      if (response.data.status === 'error') {
        toast.error(`Tool execution failed: ${response.data.error}`)
        setResult({ error: response.data.error })
      } else {
        toast.success('Tool executed successfully')
        setResult(response.data.result)
      }
    } catch (error) {
      toast.error('Failed to execute tool')
    }
  }

  return (
    <div className='border rounded-lg'>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className='w-full'>
          <div className='flex items-center justify-between p-4 hover:bg-gray-50'>
            <div className='flex items-center gap-3 text-left'>
              <Wrench className='h-4 w-4 text-gray-500' />
              <div>
                <h4 className='font-medium'>{tool.name}</h4>
                <p className='text-sm text-gray-500'>{tool.description}</p>
              </div>
            </div>
            <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='p-4 pt-0 space-y-4'>
            {tool.parameters.length > 0 && (
              <div className='space-y-3'>
                <h5 className='text-sm font-medium'>Parameters</h5>
                {tool.parameters.map((param) => (
                  <div key={param.name} className='space-y-1'>
                    <Label htmlFor={param.name} className='text-sm'>
                      {param.name}
                      {param.required && <span className='text-red-500 ml-1'>*</span>}
                    </Label>
                    {param.description && <p className='text-xs text-gray-500'>{param.description}</p>}
                    <ParameterInput
                      parameter={param}
                      value={parameters[param.name]}
                      onChange={(value) =>
                        setParameters((prev) => ({
                          ...prev,
                          [param.name]: value
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <Button size='sm' onClick={handleExecute} disabled={executeMutation.isPending} className='w-full'>
              {executeMutation.isPending ? (
                <>
                  <Loader2 className='h-4 w-4 mr-1 animate-spin' />
                  Executing...
                </>
              ) : (
                <>
                  <Play className='h-4 w-4 mr-1' />
                  Execute
                </>
              )}
            </Button>

            {result && (
              <div className='mt-4 space-y-2'>
                <div className='flex items-center justify-between'>
                  <h5 className='text-sm font-medium'>Result</h5>
                  <Button size='sm' variant='ghost' onClick={() => setResult(null)}>
                    Clear
                  </Button>
                </div>
                <div className='bg-gray-50 rounded-lg p-3'>
                  <pre className='text-xs overflow-auto'>{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function MCPToolsPanel({ projectId }: MCPToolsPanelProps) {
  const { data: toolsResponse, isLoading } = useGetMCPTools(projectId)
  const tools = toolsResponse?.data || []

  if (isLoading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center p-8'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg flex items-center gap-2'>
          <Code className='h-5 w-5' />
          MCP Tools
          <Badge variant='secondary'>{tools.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tools.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            <Wrench className='h-12 w-12 mx-auto mb-2 text-gray-300' />
            <p className='text-sm'>No tools available</p>
            <p className='text-xs mt-1'>Start an MCP server to access tools</p>
          </div>
        ) : (
          <div className='space-y-2'>
            {tools.map((tool) => (
              <ToolItem key={`${tool.serverId}-${tool.id}`} tool={tool} projectId={projectId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
