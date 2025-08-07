import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { projectIdSearchSchema } from '@/lib/search-schemas'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { Button } from '@promptliano/ui'
import { ArrowLeft } from 'lucide-react'
import { QueueDashboard as QueueDashboardComponent } from '@/components/queues/queue-dashboard'

// Search parameter validation schema
const queueDashboardSearchSchema = projectIdSearchSchema

type QueueDashboardSearch = z.infer<typeof queueDashboardSearchSchema>

// Queue dashboard wrapper component
function QueueDashboard() {
  const navigate = useNavigate()
  const { queueId } = Route.useParams()
  const search = Route.useSearch()

  const handleGoBack = () => {
    if (search.projectId) {
      // Navigate back to the project's flow view with queues tab
      navigate({
        to: '/projects',
        search: {
          projectId: search.projectId,
          activeView: 'flow',
          flowView: 'queues'
        }
      })
    } else {
      // Navigate to general projects page
      navigate({ to: '/projects' })
    }
  }

  const handleClose = () => {
    handleGoBack()
  }

  // Convert string queueId to number for the component
  const numericQueueId = Number(queueId)
  const projectId = search.projectId

  if (!projectId) {
    return (
      <div className='flex flex-col h-full w-full'>
        <div className='flex items-center gap-4 p-6 border-b'>
          <Button variant='ghost' size='sm' onClick={handleGoBack} className='flex items-center gap-2'>
            <ArrowLeft className='h-4 w-4' />
            Back
          </Button>
          <div className='flex-1'>
            <h1 className='text-2xl font-bold'>Queue Dashboard</h1>
            <p className='text-muted-foreground text-red-500'>Error: Project ID is required</p>
          </div>
        </div>
        <div className='flex-1 p-6'>
          <div className='text-center text-muted-foreground'>
            Please provide a valid project ID to view this queue dashboard.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full w-full'>
      {/* Header */}
      <div className='flex items-center gap-4 p-6 border-b'>
        <Button variant='ghost' size='sm' onClick={handleGoBack} className='flex items-center gap-2'>
          <ArrowLeft className='h-4 w-4' />
          Back to Queues
        </Button>
      </div>

      {/* Content */}
      <div className='flex-1 p-6 overflow-auto'>
        <QueueDashboardComponent queueId={numericQueueId} projectId={projectId} onClose={handleClose} />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/queue-dashboard/$queueId')({
  validateSearch: zodValidator(queueDashboardSearchSchema),
  beforeLoad: async ({ context, params, search }) => {
    const { queryClient, promptlianoClient } = context
    const queueId = Number(params.queueId)

    // Pre-validate that queueId is a valid number
    if (isNaN(queueId)) {
      throw new Error('Invalid queue ID provided')
    }

    // Prefetch queue data
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['queues', 'detail', queueId],
        queryFn: () => promptlianoClient.queues.getQueue(queueId),
        staleTime: 30 * 1000 // 30 seconds
      }),
      queryClient.prefetchQuery({
        queryKey: ['queues', 'stats', queueId],
        queryFn: () => promptlianoClient.queues.getQueueStats(queueId),
        staleTime: 5 * 1000 // 5 seconds
      }),
      queryClient.prefetchQuery({
        queryKey: ['queues', 'items', queueId],
        queryFn: () => promptlianoClient.queues.getQueueItems(queueId),
        staleTime: 5 * 1000 // 5 seconds
      })
    ])
  },
  component: QueueDashboardPage
})

function QueueDashboardPage() {
  return (
    <ErrorBoundary>
      <QueueDashboard />
    </ErrorBoundary>
  )
}
