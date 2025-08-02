import React from 'react'
import { ProjectStatsDisplayEnhanced } from './project-stats-display-enhanced-v2'

interface StatisticsViewProps {
  projectId: number
}

export function StatisticsView({ projectId }: StatisticsViewProps) {
  return (
    <div className='p-4 md:p-6 h-full overflow-y-auto'>
      <ProjectStatsDisplayEnhanced projectId={projectId} />
    </div>
  )
}
