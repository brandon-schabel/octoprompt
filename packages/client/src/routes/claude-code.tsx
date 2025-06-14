import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ClaudeCodeAgent } from '@/components/claude-code/claude-code-agent'
import { useGetProject, useGetProjects } from '@/hooks/api/use-projects-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { z } from 'zod'

const searchSchema = z.object({
  projectId: z.string().optional()
})

export const Route = createFileRoute('/claude-code')({
  component: ClaudeCodePage,
  validateSearch: searchSchema
})

function ClaudeCodePage() {
  const navigate = useNavigate()
  const { projectId } = Route.useSearch()
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(projectId ? parseInt(projectId) : null)

  const { data: projectsData } = useGetProjects()
  const { data: projectData } = useGetProject(selectedProjectId!)

  const projects = projectsData?.data || []
  const selectedProject = projectData?.data

  useEffect(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        projectId: selectedProjectId ? selectedProjectId.toString() : undefined
      })
    })
  }, [selectedProjectId, navigate])

  return (
    <div className='h-screen flex flex-col'>
      <div className='flex-none p-4 border-b'>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Project Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-4'>
              <div className='flex-1'>
                <Select
                  value={selectedProjectId?.toString() || ''}
                  onValueChange={(value) => setSelectedProjectId(value ? parseInt(value) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select a project...' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=''>No project (global context)</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        <div className='flex items-center gap-2'>
                          <FileText className='h-3 w-3' />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProject && (
                <div className='text-sm text-muted-foreground'>Path: {selectedProject.folderPath}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className='flex-1 overflow-hidden'>
        <ClaudeCodeAgent
          projectPath={selectedProject?.folderPath}
          projectName={selectedProject?.name}
          projectId={selectedProjectId || undefined}
        />
      </div>
    </div>
  )
}
