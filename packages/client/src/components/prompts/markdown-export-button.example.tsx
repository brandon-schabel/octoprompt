/**
 * Example usage of the Markdown Export components
 *
 * This file demonstrates how to use the export components in different scenarios
 */

import { useState } from 'react'
import { MarkdownExportButton, MarkdownExportMenuItem, MarkdownExportDialog } from './markdown-export-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button
} from '@promptliano/ui'
import { MoreHorizontal, Copy, Trash, Edit } from 'lucide-react'

/**
 * Example 1: Using in a three-dots dropdown menu for a single prompt
 */
export function SinglePromptActionsExample({ promptId }: { promptId: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='h-8 w-8'>
          <MoreHorizontal className='h-4 w-4' />
          <span className='sr-only'>Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem>
          <Edit className='mr-2 h-4 w-4' />
          Edit Prompt
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Copy className='mr-2 h-4 w-4' />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Single prompt export - no options dialog */}
        <MarkdownExportMenuItem promptId={promptId} filename={`my-prompt-${promptId}.md`} />
        <DropdownMenuSeparator />
        <DropdownMenuItem className='text-destructive'>
          <Trash className='mr-2 h-4 w-4' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Example 2: Batch export with options dialog in dropdown menu
 */
export function BatchExportMenuExample({ selectedPromptIds }: { selectedPromptIds: number[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='h-8 w-8'>
          <MoreHorizontal className='h-4 w-4' />
          <span className='sr-only'>Bulk Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem>
          <Copy className='mr-2 h-4 w-4' />
          Copy Selected ({selectedPromptIds.length})
        </DropdownMenuItem>
        {/* Multiple prompts export - shows options dialog */}
        <MarkdownExportMenuItem
          promptIds={selectedPromptIds}
          showOptions={true}
          disabled={selectedPromptIds.length === 0}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem className='text-destructive'>
          <Trash className='mr-2 h-4 w-4' />
          Delete Selected
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Example 3: Standalone export button for project prompts
 */
export function ProjectExportButtonExample({ projectId }: { projectId: number }) {
  return (
    <div className='flex gap-2'>
      {/* Export all prompts in project with options */}
      <MarkdownExportButton
        projectId={projectId}
        showOptions={true}
        onExportComplete={() => {
          console.log('Export completed!')
        }}
      />

      {/* Quick export without options */}
      <MarkdownExportButton projectId={projectId} showOptions={false} className='ml-auto' />
    </div>
  )
}

/**
 * Example 4: Custom dialog trigger for advanced scenarios
 */
export function CustomExportDialogExample({ promptIds }: { promptIds: number[] }) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>Open Export Options</Button>

      <MarkdownExportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        promptIds={promptIds}
        onExportComplete={() => {
          console.log('Export completed!')
          // Additional actions after export
        }}
      />
    </>
  )
}

/**
 * Example 5: Toolbar with multiple export options
 */
export function PromptToolbarExample({
  selectedPromptIds,
  projectId
}: {
  selectedPromptIds: number[]
  projectId: number
}) {
  const hasSelection = selectedPromptIds.length > 0

  return (
    <div className='flex items-center gap-2 p-2 border-b'>
      <span className='text-sm text-muted-foreground'>
        {hasSelection ? `${selectedPromptIds.length} selected` : 'No prompts selected'}
      </span>

      <div className='ml-auto flex gap-2'>
        {hasSelection ? (
          // Export selected prompts
          <MarkdownExportButton promptIds={selectedPromptIds} showOptions={true} />
        ) : (
          // Export all project prompts
          <MarkdownExportButton projectId={projectId} showOptions={true} />
        )}
      </div>
    </div>
  )
}

/**
 * Example 6: Integration with existing prompts list
 */
export function PromptsListIntegrationExample() {
  const [selectedPrompts, setSelectedPrompts] = useState<number[]>([])
  const projectId = 123 // Example project ID

  return (
    <div className='space-y-4'>
      {/* Header with export options */}
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Project Prompts</h3>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon'>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {selectedPrompts.length > 0 ? (
              <>
                <MarkdownExportMenuItem promptIds={selectedPrompts} showOptions={true} />
                <DropdownMenuItem>Export Selected as JSON</DropdownMenuItem>
              </>
            ) : (
              <>
                <MarkdownExportMenuItem projectId={projectId} showOptions={true} />
                <DropdownMenuItem>Export All as JSON</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Prompts list would go here */}
      <div className='space-y-2'>{/* Individual prompt items with their own export options */}</div>
    </div>
  )
}
