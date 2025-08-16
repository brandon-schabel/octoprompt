import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenuItem,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Progress
} from '@promptliano/ui'
import { Download, FileDown, Archive } from 'lucide-react'
import { toast } from 'sonner'
import {
  useExportPromptAsMarkdown,
  useExportPromptsAsMarkdown,
  useExportProjectPromptsAsMarkdown
} from '@/hooks/api/use-prompts-api'
import type { BatchExportRequest } from '@promptliano/schemas'

interface ExportOptions extends Partial<BatchExportRequest> {
  showDialog?: boolean
}

interface BaseExportProps {
  filename?: string
  showOptions?: boolean
  className?: string
  disabled?: boolean
  onExportComplete?: () => void
}

interface SinglePromptExportProps extends BaseExportProps {
  promptId: number
  promptIds?: never
  projectId?: never
}

interface MultiplePromptsExportProps extends BaseExportProps {
  promptIds: number[]
  promptId?: never
  projectId?: never
}

interface ProjectPromptsExportProps extends BaseExportProps {
  projectId: number
  promptId?: never
  promptIds?: never
}

type MarkdownExportProps = SinglePromptExportProps | MultiplePromptsExportProps | ProjectPromptsExportProps

/**
 * Markdown export options dialog for batch exports
 */
function MarkdownExportOptionsDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
  itemCount
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (options: ExportOptions) => void
  isExporting: boolean
  itemCount: number
}) {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'single-file',
    includeFrontmatter: true,
    includeCreatedDate: true,
    includeUpdatedDate: true,
    includeTags: true,
    sortBy: 'name',
    sortOrder: 'asc'
  })

  const handleExport = () => {
    onExport(options)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
          <DialogDescription>
            Configure how you want to export {itemCount} prompt{itemCount !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-4'>
          {/* Export Format */}
          <div className='space-y-2'>
            <Label htmlFor='format'>Export Format</Label>
            <RadioGroup
              value={options.format}
              onValueChange={(value) => setOptions({ ...options, format: value as 'single-file' | 'multi-file' })}
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='single-file' id='single-file' />
                <Label htmlFor='single-file' className='font-normal'>
                  Single file with all prompts
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='multi-file' id='multi-file' />
                <Label htmlFor='multi-file' className='font-normal'>
                  Separate files per prompt (as ZIP)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Frontmatter Options */}
          <div className='space-y-3'>
            <Label>Include in Export</Label>

            <div className='flex items-center justify-between'>
              <Label htmlFor='frontmatter' className='font-normal'>
                Frontmatter metadata
              </Label>
              <Switch
                id='frontmatter'
                checked={options.includeFrontmatter}
                onCheckedChange={(checked) => setOptions({ ...options, includeFrontmatter: checked })}
              />
            </div>

            {options.includeFrontmatter && (
              <>
                <div className='flex items-center justify-between pl-6'>
                  <Label htmlFor='created-date' className='font-normal text-sm'>
                    Created date
                  </Label>
                  <Switch
                    id='created-date'
                    checked={options.includeCreatedDate}
                    onCheckedChange={(checked) => setOptions({ ...options, includeCreatedDate: checked })}
                  />
                </div>

                <div className='flex items-center justify-between pl-6'>
                  <Label htmlFor='updated-date' className='font-normal text-sm'>
                    Updated date
                  </Label>
                  <Switch
                    id='updated-date'
                    checked={options.includeUpdatedDate}
                    onCheckedChange={(checked) => setOptions({ ...options, includeUpdatedDate: checked })}
                  />
                </div>

                <div className='flex items-center justify-between pl-6'>
                  <Label htmlFor='tags' className='font-normal text-sm'>
                    Tags
                  </Label>
                  <Switch
                    id='tags'
                    checked={options.includeTags}
                    onCheckedChange={(checked) => setOptions({ ...options, includeTags: checked })}
                  />
                </div>
              </>
            )}
          </div>

          {/* Sort Options */}
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='sort-by'>Sort By</Label>
              <Select
                value={options.sortBy}
                onValueChange={(value) => setOptions({ ...options, sortBy: value as 'name' | 'created' | 'updated' })}
              >
                <SelectTrigger id='sort-by'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='name'>Name</SelectItem>
                  <SelectItem value='created'>Created Date</SelectItem>
                  <SelectItem value='updated'>Updated Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='sort-order'>Sort Order</Label>
              <Select
                value={options.sortOrder}
                onValueChange={(value) => setOptions({ ...options, sortOrder: value as 'asc' | 'desc' })}
              >
                <SelectTrigger id='sort-order'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='asc'>Ascending</SelectItem>
                  <SelectItem value='desc'>Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Progress className='mr-2 h-4 w-4 animate-spin' />
                Exporting...
              </>
            ) : (
              <>
                <Download className='mr-2 h-4 w-4' />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dropdown menu item for markdown export
 * Use this in three-dots menus
 */
export function MarkdownExportMenuItem({
  promptId,
  promptIds,
  projectId,
  filename,
  showOptions = false,
  disabled = false,
  onExportComplete
}: MarkdownExportProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const exportSingle = useExportPromptAsMarkdown()
  const exportMultiple = useExportPromptsAsMarkdown()
  const exportProject = useExportProjectPromptsAsMarkdown()

  const handleExport = async (options?: ExportOptions) => {
    try {
      if (promptId) {
        // Single prompt export - direct download
        await exportSingle.mutateAsync(promptId)
      } else if (promptIds) {
        // Multiple prompts export
        await exportMultiple.mutateAsync({
          promptIds,
          format: options?.format || 'single-file',
          includeFrontmatter: options?.includeFrontmatter ?? true,
          includeCreatedDate: options?.includeCreatedDate ?? true,
          includeUpdatedDate: options?.includeUpdatedDate ?? true,
          includeTags: options?.includeTags ?? true,
          sanitizeContent: options?.sanitizeContent ?? true,
          sortBy: options?.sortBy || 'name',
          sortOrder: options?.sortOrder || 'asc'
        })
      } else if (projectId) {
        // Project prompts export
        await exportProject.mutateAsync({
          projectId,
          data: {
            format: options?.format || 'single-file',
            includeFrontmatter: options?.includeFrontmatter ?? true,
            includeCreatedDate: options?.includeCreatedDate ?? true,
            includeUpdatedDate: options?.includeUpdatedDate ?? true,
            includeTags: options?.includeTags ?? true,
            sanitizeContent: options?.sanitizeContent ?? true,
            sortBy: options?.sortBy || 'name',
            sortOrder: options?.sortOrder || 'asc'
          }
        })
      }

      setDialogOpen(false)
      onExportComplete?.()
    } catch (error) {
      console.error('Export failed:', error)
      // Don't close dialog on error so user can retry
    }
  }

  const handleMenuClick = (event: Event) => {
    if (showOptions && (promptIds || projectId)) {
      // Prevent the dropdown from closing when we want to show the dialog
      event.preventDefault()
      // Use setTimeout to ensure the dialog opens after the event propagation completes
      setTimeout(() => setDialogOpen(true), 0)
    } else {
      // Let dropdown close naturally for direct exports
      handleExport()
    }
  }

  const itemCount = promptId ? 1 : promptIds?.length || 0

  return (
    <>
      <DropdownMenuItem onSelect={handleMenuClick} disabled={disabled}>
        {promptIds && promptIds.length > 1 ? (
          <Archive className='mr-2 h-4 w-4' />
        ) : (
          <FileDown className='mr-2 h-4 w-4' />
        )}
        <span>Export as Markdown</span>
      </DropdownMenuItem>

      {showOptions && (promptIds || projectId) && (
        <MarkdownExportOptionsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onExport={handleExport}
          isExporting={exportSingle.isPending || exportMultiple.isPending || exportProject.isPending}
          itemCount={itemCount || 0}
        />
      )}
    </>
  )
}

/**
 * Standalone button for markdown export
 * Use this when you need a full button instead of a menu item
 */
export function MarkdownExportButton({
  promptId,
  promptIds,
  projectId,
  filename,
  showOptions = true,
  className,
  disabled = false,
  onExportComplete
}: MarkdownExportProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const exportSingle = useExportPromptAsMarkdown()
  const exportMultiple = useExportPromptsAsMarkdown()
  const exportProject = useExportProjectPromptsAsMarkdown()

  const isExporting = exportSingle.isPending || exportMultiple.isPending || exportProject.isPending

  const handleExport = async (options?: ExportOptions) => {
    try {
      if (promptId) {
        // Single prompt export - direct download
        await exportSingle.mutateAsync(promptId)
      } else if (promptIds) {
        // Multiple prompts export
        await exportMultiple.mutateAsync({
          promptIds,
          format: options?.format || 'single-file',
          includeFrontmatter: options?.includeFrontmatter ?? true,
          includeCreatedDate: options?.includeCreatedDate ?? true,
          includeUpdatedDate: options?.includeUpdatedDate ?? true,
          includeTags: options?.includeTags ?? true,
          sanitizeContent: options?.sanitizeContent ?? true,
          sortBy: options?.sortBy || 'name',
          sortOrder: options?.sortOrder || 'asc'
        })
      } else if (projectId) {
        // Project prompts export
        await exportProject.mutateAsync({
          projectId,
          data: {
            format: options?.format || 'single-file',
            includeFrontmatter: options?.includeFrontmatter ?? true,
            includeCreatedDate: options?.includeCreatedDate ?? true,
            includeUpdatedDate: options?.includeUpdatedDate ?? true,
            includeTags: options?.includeTags ?? true,
            sanitizeContent: options?.sanitizeContent ?? true,
            sortBy: options?.sortBy || 'name',
            sortOrder: options?.sortOrder || 'asc'
          }
        })
      }

      setDialogOpen(false)
      onExportComplete?.()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleButtonClick = () => {
    if (showOptions && (promptIds || projectId)) {
      setDialogOpen(true)
    } else {
      handleExport()
    }
  }

  const itemCount = promptId ? 1 : promptIds?.length || 0
  const buttonText = promptId
    ? 'Export Prompt'
    : promptIds
      ? `Export ${itemCount} Prompt${itemCount !== 1 ? 's' : ''}`
      : projectId
        ? 'Export Project Prompts'
        : 'Export'

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        onClick={handleButtonClick}
        disabled={disabled || isExporting}
        className={className}
      >
        {isExporting ? (
          <>
            <Progress className='mr-2 h-4 w-4 animate-spin' />
            Exporting...
          </>
        ) : (
          <>
            {promptIds && promptIds.length > 1 ? (
              <Archive className='mr-2 h-4 w-4' />
            ) : (
              <FileDown className='mr-2 h-4 w-4' />
            )}
            {buttonText}
          </>
        )}
      </Button>

      {showOptions && (promptIds || projectId) && (
        <MarkdownExportOptionsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onExport={handleExport}
          isExporting={isExporting}
          itemCount={itemCount || 0}
        />
      )}
    </>
  )
}

/**
 * Dialog component for markdown export
 * Use this when you need to show the options dialog directly
 */
export function MarkdownExportDialog({
  open,
  onOpenChange,
  promptId,
  promptIds,
  projectId,
  filename,
  onExportComplete
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
} & MarkdownExportProps) {
  const exportSingle = useExportPromptAsMarkdown()
  const exportMultiple = useExportPromptsAsMarkdown()
  const exportProject = useExportProjectPromptsAsMarkdown()

  const isExporting = exportSingle.isPending || exportMultiple.isPending || exportProject.isPending

  const handleExport = async (options: ExportOptions) => {
    try {
      if (promptId) {
        await exportSingle.mutateAsync(promptId)
      } else if (promptIds) {
        await exportMultiple.mutateAsync({
          promptIds,
          format: options?.format || 'single-file',
          includeFrontmatter: options?.includeFrontmatter ?? true,
          includeCreatedDate: options?.includeCreatedDate ?? true,
          includeUpdatedDate: options?.includeUpdatedDate ?? true,
          includeTags: options?.includeTags ?? true,
          sanitizeContent: options?.sanitizeContent ?? true,
          sortBy: options?.sortBy || 'name',
          sortOrder: options?.sortOrder || 'asc'
        })
      } else if (projectId) {
        await exportProject.mutateAsync({
          projectId,
          data: {
            format: options.format || 'single-file',
            includeFrontmatter: options.includeFrontmatter ?? true,
            includeCreatedDate: options.includeCreatedDate ?? true,
            includeUpdatedDate: options.includeUpdatedDate ?? true,
            includeTags: options.includeTags ?? true,
            sanitizeContent: options.sanitizeContent ?? true,
            sortBy: options.sortBy || 'name',
            sortOrder: options.sortOrder || 'asc'
          }
        })
      }

      onOpenChange(false)
      onExportComplete?.()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const itemCount = promptId ? 1 : promptIds?.length || 0

  return (
    <MarkdownExportOptionsDialog
      open={open}
      onOpenChange={onOpenChange}
      onExport={handleExport}
      isExporting={isExporting}
      itemCount={itemCount}
    />
  )
}
