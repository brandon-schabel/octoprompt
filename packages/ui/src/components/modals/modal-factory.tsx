import React, { useState, useCallback, useMemo } from 'react'
import { cn } from '../../utils'
import {
  DialogBase,
  FormDialog,
  ConfirmationDialog,
  type DialogBaseProps,
  type FormDialogProps,
  type ConfirmationDialogProps,
  type DialogAction
} from '../overlay/dialog-base'
import {
  FormFactory,
  createFormComponent,
  type FormConfig
} from '../forms/form-factory'
import { Button } from '../core/button'
import { Input } from '../core/input'
import { Badge } from '../core/badge'
import { ScrollArea } from '../data/scroll-area'
import { Separator } from '../core/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../core/tabs'
import { Progress } from '../data/progress'
import { SearchInput } from '../interaction/search-input'
import { 
  FileUploadInput,
  type FileUploadInputProps 
} from '../file/file-upload-input'
import {
  Search,
  Upload,
  Eye,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react'

// =============================================
// CORE MODAL FACTORY TYPES
// =============================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type ModalVariant = 'default' | 'form' | 'confirmation' | 'info' | 'search' | 'workflow' | 'upload'

export interface BaseModalConfig {
  title: string
  description?: string
  size?: ModalSize
  className?: string
  preventOutsideClick?: boolean
  preventEscapeClose?: boolean
  showCloseButton?: boolean
  icon?: React.ComponentType<{ className?: string }>
  iconClassName?: string
}

export interface CrudModalConfig<T = any> extends BaseModalConfig {
  entityName: string
  api?: {
    create?: (data: any) => Promise<T>
    update?: (id: number, data: any) => Promise<T>
    delete?: (id: number) => Promise<boolean>
    get?: (id: number) => Promise<T>
  }
  hooks?: {
    useCreate?: () => any
    useUpdate?: () => any
    useDelete?: () => any
    useGet?: (id: number) => any
    useInvalidate?: () => any
  }
  onSuccess?: (action: 'create' | 'update' | 'delete', data?: T) => void
  onError?: (action: 'create' | 'update' | 'delete', error: Error) => void
}

export interface FormModalConfig extends BaseModalConfig {
  formConfig: FormConfig<any>
  onSubmit: (data: any) => void | Promise<void>
  submitLabel?: string
  cancelLabel?: string
  resetOnSubmit?: boolean
  validateOnMount?: boolean
}

export interface SearchModalConfig<T = any> extends BaseModalConfig {
  searchPlaceholder?: string
  searchable: (items: T[], query: string) => T[]
  renderItem: (item: T, index: number) => React.ReactNode
  onSelect: (item: T) => void
  initialItems?: T[]
  loadItems?: (query: string) => Promise<T[]>
  multiSelect?: boolean
  selectedItems?: T[]
  keyExtractor?: (item: T) => string | number
  emptyMessage?: string
  loadingMessage?: string
}

export interface WorkflowModalConfig extends BaseModalConfig {
  steps: WorkflowStep[]
  initialStep?: number
  onComplete: (data: any) => void | Promise<void>
  onCancel?: () => void
  allowSkipSteps?: boolean
  showProgress?: boolean
  persistData?: boolean
}

export interface WorkflowStep {
  id: string
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  component: React.ComponentType<{
    data: any
    onNext: (stepData: any) => void
    onPrev: () => void
    onSkip?: () => void
    isFirstStep: boolean
    isLastStep: boolean
  }>
  validate?: (data: any) => boolean | string
  optional?: boolean
}

export interface UploadModalConfig extends BaseModalConfig {
  uploadProps: Omit<FileUploadInputProps, 'onFileSelect'>
  onUpload: (files: File[]) => Promise<void>
  onProgress?: (progress: number) => void
  showPreview?: boolean
  allowMultiple?: boolean
  maxFiles?: number
  acceptedTypes?: string[]
}

// =============================================
// MODAL FACTORY CORE IMPLEMENTATION
// =============================================

export interface ModalState {
  isOpen: boolean
  data?: any
  step?: number
  errors?: Record<string, string>
  isSubmitting?: boolean
  progress?: number
}

export interface ModalActions {
  open: (data?: any) => void
  close: () => void
  setData: (data: any) => void
  setStep: (step: number) => void
  setErrors: (errors: Record<string, string>) => void
  setSubmitting: (submitting: boolean) => void
  setProgress: (progress: number) => void
  reset: () => void
}

export function useModalState(initialData?: any): [ModalState, ModalActions] {
  const [state, setState] = useState<ModalState>({
    isOpen: false,
    data: initialData,
    step: 0,
    errors: {},
    isSubmitting: false,
    progress: 0
  })

  const actions = useMemo<ModalActions>(() => ({
    open: (data?: any) => setState(prev => ({ 
      ...prev, 
      isOpen: true, 
      data: data ?? prev.data,
      errors: {},
      isSubmitting: false,
      progress: 0
    })),
    close: () => setState(prev => ({ ...prev, isOpen: false })),
    setData: (data: any) => setState(prev => ({ ...prev, data })),
    setStep: (step: number) => setState(prev => ({ ...prev, step })),
    setErrors: (errors: Record<string, string>) => setState(prev => ({ ...prev, errors })),
    setSubmitting: (submitting: boolean) => setState(prev => ({ ...prev, isSubmitting: submitting })),
    setProgress: (progress: number) => setState(prev => ({ ...prev, progress })),
    reset: () => setState({
      isOpen: false,
      data: initialData,
      step: 0,
      errors: {},
      isSubmitting: false,
      progress: 0
    })
  }), [initialData])

  return [state, actions]
}

// =============================================
// CRUD MODAL FACTORY
// =============================================

export function createCrudModal<T extends { id?: number }>(config: CrudModalConfig<T>) {
  const { entityName, size = 'md', hooks, onSuccess, onError } = config

  const CreateModal = React.memo(({ 
    formConfig, 
    isOpen, 
    onClose, 
    initialData 
  }: {
    formConfig: FormConfig<any>
    isOpen: boolean
    onClose: () => void
    initialData?: Partial<T>
  }) => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const createMutation = hooks?.useCreate?.()

    const handleSubmit = async (data: any) => {
      setIsSubmitting(true)
      try {
        if (createMutation) {
          await createMutation.mutateAsync(data)
        } else if (config.api?.create) {
          await config.api.create(data)
        }
        
        onSuccess?.('create', data)
        onClose()
      } catch (error) {
        onError?.('create', error as Error)
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <FormDialog
        title={config.title || `Create ${entityName}`}
        description={config.description || `Create a new ${entityName.toLowerCase()}`}
        size={size}
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget as HTMLFormElement)
          const data = Object.fromEntries(formData.entries())
          handleSubmit({ ...initialData, ...data })
        }}
        isSubmitting={isSubmitting || createMutation?.isPending}
        submitLabel="Create"
        icon={Plus}
        iconClassName="text-green-600"
      >
        <FormFactory
          {...formConfig}
          onSubmit={handleSubmit}
          defaultValues={initialData}
        />
      </FormDialog>
    )
  })

  const EditModal = React.memo(({ 
    formConfig, 
    isOpen, 
    onClose, 
    item 
  }: {
    formConfig: FormConfig<any>
    isOpen: boolean
    onClose: () => void
    item?: T
  }) => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const updateMutation = hooks?.useUpdate?.()

    const handleSubmit = async (data: any) => {
      if (!item?.id) return
      
      setIsSubmitting(true)
      try {
        if (updateMutation) {
          await updateMutation.mutateAsync({ id: item.id, data })
        } else if (config.api?.update) {
          await config.api.update(item.id, data)
        }
        
        onSuccess?.('update', data)
        onClose()
      } catch (error) {
        onError?.('update', error as Error)
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <FormDialog
        title={config.title || `Edit ${entityName}`}
        description={config.description || `Update ${entityName.toLowerCase()} details`}
        size={size}
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget as HTMLFormElement)
          const data = Object.fromEntries(formData.entries())
          handleSubmit(data)
        }}
        isSubmitting={isSubmitting || updateMutation?.isPending}
        submitLabel="Update"
        icon={Edit}
        iconClassName="text-blue-600"
      >
        <FormFactory
          {...formConfig}
          onSubmit={handleSubmit}
          defaultValues={item}
        />
      </FormDialog>
    )
  })

  const DeleteModal = React.memo(({ 
    isOpen, 
    onClose, 
    item,
    confirmationMessage
  }: {
    isOpen: boolean
    onClose: () => void
    item?: T
    confirmationMessage?: string
  }) => {
    const deleteMutation = hooks?.useDelete?.()

    const handleDelete = async () => {
      if (!item?.id) return
      
      try {
        if (deleteMutation) {
          await deleteMutation.mutateAsync(item.id)
        } else if (config.api?.delete) {
          await config.api.delete(item.id)
        }
        
        onSuccess?.('delete', item)
        onClose()
      } catch (error) {
        onError?.('delete', error as Error)
      }
    }

    return (
      <ConfirmationDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleDelete}
        title={`Delete ${entityName}`}
        message={confirmationMessage || `Are you sure you want to delete this ${entityName.toLowerCase()}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isConfirming={deleteMutation?.isPending}
      />
    )
  })

  const ViewModal = React.memo(({ 
    isOpen, 
    onClose, 
    item,
    renderContent
  }: {
    isOpen: boolean
    onClose: () => void
    item?: T
    renderContent?: (item: T) => React.ReactNode
  }) => {
    const defaultContent = useMemo(() => {
      if (!item || !renderContent) {
        return (
          <div className="space-y-4">
            {item && Object.entries(item).map(([key, value]) => (
              <div key={key} className="flex justify-between py-2 border-b">
                <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        )
      }
      return renderContent(item)
    }, [item, renderContent])

    return (
      <DialogBase
        title={config.title || `View ${entityName}`}
        description={config.description || `${entityName} details`}
        size={size}
        isOpen={isOpen}
        onClose={onClose}
        icon={Eye}
        iconClassName="text-blue-600"
      >
        {defaultContent}
      </DialogBase>
    )
  })

  return {
    CreateModal,
    EditModal,
    DeleteModal,
    ViewModal
  }
}

// =============================================
// SEARCH MODAL COMPONENT
// =============================================

export function createSearchModal<T>(config: SearchModalConfig<T>) {
  return React.memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<T[]>(config.initialItems || [])
    const [selectedItems, setSelectedItems] = useState<T[]>(config.selectedItems || [])

    const filteredItems = useMemo(() => {
      return config.searchable(items, query)
    }, [items, query])

    const handleSearch = useCallback(async (searchQuery: string) => {
      setQuery(searchQuery)
      
      if (config.loadItems && searchQuery.trim()) {
        setLoading(true)
        try {
          const results = await config.loadItems(searchQuery)
          setItems(results)
        } catch (error) {
          console.error('Search failed:', error)
        } finally {
          setLoading(false)
        }
      }
    }, [config.loadItems])

    const handleSelect = (item: T) => {
      if (config.multiSelect) {
        const key = config.keyExtractor ? config.keyExtractor(item) : (item as any).id
        const isSelected = selectedItems.some(selected => 
          (config.keyExtractor ? config.keyExtractor(selected) : (selected as any).id) === key
        )
        
        if (isSelected) {
          setSelectedItems(prev => prev.filter(selected => 
            (config.keyExtractor ? config.keyExtractor(selected) : (selected as any).id) !== key
          ))
        } else {
          setSelectedItems(prev => [...prev, item])
        }
      } else {
        config.onSelect(item)
        onClose()
      }
    }

    const handleConfirmSelection = () => {
      if (config.multiSelect && selectedItems.length > 0) {
        selectedItems.forEach(item => config.onSelect(item))
      }
      onClose()
    }

    const actions = config.multiSelect ? [
      {
        label: 'Cancel',
        onClick: onClose,
        variant: 'outline' as const
      },
      {
        label: `Select ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`,
        onClick: handleConfirmSelection,
        disabled: selectedItems.length === 0
      }
    ] : undefined

    return (
      <DialogBase
        title={config.title}
        description={config.description}
        size={config.size || 'lg'}
        isOpen={isOpen}
        onClose={onClose}
        icon={Search}
        iconClassName="text-blue-600"
        actions={actions}
      >
        <div className="space-y-4">
          <SearchInput
            placeholder={config.searchPlaceholder || 'Search...'}
            value={query}
            onChange={handleSearch}
            className="w-full"
          />
          
          <ScrollArea className="max-h-[400px] border rounded-md">
            <div className="p-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">{config.loadingMessage || 'Searching...'}</span>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <div
                    key={config.keyExtractor ? config.keyExtractor(item) : index}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "p-3 rounded-md cursor-pointer transition-colors border",
                      config.multiSelect && selectedItems.some(selected => 
                        (config.keyExtractor ? config.keyExtractor(selected) : (selected as any).id) === 
                        (config.keyExtractor ? config.keyExtractor(item) : (item as any).id)
                      ) 
                        ? "bg-primary/10 border-primary" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    {config.renderItem(item, index)}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {config.emptyMessage || 'No items found'}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogBase>
    )
  })
}

// =============================================
// WORKFLOW MODAL COMPONENT
// =============================================

export function createWorkflowModal(config: WorkflowModalConfig) {
  return React.memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [currentStep, setCurrentStep] = useState(config.initialStep || 0)
    const [stepData, setStepData] = useState<Record<string, any>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const step = config.steps[currentStep]
    const isFirstStep = currentStep === 0
    const isLastStep = currentStep === config.steps.length - 1
    const progress = ((currentStep + 1) / config.steps.length) * 100

    const handleNext = useCallback((data: any) => {
      const newStepData = { ...stepData, [step.id]: data }
      setStepData(newStepData)
      
      if (isLastStep) {
        handleComplete(newStepData)
      } else {
        setCurrentStep(prev => prev + 1)
      }
    }, [stepData, step.id, isLastStep])

    const handlePrev = useCallback(() => {
      if (!isFirstStep) {
        setCurrentStep(prev => prev - 1)
      }
    }, [isFirstStep])

    const handleComplete = async (finalData: any) => {
      setIsSubmitting(true)
      try {
        await config.onComplete(finalData)
        onClose()
      } catch (error) {
        console.error('Workflow completion failed:', error)
      } finally {
        setIsSubmitting(false)
      }
    }

    const handleSkip = useCallback(() => {
      if (config.allowSkipSteps && step.optional) {
        handleNext({})
      }
    }, [config.allowSkipSteps, step.optional, handleNext])

    const handleCancel = () => {
      config.onCancel?.()
      onClose()
    }

    const StepComponent = step.component

    return (
      <DialogBase
        title={`${config.title} - Step ${currentStep + 1} of ${config.steps.length}`}
        description={step.description || config.description}
        size={config.size || 'lg'}
        isOpen={isOpen}
        onClose={handleCancel}
        icon={step.icon}
        isSubmitting={isSubmitting}
        preventOutsideClick={isSubmitting}
        preventEscapeClose={isSubmitting}
      >
        <div className="space-y-4">
          {config.showProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{step.title}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <Tabs value={step.id} className="w-full">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value={step.id}>{step.title}</TabsTrigger>
            </TabsList>
            <TabsContent value={step.id} className="space-y-4">
              <StepComponent
                data={stepData}
                onNext={handleNext}
                onPrev={handlePrev}
                onSkip={config.allowSkipSteps ? handleSkip : undefined}
                isFirstStep={isFirstStep}
                isLastStep={isLastStep}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogBase>
    )
  })
}

// =============================================
// FILE UPLOAD MODAL COMPONENT
// =============================================

export function createUploadModal(config: UploadModalConfig) {
  return React.memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [files, setFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)

    const handleFileChange = (selectedFiles: File[]) => {
      setFiles(selectedFiles)
    }

    const handleUpload = async () => {
      if (files.length === 0) return
      
      setUploading(true)
      setProgress(0)
      
      try {
        await config.onUpload(files)
        onClose()
        setFiles([])
      } catch (error) {
        console.error('Upload failed:', error)
      } finally {
        setUploading(false)
        setProgress(0)
      }
    }

    const handleRemoveFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const actions: DialogAction[] = [
      {
        label: 'Cancel',
        onClick: onClose,
        variant: 'outline',
        disabled: uploading
      },
      {
        label: uploading ? 'Uploading...' : 'Upload',
        onClick: handleUpload,
        disabled: files.length === 0 || uploading,
        loading: uploading,
        icon: Upload
      }
    ]

    return (
      <DialogBase
        title={config.title}
        description={config.description}
        size={config.size || 'md'}
        isOpen={isOpen}
        onClose={onClose}
        icon={Upload}
        iconClassName="text-blue-600"
        actions={actions}
        isSubmitting={uploading}
      >
        <div className="space-y-4">
          <FileUploadInput
            {...config.uploadProps}
            onFileSelect={handleFileChange}
            disabled={uploading}
          />
          
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Selected Files:</h4>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{file.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {(file.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {uploading && progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>
      </DialogBase>
    )
  })
}

// =============================================
// MODAL FACTORY MAIN EXPORTS
// =============================================

// Re-export existing modal components for convenience
export {
  DialogBase,
  FormDialog,
  ConfirmationDialog
} from '../overlay/dialog-base'

export type {
  DialogBaseProps,
  FormDialogProps,
  ConfirmationDialogProps,
  DialogAction
} from '../overlay/dialog-base'