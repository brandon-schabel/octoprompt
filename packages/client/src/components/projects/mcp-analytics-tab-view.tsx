import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  RefreshCw
} from 'lucide-react'
import {
  useGetMCPAnalyticsOverview,
  useGetMCPExecutions,
  useGetMCPToolStatistics,
  useGetMCPExecutionTimeline,
  useGetMCPErrorPatterns
} from '@/hooks/api/use-mcp-analytics-api'
import type { MCPAnalyticsRequest, MCPExecutionQuery } from '@octoprompt/schemas'
import { formatDistanceToNow } from 'date-fns'

interface MCPAnalyticsTabViewProps {
  projectId: number
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
  const { data: executions, isLoading: executionsLoading } = useGetMCPExecutions(projectId, {
    projectId,
    limit: 10,
    offset: 0,
    sortBy: 'startedAt',
    sortOrder: 'desc'
  })
  const { data: statistics, isLoading: statsLoading } = useGetMCPToolStatistics(projectId, analyticsRequest)

  const { data: timeline, isLoading: timelineLoading } = useGetMCPExecutionTimeline(projectId, analyticsRequest)
  const { data: errorPatterns, isLoading: errorPatternsLoading } = useGetMCPErrorPatterns(projectId, analyticsRequest)

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
    overviewData.topTools && overviewData.topTools.length > 0 ? overviewData.topTools : statistics?.data || []

  return (
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
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
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
              if (statistics && statistics.refetch) {
                statistics.refetch()
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
                    topToolsData.map((tool: any) => (
                      <div key={tool.toolName} className='p-3 border rounded-lg space-y-2'>
                        <div className='flex items-center justify-between'>
                          <h4 className='font-medium'>{tool.toolName}</h4>
                          <div className='flex items-center gap-2'>
                            <Badge variant='secondary'>{tool.totalExecutions} calls</Badge>
                            <Badge
                              variant={
                                tool.successRate > 0.9 ? 'default' : tool.successRate > 0.7 ? 'warning' : 'destructive'
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
          <Card className='h-full flex flex-col'>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>Latest tool executions across the project</CardDescription>
            </CardHeader>
            <CardContent className='flex-1 min-h-0'>
              <ScrollArea className='h-full'>
                <div className='space-y-2'>
                  {executions?.executions?.length > 0 ? (
                    executions.executions.map((execution: any) => (
                      <div key={execution.id} className='p-3 border rounded-lg flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          {execution.status === 'success' ? (
                            <CheckCircle className='h-4 w-4 text-green-500' />
                          ) : execution.status === 'error' ? (
                            <XCircle className='h-4 w-4 text-red-500' />
                          ) : (
                            <Timer className='h-4 w-4 text-yellow-500' />
                          )}
                          <div>
                            <p className='font-medium'>
                              {execution.toolName}
                              {getActionFromParams(execution.inputParams) && (
                                <span className='text-muted-foreground'>
                                  {' '}
                                  · {getActionFromParams(execution.inputParams)}
                                </span>
                              )}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>

                        <div className='flex items-center gap-2'>
                          {execution.durationMs && (
                            <Badge variant='outline'>{(execution.durationMs / 1000).toFixed(2)}s</Badge>
                          )}
                          {execution.outputSize && (
                            <Badge variant='outline'>{(execution.outputSize / 1024).toFixed(1)} KB</Badge>
                          )}
                          {execution.errorMessage && (
                            <Badge variant='destructive' title={execution.errorMessage}>
                              Error
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className='text-center py-8 text-muted-foreground'>
                      <Clock className='h-12 w-12 mx-auto mb-3 opacity-50' />
                      <p>No recent executions found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
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
                    overviewData.recentErrors.map((error: any) => (
                      <div key={error.id} className='p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20'>
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
  )
}
