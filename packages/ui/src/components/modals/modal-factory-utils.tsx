import React from 'react'
import { z } from 'zod'
import { type FormConfig } from '../forms/form-factory'
import {
  createCrudModal,
  createSearchModal,
  createWorkflowModal,
  createUploadModal,
  useModalState,
  type CrudModalConfig,
  type SearchModalConfig,
  type WorkflowModalConfig,
  type UploadModalConfig,
  type ModalState,
  type ModalActions
} from './modal-factory'

// =============================================
// COMMON MODAL CONFIGURATIONS
// =============================================

export const commonModalSizes = {
  compact: 'sm' as const,
  standard: 'md' as const,
  wide: 'lg' as const,
  extraWide: 'xl' as const,
  fullScreen: 'full' as const
}

export const modalPresets = {
  quickCreate: {
    size: 'sm' as const,
    preventOutsideClick: false,
    showCloseButton: true
  },
  detailedForm: {
    size: 'lg' as const,
    preventOutsideClick: true,
    showCloseButton: false
  },
  confirmation: {
    size: 'sm' as const,
    preventOutsideClick: true,
    preventEscapeClose: true,
    showCloseButton: false
  },
  browse: {
    size: 'xl' as const,
    preventOutsideClick: false,
    showCloseButton: true
  }
} as const

// =============================================
// FORM CONFIG BUILDERS
// =============================================

export function createEntityFormConfig<T extends z.ZodType>(
  schema: T,
  options: {
    excludeFields?: (keyof z.infer<T>)[]
    fieldOverrides?: Partial<Record<keyof z.infer<T>, any>>
    layout?: 'single' | 'two-column' | 'grouped'
  } = {}
): FormConfig<T> {
  const { excludeFields = [], fieldOverrides = {}, layout = 'single' } = options
  
  const shape = (schema as any)._def.shape()
  const fields = Object.keys(shape)
    .filter(key => !excludeFields.includes(key as keyof z.infer<T>))
    .map(key => {
      const zodField = shape[key]
      const override = (fieldOverrides && key in fieldOverrides) 
        ? (fieldOverrides as any)[key] 
        : undefined
      
      return {
        name: key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        type: inferFieldType(zodField),
        required: !zodField.isOptional(),
        ...override
      }
    })

  return {
    schema,
    fields,
    layout: layout === 'two-column' ? { columns: 2 } : undefined
  } as FormConfig<T>
}

function inferFieldType(zodField: any): string {
  const typeName = zodField._def.typeName
  
  switch (typeName) {
    case 'ZodString':
      return zodField._def.checks?.some((check: any) => check.kind === 'email') ? 'email' : 'text'
    case 'ZodNumber':
      return 'number'
    case 'ZodBoolean':
      return 'checkbox'
    case 'ZodDate':
      return 'date'
    case 'ZodEnum':
      return 'select'
    case 'ZodArray':
      return 'tags'
    default:
      return 'text'
  }
}

// =============================================
// ENHANCED CRUD MODAL FACTORY
// =============================================

export interface EnhancedCrudModalOptions<T extends Record<string, any>> extends Omit<CrudModalConfig<T>, 'formConfig'> {
  schema?: z.ZodType<T>
  formConfig?: FormConfig<z.ZodType<T>>
  fields?: {
    create?: FormConfig<z.ZodType<T>>
    edit?: FormConfig<z.ZodType<T>>
    view?: {
      fields: (keyof T)[]
      formatters?: Partial<Record<keyof T, (value: any) => React.ReactNode>>
    }
  }
  permissions?: {
    canCreate?: boolean
    canEdit?: (item: T) => boolean
    canDelete?: (item: T) => boolean
    canView?: (item: T) => boolean
  }
  confirmations?: {
    delete?: (item: T) => string
    unsavedChanges?: string
  }
}

export function createEnhancedCrudModal<T extends { id?: number }>(
  options: EnhancedCrudModalOptions<T>
) {
  const {
    schema,
    formConfig,
    fields,
    permissions = {},
    confirmations = {},
    ...baseConfig
  } = options

  // Auto-generate form config if schema is provided
  const createFormConfig = fields?.create || formConfig || (schema ? createEntityFormConfig(schema, {
    excludeFields: ['id' as keyof T, 'created' as keyof T, 'updated' as keyof T]
  }) : undefined)

  const editFormConfig = fields?.edit || formConfig || (schema ? createEntityFormConfig(schema, {
    excludeFields: ['id' as keyof T, 'created' as keyof T]
  }) : undefined)

  const crudModals = createCrudModal<T>(baseConfig)

  return {
    ...crudModals,
    
    // Enhanced CreateModal with permissions
    CreateModal: ({ 
      isOpen, 
      onClose, 
      initialData,
      ...props 
    }: {
      isOpen: boolean
      onClose: () => void
      initialData?: Partial<T>
    } & any) => {
      if (permissions.canCreate === false) return null
      
      return (
        <crudModals.CreateModal
          formConfig={createFormConfig!}
          isOpen={isOpen}
          onClose={onClose}
          initialData={initialData}
          {...props}
        />
      )
    },

    // Enhanced EditModal with permissions
    EditModal: ({ 
      isOpen, 
      onClose, 
      item,
      ...props 
    }: {
      isOpen: boolean
      onClose: () => void
      item?: T
    } & any) => {
      if (!item || (permissions.canEdit && !permissions.canEdit(item))) return null
      
      return (
        <crudModals.EditModal
          formConfig={editFormConfig!}
          isOpen={isOpen}
          onClose={onClose}
          item={item}
          {...props}
        />
      )
    },

    // Enhanced DeleteModal with custom confirmations
    DeleteModal: ({ 
      isOpen, 
      onClose, 
      item,
      ...props 
    }: {
      isOpen: boolean
      onClose: () => void
      item?: T
    } & any) => {
      if (!item || (permissions.canDelete && !permissions.canDelete(item))) return null
      
      const confirmationMessage = confirmations.delete ? confirmations.delete(item) : undefined
      
      return (
        <crudModals.DeleteModal
          isOpen={isOpen}
          onClose={onClose}
          item={item}
          confirmationMessage={confirmationMessage}
          {...props}
        />
      )
    },

    // Enhanced ViewModal with formatted fields
    ViewModal: ({ 
      isOpen, 
      onClose, 
      item,
      ...props 
    }: {
      isOpen: boolean
      onClose: () => void
      item?: T
    } & any) => {
      if (!item || (permissions.canView && !permissions.canView(item))) return null
      
      const renderContent = fields?.view ? (item: T) => (
        <div className="space-y-4">
          {fields.view!.fields.map(fieldKey => {
            const value = item[fieldKey]
            const formatter = fields.view!.formatters?.[fieldKey]
            const displayValue = formatter ? formatter(value) : String(value || '-')
            
            return (
              <div key={String(fieldKey)} className="flex justify-between py-2 border-b">
                <span className="font-medium capitalize">
                  {String(fieldKey).replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span>{displayValue}</span>
              </div>
            )
          })}
        </div>
      ) : undefined
      
      return (
        <crudModals.ViewModal
          isOpen={isOpen}
          onClose={onClose}
          item={item}
          renderContent={renderContent}
          {...props}
        />
      )
    }
  }
}

// =============================================
// MODAL MANAGER HOOK
// =============================================

export interface ModalManager<T = any> {
  // State
  state: ModalState
  actions: ModalActions
  
  // Modal toggles
  openCreate: (initialData?: Partial<T>) => void
  openEdit: (item: T) => void
  openDelete: (item: T) => void
  openView: (item: T) => void
  openSearch: (initialItems?: T[]) => void
  openWorkflow: (initialData?: any) => void
  openUpload: () => void
  
  // Current modal tracking
  currentModal: 'create' | 'edit' | 'delete' | 'view' | 'search' | 'workflow' | 'upload' | null
  setCurrentModal: (modal: ModalManager<T>['currentModal']) => void
  
  // Convenience methods
  closeAll: () => void
  isAnyOpen: boolean
}

export function useModalManager<T = any>(initialData?: T): ModalManager<T> {
  const [state, actions] = useModalState(initialData)
  const [currentModal, setCurrentModal] = React.useState<ModalManager<T>['currentModal']>(null)

  const openCreate = React.useCallback((initialData?: Partial<T>) => {
    setCurrentModal('create')
    actions.open(initialData)
  }, [actions])

  const openEdit = React.useCallback((item: T) => {
    setCurrentModal('edit')
    actions.open(item)
  }, [actions])

  const openDelete = React.useCallback((item: T) => {
    setCurrentModal('delete')
    actions.open(item)
  }, [actions])

  const openView = React.useCallback((item: T) => {
    setCurrentModal('view')
    actions.open(item)
  }, [actions])

  const openSearch = React.useCallback((initialItems?: T[]) => {
    setCurrentModal('search')
    actions.open({ initialItems })
  }, [actions])

  const openWorkflow = React.useCallback((initialData?: any) => {
    setCurrentModal('workflow')
    actions.open(initialData)
  }, [actions])

  const openUpload = React.useCallback(() => {
    setCurrentModal('upload')
    actions.open()
  }, [actions])

  const closeAll = React.useCallback(() => {
    setCurrentModal(null)
    actions.close()
  }, [actions])

  return {
    state,
    actions,
    openCreate,
    openEdit,
    openDelete,
    openView,
    openSearch,
    openWorkflow,
    openUpload,
    currentModal,
    setCurrentModal,
    closeAll,
    isAnyOpen: state.isOpen
  }
}

// =============================================
// MODAL COMPOSITION HELPERS
// =============================================

export interface ModalSuite<T extends { id?: number }> {
  modals: ReturnType<typeof createEnhancedCrudModal<T>>
  manager: ModalManager<T>
  renderModals: () => React.ReactNode
}

export function createModalSuite<T extends { id?: number }>(
  config: EnhancedCrudModalOptions<T> & {
    searchConfig?: Omit<SearchModalConfig<T>, 'title' | 'onSelect'>
    workflowConfig?: Omit<WorkflowModalConfig, 'title' | 'onComplete'>
    uploadConfig?: Omit<UploadModalConfig, 'title' | 'onUpload'>
  }
): ModalSuite<T> {
  const modals = createEnhancedCrudModal(config)
  const manager = useModalManager<T>()

  const searchModal = config.searchConfig ? createSearchModal<T>({
    ...config.searchConfig,
    title: `Search ${config.entityName}`,
    onSelect: (item) => {
      manager.openView(item)
    }
  }) : null

  const workflowModal = config.workflowConfig ? createWorkflowModal({
    ...config.workflowConfig,
    title: `${config.entityName} Workflow`,
    onComplete: async (data) => {
      if (config.onSuccess) {
        config.onSuccess('create', data)
      }
      manager.closeAll()
    }
  }) : null

  const uploadModal = config.uploadConfig ? createUploadModal({
    ...config.uploadConfig,
    title: `Upload ${config.entityName}`,
    onUpload: async (files) => {
      // Handle upload logic here
      manager.closeAll()
    }
  }) : null

  const renderModals = React.useCallback(() => {
    const { currentModal, state, closeAll } = manager
    const item = state.data as T

    return (
      <>
        <modals.CreateModal
          isOpen={state.isOpen && currentModal === 'create'}
          onClose={closeAll}
          initialData={state.data}
        />
        
        <modals.EditModal
          isOpen={state.isOpen && currentModal === 'edit'}
          onClose={closeAll}
          item={item}
        />
        
        <modals.DeleteModal
          isOpen={state.isOpen && currentModal === 'delete'}
          onClose={closeAll}
          item={item}
        />
        
        <modals.ViewModal
          isOpen={state.isOpen && currentModal === 'view'}
          onClose={closeAll}
          item={item}
        />
        
        {searchModal && React.createElement(searchModal, {
          isOpen: state.isOpen && currentModal === 'search',
          onClose: closeAll
        })}
        
        {workflowModal && React.createElement(workflowModal, {
          isOpen: state.isOpen && currentModal === 'workflow',
          onClose: closeAll
        })}
        
        {uploadModal && React.createElement(uploadModal, {
          isOpen: state.isOpen && currentModal === 'upload',
          onClose: closeAll
        })}
      </>
    )
  }, [manager, modals, searchModal, workflowModal, uploadModal])

  return {
    modals,
    manager,
    renderModals
  }
}

// =============================================
// COMMON VALIDATORS & FORMATTERS
// =============================================

export const commonFormatters = {
  date: (value: number | Date) => {
    if (!value) return '-'
    const date = typeof value === 'number' ? new Date(value) : value
    return date.toLocaleDateString()
  },
  
  dateTime: (value: number | Date) => {
    if (!value) return '-'
    const date = typeof value === 'number' ? new Date(value) : value
    return date.toLocaleString()
  },
  
  currency: (value: number) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  },
  
  percentage: (value: number) => {
    if (value == null) return '-'
    return `${(value * 100).toFixed(1)}%`
  },
  
  truncate: (maxLength: number) => (value: string) => {
    if (!value) return '-'
    return value.length > maxLength 
      ? `${value.substring(0, maxLength)}...`
      : value
  },
  
  badge: (colorMap: Record<string, string>) => (value: string) => {
    if (!value) return null
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[value] || 'bg-gray-100'}`}>
        {value}
      </span>
    )
  }
}

export const commonValidators = {
  required: (message = 'This field is required') => (value: any) => 
    value ? true : message,
    
  minLength: (min: number, message?: string) => (value: string) =>
    !value || value.length >= min ? true : (message || `Minimum ${min} characters required`),
    
  maxLength: (max: number, message?: string) => (value: string) =>
    !value || value.length <= max ? true : (message || `Maximum ${max} characters allowed`),
    
  email: (message = 'Invalid email address') => (value: string) =>
    !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? true : message,
    
  unique: (checkUnique: (value: any) => Promise<boolean>, message = 'This value must be unique') =>
    async (value: any) => {
      if (!value) return true
      const isUnique = await checkUnique(value)
      return isUnique ? true : message
    }
}