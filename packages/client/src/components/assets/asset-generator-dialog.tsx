import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { LazyMonacoEditor } from '@/components/lazy-monaco-editor'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { toast } from 'sonner'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useGenerateStructuredData } from '@/hooks/api/use-gen-ai-api'
import { Copy, Download, Loader2, Sparkles, Code } from 'lucide-react'
import { estimateTokenCount, formatTokenCount } from '@promptliano/shared'
import { SvgPreview } from '@/components/svg-preview'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ProviderModelSelector, useModelSelection } from '@/components/model-selection'
import { Separator } from '@promptliano/ui'
import { APIProviders } from '@promptliano/schemas'

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
  chart: 'xml',
  'architecture-doc': 'markdown',
  'mermaid-diagram': 'markdown'
}

// File extension map
const extensionMap: Record<string, string> = {
  icon: '.svg',
  illustration: '.svg',
  logo: '.svg',
  pattern: '.svg',
  'ui-element': '.svg',
  chart: '.svg',
  'architecture-doc': '.md',
  'mermaid-diagram': '.md'
}

// Schema key mapping for API calls
const schemaKeyMap: Record<string, string> = {
  icon: 'svgGenerator',
  illustration: 'svgGenerator',
  logo: 'svgGenerator',
  pattern: 'svgGenerator',
  'ui-element': 'svgGenerator',
  chart: 'svgGenerator',
  'architecture-doc': 'architectureDocGenerator',
  'mermaid-diagram': 'mermaidDiagramGenerator'
}

export function AssetGeneratorDialog({ open, onOpenChange, assetType, onSuccess }: AssetGeneratorDialogProps) {
  const [activeTab, setActiveTab] = useState('input')

  // Common form data for all asset types
  const [commonFormData, setCommonFormData] = useState<CommonFormData>({
    name: '',
    description: '',
    additionalContext: ''
  })

  // SVG-specific form data
  const [svgFormData, setSvgFormData] = useState<SvgFormData>({
    style: 'modern',
    colors: '#000000',
    dimensions: '24x24'
  })

  // Markdown-specific form data
  const [markdownFormData, setMarkdownFormData] = useState<MarkdownFormData>({
    documentFormat: 'standard',
    diagramType: 'auto',
    includeTableOfContents: true,
    targetAudience: 'developers',
    includeExamples: true,
    sections: []
  })

  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Model selection state
  const { provider, model, setProvider: setProviderBase, setModel } = useModelSelection({
    persistenceKey: 'asset-generator-model',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o'
  })

  // Wrapper to handle string | APIProviders type
  const setProvider = (newProvider: string | APIProviders) => {
    setProviderBase(newProvider as APIProviders)
  }

  const { copyToClipboard } = useCopyClipboard()
  // Use extended timeout (3 minutes) for asset generation which can take longer with many tokens
  const generateMutation = useGenerateStructuredData({ timeout: 180000 })

  const assetTypeNames: Record<string, string> = {
    icon: 'Icon',
    illustration: 'Illustration',
    logo: 'Logo',
    pattern: 'Pattern',
    'ui-element': 'UI Element',
    chart: 'Chart/Graph',
    'architecture-doc': 'Architecture Documentation',
    'mermaid-diagram': 'Mermaid Diagram'
  }

  const getAssetTypeName = () => assetTypeNames[assetType || ''] || 'Asset'

  const tokenCount = useMemo(() => {
    const isMarkdown = ['architecture-doc', 'mermaid-diagram'].includes(assetType || '')

    if (isMarkdown) {
      const markdownContext = `${commonFormData.name} ${commonFormData.description} ${commonFormData.additionalContext} ${markdownFormData.documentFormat} ${markdownFormData.targetAudience}`
      return estimateTokenCount(markdownContext)
    } else {
      const svgContext = `${commonFormData.name} ${commonFormData.description} ${svgFormData.style} ${svgFormData.colors} ${svgFormData.dimensions} ${commonFormData.additionalContext}`
      return estimateTokenCount(svgContext)
    }
  }, [commonFormData, svgFormData, markdownFormData, assetType])

  const validateContent = (content: string, format: string): boolean => {
    if (format === 'svg') {
      // Basic SVG validation
      const trimmed = content.trim()
      return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')
    } else if (format === 'markdown') {
      // Basic markdown validation - just check it's not empty
      return content.trim().length > 0
    }
    return false
  }

  const getAssetFormat = (assetType: string): string => {
    if (['icon', 'illustration', 'logo', 'pattern', 'ui-element', 'chart'].includes(assetType)) {
      return 'svg'
    }
    return 'markdown'
  }

  const handleGenerate = async () => {
    if (!commonFormData.name.trim()) {
      toast.error('Please provide a name for the asset')
      return
    }

    setIsGenerating(true)
    try {
      // Merge form data based on asset type
      const isMarkdown = ['architecture-doc', 'mermaid-diagram'].includes(assetType || '')
      const formData = isMarkdown ? { ...commonFormData, ...markdownFormData } : { ...commonFormData, ...svgFormData }

      // Prepare user input based on asset type
      const userInput = prepareUserInput(assetType || '', formData)
      const schemaKey = schemaKeyMap[assetType || '']

      if (!schemaKey) {
        throw new Error(`Unknown asset type: ${assetType}`)
      }

      const response = await generateMutation.mutateAsync({
        schemaKey,
        userInput,
        options: {
          model,
          provider
        }
      })

      let generatedContent = ''
      const assetFormat = getAssetFormat(assetType || '')

      console.log('API Response:', response)

      // Handle different response structures
      if (response && typeof response === 'object' && 'success' in response && response.success) {
        const responseData = response as { success: boolean; data?: { output?: string | { content?: string } } }
        if (responseData.data?.output) {
          if (typeof responseData.data.output === 'string') {
            generatedContent = responseData.data.output
          } else if (typeof responseData.data.output === 'object' && 'content' in responseData.data.output) {
            generatedContent = responseData.data.output.content || ''
          }
        }
      }

      console.log('Extracted content:', generatedContent)

      // Validate the content
      if (!generatedContent || !validateContent(generatedContent, assetFormat)) {
        console.error('Invalid content received:', generatedContent)
        console.error('Full response:', response)

        if (assetFormat === 'svg') {
          // Generate a fallback SVG
          const [width, height] = svgFormData.dimensions.split('x')
          generatedContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${svgFormData.colors}" opacity="0.1"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="${svgFormData.colors}" font-family="system-ui" font-size="14">
    ${commonFormData.name}
  </text>
</svg>`
          toast.warning('Generated a placeholder SVG. Please try again with a different description.')
        } else {
          // Generate fallback markdown
          generatedContent = `# ${commonFormData.name}\n\n${commonFormData.description}\n\n*Failed to generate content. Please try again.*`
          toast.warning('Generated placeholder content. Please try again with a different description.')
        }
      } else {
        toast.success(`${getAssetTypeName()} generated successfully!`)
      }

      setGeneratedContent(generatedContent)
      setActiveTab('preview')

      if (onSuccess) {
        onSuccess(generatedContent, commonFormData.name)
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
    const assetFormat = getAssetFormat(assetType || '')
    const mimeType = assetFormat === 'svg' ? 'image/svg+xml' : 'text/markdown'
    const blob = new Blob([generatedContent], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${commonFormData.name}${extensionMap[assetType || ''] || '.txt'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success(`${assetFormat === 'svg' ? 'SVG' : 'Markdown'} file downloaded`)
  }

  const copyAsReactComponent = async () => {
    const componentName = commonFormData.name
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
    ${generatedContent
      .replace(/width="[\d]+"/, 'width={width}')
      .replace(/height="[\d]+"/, 'height={height}')
      .replace(/<svg/, '<svg className={className} {...props}')}
  )
}`

    await copyToClipboard(reactComponent, {
      successMessage: 'React component copied to clipboard',
      errorMessage: 'Failed to copy React component'
    })
  }

  const handleReset = () => {
    setCommonFormData({
      name: '',
      description: '',
      additionalContext: ''
    })
    setSvgFormData({
      style: 'modern',
      colors: '#000000',
      dimensions: '24x24'
    })
    setMarkdownFormData({
      documentFormat: 'standard',
      diagramType: 'auto',
      includeTableOfContents: true,
      targetAudience: 'developers',
      includeExamples: true,
      sections: []
    })
    setGeneratedContent('')
    setActiveTab('input')
    // Note: Model selection persists due to localStorage
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
              {renderInputForm(
                assetType || '',
                commonFormData,
                setCommonFormData,
                svgFormData,
                setSvgFormData,
                markdownFormData,
                setMarkdownFormData
              )}

              <Separator className='my-4' />

              <div className='space-y-4'>
                <div>
                  <Label>AI Model Selection</Label>
                  <p className='text-sm text-muted-foreground mb-3'>
                    Choose the AI provider and model for generating your asset
                  </p>
                  <ProviderModelSelector
                    provider={provider}
                    currentModel={model}
                    onProviderChange={setProvider}
                    onModelChange={setModel}
                    layout='compact'
                    showLabels={false}
                  />
                </div>
              </div>

              <div className='flex justify-between items-center pt-4'>
                <div className='flex flex-col gap-1'>
                  <span className='text-sm text-muted-foreground'>
                    Estimated tokens: {formatTokenCount(tokenCount)}
                  </span>
                  {tokenCount > 1500 && (
                    <span className='text-xs text-amber-600 dark:text-amber-400'>
                      ⚠️ Large generation may take 30-60 seconds
                    </span>
                  )}
                  {tokenCount > 2500 && (
                    <span className='text-xs text-amber-600 dark:text-amber-400'>
                      Consider simplifying your request for faster generation
                    </span>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value='preview' className='h-full'>
              {generatedContent && (
                <div className='space-y-4'>
                  <div className='flex justify-between items-center'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' onClick={handleCopy}>
                        <Copy className='h-4 w-4 mr-2' />
                        Copy {getAssetFormat(assetType || '') === 'svg' ? 'SVG' : 'Markdown'}
                      </Button>
                      {getAssetFormat(assetType || '') === 'svg' && (
                        <Button variant='outline' size='sm' onClick={() => copyAsReactComponent()}>
                          <Code className='h-4 w-4 mr-2' />
                          Copy as React
                        </Button>
                      )}
                      <Button variant='outline' size='sm' onClick={handleDownload}>
                        <Download className='h-4 w-4 mr-2' />
                        Download
                      </Button>
                    </div>
                  </div>

                  {/* Content Preview */}
                  <div className='space-y-2'>
                    <div className='text-sm text-muted-foreground'>Preview</div>
                    {getAssetFormat(assetType || '') === 'svg' ? (
                      <SvgPreview svgContent={generatedContent} className='h-[400px]' showControls={true} />
                    ) : (
                      <div className='border rounded-lg p-4 h-[400px] overflow-y-auto bg-background'>
                        <MarkdownRenderer content={generatedContent} copyToClipboard={copyToClipboard} />
                      </div>
                    )}
                  </div>

                  {/* Code Editor */}
                  <div className='border rounded-lg overflow-hidden'>
                    <div className='bg-muted px-3 py-2 text-sm font-medium'>
                      {getAssetFormat(assetType || '') === 'svg' ? 'SVG Code' : 'Markdown Code'}
                    </div>
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
          <Button onClick={handleGenerate} disabled={isGenerating || !commonFormData.name.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                {tokenCount > 1500 ? 'Generating (this may take a moment)...' : 'Generating...'}
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

interface CommonFormData {
  name: string
  description: string
  additionalContext: string
}

interface SvgFormData {
  style: string
  colors: string
  dimensions: string
}

interface MarkdownFormData {
  documentFormat: string
  diagramType: string
  includeTableOfContents: boolean
  targetAudience: string
  includeExamples: boolean
  sections: string[]
}

// Helper function to render input form based on asset type
function renderInputForm(
  assetType: string,
  commonFormData: CommonFormData,
  setCommonFormData: React.Dispatch<React.SetStateAction<CommonFormData>>,
  svgFormData: SvgFormData,
  setSvgFormData: React.Dispatch<React.SetStateAction<SvgFormData>>,
  markdownFormData: MarkdownFormData,
  setMarkdownFormData: React.Dispatch<React.SetStateAction<MarkdownFormData>>
) {
  const updateCommonField = (field: keyof CommonFormData, value: string) => {
    setCommonFormData((prev) => ({ ...prev, [field]: value }))
  }

  const updateSvgField = (field: keyof SvgFormData, value: string) => {
    setSvgFormData((prev) => ({ ...prev, [field]: value }))
  }

  const updateMarkdownField = (field: keyof MarkdownFormData, value: string | boolean | string[]) => {
    setMarkdownFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Check if it's a markdown asset type
  const isMarkdown = ['architecture-doc', 'mermaid-diagram'].includes(assetType)

  // Markdown-specific inputs
  if (isMarkdown) {
    return (
      <>
        <div>
          <Label htmlFor='name'>Document Name</Label>
          <Input
            id='name'
            value={commonFormData.name}
            onChange={(e) => updateCommonField('name', e.target.value)}
            placeholder={assetType === 'architecture-doc' ? 'architecture-guide' : 'user-flow-diagram'}
          />
        </div>

        <div>
          <Label htmlFor='description'>
            {assetType === 'architecture-doc' ? 'Project Description' : 'Diagram Description'}
          </Label>
          <Textarea
            id='description'
            value={commonFormData.description}
            onChange={(e) => updateCommonField('description', e.target.value)}
            placeholder={
              assetType === 'architecture-doc'
                ? 'Describe your project: what it does, key features, tech stack, and any specific areas you want documented...'
                : 'Describe what you want to visualize: system components, data flow, user journey, class relationships...'
            }
            rows={5}
          />
        </div>

        {assetType === 'architecture-doc' && (
          <>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <Label htmlFor='format'>Document Format</Label>
                <Select
                  value={markdownFormData.documentFormat}
                  onValueChange={(value) => updateMarkdownField('documentFormat', value)}
                >
                  <SelectTrigger id='format'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='concise'>Concise (Essential info only)</SelectItem>
                    <SelectItem value='standard'>Standard (Balanced detail)</SelectItem>
                    <SelectItem value='detailed'>Detailed (Comprehensive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor='audience'>Target Audience</Label>
                <Select
                  value={markdownFormData.targetAudience}
                  onValueChange={(value) => updateMarkdownField('targetAudience', value)}
                >
                  <SelectTrigger id='audience'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='developers'>Developers</SelectItem>
                    <SelectItem value='stakeholders'>Stakeholders</SelectItem>
                    <SelectItem value='both'>Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Document Options</Label>
              <div className='space-y-2 mt-2'>
                <label className='flex items-center space-x-2'>
                  <Checkbox
                    checked={markdownFormData.includeTableOfContents}
                    onCheckedChange={(checked) => updateMarkdownField('includeTableOfContents', checked)}
                  />
                  <span className='text-sm'>Include Table of Contents</span>
                </label>
                <label className='flex items-center space-x-2'>
                  <Checkbox
                    checked={markdownFormData.includeExamples}
                    onCheckedChange={(checked) => updateMarkdownField('includeExamples', checked)}
                  />
                  <span className='text-sm'>Include Code Examples</span>
                </label>
              </div>
            </div>
          </>
        )}

        {assetType === 'mermaid-diagram' && (
          <div>
            <Label htmlFor='diagramType'>Diagram Type (Optional)</Label>
            <Select
              value={markdownFormData.diagramType}
              onValueChange={(value) => updateMarkdownField('diagramType', value)}
            >
              <SelectTrigger id='diagramType'>
                <SelectValue placeholder='Auto-detect' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='auto'>Auto-detect</SelectItem>
                <SelectItem value='flowchart'>Flowchart</SelectItem>
                <SelectItem value='sequence'>Sequence Diagram</SelectItem>
                <SelectItem value='class'>Class Diagram</SelectItem>
                <SelectItem value='state'>State Diagram</SelectItem>
                <SelectItem value='er'>Entity Relationship</SelectItem>
                <SelectItem value='gantt'>Gantt Chart</SelectItem>
                <SelectItem value='pie'>Pie Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor='additionalContext'>Additional Requirements (Optional)</Label>
          <Textarea
            id='additionalContext'
            value={commonFormData.additionalContext}
            onChange={(e) => updateCommonField('additionalContext', e.target.value)}
            placeholder={
              assetType === 'architecture-doc'
                ? 'Specific sections to include, coding standards to document, patterns to highlight...'
                : 'Specific styling preferences, components to include, relationships to emphasize...'
            }
            rows={3}
          />
        </div>
      </>
    )
  }

  // SVG-specific inputs
  return (
    <>
      <div>
        <Label htmlFor='name'>Name</Label>
        <Input
          id='name'
          value={commonFormData.name}
          onChange={(e) => updateCommonField('name', e.target.value)}
          placeholder={assetType === 'icon' ? 'menu-icon' : assetType === 'logo' ? 'company-logo' : 'asset-name'}
        />
      </div>

      <div>
        <Label htmlFor='description'>Description</Label>
        <Textarea
          id='description'
          value={commonFormData.description}
          onChange={(e) => updateCommonField('description', e.target.value)}
          placeholder={
            assetType === 'icon'
              ? 'A hamburger menu icon with three horizontal lines'
              : assetType === 'illustration'
                ? 'An illustration showing a person working on a laptop'
                : assetType === 'logo'
                  ? 'A modern, minimalist logo for a tech startup'
                  : assetType === 'pattern'
                    ? 'A geometric pattern with triangles and hexagons'
                    : assetType === 'ui-element'
                      ? 'A rounded button with gradient background'
                      : 'A bar chart showing monthly revenue'
          }
          rows={3}
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label htmlFor='style'>Style</Label>
          <Select value={svgFormData.style} onValueChange={(value) => updateSvgField('style', value)}>
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
          <Select value={svgFormData.dimensions} onValueChange={(value) => updateSvgField('dimensions', value)}>
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
            value={svgFormData.colors}
            onChange={(e) => updateSvgField('colors', e.target.value)}
            className='w-20 h-10 p-1 cursor-pointer'
          />
          <Input
            value={svgFormData.colors}
            onChange={(e) => updateSvgField('colors', e.target.value)}
            placeholder='#000000'
            className='flex-1'
          />
        </div>
      </div>

      <div>
        <Label htmlFor='additionalContext'>Additional Context (optional)</Label>
        <Textarea
          id='additionalContext'
          value={commonFormData.additionalContext}
          onChange={(e) => updateCommonField('additionalContext', e.target.value)}
          placeholder='Any specific requirements, style preferences, or context...'
          rows={2}
        />
      </div>
    </>
  )
}

// Helper function to prepare user input for API
function prepareUserInput(assetType: string, formData: CommonFormData & Partial<SvgFormData> & Partial<MarkdownFormData>): string {
  // Handle markdown asset types
  if (assetType === 'architecture-doc') {
    const formatNote = formData.documentFormat ? `\n\nDocument format: ${formData.documentFormat}` : ''
    const audienceNote = formData.targetAudience ? `\nTarget audience: ${formData.targetAudience}` : ''
    const optionsNote = []

    if (formData.includeTableOfContents) optionsNote.push('Include a table of contents')
    if (formData.includeExamples) optionsNote.push('Include code examples and practical usage')

    const options = optionsNote.length > 0 ? `\n\n${optionsNote.join('. ')}.` : ''

    return `${formData.description}${formatNote}${audienceNote}${options}${formData.additionalContext ? `\n\nAdditional requirements: ${formData.additionalContext}` : ''}`
  }

  if (assetType === 'mermaid-diagram') {
    const diagramType =
      formData.diagramType && formData.diagramType !== 'auto'
        ? `\n\nPreferred diagram type: ${formData.diagramType}`
        : ''
    return `${formData.description}${diagramType}${formData.additionalContext ? `\n\nAdditional requirements: ${formData.additionalContext}` : ''}`
  }

  // Handle SVG asset types
  const [width, height] = formData.dimensions?.split('x') || ['', '']

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
