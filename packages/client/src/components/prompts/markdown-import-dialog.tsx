import React, { useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Card,
  CardContent,
  Badge,
  Progress,
  Switch,
  Label,
  ScrollArea,
  Alert,
  AlertDescription
} from '@promptliano/ui'
import { FileUploadInput } from '@promptliano/ui'
import { FileText, Upload, X, CheckCircle, AlertCircle, FileWarning, Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useImportMarkdownPrompts } from '@/hooks/api-hooks'
import { useValidateMarkdownFile } from '@/hooks/api/use-prompts-api'
import { cn } from '@promptliano/ui'

interface FileValidationStatus {
  file: File
  status: 'pending' | 'validating' | 'valid' | 'invalid'
  errors?: string[]
  warnings?: string[]
  metadata?: {
    name?: string
    description?: string
    tags?: string[]
  }
}

interface MarkdownImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: number
  onSuccess?: (importedCount: number) => void
}

export function MarkdownImportDialog({ open, onOpenChange, projectId, onSuccess }: MarkdownImportDialogProps) {
  const [files, setFiles] = useState<FileValidationStatus[]>([])
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const importMutation = useImportMarkdownPrompts()
  const validateMutation = useValidateMarkdownFile()

  // Calculate file statistics
  const fileStats = useMemo(() => {
    const valid = files.filter((f) => f.status === 'valid').length
    const invalid = files.filter((f) => f.status === 'invalid').length
    const pending = files.filter((f) => f.status === 'pending' || f.status === 'validating').length
    const totalSize = files.reduce((acc, f) => acc + f.file.size, 0)

    return { valid, invalid, pending, totalSize }
  }, [files])

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback(
    async (selectedFiles: File[]) => {
      // Filter for markdown files only
      const markdownFiles = selectedFiles.filter((file) => file.name.endsWith('.md') || file.name.endsWith('.markdown'))

      if (markdownFiles.length !== selectedFiles.length) {
        toast.warning(
          `Only markdown files (.md, .markdown) are accepted. ${selectedFiles.length - markdownFiles.length} file(s) ignored.`
        )
      }

      if (markdownFiles.length === 0) {
        toast.error('No valid markdown files selected')
        return
      }

      // Add files to state with pending status
      const newFiles: FileValidationStatus[] = markdownFiles.map((file) => ({
        file,
        status: 'pending' as const
      }))

      setFiles((prev) => [...prev, ...newFiles])

      // Start validation
      setIsValidating(true)

      // Validate files one by one
      for (let i = 0; i < newFiles.length; i++) {
        const fileStatus = newFiles[i]

        // Update status to validating
        setFiles((prev) =>
          prev.map((f, idx) => (idx === files.length + i ? { ...f, status: 'validating' as const } : f))
        )

        try {
          const fileContent = await fileStatus.file.text()
          const validation = await validateMutation.mutateAsync(fileContent)

          // Update with validation results
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === files.length + i
                ? {
                    ...f,
                    status: validation.isValid ? ('valid' as const) : ('invalid' as const),
                    errors: validation.errors?.map((e: any) => (typeof e === 'string' ? e : e.message)),
                    warnings: validation.warnings,
                    metadata: validation.metadata
                  }
                : f
            )
          )
        } catch (error) {
          // Handle validation error
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === files.length + i
                ? {
                    ...f,
                    status: 'invalid' as const,
                    errors: ['Failed to validate file']
                  }
                : f
            )
          )
        }
      }

      setIsValidating(false)
    },
    [files.length, validateMutation]
  )

  // Remove file from list
  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Clear all files
  const handleClearAll = useCallback(() => {
    setFiles([])
    setImportProgress(0)
  }, [])

  // Handle import
  const handleImport = useCallback(async () => {
    const validFiles = files.filter((f) => f.status === 'valid')

    if (validFiles.length === 0) {
      toast.error('No valid files to import')
      return
    }

    try {
      setImportProgress(0)

      const result = await importMutation.mutateAsync({
        files: validFiles.map((f) => f.file),
        options: {
          projectId,
          overwriteExisting,
          validateContent: true
        }
      })

      // Calculate success rate from the summary
      const successCount = result.data?.summary?.created || 0
      const updatedCount = result.data?.summary?.updated || 0
      const errorCount = result.data?.summary?.failed || 0
      const totalSuccessful = successCount + updatedCount

      setImportProgress(100)

      if (totalSuccessful > 0) {
        toast.success(`Successfully imported ${totalSuccessful} prompt${totalSuccessful > 1 ? 's' : ''}`)
        onSuccess?.(totalSuccessful)
      }

      if (errorCount > 0) {
        toast.warning(`Failed to import ${errorCount} prompt${errorCount > 1 ? 's' : ''}`)
      }

      // Close dialog on success
      if (errorCount === 0) {
        handleClose()
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import prompts')
    }
  }, [files, importMutation, projectId, overwriteExisting, onSuccess])

  // Handle dialog close
  const handleClose = useCallback(() => {
    setFiles([])
    setImportProgress(0)
    setOverwriteExisting(false)
    onOpenChange(false)
  }, [onOpenChange])

  // Get status icon
  const getStatusIcon = useCallback((status: FileValidationStatus['status']) => {
    switch (status) {
      case 'validating':
        return <Loader2 className='h-4 w-4 animate-spin text-blue-500' />
      case 'valid':
        return <CheckCircle className='h-4 w-4 text-green-500' />
      case 'invalid':
        return <AlertCircle className='h-4 w-4 text-red-500' />
      default:
        return <FileText className='h-4 w-4 text-muted-foreground' />
    }
  }, [])

  // Check if can import
  const canImport = fileStats.valid > 0 && fileStats.pending === 0 && !importMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[700px]'>
        <DialogHeader>
          <DialogTitle>Import Markdown Prompts</DialogTitle>
          <DialogDescription>
            Import prompts from markdown files. Each file should contain frontmatter with name and optional metadata.
            {projectId && ' Prompts will be added to the current project.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* File Upload Zone */}
          {files.length === 0 ? (
            <FileUploadInput
              onFileSelect={handleFileSelect}
              multiple
              accept={{
                'text/markdown': ['.md', '.markdown']
              }}
              maxSize={5 * 1024 * 1024} // 5MB
              disabled={isValidating || importMutation.isPending}
              className='min-h-[200px]'
            />
          ) : (
            <>
              {/* File Statistics */}
              <div className='flex items-center justify-between text-sm'>
                <div className='flex items-center gap-4'>
                  <span className='text-muted-foreground'>
                    {files.length} file{files.length > 1 ? 's' : ''} • {formatFileSize(fileStats.totalSize)}
                  </span>
                  {fileStats.valid > 0 && (
                    <Badge variant='outline' className='text-green-600'>
                      {fileStats.valid} valid
                    </Badge>
                  )}
                  {fileStats.invalid > 0 && (
                    <Badge variant='outline' className='text-red-600'>
                      {fileStats.invalid} invalid
                    </Badge>
                  )}
                  {fileStats.pending > 0 && (
                    <Badge variant='outline' className='text-blue-600'>
                      {fileStats.pending} validating
                    </Badge>
                  )}
                </div>
                <Button variant='ghost' size='sm' onClick={handleClearAll} disabled={importMutation.isPending}>
                  Clear all
                </Button>
              </div>

              {/* File List */}
              <ScrollArea className='h-[250px] rounded-md border p-4'>
                <div className='space-y-2'>
                  {files.map((fileStatus, index) => (
                    <Card
                      key={index}
                      className={cn('relative', fileStatus.status === 'invalid' && 'border-red-200 bg-red-50/50')}
                    >
                      <CardContent className='flex items-start justify-between p-3'>
                        <div className='flex items-start gap-3 flex-1'>
                          {getStatusIcon(fileStatus.status)}
                          <div className='flex-1 space-y-1'>
                            <div className='flex items-center gap-2'>
                              <span className='text-sm font-medium truncate max-w-[300px]'>{fileStatus.file.name}</span>
                              <span className='text-xs text-muted-foreground'>
                                {formatFileSize(fileStatus.file.size)}
                              </span>
                            </div>

                            {/* Show metadata if available */}
                            {fileStatus.metadata?.name && (
                              <p className='text-xs text-muted-foreground'>Prompt: {fileStatus.metadata.name}</p>
                            )}

                            {/* Show errors */}
                            {fileStatus.errors && fileStatus.errors.length > 0 && (
                              <div className='space-y-1'>
                                {fileStatus.errors.map((error, i) => (
                                  <p key={i} className='text-xs text-red-600 flex items-center gap-1'>
                                    <AlertCircle className='h-3 w-3' />
                                    {error}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Show warnings */}
                            {fileStatus.warnings && fileStatus.warnings.length > 0 && (
                              <div className='space-y-1'>
                                {fileStatus.warnings.map((warning, i) => (
                                  <p key={i} className='text-xs text-yellow-600 flex items-center gap-1'>
                                    <FileWarning className='h-3 w-3' />
                                    {warning}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0'
                          onClick={() => handleRemoveFile(index)}
                          disabled={importMutation.isPending}
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              {/* Add more files button */}
              <Button
                variant='outline'
                size='sm'
                className='w-full'
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.accept = '.md,.markdown'
                  input.onchange = (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || [])
                    if (files.length > 0) {
                      handleFileSelect(files)
                    }
                  }
                  input.click()
                }}
                disabled={isValidating || importMutation.isPending}
              >
                <Upload className='h-4 w-4 mr-2' />
                Add more files
              </Button>
            </>
          )}

          {/* Import Options */}
          {files.length > 0 && (
            <div className='space-y-3 border-t pt-3'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='overwrite'>Overwrite existing prompts</Label>
                  <p className='text-xs text-muted-foreground'>
                    Replace prompts with the same name if they already exist
                  </p>
                </div>
                <Switch
                  id='overwrite'
                  checked={overwriteExisting}
                  onCheckedChange={setOverwriteExisting}
                  disabled={importMutation.isPending}
                />
              </div>
            </div>
          )}

          {/* Import Progress */}
          {importMutation.isPending && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span>Importing prompts...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className='h-2' />
            </div>
          )}

          {/* Import Results */}
          {importMutation.isSuccess && importMutation.data && (
            <Alert>
              <CheckCircle className='h-4 w-4' />
              <AlertDescription>Import completed. Check the results above for any failures.</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline' disabled={importMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={!canImport}>
            {importMutation.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Importing...
              </>
            ) : (
              <>
                <Download className='mr-2 h-4 w-4' />
                Import {fileStats.valid} Prompt{fileStats.valid !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
