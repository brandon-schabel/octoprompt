import { useState } from 'react'
import { Project } from '@promptliano/schemas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { AssetGeneratorDialog } from '@/components/assets/asset-generator-dialog'
import { useRecentGenerations } from '@/hooks/use-recent-generations'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { formatDistanceToNow } from 'date-fns'
import {
  Sparkles,
  Square,
  Image,
  Hexagon,
  Grid3x3,
  Layout,
  BarChart3,
  Copy,
  Download,
  Eye,
  EyeOff,
  Code,
  Trash,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import { SvgInlinePreview } from '@/components/svg-inline-preview'
import { MarkdownInlinePreview } from '@promptliano/ui'
import { MarkdownPreview } from '@/components/markdown-preview'

interface ProjectAssetsViewProps {
  project: Project
  projectId: number
}

const assetTypes = [
  {
    id: 'icon',
    name: 'Icon',
    description: 'Generate clean, scalable icons',
    icon: Square,
    category: 'icons'
  },
  {
    id: 'illustration',
    name: 'Illustration',
    description: 'Create detailed illustrations',
    icon: Image,
    category: 'graphics'
  },
  {
    id: 'logo',
    name: 'Logo',
    description: 'Design logos and brand marks',
    icon: Hexagon,
    category: 'branding'
  },
  {
    id: 'pattern',
    name: 'Pattern',
    description: 'Generate repeating patterns',
    icon: Grid3x3,
    category: 'backgrounds'
  },
  {
    id: 'ui-element',
    name: 'UI Element',
    description: 'Create UI components',
    icon: Layout,
    category: 'interface'
  },
  {
    id: 'chart',
    name: 'Chart/Graph',
    description: 'Generate data visualizations',
    icon: BarChart3,
    category: 'data-viz'
  }
]

export function ProjectAssetsView({ project, projectId }: ProjectAssetsViewProps) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [generatorDialogOpen, setGeneratorDialogOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const { recentGenerations, addGeneration, removeGeneration } = useRecentGenerations()
  const { copyToClipboard } = useCopyClipboard()

  // Filter recent generations for this project
  const projectGenerations = recentGenerations.filter(
    (gen) => gen.name.toLowerCase().includes(project.name.toLowerCase()) || gen.content.includes(project.name)
  )

  const handleGenerateAsset = (assetId: string) => {
    setSelectedAsset(assetId)
    setGeneratorDialogOpen(true)
  }

  const handleGeneratorClose = () => {
    setGeneratorDialogOpen(false)
    setTimeout(() => setSelectedAsset(null), 300)
  }

  const handleGenerationSuccess = (content: string, name: string) => {
    if (selectedAsset) {
      addGeneration(selectedAsset, `${project.name}-${name}`, content)
    }
  }

  const copyAsReactComponent = async (svgContent: string, name: string) => {
    const componentName = name
      .split(/[-_\s]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')

    const reactComponent = `import React from 'react'

interface ${componentName}Props {
  className?: string
  width?: number | string
  height?: number | string
}

export function ${componentName}({ className, width = 24, height = 24, ...props }: ${componentName}Props) {
  return (
    ${svgContent
      .replace(/width="[\d]+"/, 'width={width}')
      .replace(/height="[\d]+"/, 'height={height}')
      .replace(/<svg/, '<svg className={className} {...props}')}
  )
}`

    await copyToClipboard(reactComponent, {
      successMessage: 'React component copied to clipboard'
    })
  }

  return (
    <div className='h-full flex flex-col p-4 space-y-4'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <div>
          <h3 className='text-lg font-semibold'>SVG Assets</h3>
          <p className='text-sm text-muted-foreground'>Generate and manage SVG assets for {project.name}</p>
        </div>
        <Button variant='outline' size='sm' onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? (
            <>
              <EyeOff className='h-4 w-4 mr-2' />
              Hide Preview
            </>
          ) : (
            <>
              <Eye className='h-4 w-4 mr-2' />
              Show Preview
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue='generate' className='flex-1 flex flex-col'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='generate'>Generate New</TabsTrigger>
          <TabsTrigger value='recent'>
            Recent Assets
            {projectGenerations.length > 0 && (
              <Badge variant='secondary' className='ml-2'>
                {projectGenerations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <ScrollArea className='flex-1'>
          <TabsContent value='generate' className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {assetTypes.map((asset) => {
                const Icon = asset.icon
                return (
                  <Card
                    key={asset.id}
                    className='group hover:shadow-lg transition-all cursor-pointer'
                    onClick={() => handleGenerateAsset(asset.id)}
                  >
                    <CardHeader className='pb-3'>
                      <div className='flex items-start justify-between'>
                        <Icon className='h-8 w-8 text-primary' />
                      </div>
                      <CardTitle className='mt-3 text-base'>{asset.name}</CardTitle>
                      <CardDescription className='text-sm'>{asset.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='w-full'
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGenerateAsset(asset.id)
                        }}
                      >
                        <Plus className='h-4 w-4 mr-2' />
                        Generate
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value='recent' className='space-y-4'>
            {projectGenerations.length > 0 ? (
              <div className='grid gap-4'>
                {projectGenerations.map((generation) => {
                  const assetType = assetTypes.find((t) => t.id === generation.assetType)
                  const Icon = assetType?.icon || Square

                  return (
                    <Card key={generation.id} className='group'>
                      <CardHeader className='pb-3'>
                        <div className='flex items-start justify-between'>
                          <div className='flex items-center gap-3'>
                            <Icon className='h-5 w-5 text-primary' />
                            <div>
                              <CardTitle className='text-base'>{generation.name}</CardTitle>
                              <CardDescription className='text-xs'>
                                {assetType?.name} • {formatDistanceToNow(generation.timestamp, { addSuffix: true })}
                              </CardDescription>
                            </div>
                          </div>
                          <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              onClick={() =>
                                copyToClipboard(generation.content, {
                                  successMessage: 'SVG copied to clipboard'
                                })
                              }
                            >
                              <Copy className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              onClick={() => copyAsReactComponent(generation.content, generation.name)}
                            >
                              <Code className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              onClick={() => {
                                const blob = new Blob([generation.content], { type: 'image/svg+xml' })
                                const url = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `${generation.name}.svg`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                window.URL.revokeObjectURL(url)
                                toast.success('SVG downloaded')
                              }}
                            >
                              <Download className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 text-destructive'
                              onClick={() => removeGeneration(generation.id)}
                            >
                              <Trash className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {showPreview && (
                        <CardContent>
                          <div className='flex items-center justify-center'>
                            <SvgInlinePreview
                              svgContent={generation.content}
                              size='lg'
                              background='checkerboard'
                              className='mx-auto'
                            />
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className='pt-6'>
                  <p className='text-center text-muted-foreground py-8'>
                    No assets generated for this project yet. Click on an asset type above to get started.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Asset Generator Dialog */}
      <AssetGeneratorDialog
        open={generatorDialogOpen}
        onOpenChange={handleGeneratorClose}
        assetType={selectedAsset}
        onSuccess={(content, name) => {
          handleGenerationSuccess(content, name)
          toast.success('SVG asset generated successfully!')
        }}
      />
    </div>
  )
}
