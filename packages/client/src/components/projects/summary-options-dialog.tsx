import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SummaryOptions } from '@promptliano/schemas'

interface SummaryOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (options: SummaryOptions) => void
  projectName?: string
}

export function SummaryOptionsDialog({ open, onOpenChange, onGenerate, projectName }: SummaryOptionsDialogProps) {
  const [options, setOptions] = useState<SummaryOptions>({
    depth: 'standard',
    format: 'xml',
    strategy: 'balanced',
    includeImports: true,
    includeExports: true,
    progressive: false,
    includeMetrics: false,
    groupAware: false,
    includeRelationships: true,
    contextWindow: 3
  })

  const [focusAreas, setFocusAreas] = useState<string>('')

  const handleGenerate = () => {
    const finalOptions: SummaryOptions = {
      ...options,
      focus: focusAreas
        ? focusAreas
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined
    }
    onGenerate(finalOptions)
    onOpenChange(false)
  }

  // Estimate token usage based on options
  const estimatedTokens = () => {
    const base = options.depth === 'minimal' ? 1000 : options.depth === 'detailed' ? 5000 : 2500
    const strategyMultiplier = options.strategy === 'fast' ? 0.5 : options.strategy === 'thorough' ? 1.5 : 1
    return Math.round(base * strategyMultiplier)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Generate Project Summary</DialogTitle>
          <DialogDescription>
            {projectName && <span className='font-medium'>{projectName}</span>}
            {projectName && ' - '}
            Configure options for summary generation
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Depth Selection */}
          <div className='space-y-2'>
            <Label htmlFor='depth'>Summary Depth</Label>
            <Select
              value={options.depth}
              onValueChange={(value: 'minimal' | 'standard' | 'detailed') =>
                setOptions((prev) => ({ ...prev, depth: value }))
              }
            >
              <SelectTrigger id='depth'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='minimal'>Minimal (100 words)</SelectItem>
                <SelectItem value='standard'>Standard (200 words)</SelectItem>
                <SelectItem value='detailed'>Detailed (400 words)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Format Selection */}
          <div className='space-y-2'>
            <Label htmlFor='format'>Output Format</Label>
            <Select
              value={options.format}
              onValueChange={(value: 'xml' | 'json' | 'markdown') => setOptions((prev) => ({ ...prev, format: value }))}
            >
              <SelectTrigger id='format'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='xml'>XML (Default)</SelectItem>
                <SelectItem value='json'>JSON</SelectItem>
                <SelectItem value='markdown'>Markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Strategy Selection */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <Label htmlFor='strategy'>Generation Strategy</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className='h-4 w-4 text-muted-foreground' />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className='max-w-xs'>
                      Fast: No AI processing, structured data only
                      <br />
                      Balanced: AI-enhanced with top 50 files
                      <br />
                      Thorough: High-quality AI with top 100 files
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={options.strategy}
              onValueChange={(value: 'fast' | 'balanced' | 'thorough') =>
                setOptions((prev) => ({ ...prev, strategy: value }))
              }
            >
              <SelectTrigger id='strategy'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='fast'>Fast</SelectItem>
                <SelectItem value='balanced'>Balanced</SelectItem>
                <SelectItem value='thorough'>Thorough</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Focus Areas */}
          <div className='space-y-2'>
            <Label htmlFor='focus'>Focus Areas (optional)</Label>
            <Input
              id='focus'
              placeholder='api, frontend, database (comma-separated)'
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
            />
          </div>

          {/* Options */}
          <div className='space-y-2'>
            <Label>Include Options</Label>
            <div className='space-y-2'>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='imports'
                  checked={options.includeImports}
                  onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, includeImports: !!checked }))}
                />
                <label htmlFor='imports' className='text-sm'>
                  Include imports
                </label>
              </div>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='exports'
                  checked={options.includeExports}
                  onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, includeExports: !!checked }))}
                />
                <label htmlFor='exports' className='text-sm'>
                  Include exports
                </label>
              </div>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='metrics'
                  checked={options.includeMetrics}
                  onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, includeMetrics: !!checked }))}
                />
                <label htmlFor='metrics' className='text-sm'>
                  Include generation metrics
                </label>
              </div>
            </div>
          </div>

          {/* Token Estimate */}
          <div className='flex items-center justify-between pt-2 border-t'>
            <span className='text-sm text-muted-foreground'>Estimated tokens:</span>
            <Badge variant='secondary'>~{estimatedTokens().toLocaleString()}</Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate}>Generate Summary</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
