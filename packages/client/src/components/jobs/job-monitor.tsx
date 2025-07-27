import React, { useState } from 'react'
import { useProjectJobs, useCancelJob, useRetryJob, useProjectJobEvents } from '@/hooks/api/use-job-api'
import { JobList } from './job-list'
import type { Job, JobStatus } from '@promptliano/schemas'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Briefcase, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobMonitorProps {
  projectId: number
  className?: string
}

export function JobMonitor({ projectId, className }: JobMonitorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: jobs = [], isLoading } = useProjectJobs(projectId)
  const cancelJob = useCancelJob()
  const retryJob = useRetryJob()

  // Subscribe to job events for this project
  useProjectJobEvents(projectId)

  // Count active jobs
  const activeJobs = jobs.filter((job: Job) => job.status === 'pending' || job.status === 'running')
  const hasActiveJobs = activeJobs.length > 0

  // Group jobs by status
  const jobsByStatus = jobs.reduce(
    (acc: Record<JobStatus, number>, job: Job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    },
    {} as Record<JobStatus, number>
  )

  return (
    <>
      <Button variant='outline' size='sm' onClick={() => setDialogOpen(true)} className={cn('gap-2', className)}>
        <Briefcase className='h-4 w-4' />
        Jobs
        {hasActiveJobs && (
          <Badge variant='default' className='ml-1 h-5 px-1'>
            <Loader2 className='h-3 w-3 animate-spin' />
            {activeJobs.length}
          </Badge>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Background Jobs</DialogTitle>
            <DialogDescription>Monitor and manage background operations for this project</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            {/* Status summary */}
            <div className='flex items-center gap-2 text-sm'>
              {jobsByStatus.running > 0 && <Badge variant='default'>{jobsByStatus.running} Running</Badge>}
              {jobsByStatus.pending > 0 && <Badge variant='secondary'>{jobsByStatus.pending} Pending</Badge>}
              {jobsByStatus.completed > 0 && (
                <Badge variant='secondary' className='bg-green-100 text-green-800 border-green-200'>
                  {jobsByStatus.completed} Completed
                </Badge>
              )}
              {jobsByStatus.failed > 0 && <Badge variant='destructive'>{jobsByStatus.failed} Failed</Badge>}
              {jobsByStatus.cancelled > 0 && <Badge variant='outline'>{jobsByStatus.cancelled} Cancelled</Badge>}
            </div>

            {/* Job list */}
            <JobList
              jobs={jobs}
              isLoading={isLoading}
              onCancel={(jobId) => cancelJob.mutate(jobId)}
              onRetry={(jobId) => retryJob.mutate(jobId)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Compact job indicator for showing in headers
export function JobIndicator({ projectId, className }: JobMonitorProps) {
  const { data: jobs = [] } = useProjectJobs(projectId)

  // Subscribe to job events
  useProjectJobEvents(projectId)

  const activeJobs = jobs.filter((job: Job) => job.status === 'pending' || job.status === 'running')

  if (activeJobs.length === 0) return null

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Loader2 className='h-3 w-3 animate-spin text-muted-foreground' />
      <span className='text-xs text-muted-foreground'>
        {activeJobs.length} job{activeJobs.length !== 1 ? 's' : ''} running
      </span>
    </div>
  )
}
