import { createFileRoute, redirect } from '@tanstack/react-router'
import { ProjectsPage } from './projects'

export const Route = createFileRoute('/projects/$tabId/$projectId')({
  beforeLoad: ({ params }) => {
    const tabId = parseInt(params.tabId)
    const projectId = parseInt(params.projectId)
    
    if (isNaN(tabId) || isNaN(projectId)) {
      throw redirect({
        to: '/projects'
      })
    }
    
    return { tabId, projectId }
  },
  component: ProjectsPage
})