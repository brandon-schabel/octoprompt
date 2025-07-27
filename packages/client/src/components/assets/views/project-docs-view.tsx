import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { DocumentationGeneratorDialog } from '@/components/assets/documentation-generator-dialog'
import { toast } from 'sonner'
import { FileText, Sparkles, Settings, Copy, Download } from 'lucide-react'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

interface ProjectDocsViewProps {
  projectId: number
  projectName?: string
}

const projectDocTemplates = {
  comprehensive: {
    name: 'Comprehensive Documentation',
    description: 'Full project documentation with all sections',
    sections: ['overview', 'setup', 'architecture', 'api', 'deployment', 'contributing'],
    prompt: `Generate comprehensive project documentation for {projectName} with the following sections:

1. Project Overview
   - Purpose and goals
   - Key features
   - Technology stack
   
2. Getting Started
   - Prerequisites
   - Installation steps
   - Configuration
   
3. Architecture
   - System design
   - Component overview
   - Data flow
   
4. API Reference
   - Endpoints
   - Authentication
   - Examples
   
5. Deployment
   - Production setup
   - Environment variables
   - Monitoring
   
6. Contributing
   - Development workflow
   - Code standards
   - Testing guidelines`
  },
  readme: {
    name: 'README.md',
    description: 'Standard GitHub README with badges',
    sections: ['badges', 'overview', 'installation', 'usage', 'license'],
    prompt: `Create a professional README.md for {projectName} including:

- Project badges (build status, version, license)
- Clear project description
- Installation instructions
- Basic usage examples
- Features list
- Contributing guidelines
- License information`
  },
  technical: {
    name: 'Technical Documentation',
    description: 'In-depth technical implementation details',
    sections: ['architecture', 'database', 'security', 'performance'],
    prompt: `Generate technical documentation for {projectName} covering:

1. Technical Architecture
   - Design patterns used
   - System components
   - Integration points
   
2. Database Design
   - Schema overview
   - Relationships
   - Indexing strategy
   
3. Security Implementation
   - Authentication flow
   - Authorization model
   - Security best practices
   
4. Performance Considerations
   - Optimization strategies
   - Caching approach
   - Scalability design`
  }
}

export function ProjectDocsView({ projectId, projectName = 'Project' }: ProjectDocsViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof projectDocTemplates>('comprehensive')
  const [customPrompt, setCustomPrompt] = useState('')
  const [includeSections, setIncludeSections] = useState<Record<string, boolean>>({})
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const { copyToClipboard } = useCopyClipboard()

  const template = projectDocTemplates[selectedTemplate]

  const handleGenerateWithTemplate = () => {
    // This would integrate with the asset generator
    setGeneratorOpen(true)
  }

  const handleCopyPrompt = async () => {
    const prompt = customPrompt || template.prompt.replace('{projectName}', projectName)
    await copyToClipboard(prompt, {
      successMessage: 'Prompt copied to clipboard'
    })
  }

  return (
    <div className='h-full flex flex-col p-6 space-y-6'>
      <div>
        <h2 className='text-2xl font-bold flex items-center gap-2'>
          <FileText className='h-6 w-6' />
          Project Documentation
        </h2>
        <p className='text-muted-foreground mt-1'>Generate comprehensive documentation for {projectName}</p>
      </div>

      <Tabs defaultValue='templates' className='flex-1'>
        <TabsList>
          <TabsTrigger value='templates'>Templates</TabsTrigger>
          <TabsTrigger value='custom'>Custom</TabsTrigger>
          <TabsTrigger value='settings'>Settings</TabsTrigger>
        </TabsList>

        <TabsContent value='templates' className='space-y-4'>
          <div className='grid gap-4'>
            {Object.entries(projectDocTemplates).map(([key, template]) => (
              <Card
                key={key}
                className={`cursor-pointer transition-all ${selectedTemplate === key ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedTemplate(key as keyof typeof projectDocTemplates)}
              >
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div>
                      <CardTitle className='text-lg'>{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    {selectedTemplate === key && <Badge className='ml-2'>Selected</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='flex flex-wrap gap-2'>
                    {template.sections.map((section) => (
                      <Badge key={section} variant='secondary'>
                        {section}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className='flex gap-2'>
            <Button onClick={handleGenerateWithTemplate} className='flex-1'>
              <Sparkles className='h-4 w-4 mr-2' />
              Generate Documentation
            </Button>
            <Button variant='outline' onClick={handleCopyPrompt}>
              <Copy className='h-4 w-4' />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value='custom' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Custom Documentation Prompt</CardTitle>
              <CardDescription>Create your own documentation prompt for specific needs</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Documentation Prompt</Label>
                <Textarea
                  placeholder='Describe what documentation you need...'
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className='min-h-[200px]'
                />
              </div>

              <div className='space-y-2'>
                <Label>Include Sections</Label>
                <div className='grid grid-cols-2 gap-3'>
                  {['Overview', 'Setup', 'API', 'Database', 'Testing', 'Deployment'].map((section) => (
                    <div key={section} className='flex items-center space-x-2'>
                      <Checkbox
                        id={section}
                        checked={includeSections[section] || false}
                        onCheckedChange={(checked) => setIncludeSections((prev) => ({ ...prev, [section]: !!checked }))}
                      />
                      <Label htmlFor={section} className='cursor-pointer'>
                        {section}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleGenerateWithTemplate} className='w-full'>
                <Sparkles className='h-4 w-4 mr-2' />
                Generate Custom Documentation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='settings' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Documentation Settings</CardTitle>
              <CardDescription>Configure how your documentation is generated</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Documentation Style</Label>
                <Select defaultValue='professional'>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='professional'>Professional</SelectItem>
                    <SelectItem value='casual'>Casual</SelectItem>
                    <SelectItem value='technical'>Technical</SelectItem>
                    <SelectItem value='educational'>Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Target Audience</Label>
                <Select defaultValue='developers'>
                  <SelectTrigger>
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

              <div className='space-y-2'>
                <Label>Output Format</Label>
                <Select defaultValue='markdown'>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='markdown'>Markdown</SelectItem>
                    <SelectItem value='html'>HTML</SelectItem>
                    <SelectItem value='pdf'>PDF</SelectItem>
                    <SelectItem value='docx'>DOCX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DocumentationGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        documentationType='project-readme'
        projectContext={{
          name: projectName,
          description: 'Promptliano project' // You can enhance this with actual project context
        }}
        onSuccess={(content, name) => {
          toast.success('Documentation generated successfully!')
          // Here you could save the generated documentation
        }}
      />
    </div>
  )
}
