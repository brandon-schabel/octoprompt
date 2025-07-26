import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { JobStatusBadge } from './job-status-badge'
import { formatDistanceToNow } from 'date-fns'
import { RotateCcw, X, Clock, FileCode } from 'lucide-react'
import type { Job } from '@octoprompt/schemas'
import { cn } from '@/lib/utils'

interface JobListProps {
  jobs: Job[]
  onCancel?: (jobId: number) => void
  onRetry?: (jobId: number) => void
  isLoading?: boolean
  className?: string
}

export function JobList({ jobs, onCancel, onRetry, isLoading, className }: JobListProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No jobs found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ScrollArea className={cn('h-[400px]', className)}>
      <div className="space-y-2 pr-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onCancel={onCancel} onRetry={onRetry} />
        ))}
      </div>
    </ScrollArea>
  )
}

interface JobCardProps {
  job: Job
  onCancel?: (jobId: number) => void
  onRetry?: (jobId: number) => void
}

function JobCard({ job, onCancel, onRetry }: JobCardProps) {
  const canCancel = job.status === 'pending' || job.status === 'running'
  const canRetry = job.status === 'failed'
  
  const jobTypeLabels: Record<string, string> = {
    'git.worktree.add': 'Add Git Worktree',
    'git.worktree.remove': 'Remove Git Worktree',
    'git.worktree.prune': 'Prune Git Worktrees',
    'git.worktree.lock': 'Lock Git Worktree',
    'git.worktree.unlock': 'Unlock Git Worktree',
  }

  const jobLabel = jobTypeLabels[job.type] || job.type

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">{jobLabel}</CardTitle>
              <JobStatusBadge status={job.status} />
            </div>
            <CardDescription className="text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(job.created), { addSuffix: true })}
                </span>
                {job.metadata?.path && (
                  <span className="font-mono text-xs">{job.metadata.path}</span>
                )}
              </div>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {canCancel && onCancel && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCancel(job.id)}
                title="Cancel job"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            {canRetry && onRetry && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRetry(job.id)}
                title="Retry job"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {job.progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{job.progress.message || 'Processing...'}</span>
              {job.progress.percentage !== undefined && (
                <span>{Math.round(job.progress.percentage)}%</span>
              )}
            </div>
            <Progress 
              value={job.progress.percentage || 0} 
              className="h-2"
            />
          </div>
        )}
        
        {job.error && (
          <div className="mt-2 rounded-md bg-destructive/10 p-2">
            <p className="text-xs text-destructive">{job.error.message}</p>
          </div>
        )}
        
        {job.status === 'completed' && job.result && (
          <div className="mt-2 text-xs text-muted-foreground">
            {job.type.includes('prune') && Array.isArray(job.result.prunedPaths) && (
              <span>Pruned {job.result.prunedPaths.length} worktree(s)</span>
            )}
            {job.type.includes('add') && job.result.path && (
              <span>Created at: {job.result.path}</span>
            )}
            {job.type.includes('remove') && job.result.path && (
              <span>Removed: {job.result.path}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}