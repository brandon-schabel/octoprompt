import React from 'react'
import { ProjectSummarizationSettingsPage } from '@/routes/project-summarization'
import { useScrollToSection } from '@/hooks/use-scroll-to-section'
import { Route } from '@/routes/projects'

export function SummarizationView() {
  // Get search params and use the scroll to section hook
  const search = Route.useSearch()
  useScrollToSection({ search })

  return (
    <div className='p-4 md:p-6 h-full overflow-y-auto'>
      <ProjectSummarizationSettingsPage />
    </div>
  )
}
