import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/api/use-api-client'
import { Button } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { FileText, RefreshCw, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@promptliano/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@promptliano/ui'
import { toast } from 'sonner'

interface AgentFilesManagerProps {
  projectId: number
}

interface AgentFile {
  path: string
  filename: string
  exists: boolean
  hasInstructions: boolean
  version?: string
  needsUpdate: boolean
  type?: string
  scope?: string
  writable?: boolean
}

export function AgentFilesManager({ projectId }: AgentFilesManagerProps) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const {
    data: filesData,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['agent-files', projectId],
    queryFn: async () => {
      const response = await client?.agentFiles.detectFiles(projectId)
      return response?.data
    }
  })

  const { data: statusData } = useQuery({
    queryKey: ['agent-files-status', projectId],
    queryFn: async () => {
      const response = await client?.agentFiles.getStatus(projectId)
      return response?.data
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (files?: { path: string; update: boolean }[]) => {
      const response = await client?.agentFiles.updateFile(projectId, {
        files
      })
      return response
    },
    onSuccess: (data) => {
      toast.success('Agent files updated', {
        description: `Successfully updated ${data?.data?.results?.length || 0} files`
      })
      queryClient.invalidateQueries({ queryKey: ['agent-files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['agent-files-status', projectId] })
      setSelectedFiles(new Set())
    },
    onError: (error) => {
      toast.error('Update failed', {
        description: error.message
      })
    }
  })

  const handleSelectFile = (path: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(path)) {
      newSelection.delete(path)
    } else {
      newSelection.add(path)
    }
    setSelectedFiles(newSelection)
  }

  const handleUpdateSelected = () => {
    const filesToUpdate = Array.from(selectedFiles).map((path) => ({
      path,
      update: true
    }))
    updateMutation.mutate(filesToUpdate)
  }

  const handleUpdateAll = () => {
    updateMutation.mutate([])
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-8'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </CardContent>
      </Card>
    )
  }

  // Transform and combine data from both endpoints
  const transformedFiles: AgentFile[] = []

  if (filesData && statusData) {
    // Process project files
    const projectFiles = filesData.projectFiles || []
    const statusFiles = statusData.files || []

    // Create a map for quick status lookup
    const statusMap = new Map(statusFiles.map((f: any) => [f.path, f]))

    // Combine project and global files
    const allFiles = [
      ...projectFiles.map((f: any) => ({ ...f, source: 'project' })),
      ...(filesData.globalFiles || []).map((f: any) => ({ ...f, source: 'global' }))
    ]

    allFiles.forEach((file: any) => {
      const statusInfo = statusMap.get(file.path) as any
      transformedFiles.push({
        path: file.path,
        filename: file.path.split('/').pop() || file.name || 'Unknown',
        exists: file.exists,
        hasInstructions: (statusInfo && typeof statusInfo === 'object' && statusInfo.hasInstructions) || file.hasInstructions || false,
        version: (statusInfo && typeof statusInfo === 'object' && statusInfo.instructionVersion) || undefined,
        needsUpdate: (statusInfo && typeof statusInfo === 'object' && statusInfo.isOutdated) || false,
        type: file.type,
        scope: file.scope || file.source,
        writable: file.writable
      })
    })
  }

  const files = transformedFiles
  const needsUpdateCount = files.filter((f) => f.needsUpdate).length

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Agent Configuration Files</CardTitle>
            <CardDescription>Manage Promptliano MCP instructions in your agent configuration files</CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            {needsUpdateCount > 0 && (
              <Badge variant='secondary'>
                <AlertCircle className='w-3 h-3 mr-1' />
                {needsUpdateCount} need{needsUpdateCount === 1 ? 's' : ''} update
              </Badge>
            )}
            <Button variant='outline' size='sm' onClick={() => refetch()}>
              <RefreshCw className='h-4 w-4 mr-2' />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[50px]'></TableHead>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file: AgentFile) => (
                <TableRow key={file.path}>
                  <TableCell>
                    <Checkbox
                      checked={selectedFiles.has(file.path)}
                      onCheckedChange={() => handleSelectFile(file.path)}
                      disabled={!file.exists}
                    />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <FileText className='h-4 w-4 text-muted-foreground' />
                      <Tooltip>
                        <TooltipTrigger>
                          <span className='font-mono text-sm'>{file.filename}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className='text-xs'>{file.path}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline' className='capitalize'>
                      {file.type || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={file.scope === 'global' ? 'secondary' : 'default'}>{file.scope || 'Unknown'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      {file.exists ? (
                        <Badge variant='outline' className='gap-1'>
                          <Check className='h-3 w-3' />
                          Exists
                        </Badge>
                      ) : (
                        <Badge variant='secondary' className='gap-1'>
                          <X className='h-3 w-3' />
                          Not Found
                        </Badge>
                      )}
                      {file.hasInstructions && (
                        <Badge variant='default' className='gap-1'>
                          <Check className='h-3 w-3' />
                          Configured
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {file.version ? (
                      <Badge variant='outline'>v{file.version}</Badge>
                    ) : (
                      <span className='text-sm text-muted-foreground'>-</span>
                    )}
                  </TableCell>
                  <TableCell className='text-right'>
                    {file.needsUpdate && (
                      <Badge variant='secondary' className='text-xs'>
                        Update Available
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className='flex items-center justify-between pt-4 border-t'>
            <div className='text-sm text-muted-foreground'>
              {selectedFiles.size > 0 && (
                <span>
                  {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <div className='flex gap-2'>
              {selectedFiles.size > 0 && (
                <Button onClick={handleUpdateSelected} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  ) : (
                    <RefreshCw className='h-4 w-4 mr-2' />
                  )}
                  Update Selected
                </Button>
              )}
              <Button variant='outline' onClick={handleUpdateAll} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <RefreshCw className='h-4 w-4 mr-2' />
                )}
                Update All Files
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
