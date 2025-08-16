import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { LazyMonacoEditor } from '@/components/lazy-monaco-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { toast } from 'sonner'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useGenerateStructuredData } from '@/hooks/api/use-gen-ai-api'
import { Copy, Download, Loader2, FileText, Code, GitBranch, Database, Book } from 'lucide-react'
import { estimateTokenCount, formatTokenCount } from '@promptliano/shared'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ProviderModelSelector, useModelSelection } from '@/components/model-selection'
import { Separator } from '@promptliano/ui'
import { APIProviders } from '@promptliano/schemas'

interface DocumentationGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentationType: string | null
  projectContext?: {
    name: string
    description?: string
    techStack?: string[]
  }
  onSuccess?: (generatedContent: string, name: string) => void
}

// Documentation type configurations
const documentationTypes = {
  'project-readme': {
    name: 'README.md',
    icon: FileText,
    description: 'Main project documentation',
    schemaKey: 'readmeGenerator',
    sections: ['overview', 'installation', 'usage', 'contributing']
  },
  'architecture-doc': {
    name: 'Architecture Document',
    icon: GitBranch,
    description: 'System design and architecture',
    schemaKey: 'architectureDocGenerator',
    sections: ['overview', 'components', 'data-flow', 'decisions']
  },
  'api-documentation': {
    name: 'API Documentation',
    icon: Code,
    description: 'API endpoints and usage',
    schemaKey: 'architectureDocGenerator', // Using architecture doc for now
    sections: ['endpoints', 'authentication', 'examples', 'errors']
  },
  'database-schema': {
    name: 'Database Documentation',
    icon: Database,
    description: 'Database schema and relationships',
    schemaKey: 'architectureDocGenerator', // Using architecture doc for database docs
    sections: ['schema', 'relationships', 'migrations', 'indexes']
  },
  'user-guide': {
    name: 'User Guide',
    icon: Book,
    description: 'End-user documentation',
    schemaKey: 'readmeGenerator', // Using readme generator for user guides
    sections: ['getting-started', 'features', 'troubleshooting', 'faq']
  },
  'mermaid-diagram': {
    name: 'Mermaid Diagram',
    icon: GitBranch,
    description: 'Visual diagrams and flowcharts',
    schemaKey: 'mermaidDiagramGenerator',
    sections: ['flowchart', 'sequence', 'class', 'entity-relationship']
  }
}

export function DocumentationGeneratorDialog({
  open,
  onOpenChange,
  documentationType,
  projectContext,
  onSuccess
}: DocumentationGeneratorDialogProps) {
  const [activeTab, setActiveTab] = useState('input')

  const docType = documentationType ? documentationTypes[documentationType as keyof typeof documentationTypes] : null

  // Form data - initialize with all sections selected
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    format: 'detailed',
    audience: 'developers',
    includeTableOfContents: true,
    includeExamples: true,
    sections: docType?.sections || [],
    additionalContext: ''
  })

  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Model selection - Default to OpenRouter with Gemini 2.5 Pro
  const { provider, model, setProvider: setProviderBase, setModel } = useModelSelection({
    persistenceKey: 'documentation-generator-model',
    defaultProvider: 'openrouter',
    defaultModel: 'google/gemini-2.5-pro-preview'
  })

  // Wrapper to handle string | APIProviders type
  const setProvider = (newProvider: string | APIProviders) => {
    setProviderBase(newProvider as APIProviders)
  }

  const { copyToClipboard } = useCopyClipboard()
  const generateMutation = useGenerateStructuredData()

  const getDocTypeName = () => docType?.name || 'Documentation'

  // Update sections when documentationType changes
  React.useEffect(() => {
    if (docType?.sections) {
      setFormData((prev) => ({
        ...prev,
        sections: docType.sections
      }))
    }
  }, [documentationType, docType])

  const tokenCount = useMemo(() => {
    const context = `${formData.title} ${formData.description} ${formData.additionalContext} ${projectContext?.name || ''} ${projectContext?.description || ''}`
    return estimateTokenCount(context)
  }, [formData, projectContext])

  const handleGenerate = async () => {
    if (!formData.title.trim()) {
      toast.error('Please provide a title for the documentation')
      return
    }

    if (!docType) {
      toast.error('Invalid documentation type')
      return
    }

    setIsGenerating(true)
    try {
      const userInput = prepareUserInput(documentationType || '', formData, projectContext)

      const response = await generateMutation.mutateAsync({
        schemaKey: docType.schemaKey,
        userInput,
        options: {
          model,
          provider
        }
      })

      let generatedContent = ''
      if ((response as any).success && (response as any).data?.output) {
        if (typeof (response as any).data.output === 'string') {
          generatedContent = (response as any).data.output
        } else if ((response as any).data.output.content) {
          generatedContent = (response as any).data.output.content
        }
      }

      if (!generatedContent || generatedContent.trim().length === 0) {
        toast.error('Failed to generate documentation. Please try again.')
        return
      }

      toast.success(`${getDocTypeName()} generated successfully!`)
      setGeneratedContent(generatedContent)
      setActiveTab('preview')

      if (onSuccess) {
        onSuccess(generatedContent, formData.title)
      }
    } catch (error) {
      toast.error('Failed to generate documentation')
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    await copyToClipboard(generatedContent, {
      successMessage: 'Documentation copied to clipboard',
      errorMessage: 'Failed to copy documentation'
    })
  }

  const handleDownload = () => {
    const blob = new Blob([generatedContent], { type: 'text/markdown' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.title.toLowerCase().replace(/\s+/g, '-')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Documentation downloaded')
  }

  const handleReset = () => {
    setFormData({
      title: '',
      description: '',
      format: 'detailed',
      audience: 'developers',
      includeTableOfContents: true,
      includeExamples: true,
      sections: docType?.sections || [],
      additionalContext: ''
    })
    setGeneratedContent('')
    setActiveTab('input')
  }

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (!docType) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl h-[85vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <docType.icon className='h-5 w-5' />
            Generate {getDocTypeName()}
          </DialogTitle>
          <DialogDescription>{docType.description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className='flex-1'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='input'>Configuration</TabsTrigger>
            <TabsTrigger value='preview' disabled={!generatedContent}>
              Preview
            </TabsTrigger>
          </TabsList>

          <ScrollArea className='h-[calc(85vh-200px)] mt-4'>
            <TabsContent value='input' className='space-y-4'>
              <div>
                <Label htmlFor='title'>Document Title</Label>
                <Input
                  id='title'
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder={`e.g., ${projectContext?.name || 'Project'} ${getDocTypeName()}`}
                />
              </div>

              <div>
                <Label htmlFor='description'>Description / Context</Label>
                <Textarea
                  id='description'
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder={`Describe what should be included in this ${getDocTypeName().toLowerCase()}...`}
                  rows={4}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='format'>Documentation Format</Label>
                  <Select value={formData.format} onValueChange={(value) => updateField('format', value)}>
                    <SelectTrigger id='format'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='concise'>Concise</SelectItem>
                      <SelectItem value='detailed'>Detailed</SelectItem>
                      <SelectItem value='comprehensive'>Comprehensive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor='audience'>Target Audience</Label>
                  <Select value={formData.audience} onValueChange={(value) => updateField('audience', value)}>
                    <SelectTrigger id='audience'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='developers'>Developers</SelectItem>
                      <SelectItem value='users'>End Users</SelectItem>
                      <SelectItem value='stakeholders'>Stakeholders</SelectItem>
                      <SelectItem value='contributors'>Contributors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Include Sections</Label>
                <div className='grid grid-cols-2 gap-3 mt-2'>
                  {docType.sections.map((section) => (
                    <div key={section} className='flex items-center space-x-2'>
                      <Checkbox
                        id={section}
                        checked={formData.sections.includes(section)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateField('sections', [...formData.sections, section])
                          } else {
                            updateField(
                              'sections',
                              formData.sections.filter((s) => s !== section)
                            )
                          }
                        }}
                      />
                      <Label htmlFor={section} className='cursor-pointer capitalize'>
                        {section.replace('-', ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Options</Label>
                <div className='space-y-2 mt-2'>
                  <label className='flex items-center space-x-2'>
                    <Checkbox
                      checked={formData.includeTableOfContents}
                      onCheckedChange={(checked) => updateField('includeTableOfContents', checked)}
                    />
                    <span className='text-sm'>Include Table of Contents</span>
                  </label>
                  <label className='flex items-center space-x-2'>
                    <Checkbox
                      checked={formData.includeExamples}
                      onCheckedChange={(checked) => updateField('includeExamples', checked)}
                    />
                    <span className='text-sm'>Include Code Examples</span>
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor='additionalContext'>Additional Requirements</Label>
                <Textarea
                  id='additionalContext'
                  value={formData.additionalContext}
                  onChange={(e) => updateField('additionalContext', e.target.value)}
                  placeholder='Any specific requirements or additional context...'
                  rows={3}
                />
              </div>

              <Separator className='my-4' />

              <div className='space-y-4'>
                <div>
                  <Label>AI Model Selection</Label>
                  <p className='text-sm text-muted-foreground mb-3'>
                    Choose the AI provider and model for generating your documentation
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
                        Copy Markdown
                      </Button>
                      <Button variant='outline' size='sm' onClick={handleDownload}>
                        <Download className='h-4 w-4 mr-2' />
                        Download
                      </Button>
                    </div>
                  </div>

                  {/* Markdown Preview */}
                  <div className='space-y-2'>
                    <div className='text-sm text-muted-foreground'>Preview</div>
                    <div className='border rounded-lg p-6 h-[400px] overflow-y-auto bg-background'>
                      <MarkdownRenderer content={generatedContent} copyToClipboard={copyToClipboard} />
                    </div>
                  </div>

                  {/* Markdown Editor */}
                  <div className='border rounded-lg overflow-hidden'>
                    <div className='bg-muted px-3 py-2 text-sm font-medium'>Markdown Source</div>
                    <LazyMonacoEditor
                      value={generatedContent}
                      onChange={(value) => setGeneratedContent(value || '')}
                      language='markdown'
                      readOnly={false}
                      className='h-[200px]'
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
          <Button onClick={handleGenerate} disabled={isGenerating || !formData.title.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Generating...
              </>
            ) : (
              <>
                <FileText className='h-4 w-4 mr-2' />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to prepare user input for API
function prepareUserInput(documentationType: string, formData: any, projectContext?: any): string {
  const projectName = projectContext?.name || 'the project'
  const projectDesc = projectContext?.description || ''
  const techStack = projectContext?.techStack?.join(', ') || ''

  let basePrompt = `Generate ${formData.format} ${documentationType.replace('-', ' ')} documentation for ${projectName}.`

  if (projectDesc) {
    basePrompt += `\n\nProject Description: ${projectDesc}`
  }

  if (techStack) {
    basePrompt += `\nTechnology Stack: ${techStack}`
  }

  if (formData.description) {
    basePrompt += `\n\nSpecific Requirements: ${formData.description}`
  }

  // Add format specifications
  basePrompt += `\n\nFormat Requirements:`
  basePrompt += `\n- Documentation style: ${formData.format}`
  basePrompt += `\n- Target audience: ${formData.audience}`

  if (formData.includeTableOfContents) {
    basePrompt += `\n- Include a table of contents`
  }

  if (formData.includeExamples) {
    basePrompt += `\n- Include practical code examples`
  }

  if (formData.sections.length > 0) {
    basePrompt += `\n\nRequired Sections: ${formData.sections.join(', ')}`
  }

  if (formData.additionalContext) {
    basePrompt += `\n\nAdditional Context: ${formData.additionalContext}`
  }

  return basePrompt
}
