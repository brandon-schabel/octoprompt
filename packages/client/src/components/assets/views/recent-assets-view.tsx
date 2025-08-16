import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { useRecentGenerations } from '@/hooks/use-recent-generations'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useCreatePrompt, useAddPromptToProject } from '@/hooks/api/use-prompts-api'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  Clock,
  Copy,
  Download,
  Trash,
  Search,
  FileText,
  Building2,
  Code2,
  Database,
  BookOpen,
  GitBranch,
  Save,
  Filter
} from 'lucide-react'
import { SvgInlinePreview } from '@/components/svg-inline-preview'
import { MarkdownPreview } from '@/components/markdown-preview'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'

interface RecentAssetsViewProps {
  projectId: number
  projectName?: string
}

const assetTypeIcons: Record<string, React.ComponentType<any>> = {
  'project-documentation': FileText,
  'architecture-doc': Building2,
  'api-documentation': Code2,
  'database-schema': Database,
  'user-guide': BookOpen,
  'mermaid-diagram': GitBranch
}

export function RecentAssetsView({ projectId, projectName = 'Project' }: RecentAssetsViewProps) {
  const { recentGenerations, removeGeneration } = useRecentGenerations()
  const { copyToClipboard } = useCopyClipboard()
  const { mutate: createPrompt } = useCreatePrompt()
  const { mutate: addPromptToProject } = useAddPromptToProject()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [savePromptDialog, setSavePromptDialog] = useState<{
    open: boolean
    content: string
    originalName: string
  }>({ open: false, content: '', originalName: '' })
  const [promptName, setPromptName] = useState('')
  const [promptDescription, setPromptDescription] = useState('')

  // Filter generations
  const filteredGenerations = recentGenerations.filter((gen) => {
    const matchesSearch =
      gen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gen.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || gen.assetType === filterType
    return matchesSearch && matchesType
  })

  const handleSaveAsPrompt = (content: string, originalName: string) => {
    setPromptName(originalName)
    setPromptDescription(`Generated documentation for ${originalName}`)
    setSavePromptDialog({ open: true, content, originalName })
  }

  const confirmSavePrompt = () => {
    if (!promptName.trim()) {
      toast.error('Please enter a prompt name')
      return
    }

    // First create the prompt
    createPrompt(
      {
        name: promptName,
        content: savePromptDialog.content
      },
      {
        onSuccess: (response) => {
          const typedResponse = response as any
          if (typedResponse.data?.id) {
            // Then add it to the project
            addPromptToProject(
              { projectId, promptId: typedResponse.data.id },
              {
                onSuccess: () => {
                  toast.success('Documentation saved to prompts!')
                  setSavePromptDialog({ open: false, content: '', originalName: '' })
                  setPromptName('')
                  setPromptDescription('')
                },
                onError: () => {
                  toast.error('Failed to add prompt to project')
                }
              }
            )
          }
        },
        onError: () => {
          toast.error('Failed to create prompt')
        }
      }
    )
  }

  const handleDownload = (content: string, name: string, type: string) => {
    const extension = type.includes('svg') ? '.svg' : '.md'
    const mimeType = type.includes('svg') ? 'image/svg+xml' : 'text/markdown'

    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('File downloaded')
  }

  const getAssetIcon = (assetType: string) => {
    const Icon = assetTypeIcons[assetType] || FileText
    return <Icon className='h-4 w-4' />
  }

  return (
    <div className='h-full flex flex-col p-6 space-y-6'>
      <div>
        <h2 className='text-2xl font-bold flex items-center gap-2'>
          <Clock className='h-6 w-6' />
          Recent Assets
        </h2>
        <p className='text-muted-foreground mt-1'>View and manage recently generated documentation</p>
      </div>

      {/* Search and Filter */}
      <div className='flex gap-4'>
        <div className='flex-1 relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search assets...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-10'
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className='w-[200px]'>
            <SelectValue placeholder='Filter by type' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Types</SelectItem>
            <SelectItem value='project-documentation'>Project Docs</SelectItem>
            <SelectItem value='architecture-doc'>Architecture</SelectItem>
            <SelectItem value='api-documentation'>API Docs</SelectItem>
            <SelectItem value='database-schema'>Database</SelectItem>
            <SelectItem value='user-guide'>User Guides</SelectItem>
            <SelectItem value='mermaid-diagram'>Diagrams</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets List */}
      <ScrollArea className='flex-1'>
        <div className='space-y-4'>
          {filteredGenerations.length > 0 ? (
            filteredGenerations.map((generation) => {
              const isMarkdown = !generation.assetType.includes('svg')
              return (
                <Card key={generation.id} className='group'>
                  <CardHeader>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center gap-3'>
                        {getAssetIcon(generation.assetType)}
                        <div>
                          <CardTitle className='text-base'>{generation.name}</CardTitle>
                          <CardDescription className='text-sm'>
                            Generated {formatDistanceToNow(generation.timestamp, { addSuffix: true })}
                          </CardDescription>
                        </div>
                      </div>
                      <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handleSaveAsPrompt(generation.content, generation.name)}
                          title='Save as prompt'
                        >
                          <Save className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() =>
                            copyToClipboard(generation.content, {
                              successMessage: 'Content copied'
                            })
                          }
                        >
                          <Copy className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handleDownload(generation.content, generation.name, generation.assetType)}
                        >
                          <Download className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='text-destructive'
                          onClick={() => removeGeneration(generation.id)}
                        >
                          <Trash className='h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='border rounded-lg p-4 max-h-[300px] overflow-hidden'>
                      {isMarkdown ? (
                        <MarkdownPreview
                          markdownContent={generation.content}
                          size='sm'
                          className='max-h-[250px] overflow-y-auto'
                        />
                      ) : (
                        <SvgInlinePreview
                          svgContent={generation.content}
                          size='md'
                          background='checkerboard'
                          className='mx-auto'
                        />
                      )}
                    </div>
                    <div className='mt-3 flex gap-2'>
                      <Badge variant='secondary'>{generation.assetType.replace(/-/g, ' ')}</Badge>
                      <Badge variant='outline'>{isMarkdown ? 'Markdown' : 'SVG'}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <Card>
              <CardContent className='pt-6'>
                <p className='text-center text-muted-foreground py-8'>
                  {searchQuery || filterType !== 'all'
                    ? 'No assets match your search criteria'
                    : 'No recent assets generated yet'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Save as Prompt Dialog */}
      <Dialog open={savePromptDialog.open} onOpenChange={(open) => setSavePromptDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Documentation as Prompt</DialogTitle>
            <DialogDescription>
              Save this generated documentation as a reusable prompt in your project
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Prompt Name</Label>
              <Input
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder='e.g., API Documentation Template'
              />
            </div>
            <div className='space-y-2'>
              <Label>Description</Label>
              <Textarea
                value={promptDescription}
                onChange={(e) => setPromptDescription(e.target.value)}
                placeholder='Describe what this prompt contains...'
                className='min-h-[80px]'
              />
            </div>
            <div className='space-y-2'>
              <Label>Preview</Label>
              <div className='border rounded p-3 bg-muted max-h-[150px] overflow-y-auto'>
                <pre className='text-xs whitespace-pre-wrap'>{savePromptDialog.content.substring(0, 500)}...</pre>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setSavePromptDialog({ open: false, content: '', originalName: '' })}
            >
              Cancel
            </Button>
            <Button onClick={confirmSavePrompt}>
              <Save className='h-4 w-4 mr-2' />
              Save to Prompts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
