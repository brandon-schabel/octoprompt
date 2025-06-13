import { useState } from 'react'
import { CLAUDE_CODE_TEMPLATES, type ClaudeCodeTemplate, processTemplatePrompt } from '@octoprompt/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileCode, FileText, TestTube, Bug, Sparkles, Zap, Shield, ChevronRight } from 'lucide-react'

interface ClaudeCodeTemplatesProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (prompt: string) => void
}

const categoryIcons = {
  refactoring: FileCode,
  documentation: FileText,
  testing: TestTube,
  debugging: Bug,
  feature: Sparkles,
  optimization: Zap,
  security: Shield
}

const categoryColors = {
  refactoring: 'bg-blue-500',
  documentation: 'bg-green-500',
  testing: 'bg-purple-500',
  debugging: 'bg-red-500',
  feature: 'bg-yellow-500',
  optimization: 'bg-orange-500',
  security: 'bg-pink-500'
}

export function ClaudeCodeTemplates({ isOpen, onClose, onSelectTemplate }: ClaudeCodeTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ClaudeCodeTemplate | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [variables, setVariables] = useState<Record<string, string>>({})

  const filteredTemplates =
    selectedCategory === 'all'
      ? CLAUDE_CODE_TEMPLATES
      : CLAUDE_CODE_TEMPLATES.filter((t) => t.category === selectedCategory)

  const handleSelectTemplate = (template: ClaudeCodeTemplate) => {
    setSelectedTemplate(template)
    // Initialize variables with default values
    const defaultVars: Record<string, string> = {}
    template.variables?.forEach((v) => {
      defaultVars[v.name] = v.defaultValue || ''
    })
    setVariables(defaultVars)
  }

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      const processedPrompt = processTemplatePrompt(selectedTemplate, variables)
      onSelectTemplate(processedPrompt)
      onClose()
      // Reset state
      setSelectedTemplate(null)
      setVariables({})
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-4xl max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle>Claude Code Templates</DialogTitle>
          <DialogDescription>Select a template to quickly generate prompts for common coding tasks</DialogDescription>
        </DialogHeader>

        <div className='flex gap-4 h-[60vh]'>
          {/* Template List */}
          <div className='flex-1 flex flex-col'>
            <div className='mb-4'>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder='All Categories' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  <SelectItem value='refactoring'>Refactoring</SelectItem>
                  <SelectItem value='documentation'>Documentation</SelectItem>
                  <SelectItem value='testing'>Testing</SelectItem>
                  <SelectItem value='debugging'>Debugging</SelectItem>
                  <SelectItem value='feature'>Features</SelectItem>
                  <SelectItem value='optimization'>Optimization</SelectItem>
                  <SelectItem value='security'>Security</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className='flex-1'>
              <div className='space-y-2'>
                {filteredTemplates.map((template) => {
                  const Icon = categoryIcons[template.category]
                  const isSelected = selectedTemplate?.id === template.id

                  return (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'border-primary' : 'hover:border-gray-400'
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <CardHeader className='pb-3'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            <Icon className='h-4 w-4' />
                            <CardTitle className='text-sm'>{template.name}</CardTitle>
                          </div>
                          <Badge variant='secondary' className={`${categoryColors[template.category]} text-white`}>
                            {template.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className='text-xs'>{template.description}</CardDescription>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Template Details */}
          {selectedTemplate && (
            <div className='w-96 border-l pl-4'>
              <h3 className='font-semibold mb-2'>{selectedTemplate.name}</h3>
              <p className='text-sm text-muted-foreground mb-4'>{selectedTemplate.description}</p>

              {/* Variables */}
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                <div className='mb-4'>
                  <h4 className='text-sm font-medium mb-2'>Template Variables</h4>
                  <div className='space-y-3'>
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable.name}>
                        <Label htmlFor={variable.name} className='text-xs'>
                          {variable.description}
                        </Label>
                        <Input
                          id={variable.name}
                          value={variables[variable.name] || ''}
                          onChange={(e) =>
                            setVariables({
                              ...variables,
                              [variable.name]: e.target.value
                            })
                          }
                          placeholder={variable.defaultValue}
                          className='mt-1'
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div>
                <h4 className='text-sm font-medium mb-2'>Prompt Preview</h4>
                <Card>
                  <CardContent className='pt-4'>
                    <p className='text-sm whitespace-pre-wrap'>{processTemplatePrompt(selectedTemplate, variables)}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUseTemplate} disabled={!selectedTemplate}>
            Use Template
            <ChevronRight className='ml-1 h-4 w-4' />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
