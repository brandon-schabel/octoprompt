import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promptlianoClient } from '../promptliano-client'
import type { Job, JobFilter, CreateJob } from '@promptliano/schemas'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'

// Get single job
export function useJob(jobId: number | undefined) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null
      const result = await promptlianoClient.jobs.getJob(jobId)
      return result.data
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      // Poll more frequently for running jobs
      const job = query.state.data
      if (job?.status === 'running' || job?.status === 'pending') {
        return 1000 // 1 second
      }
      return false // Don't poll for completed/failed/cancelled jobs
    }
  })
}

// Get jobs with filters
export function useJobs(filter: JobFilter = {}) {
  return useQuery({
    queryKey: ['jobs', filter],
    queryFn: async () => {
      return await promptlianoClient.jobs.listJobs(filter)
    }
  })
}

// Get project jobs
export function useProjectJobs(projectId: number | undefined) {
  return useQuery({
    queryKey: ['jobs', 'project', projectId],
    queryFn: async () => {
      if (!projectId) return []
      return await promptlianoClient.jobs.getProjectJobs(projectId)
    },
    enabled: !!projectId
  })
}

// Cancel job
export function useCancelJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: number) => {
      return await promptlianoClient.jobs.cancelJob(jobId)
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Job cancelled')
    },
    onError: (error) => {
      toast.error('Failed to cancel job', {
        description: error.message
      })
    }
  })
}

// Retry failed job
export function useRetryJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: number) => {
      return await promptlianoClient.jobs.retryJob(jobId)
    },
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Job retry started', {
        description: `New job ID: ${newJob.id}`
      })
    },
    onError: (error) => {
      toast.error('Failed to retry job', {
        description: error.message
      })
    }
  })
}

// Subscribe to job events via WebSocket
export function useJobEvents(jobId?: number) {
  const { subscribe, unsubscribe } = useWebSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!jobId) return

    const handleJobEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'job.event' && data.data.jobId === jobId) {
          // Update job in cache
          queryClient.setQueryData(['job', jobId], data.data.job)

          // Show toast for important events
          switch (data.data.type) {
            case 'job.completed':
              toast.success('Job completed successfully')
              break
            case 'job.failed':
              toast.error('Job failed', {
                description: data.data.job.error?.message
              })
              break
            case 'job.cancelled':
              toast.info('Job cancelled')
              break
          }
        }
      } catch (error) {
        console.error('Failed to parse job event:', error)
      }
    }

    subscribe('message', handleJobEvent)
    return () => unsubscribe('message', handleJobEvent)
  }, [jobId, subscribe, unsubscribe, queryClient])
}

// Subscribe to project job events
export function useProjectJobEvents(projectId?: number) {
  const { subscribe, unsubscribe, send } = useWebSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return

    // Subscribe to project
    send({ type: 'subscribe.project', projectId })

    const handleJobEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'job.event' && data.data.job.projectId === projectId) {
          // Invalidate project jobs query
          queryClient.invalidateQueries({ queryKey: ['jobs', 'project', projectId] })

          // Update specific job if in cache
          queryClient.setQueryData(['job', data.data.jobId], data.data.job)
        }
      } catch (error) {
        console.error('Failed to parse job event:', error)
      }
    }

    subscribe('message', handleJobEvent)

    return () => {
      unsubscribe('message', handleJobEvent)
      send({ type: 'unsubscribe.project' })
    }
  }, [projectId, subscribe, unsubscribe, send, queryClient])
}