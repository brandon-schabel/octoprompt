import React from 'react'
import {
  ConfiguredDataTable,
  createDataTableColumns,
  type DataTableColumnsConfig
} from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Copy, Eye, Pencil, Trash, Plus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction
} from '@promptliano/ui'
import { FormatTokenCount } from '../format-token-count'
import { toast } from 'sonner'

interface Prompt {
  id: number
  name: string
  content: string
  created: number
  updated: number
  projectId?: number
}

interface PromptDataTableProps {
  prompts: Prompt[]
  selectedPromptIds: number[]
  onSelectPrompts: (promptIds: number[]) => void
  onViewPrompt: (prompt: Prompt) => void
  onEditPrompt: (promptId: number) => void
  onDeletePrompt: (promptId: number) => void
  onCreatePrompt: () => void
  onCopyPrompt: (content: string) => void
  isLoading?: boolean
  className?: string
}

export function PromptDataTable({
  prompts,
  selectedPromptIds,
  onSelectPrompts,
  onViewPrompt,
  onEditPrompt,
  onDeletePrompt,
  onCreatePrompt,
  onCopyPrompt,
  isLoading = false,
  className
}: PromptDataTableProps) {
  const [deletePromptId, setDeletePromptId] = React.useState<number | null>(null)
  const promptToDelete = prompts.find(p => p.id === deletePromptId)

  // Define columns using the column factory
  const columnsConfig: DataTableColumnsConfig<Prompt> = {
    selectable: true,
    columns: [
      {
        type: 'text',
        config: {
          accessorKey: 'name',
          header: 'Prompt Name',
          enableSorting: true,
                    truncate: true,
          maxLength: 40
        }
      },
      {
        type: 'custom',
        column: {
          id: 'tokens',
          header: 'Tokens',
          cell: ({ row }) => (
            <FormatTokenCount tokenContent={row.original.content || ''} />
          ),
          enableSorting: true,
                    accessorFn: (row) => row.content?.length || 0
        }
      },
      {
        type: 'custom',
        column: {
          id: 'size',
          header: 'Size',
          cell: ({ row }) => {
            const size = row.original.content?.length || 0
            const kb = (size / 1024).toFixed(1)
            return (
              <span className='text-sm text-muted-foreground'>
                {size > 1024 ? `${kb} KB` : `${size} bytes`}
              </span>
            )
          },
          enableSorting: true,
                    accessorFn: (row) => row.content?.length || 0
        }
      },
      {
        type: 'date',
        config: {
          accessorKey: 'updated',
          header: 'Updated',
          format: 'relative',
          enableSorting: true
        }
      },
      {
        type: 'date',
        config: {
          accessorKey: 'created', 
          header: 'Created',
          format: 'relative',
          enableSorting: true
        }
      }
    ],
    actions: {
      actions: [
        {
          label: 'View',
          icon: Eye,
          onClick: (prompt) => onViewPrompt(prompt)
        },
        {
          label: 'Edit',
          icon: Pencil,
          onClick: (prompt) => onEditPrompt(prompt.id)
        },
        {
          label: 'Copy Content',
          icon: Copy,
          onClick: (prompt) => {
            onCopyPrompt(prompt.content || '')
            toast.success('Prompt content copied to clipboard')
          }
        },
        {
          label: 'Delete',
          icon: Trash,
          onClick: (prompt) => setDeletePromptId(prompt.id),
          variant: 'destructive'
        }
      ]
    }
  }

  const columns = createDataTableColumns(columnsConfig)

  // Handle selection changes
  const handleSelectionChange = (selectedPrompts: Prompt[]) => {
    onSelectPrompts(selectedPrompts.map(p => p.id))
  }

  return (
    <>
      <ConfiguredDataTable
        columns={columns}
        data={prompts}
        isLoading={isLoading}
        pagination={{
          enabled: true,
          pageSize: 15,
          pageSizeOptions: [10, 15, 25, 50]
        }}
        sorting={{
          enabled: true,
          defaultSort: [{ id: 'name', desc: false }]
        }}
        filtering={{
          enabled: true,
          searchPlaceholder: 'Search prompts...'
        }}
        selection={{
          enabled: true,
          multiple: true,
          onSelectionChange: handleSelectionChange
        }}
        onRowClick={(row) => onViewPrompt(row.original)}
        getRowId={(prompt) => prompt.id.toString()}
        emptyMessage='No prompts yet. Create your first prompt to get started.'
        className={className}
        showToolbar={true}
        showPagination={prompts.length > 15}
        toolbarActions={
          <Button onClick={onCreatePrompt} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            New Prompt
          </Button>
        }
      />

      <AlertDialog open={!!deletePromptId} onOpenChange={(open) => !open && setDeletePromptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
          </AlertDialogHeader>
          <p className='text-sm text-muted-foreground'>
            Are you sure you want to delete the prompt "{promptToDelete?.name}"?
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePromptId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deletePromptId) {
                onDeletePrompt(deletePromptId)
                setDeletePromptId(null)
              }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}