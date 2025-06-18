import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { LazyMonacoEditor } from '@/components/lazy-monaco-editor'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useGenerateStructuredData } from '@/hooks/api/use-gen-ai-api'
import { Copy, Download, Loader2, Sparkles, Code } from 'lucide-react'
import { estimateTokenCount, formatTokenCount } from '@octoprompt/shared'
import { SvgPreview } from '@/components/svg-preview'

interface AssetGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetType: string | null
  onSuccess?: (generatedContent: string, name: string) => void
}

// Language map for Monaco editor
const languageMap: Record<string, string> = {
  icon: 'xml',
  illustration: 'xml',
  logo: 'xml',
  pattern: 'xml',
  'ui-element': 'xml',
  chart: 'xml'
}

// File extension map
const extensionMap: Record<string, string> = {
  icon: '.svg',
  illustration: '.svg',
  logo: '.svg',
  pattern: '.svg',
  'ui-element': '.svg',
  chart: '.svg'
}

// Schema key mapping for API calls
const schemaKeyMap: Record<string, string> = {
  icon: 'svgGenerator',
  illustration: 'svgGenerator',
  logo: 'svgGenerator',
  pattern: 'svgGenerator',
  'ui-element': 'svgGenerator',
  chart: 'svgGenerator'
}

export function AssetGeneratorDialog({ open, onOpenChange, assetType, onSuccess }: AssetGeneratorDialogProps) {
  const [activeTab, setActiveTab] = useState('input')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    style: 'modern',
    colors: '#000000',
    dimensions: '24x24',
    additionalContext: ''
  })
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const { copyToClipboard } = useCopyClipboard()
  const generateMutation = useGenerateStructuredData()

  const assetTypeNames: Record<string, string> = {
    icon: 'Icon',
    illustration: 'Illustration',
    logo: 'Logo',
    pattern: 'Pattern',
    'ui-element': 'UI Element',
    chart: 'Chart/Graph'
  }

  const getAssetTypeName = () => assetTypeNames[assetType || ''] || 'Asset'

  const tokenCount = useMemo(() => {
    const fullContext = `${formData.name} ${formData.description} ${formData.style} ${formData.colors} ${formData.dimensions} ${formData.additionalContext}`
    return estimateTokenCount(fullContext)
  }, [formData])

  const validateSvg = (content: string): boolean => {
    // Basic SVG validation
    const trimmed = content.trim()
    return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')
  }

  const handleGenerate = async () => {
    if (!formData.name.trim()) {
      toast.error('Please provide a name for the asset')
      return
    }

    setIsGenerating(true)
    try {
      // Prepare user input based on asset type
      const userInput = prepareUserInput(assetType || '', formData)
      const schemaKey = schemaKeyMap[assetType || '']

      if (!schemaKey) {
        throw new Error(`Unknown asset type: ${assetType}`)
      }

      const response = await generateMutation.mutateAsync({
        schemaKey,
        userInput,
      })

      let svgContent = ''

      console.log('API Response:', response)

      // Handle different response structures
      if (response.success && response.data?.output) {
        if (typeof response.data.output === 'string') {
          svgContent = response.data.output
        } else if (response.data.output.content) {
          svgContent = response.data.output.content
        }
      }

      console.log('Extracted SVG content:', svgContent)

      // Validate the SVG
      if (!svgContent || !validateSvg(svgContent)) {
        console.error('Invalid SVG content received:', svgContent)
        console.error('Full response:', response)

        // Generate a fallback SVG
        const [width, height] = formData.dimensions.split('x')
        svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${formData.colors}" opacity="0.1"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="${formData.colors}" font-family="system-ui" font-size="14">
    ${formData.name}
  </text>
</svg>`

        toast.warning('Generated a placeholder SVG. Please try again with a different description.')
      } else {
        toast.success(`${getAssetTypeName()} generated successfully!`)
      }

      setGeneratedContent(svgContent)
      setActiveTab('preview')

      if (onSuccess) {
        onSuccess(svgContent, formData.name)
      }
    } catch (error) {
      toast.error('Failed to generate asset')
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    await copyToClipboard(generatedContent, {
      successMessage: 'Content copied to clipboard',
      errorMessage: 'Failed to copy content'
    })
  }

  const handleDownload = () => {
    const blob = new Blob([generatedContent], { type: 'image/svg+xml' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.name}${extensionMap[assetType || ''] || '.svg'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('SVG downloaded')
  }

  const copyAsReactComponent = async () => {
    const componentName = formData.name
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')

    const reactComponent = `import React from 'react'

interface ${componentName}Props {
  className?: string
  width?: number | string
  height?: number | string
}

export function ${componentName}({ className, width = 24, height = 24, ...props }: ${componentName}Props) {
  return (
    ${generatedContent.replace(/width="[\d]+"/, 'width={width}').replace(/height="[\d]+"/, 'height={height}').replace(/<svg/, '<svg className={className} {...props}')}
  )
}`

    await copyToClipboard(reactComponent, {
      successMessage: 'React component copied to clipboard',
      errorMessage: 'Failed to copy React component'
    })
  }

  const handleReset = () => {
    setFormData({
      name: '',
      description: '',
      style: 'modern',
      colors: '#000000',
      dimensions: '24x24',
      additionalContext: ''
    })
    setGeneratedContent('')
    setActiveTab('input')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl h-[80vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5' />
            Generate {getAssetTypeName()}
          </DialogTitle>
          <DialogDescription>
            Provide details about your {getAssetTypeName().toLowerCase()} and AI will generate it for you.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className='flex-1'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='input'>Input</TabsTrigger>
            <TabsTrigger value='preview' disabled={!generatedContent}>
              Preview
              {generatedContent && (
                <Badge variant='secondary' className='ml-2'>
                  Ready
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className='h-[calc(80vh-200px)] mt-4'>
            <TabsContent value='input' className='space-y-4'>
              {renderInputForm(assetType || '', formData, setFormData)}

              <div className='flex justify-between items-center pt-4'>
                <span className='text-sm text-muted-foreground'>Estimated tokens: {formatTokenCount(tokenCount)}</span>
              </div>
            </TabsContent>

            <TabsContent value='preview' className='h-full'>
              {generatedContent && (
                <div className='space-y-4'>
                  <div className='flex justify-between items-center'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' onClick={handleCopy}>
                        <Copy className='h-4 w-4 mr-2' />
                        Copy SVG
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => copyAsReactComponent()}
                      >
                        <Code className='h-4 w-4 mr-2' />
                        Copy as React
                      </Button>
                      <Button variant='outline' size='sm' onClick={handleDownload}>
                        <Download className='h-4 w-4 mr-2' />
                        Download
                      </Button>
                    </div>
                  </div>

                  {/* SVG Preview */}
                  <div className='space-y-2'>
                    <div className='text-sm text-muted-foreground'>Preview</div>
                    <SvgPreview
                      svgContent={generatedContent}
                      className='h-[400px]'
                      showControls={true}
                    />
                  </div>

                  {/* Code Editor */}
                  <div className='border rounded-lg overflow-hidden'>
                    <div className='bg-muted px-3 py-2 text-sm font-medium'>SVG Code</div>
                    <LazyMonacoEditor
                      value={generatedContent}
                      onChange={(value) => setGeneratedContent(value || '')}
                      language={languageMap[assetType || ''] || 'xml'}
                      readOnly={false}
                      className='h-[calc(80vh-500px)]'
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant='outline' onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !formData.name.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className='h-4 w-4 mr-2' />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to render input form based on asset type
function renderInputForm(assetType: string, formData: any, setFormData: (data: any) => void) {
  const updateField = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  // All SVG types share similar inputs
  return (
    <>
      <div>
        <Label htmlFor='name'>Name</Label>
        <Input
          id='name'
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder={assetType === 'icon' ? 'menu-icon' : assetType === 'logo' ? 'company-logo' : 'asset-name'}
        />
      </div>

      <div>
        <Label htmlFor='description'>Description</Label>
        <Textarea
          id='description'
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder={
            assetType === 'icon' ? 'A hamburger menu icon with three horizontal lines' :
              assetType === 'illustration' ? 'An illustration showing a person working on a laptop' :
                assetType === 'logo' ? 'A modern, minimalist logo for a tech startup' :
                  assetType === 'pattern' ? 'A geometric pattern with triangles and hexagons' :
                    assetType === 'ui-element' ? 'A rounded button with gradient background' :
                      'A bar chart showing monthly revenue'
          }
          rows={3}
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label htmlFor='style'>Style</Label>
          <Select value={formData.style} onValueChange={(value) => updateField('style', value)}>
            <SelectTrigger id='style'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='modern'>Modern</SelectItem>
              <SelectItem value='minimalist'>Minimalist</SelectItem>
              <SelectItem value='detailed'>Detailed</SelectItem>
              <SelectItem value='flat'>Flat</SelectItem>
              <SelectItem value='gradient'>Gradient</SelectItem>
              <SelectItem value='outline'>Outline</SelectItem>
              <SelectItem value='3d'>3D Effect</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor='dimensions'>Dimensions</Label>
          <Select value={formData.dimensions} onValueChange={(value) => updateField('dimensions', value)}>
            <SelectTrigger id='dimensions'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='16x16'>16×16 (Small Icon)</SelectItem>
              <SelectItem value='24x24'>24×24 (Default Icon)</SelectItem>
              <SelectItem value='32x32'>32×32 (Medium Icon)</SelectItem>
              <SelectItem value='48x48'>48×48 (Large Icon)</SelectItem>
              <SelectItem value='64x64'>64×64 (Extra Large)</SelectItem>
              <SelectItem value='128x128'>128×128 (Logo Size)</SelectItem>
              <SelectItem value='256x256'>256×256 (High Res)</SelectItem>
              <SelectItem value='512x512'>512×512 (Ultra High Res)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor='colors'>Primary Color</Label>
        <div className='flex gap-2'>
          <Input
            id='colors'
            type='color'
            value={formData.colors}
            onChange={(e) => updateField('colors', e.target.value)}
            className='w-20 h-10 p-1 cursor-pointer'
          />
          <Input
            value={formData.colors}
            onChange={(e) => updateField('colors', e.target.value)}
            placeholder='#000000'
            className='flex-1'
          />
        </div>
      </div>

      <div>
        <Label htmlFor='additionalContext'>Additional Context (optional)</Label>
        <Textarea
          id='additionalContext'
          value={formData.additionalContext}
          onChange={(e) => updateField('additionalContext', e.target.value)}
          placeholder='Any specific requirements, style preferences, or context...'
          rows={2}
        />
      </div>
    </>
  )
}

// Helper function to prepare user input for API
function prepareUserInput(assetType: string, formData: any): string {
  const [width, height] = formData.dimensions.split('x')

  let assetTypeDescription = ''
  switch (assetType) {
    case 'icon':
      assetTypeDescription = 'icon'
      break
    case 'illustration':
      assetTypeDescription = 'illustration'
      break
    case 'logo':
      assetTypeDescription = 'logo'
      break
    case 'pattern':
      assetTypeDescription = 'repeating pattern'
      break
    case 'ui-element':
      assetTypeDescription = 'UI element'
      break
    case 'chart':
      assetTypeDescription = 'chart or data visualization'
      break
  }

  return `Generate an SVG ${assetTypeDescription} based on this description: "${formData.description}"

SPECIFICATIONS:
- Type: ${assetTypeDescription}
- Dimensions: ${width}x${height} pixels (use these exact values in the width and height attributes)
- Style: ${formData.style}
- Primary Color: ${formData.colors}
- ViewBox: 0 0 ${width} ${height}
${formData.additionalContext ? `- Additional requirements: ${formData.additionalContext}` : ''}

The SVG must:
1. Be a complete, valid SVG element
2. Start with: <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
3. End with: </svg>
4. Use the color ${formData.colors} for the main elements
5. Follow the ${formData.style} design style
6. Be optimized and clean

Generate the complete SVG code now:`
}

