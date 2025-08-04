import React from 'react'
import { useGetProjectStatistics } from '@/hooks/api/use-projects-api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Progress } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { FileText, CheckCircle2, Circle, Sparkles, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: number; isPositive: boolean }
  className?: string
  gradient?: string
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, className, gradient }: MetricCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className={cn('absolute inset-0 opacity-10', gradient || 'bg-gradient-to-br from-primary to-primary/50')} />
      <CardHeader className='relative flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent className='relative'>
        <div className='text-2xl font-bold'>{value}</div>
        {subtitle && <p className='text-xs text-muted-foreground mt-1'>{subtitle}</p>}
        {trend && (
          <div className={cn('flex items-center text-xs mt-2', trend.isPositive ? 'text-green-600' : 'text-red-600')}>
            <TrendingUp className={cn('h-3 w-3 mr-1', !trend.isPositive && 'rotate-180')} />
            {Math.abs(trend.value)}% from last week
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ProjectStatsDisplayEnhanced({ projectId }: ProjectStatsDisplayEnhancedProps) {
  const { data: response, isLoading, error } = useGetProjectStatistics(projectId)
  const statistics = response?.data

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
      {/* Metric Cards Row */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <MetricCard
          title='Total Files'
          value={formatNumber(statistics.fileStats?.totalFiles || 0)}
          subtitle={formatBytes(statistics.fileStats?.totalSize || 0)}
          icon={FileText}
          gradient='bg-gradient-to-br from-blue-500 to-blue-600'
        />
        <MetricCard
          title='Active Tickets'
          value={statistics.ticketStats?.totalTickets || 0}
          subtitle={`${statistics.ticketStats?.ticketsByStatus?.open || 0} open`}
          icon={Circle}
          gradient='bg-gradient-to-br from-purple-500 to-purple-600'
        />
        <MetricCard
          title='Task Completion'
          value={`${Math.round(statistics.taskStats?.completionRate || 0)}%`}
          subtitle={`${statistics.taskStats?.completedTasks || 0} of ${statistics.taskStats?.totalTasks || 0}`}
          icon={CheckCircle2}
          gradient='bg-gradient-to-br from-green-500 to-green-600'
        />
        <MetricCard
          title='Total Prompts'
          value={statistics.promptStats?.totalPrompts || 0}
          subtitle={`~${formatNumber(statistics.promptStats?.totalTokens || 0)} tokens`}
          icon={Sparkles}
          gradient='bg-gradient-to-br from-orange-500 to-orange-600'
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
