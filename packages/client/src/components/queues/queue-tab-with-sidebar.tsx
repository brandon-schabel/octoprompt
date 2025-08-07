import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { QueueSidebarNav } from './queue-sidebar-nav'
import { QueueOverviewView } from './views/queue-overview-view'
import { QueueItemsView } from './views/queue-items-view'
import { QueueTimelineView } from './views/queue-timeline-view'
import { QueueAnalyticsView } from './views/queue-analytics-view'
import { QueueCreateDialog } from './queue-create-dialog'
import { type QueueView } from '@/lib/search-schemas'

interface QueueTabWithSidebarProps {
  projectId: number
  projectName?: string
  queueView?: QueueView
  selectedQueueId?: number
  onQueueViewChange: (view: QueueView) => void
  onQueueSelect: (queueId: number | undefined) => void
  className?: string
}

export function QueueTabWithSidebar({
  projectId,
  projectName,
  queueView = 'overview',
  selectedQueueId,
  onQueueViewChange,
  onQueueSelect,
  className
}: QueueTabWithSidebarProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const renderContent = () => {
    switch (queueView) {
      case 'overview':
        return (
          <QueueOverviewView
            projectId={projectId}
            selectedQueueId={selectedQueueId}
            onQueueSelect={onQueueSelect}
            onCreateQueue={() => setIsCreateDialogOpen(true)}
          />
        )

      case 'items':
        return <QueueItemsView projectId={projectId} selectedQueueId={selectedQueueId} onQueueSelect={onQueueSelect} />

      case 'timeline':
        return <QueueTimelineView projectId={projectId} selectedQueueId={selectedQueueId} />

      case 'analytics':
        return <QueueAnalyticsView projectId={projectId} selectedQueueId={selectedQueueId} />

      default:
        return null
    }
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar */}
      <div className='w-64 border-r flex-shrink-0'>
        <QueueSidebarNav
          projectId={projectId}
          activeView={queueView}
          selectedQueueId={selectedQueueId}
          onViewChange={onQueueViewChange}
          onQueueSelect={onQueueSelect}
          onCreateQueue={() => setIsCreateDialogOpen(true)}
          className='h-full'
        />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-hidden'>{renderContent()}</div>

      {/* Create Queue Dialog */}
      <QueueCreateDialog projectId={projectId} open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </div>
  )
}
