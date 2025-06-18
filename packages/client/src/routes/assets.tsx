import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Component,
  TestTube,
  Settings,
  Code,
  FileCode,
  Sparkles,
  Copy,
  Download,
  Eye,
  EyeOff,
  Trash,
  Square,
  Image,
  Hexagon,
  Grid3x3,
  Layout,
  BarChart3,
  List,
  Grid
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AssetGeneratorDialog } from '@/components/assets/asset-generator-dialog'
import { useRecentGenerations } from '@/hooks/use-recent-generations'
import { formatDistanceToNow } from 'date-fns'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { SvgInlinePreview } from '@/components/svg-inline-preview'

// SVG Asset type definitions
const assetTypes = [
  {
    id: 'icon',
    name: 'Icon',
    description: 'Generate clean, scalable icons for UI elements',
    icon: Square,
    category: 'icons',
    comingSoon: false,
    examples: 'menu, arrow, close, user, settings'
  },
  {
    id: 'illustration',
    name: 'Illustration',
    description: 'Create detailed illustrations and graphics',
    icon: Image,
    category: 'graphics',
    comingSoon: false,
    examples: 'hero images, feature graphics, decorative elements'
  },
  {
    id: 'logo',
    name: 'Logo',
    description: 'Design logos and brand marks',
    icon: Hexagon,
    category: 'branding',
    comingSoon: false,
    examples: 'company logos, app icons, brand symbols'
  },
  {
    id: 'pattern',
    name: 'Pattern',
    description: 'Generate repeating patterns and backgrounds',
    icon: Grid3x3,
    category: 'backgrounds',
    comingSoon: false,
    examples: 'geometric patterns, textures, decorative backgrounds'
  },
  {
    id: 'ui-element',
    name: 'UI Element',
    description: 'Create UI components like buttons, cards, badges',
    icon: Layout,
    category: 'interface',
    comingSoon: false,
    examples: 'buttons, toggles, progress bars, badges'
  },
  {
    id: 'chart',
    name: 'Chart/Graph',
    description: 'Generate data visualization elements',
    icon: BarChart3,
    category: 'data-viz',
    comingSoon: false,
    examples: 'bar charts, pie charts, line graphs, gauges'
  }
]

const categories = [
  { id: 'all', name: 'All SVGs' },
  { id: 'icons', name: 'Icons' },
  { id: 'graphics', name: 'Graphics' },
  { id: 'branding', name: 'Branding' },
  { id: 'backgrounds', name: 'Backgrounds' },
  { id: 'interface', name: 'UI Elements' },
  { id: 'data-viz', name: 'Data Visualization' }
]

// File extension map for downloads
const extensionMap: Record<string, string> = {
  icon: '.svg',
  illustration: '.svg',
  logo: '.svg',
  pattern: '.svg',
  'ui-element': '.svg',
  chart: '.svg'
}

export function AssetsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [generatorDialogOpen, setGeneratorDialogOpen] = useState(false)
  const { recentGenerations, addGeneration, removeGeneration } = useRecentGenerations()
  const { copyToClipboard } = useCopyClipboard()

  const filteredAssets = assetTypes.filter((asset) => selectedCategory === 'all' || asset.category === selectedCategory)

  const handleGenerateAsset = (assetId: string) => {
    setSelectedAsset(assetId)
    setGeneratorDialogOpen(true)
  }

  const handleGeneratorClose = () => {
    setGeneratorDialogOpen(false)
    // Keep selectedAsset for a moment to prevent flicker
    setTimeout(() => setSelectedAsset(null), 300)
  }

  const handleGenerationSuccess = (content: string, name: string) => {
    if (selectedAsset) {
      addGeneration(selectedAsset, name, content)
    }
  }

  return (
    <div className='container mx-auto p-6 space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold flex items-center gap-2'>
            <Sparkles className='h-8 w-8 text-primary' />
            SVG Asset Generator
          </h1>
          <p className='text-muted-foreground mt-1'>Generate high-quality SVG graphics with AI assistance</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
            {viewMode === 'list' ? (
              <>
                <Grid className='h-4 w-4 mr-2' />
                Grid View
              </>
            ) : (
              <>
                <List className='h-4 w-4 mr-2' />
                List View
              </>
            )}
          </Button>
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
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className='mt-6'>
          {/* Asset Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {filteredAssets.map((asset) => {
              const Icon = asset.icon
              return (
                <Card
                  key={asset.id}
                  className={cn(
                    'group hover:shadow-lg transition-all cursor-pointer',
                    asset.comingSoon && 'opacity-60'
                  )}
                  onClick={() => !asset.comingSoon && handleGenerateAsset(asset.id)}
                >
                  <CardHeader>
                    <div className='flex items-start justify-between'>
                      <Icon className='h-8 w-8 text-primary' />
                      {asset.comingSoon && (
                        <Badge variant='secondary' className='text-xs'>
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <CardTitle className='mt-3'>{asset.name}</CardTitle>
                    <CardDescription>{asset.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='flex items-center justify-between'>
                      <Badge variant='outline' className='text-xs'>
                        {asset.category}
                      </Badge>
                      <Button
                        size='sm'
                        variant='ghost'
                        disabled={asset.comingSoon}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGenerateAsset(asset.id)
                        }}
                      >
                        Generate
                        <Sparkles className='h-3 w-3 ml-1' />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent Generations */}
      <div className='mt-8'>
        <h2 className='text-xl font-semibold mb-4'>Recent Generations</h2>
        {recentGenerations.length > 0 ? (
          viewMode === 'grid' ? (
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
              {recentGenerations.map((generation) => {
                const assetType = assetTypes.find((t) => t.id === generation.assetType)
                
                return (
                  <Card key={generation.id} className='group cursor-pointer overflow-hidden'>
                    <CardContent className='p-2'>
                      <SvgInlinePreview
                        svgContent={generation.content}
                        size='md'
                        background='checkerboard'
                        className='w-full'
                        showHoverPreview={false}
                      />
                      <div className='mt-2 space-y-1'>
                        <p className='text-xs font-medium truncate'>{generation.name}</p>
                        <p className='text-xs text-muted-foreground'>
                          {formatDistanceToNow(generation.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                      <div className='flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6'
                          onClick={async (e) => {
                            e.stopPropagation()
                            await copyToClipboard(generation.content, {
                              successMessage: 'SVG copied'
                            })
                          }}
                        >
                          <Copy className='h-3 w-3' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6'
                          onClick={(e) => {
                            e.stopPropagation()
                            const blob = new Blob([generation.content], { type: 'image/svg+xml' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${generation.name}.svg`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                        >
                          <Download className='h-3 w-3' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 text-destructive'
                          onClick={(e) => {
                            e.stopPropagation()
                            removeGeneration(generation.id)
                          }}
                        >
                          <Trash className='h-3 w-3' />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className='grid gap-4'>
            {recentGenerations.map((generation) => {
              const assetType = assetTypes.find((t) => t.id === generation.assetType)
              const Icon = assetType?.icon || FileText

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
                          onClick={async () => {
                            await copyToClipboard(generation.content, {
                              successMessage: 'Content copied to clipboard'
                            })
                          }}
                        >
                          <Copy className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8'
                          onClick={() => {
                            const blob = new Blob([generation.content], { type: 'text/plain' })
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${generation.name}${extensionMap[generation.assetType] || '.txt'}`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            window.URL.revokeObjectURL(url)
                            toast.success('File downloaded')
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
          )
        ) : (
          <Card>
            <CardContent className='pt-6'>
              <p className='text-center text-muted-foreground py-8'>
                No recent generations yet. Start by selecting an asset type above.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Asset Generator Dialog */}
      <AssetGeneratorDialog
        open={generatorDialogOpen}
        onOpenChange={handleGeneratorClose}
        assetType={selectedAsset}
        onSuccess={(content, name) => {
          handleGenerationSuccess(content, name)
          toast.success('Asset generated successfully!')
        }}
      />
    </div>
  )
}

export const Route = createFileRoute('/assets')({
  component: AssetsPage
})
