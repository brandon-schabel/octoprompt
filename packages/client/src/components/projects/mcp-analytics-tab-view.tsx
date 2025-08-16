import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import {
  Activity,
  AlertCircle,
  BarChart2,
  Clock,
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  RefreshCw,
  Download,
  Sparkles,
  HelpCircle
} from 'lucide-react'
import {
  useGetMCPAnalyticsOverview,
  useGetMCPExecutions,
  useGetMCPToolStatistics,
  useGetMCPExecutionTimeline,
  useGetMCPErrorPatterns
} from '@/hooks/api/use-mcp-analytics-api'
import { useGlobalMCPManager } from '@/hooks/api/use-mcp-global-api'
import type { MCPAnalyticsRequest, MCPExecutionQuery, MCPToolSummary, MCPToolExecution } from '@promptliano/schemas'
import { formatDistanceToNow } from 'date-fns'
import { MCPExecutionsTable } from './mcp-analytics/mcp-executions-table'
import { toast } from 'sonner'

interface MCPAnalyticsTabViewProps {
  projectId: number
}

interface ToolStatus {
  tool: string
  name: string
  installed: boolean
  hasGlobalPromptliano: boolean
  configPath?: string
}

// Helper function to extract action from input params
function getActionFromParams(inputParams: string | null | undefined): string | null {
  if (!inputParams) return null

  try {
    const params = JSON.parse(inputParams)
    return params?.action || null
  } catch (e) {
    return null
  }
}

export function MCPAnalyticsTabView({ projectId }: MCPAnalyticsTabViewProps) {
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month'>('day')
  const [selectedTool, setSelectedTool] = useState<string | undefined>()
  const [showInstallDialog, setShowInstallDialog] = useState(false)

  const analyticsRequest: MCPAnalyticsRequest = {
    projectId,
    period: timeRange,
    ...(selectedTool && { toolNames: [selectedTool] })
  }

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview
  } = useGetMCPAnalyticsOverview(projectId, analyticsRequest)
  const {
    data: statistics,
    isLoading: statsLoading,
    refetch: refetchStatistics
  } = useGetMCPToolStatistics(projectId, analyticsRequest)

  const { data: timeline, isLoading: timelineLoading } = useGetMCPExecutionTimeline(projectId, analyticsRequest)
  const { data: errorPatterns, isLoading: errorPatternsLoading } = useGetMCPErrorPatterns(projectId, analyticsRequest)

  // Global MCP manager
  const {
    config: globalConfig,
    status: globalStatus,
    toolStatuses,
    isLoading: isGlobalLoading,
    install: installGlobal,
    isInstalling
  } = useGlobalMCPManager()

  // Handle universal MCP installation
  const handleInstallUniversalMCP = async () => {
    try {
      // Find tools that don't have Promptliano installed
      const uninstalledTools = toolStatuses?.filter((tool: ToolStatus) => tool.installed && !tool.hasGlobalPromptliano) || []

      if (uninstalledTools.length === 0) {
        toast.info('All installed tools already have Promptliano MCP configured')
        return
      }

      // Install for each tool
      for (const tool of uninstalledTools) {
        await installGlobal({ tool: tool.tool })
        toast.success(`Installed Promptliano MCP for ${tool.name}`)
      }

      toast.success('Universal MCP configuration installed successfully!')
    } catch (error) {
      toast.error('Failed to install universal MCP configuration', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  if (overviewLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <p className='text-muted-foreground'>Loading MCP analytics...</p>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className='flex items-center justify-center h-full'>
        <div className='text-center space-y-2'>
          <AlertCircle className='h-8 w-8 text-muted-foreground mx-auto' />
          <p className='text-muted-foreground'>No MCP analytics data available</p>
        </div>
      </div>
    )
  }

  // The overview object is the data itself based on console logs
  const overviewData = overview

  // Use statistics data as fallback if overview.topTools is empty
  const topToolsData =
    overviewData.topTools && overviewData.topTools.length > 0 ? overviewData.topTools : statistics || []

  return (
    <TooltipProvider>
      <div className='h-full flex flex-col p-4 md:p-6 overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-4'>
            <h2 className='text-2xl font-semibold flex items-center gap-2'>
              <BarChart2 className='h-6 w-6' />
              MCP Tool Analytics
            </h2>
            <Badge variant='secondary'>{overviewData.totalExecutions} executions</Badge>
          </div>

          <div className='flex items-center gap-2'>
            {/* Universal MCP Installation Button */}
            {!isGlobalLoading && (
              <div className='flex items-center gap-1'>
                {globalStatus && !globalStatus.installed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size='sm' variant='outline' onClick={handleInstallUniversalMCP} disabled={isInstalling}>
                        <Sparkles className='h-4 w-4 mr-1' />
                        Install Universal MCP
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='max-w-xs'>
                      <p className='font-medium mb-1'>Install Promptliano MCP Globally</p>
                      <p className='text-sm'>
                        This will install the Promptliano MCP server configuration for all supported tools on your
                        system (Claude Desktop, VS Code, Cursor, etc.)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className='flex items-center gap-2'>
                    {toolStatuses && toolStatuses.some((t: ToolStatus) => t.installed && !t.hasGlobalPromptliano) ? (
                      <Button size='sm' variant='outline' onClick={handleInstallUniversalMCP} disabled={isInstalling}>
                        <Download className='h-4 w-4 mr-1' />
                        Update Universal MCP
                      </Button>
                    ) : (
                      <Badge variant='secondary' className='flex items-center gap-1'>
                        <CheckCircle className='h-3 w-3' />
                        Universal MCP Installed
                      </Badge>
                    )}
                    {!globalConfig && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className='h-4 w-4 text-muted-foreground cursor-help' />
                        </TooltipTrigger>
                        <TooltipContent side='bottom' className='max-w-xs'>
                          <p className='font-medium mb-1'>No Universal MCP Config Found</p>
                          <p className='text-sm'>
                            To create a universal MCP configuration file, go to Settings → Global MCP and configure your
                            global MCP settings.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            )}

            <Select value={timeRange} onValueChange={(value: 'hour' | 'day' | 'week' | 'month') => setTimeRange(value)}>
              <SelectTrigger className='w-[140px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='hour'>Last Hour</SelectItem>
                <SelectItem value='day'>Last 24 Hours</SelectItem>
                <SelectItem value='week'>Last 7 Days</SelectItem>
                <SelectItem value='month'>Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                refetchOverview()
                // Also refetch statistics if being used as fallback
                if (refetchStatistics) {
                  refetchStatistics()
                }
              }}
              disabled={overviewLoading}
            >
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center justify-between'>
                Total Executions
                <Activity className='h-4 w-4 text-muted-foreground' />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-bold'>{overviewData.totalExecutions}</p>
              <p className='text-xs text-muted-foreground mt-1'>{overviewData.uniqueTools} unique tools</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center justify-between'>
                Success Rate
                <CheckCircle className='h-4 w-4 text-green-500' />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-bold'>{(overviewData.overallSuccessRate * 100).toFixed(1)}%</p>
              <p className='text-xs text-muted-foreground mt-1'>Overall success rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center justify-between'>
                Avg Execution Time
                <Clock className='h-4 w-4 text-muted-foreground' />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-bold'>{(overviewData.avgExecutionTime / 1000).toFixed(2)}s</p>
              <p className='text-xs text-muted-foreground mt-1'>Average duration</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center justify-between'>
                Recent Errors
                <AlertTriangle className='h-4 w-4 text-red-500' />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-bold'>{overviewData.recentErrors.length}</p>
              <p className='text-xs text-muted-foreground mt-1'>In selected period</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue='tools' className='flex-1 flex flex-col min-h-0'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='tools'>Top Tools</TabsTrigger>
            <TabsTrigger value='executions'>Recent Executions</TabsTrigger>
            <TabsTrigger value='timeline'>Timeline</TabsTrigger>
            <TabsTrigger value='errors'>Error Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value='tools' className='flex-1 overflow-hidden mt-4'>
            <Card className='h-full flex flex-col'>
              <CardHeader>
                <CardTitle>Most Used Tools</CardTitle>
                <CardDescription>Tool usage statistics for the selected time period</CardDescription>
              </CardHeader>
              <CardContent className='flex-1 min-h-0'>
                <ScrollArea className='h-full'>
                  <div className='space-y-3'>
                    {topToolsData.length === 0 ? (
                      <div className='text-center py-8 text-muted-foreground'>
                        <Activity className='h-12 w-12 mx-auto mb-3 opacity-50' />
                        <p>No tool usage data available for the selected period</p>
                        <p className='text-sm mt-1'>Try selecting a different time range</p>
                      </div>
                    ) : (
                      topToolsData.map((tool: MCPToolSummary) => (
                        <div key={tool.toolName} className='p-3 border rounded-lg space-y-2'>
                          <div className='flex items-center justify-between'>
                            <h4 className='font-medium'>{tool.toolName}</h4>
                            <div className='flex items-center gap-2'>
                              <Badge variant='secondary'>{tool.totalExecutions} calls</Badge>
                              <Badge
                                variant={
                                  tool.successRate > 0.9
                                    ? 'default'
                                    : tool.successRate > 0.7
                                      ? 'warning'
                                      : 'destructive'
                                }
                                className={cn(
                                  tool.successRate > 0.9 && 'bg-green-100 text-green-700',
                                  tool.successRate > 0.7 && tool.successRate <= 0.9 && 'bg-yellow-100 text-yellow-700',
                                  tool.successRate <= 0.7 && 'bg-red-100 text-red-700'
                                )}
                              >
                                {(tool.successRate * 100).toFixed(1)}% success
                              </Badge>
                            </div>
                          </div>

                          <div className='grid grid-cols-3 gap-4 text-sm'>
                            <div>
                              <p className='text-muted-foreground'>Avg Duration</p>
                              <p className='font-medium'>
                                {tool.avgDurationMs ? `${(tool.avgDurationMs / 1000).toFixed(2)}s` : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className='text-muted-foreground'>Min/Max</p>
                              <p className='font-medium'>
                                {tool.minDurationMs && tool.maxDurationMs
                                  ? `${(tool.minDurationMs / 1000).toFixed(2)}s - ${(tool.maxDurationMs / 1000).toFixed(2)}s`
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className='text-muted-foreground'>Total Output</p>
                              <p className='font-medium'>{(tool.totalOutputSize / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='executions' className='flex-1 overflow-hidden mt-4'>
            <MCPExecutionsTable projectId={projectId} />
          </TabsContent>

          <TabsContent value='timeline' className='flex-1 overflow-hidden mt-4'>
            <Card className='h-full flex flex-col'>
              <CardHeader>
                <CardTitle>Execution Timeline</CardTitle>
                <CardDescription>Tool execution patterns over time</CardDescription>
              </CardHeader>
              <CardContent className='flex-1 min-h-0'>
                <div className='text-center py-8 text-muted-foreground'>
                  <TrendingUp className='h-12 w-12 mx-auto mb-3 opacity-50' />
                  <p>Timeline visualization coming soon</p>
                  <p className='text-sm mt-1'>Track execution patterns and trends over time</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='errors' className='flex-1 overflow-hidden mt-4'>
            <Card className='h-full flex flex-col'>
              <CardHeader>
                <CardTitle>Error Analysis</CardTitle>
                <CardDescription>Common error patterns and failure points</CardDescription>
              </CardHeader>
              <CardContent className='flex-1 min-h-0'>
                <ScrollArea className='h-full'>
                  <div className='space-y-3'>
                    {!overviewData.recentErrors || overviewData.recentErrors.length === 0 ? (
                      <div className='text-center py-8 text-muted-foreground'>
                        <CheckCircle className='h-12 w-12 mx-auto mb-3 text-green-500 opacity-50' />
                        <p>No errors in the selected period</p>
                      </div>
                    ) : (
                      overviewData.recentErrors.map((error: MCPToolExecution) => (
                        <div
                          key={error.id}
                          className='p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20'
                        >
                          <div className='flex items-start justify-between'>
                            <div className='flex-1'>
                              <div className='flex items-center gap-2 mb-1'>
                                <XCircle className='h-4 w-4 text-red-500' />
                                <p className='font-medium'>
                                  {error.toolName}
                                  {getActionFromParams(error.inputParams) && (
                                    <span className='text-muted-foreground'>
                                      {' '}
                                      · {getActionFromParams(error.inputParams)}
                                    </span>
                                  )}
                                </p>
                                <Badge variant='destructive' className='text-xs'>
                                  {error.errorCode || 'ERROR'}
                                </Badge>
                              </div>
                              <p className='text-sm text-muted-foreground'>{error.errorMessage}</p>
                            </div>
                            <p className='text-xs text-muted-foreground'>
                              {formatDistanceToNow(new Date(error.startedAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
