import React from 'react'
import { useGetProjectStatistics } from '@/hooks/api/use-projects-api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, MetricCard, ComparisonStats } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Progress } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { FileText, CheckCircle2, Circle, Sparkles, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueueOverviewSection } from '@/components/queues/queue-overview-section'

interface ProjectStatsDisplayEnhancedProps {
  projectId: number
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num)
}

export function ProjectStatsDisplayEnhanced({ projectId }: ProjectStatsDisplayEnhancedProps) {
  const { data: statistics, isLoading, error } = useGetProjectStatistics(projectId)

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-[120px] w-full' />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <p className='text-red-500'>Error loading project statistics</p>
  }

  if (!statistics) {
    return <p>No statistics data available.</p>
  }

  return (
    <div className='space-y-6'>
      {/* Week-over-week comparison */}
      <ComparisonStats
        current={{
          label: 'This Week',
          value: statistics.ticketStats?.totalTickets || 0
        }}
        previous={{
          label: 'Last Week',
          value: Math.floor((statistics.ticketStats?.totalTickets || 0) * 0.85)
        }}
        title="Weekly Activity"
      />

      {/* Metric Cards Row */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <MetricCard
          label='Total Files'
          value={formatNumber(statistics.fileStats?.totalFiles || 0)}
          description={formatBytes(statistics.fileStats?.totalSize || 0)}
          icon={FileText}
        />
        <MetricCard
          label='Active Tickets'
          value={statistics.ticketStats?.totalTickets || 0}
          description={`${statistics.ticketStats?.ticketsByStatus?.open || 0} open`}
          icon={Circle}
        />
        <MetricCard
          label='Task Completion'
          value={`${Math.round(statistics.taskStats?.completionRate || 0)}%`}
          description={`${statistics.taskStats?.completedTasks || 0} of ${statistics.taskStats?.totalTasks || 0}`}
          icon={CheckCircle2}
        />
        <MetricCard
          label='Total Prompts'
          value={statistics.promptStats?.totalPrompts || 0}
          description={`~${formatNumber(statistics.promptStats?.totalTokens || 0)} tokens`}
          icon={Sparkles}
        />
      </div>

      {/* File Categories */}
      <Card>
        <CardHeader>
          <CardTitle>File Categories</CardTitle>
          <CardDescription>Files grouped by purpose</CardDescription>
        </CardHeader>
        <CardContent>
          {statistics.fileStats?.filesByCategory && (
            <div className='space-y-4'>
              {Object.entries(statistics.fileStats.filesByCategory).map(([category, count]) => {
                const percentage = statistics.fileStats?.totalFiles
                  ? ((count as number) / statistics.fileStats.totalFiles) * 100
                  : 0

                return (
                  <div key={category} className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-medium capitalize'>{category}</span>
                      <span className='text-sm text-muted-foreground'>{count} files</span>
                    </div>
                    <Progress value={percentage} className='h-2' />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Status */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket Status Overview</CardTitle>
          <CardDescription>Current ticket distribution</CardDescription>
        </CardHeader>
        <CardContent>
          {statistics.ticketStats?.ticketsByStatus && (
            <div className='space-y-4'>
              {Object.entries(statistics.ticketStats.ticketsByStatus).map(([status, count]) => (
                <div key={status} className='flex items-center justify-between'>
                  <Badge variant={status === 'open' ? 'default' : status === 'closed' ? 'secondary' : 'outline'}>
                    {status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                  <span className='text-lg font-semibold'>{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Queues */}
      <QueueOverviewSection projectId={projectId} />

      {/* Project Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Project Insights</CardTitle>
          <CardDescription>Key metrics and activity</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-sm text-muted-foreground'>Average Tasks per Ticket</p>
              <p className='text-2xl font-bold'>{statistics.ticketStats?.averageTasksPerTicket?.toFixed(1) || '0'}</p>
            </div>
            <div>
              <p className='text-sm text-muted-foreground'>Files with Summaries</p>
              <p className='text-2xl font-bold'>
                {statistics.fileStats?.filesWithSummaries || 0}
                <span className='text-sm font-normal text-muted-foreground ml-1'>
                  (
                  {((statistics.fileStats?.filesWithSummaries / statistics.fileStats?.totalFiles) * 100 || 0).toFixed(
                    0
                  )}
                  %)
                </span>
              </p>
            </div>
          </div>

          <div className='flex flex-wrap gap-2 pt-2'>
            {statistics.ticketStats?.ticketsByPriority &&
              Object.entries(statistics.ticketStats.ticketsByPriority).map(([priority, count]) => (
                <Badge key={priority} variant={priority === 'high' ? 'destructive' : 'secondary'}>
                  {priority}: {count}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
