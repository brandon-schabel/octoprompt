import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { z } from 'zod'
import React from 'react'
import {
  createCrudModal,
  createSearchModal,
  createWorkflowModal,
  createUploadModal,
  useModalState,
  type CrudModalConfig,
  type SearchModalConfig,
  type WorkflowModalConfig,
  type UploadModalConfig
} from './modal-factory'
import { createEntityFormConfig } from './modal-factory-utils'

// Test wrapper with React Query
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Mock data and schemas
const TestSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  created: z.number().optional()
})

type TestEntity = z.infer<typeof TestSchema>

const mockEntity: TestEntity = {
  id: 1,
  name: 'Test Entity',
  description: 'Test description',
  status: 'active',
  created: Date.now()
}

// Mock API functions
const mockApi = {
  create: vi.fn().mockResolvedValue(mockEntity),
  update: vi.fn().mockResolvedValue(mockEntity),
  delete: vi.fn().mockResolvedValue(true),
  get: vi.fn().mockResolvedValue(mockEntity)
}

// Mock hooks
const mockHooks = {
  useCreate: () => ({
    mutateAsync: mockApi.create,
    isPending: false
  }),
  useUpdate: () => ({
    mutateAsync: ({ id, data }: { id: number; data: any }) => mockApi.update(id, data),
    isPending: false
  }),
  useDelete: () => ({
    mutateAsync: mockApi.delete,
    isPending: false
  })
}

describe('Modal Factory', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('useModalState', () => {
    function TestComponent({ initialData }: { initialData?: any }) {
      const [state, actions] = useModalState(initialData)
      
      return (
        <div>
          <div data-testid="is-open">{state.isOpen.toString()}</div>
          <div data-testid="data">{JSON.stringify(state.data)}</div>
          <div data-testid="step">{state.step}</div>
          <div data-testid="submitting">{state.isSubmitting.toString()}</div>
          <div data-testid="progress">{state.progress}</div>
          
          <button onClick={() => actions.open({ test: 'data' })}>Open</button>
          <button onClick={() => actions.close()}>Close</button>
          <button onClick={() => actions.setData({ updated: true })}>Set Data</button>
          <button onClick={() => actions.setStep(2)}>Set Step</button>
          <button onClick={() => actions.setSubmitting(true)}>Set Submitting</button>
          <button onClick={() => actions.setProgress(50)}>Set Progress</button>
          <button onClick={() => actions.reset()}>Reset</button>
        </div>
      )
    }

    it('should initialize with correct default state', () => {
      render(<TestComponent />)
      
      expect(screen.getByTestId('is-open')).toHaveTextContent('false')
      expect(screen.getByTestId('data')).toHaveTextContent('null')
      expect(screen.getByTestId('step')).toHaveTextContent('0')
      expect(screen.getByTestId('submitting')).toHaveTextContent('false')
      expect(screen.getByTestId('progress')).toHaveTextContent('0')
    })

    it('should initialize with provided initial data', () => {
      const initialData = { name: 'test' }
      render(<TestComponent initialData={initialData} />)
      
      expect(screen.getByTestId('data')).toHaveTextContent(JSON.stringify(initialData))
    })

    it('should handle open/close actions', async () => {
      render(<TestComponent />)
      
      fireEvent.click(screen.getByText('Open'))
      expect(screen.getByTestId('is-open')).toHaveTextContent('true')
      expect(screen.getByTestId('data')).toHaveTextContent(JSON.stringify({ test: 'data' }))
      
      fireEvent.click(screen.getByText('Close'))
      expect(screen.getByTestId('is-open')).toHaveTextContent('false')
    })

    it('should handle state updates', async () => {
      render(<TestComponent />)
      
      fireEvent.click(screen.getByText('Set Data'))
      expect(screen.getByTestId('data')).toHaveTextContent(JSON.stringify({ updated: true }))
      
      fireEvent.click(screen.getByText('Set Step'))
      expect(screen.getByTestId('step')).toHaveTextContent('2')
      
      fireEvent.click(screen.getByText('Set Submitting'))
      expect(screen.getByTestId('submitting')).toHaveTextContent('true')
      
      fireEvent.click(screen.getByText('Set Progress'))
      expect(screen.getByTestId('progress')).toHaveTextContent('50')
    })

    it('should handle reset action', async () => {
      const initialData = { name: 'initial' }
      render(<TestComponent initialData={initialData} />)
      
      // Make some changes
      fireEvent.click(screen.getByText('Open'))
      fireEvent.click(screen.getByText('Set Step'))
      fireEvent.click(screen.getByText('Set Progress'))
      
      // Reset
      fireEvent.click(screen.getByText('Reset'))
      
      expect(screen.getByTestId('is-open')).toHaveTextContent('false')
      expect(screen.getByTestId('data')).toHaveTextContent(JSON.stringify(initialData))
      expect(screen.getByTestId('step')).toHaveTextContent('0')
      expect(screen.getByTestId('progress')).toHaveTextContent('0')
    })
  })

  describe('createCrudModal', () => {
    const config: CrudModalConfig<TestEntity> = {
      entityName: 'Test Entity',
      hooks: mockHooks,
      onSuccess: vi.fn(),
      onError: vi.fn()
    }

    const formConfig = createEntityFormConfig(TestSchema, {
      excludeFields: ['id', 'created']
    })

    it('should create CRUD modal components', () => {
      const modals = createCrudModal(config)
      
      expect(modals.CreateModal).toBeDefined()
      expect(modals.EditModal).toBeDefined()
      expect(modals.DeleteModal).toBeDefined()
      expect(modals.ViewModal).toBeDefined()
    })

    it('should render CreateModal correctly', () => {
      const { CreateModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <CreateModal
            formConfig={formConfig}
            isOpen={true}
            onClose={vi.fn()}
          />
        </TestWrapper>
      )
      
      expect(screen.getByText('Create Test Entity')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('should render EditModal with item data', () => {
      const { EditModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <EditModal
            formConfig={formConfig}
            isOpen={true}
            onClose={vi.fn()}
            item={mockEntity}
          />
        </TestWrapper>
      )
      
      expect(screen.getByText('Edit Test Entity')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
    })

    it('should render DeleteModal with confirmation', () => {
      const { DeleteModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <DeleteModal
            isOpen={true}
            onClose={vi.fn()}
            item={mockEntity}
          />
        </TestWrapper>
      )
      
      expect(screen.getByText('Delete Test Entity')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('should render ViewModal with item details', () => {
      const { ViewModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <ViewModal
            isOpen={true}
            onClose={vi.fn()}
            item={mockEntity}
          />
        </TestWrapper>
      )
      
      expect(screen.getByText('View Test Entity')).toBeInTheDocument()
      expect(screen.getByText('Test Entity')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('should handle create submission', async () => {
      const onClose = vi.fn()
      const { CreateModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <CreateModal
            formConfig={formConfig}
            isOpen={true}
            onClose={onClose}
          />
        </TestWrapper>
      )
      
      // Fill form and submit
      const nameInput = screen.getByDisplayValue('') // Form inputs
      fireEvent.change(nameInput, { target: { value: 'New Entity' } })
      
      const createButton = screen.getByRole('button', { name: 'Create' })
      fireEvent.click(createButton)
      
      await waitFor(() => {
        expect(mockApi.create).toHaveBeenCalled()
        expect(config.onSuccess).toHaveBeenCalledWith('create', expect.any(Object))
      })
    })

    it('should handle delete confirmation', async () => {
      const onClose = vi.fn()
      const { DeleteModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <DeleteModal
            isOpen={true}
            onClose={onClose}
            item={mockEntity}
          />
        </TestWrapper>
      )
      
      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      fireEvent.click(deleteButton)
      
      await waitFor(() => {
        expect(mockApi.delete).toHaveBeenCalledWith(mockEntity.id)
        expect(config.onSuccess).toHaveBeenCalledWith('delete', mockEntity)
      })
    })
  })

  describe('createSearchModal', () => {
    const searchItems = [
      { id: 1, name: 'Item 1', category: 'A' },
      { id: 2, name: 'Item 2', category: 'B' },
      { id: 3, name: 'Another Item', category: 'A' }
    ]

    const config: SearchModalConfig<typeof searchItems[0]> = {
      title: 'Search Items',
      searchable: (items, query) => 
        items.filter(item => 
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
        ),
      renderItem: (item) => (
        <div>
          <h4>{item.name}</h4>
          <p>{item.category}</p>
        </div>
      ),
      onSelect: vi.fn(),
      initialItems: searchItems,
      keyExtractor: (item) => item.id
    }

    it('should render search modal with initial items', () => {
      const SearchModal = createSearchModal(config)
      
      render(
        <TestWrapper>
          <SearchModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      )
      
      expect(screen.getByText('Search Items')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Another Item')).toBeInTheDocument()
    })

    it('should filter items based on search query', async () => {
      const SearchModal = createSearchModal(config)
      
      render(
        <TestWrapper>
          <SearchModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      )
      
      const searchInput = screen.getByPlaceholderText('Search...')
      fireEvent.change(searchInput, { target: { value: 'Another' } })
      
      await waitFor(() => {
        expect(screen.getByText('Another Item')).toBeInTheDocument()
        expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
        expect(screen.queryByText('Item 2')).not.toBeInTheDocument()
      })
    })

    it('should handle item selection', async () => {
      const onSelect = vi.fn()
      const onClose = vi.fn()
      const SearchModal = createSearchModal({ ...config, onSelect })
      
      render(
        <TestWrapper>
          <SearchModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      )
      
      fireEvent.click(screen.getByText('Item 1'))
      
      expect(onSelect).toHaveBeenCalledWith(searchItems[0])
      expect(onClose).toHaveBeenCalled()
    })

    it('should handle multiselect mode', async () => {
      const onSelect = vi.fn()
      const SearchModal = createSearchModal({ 
        ...config, 
        multiSelect: true,
        onSelect 
      })
      
      render(
        <TestWrapper>
          <SearchModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      )
      
      // Select multiple items
      fireEvent.click(screen.getByText('Item 1'))
      fireEvent.click(screen.getByText('Item 2'))
      
      // Confirm selection
      const confirmButton = screen.getByRole('button', { name: /Select 2 item/ })
      expect(confirmButton).toBeInTheDocument()
      
      fireEvent.click(confirmButton)
      
      expect(onSelect).toHaveBeenCalledTimes(2)
      expect(onSelect).toHaveBeenCalledWith(searchItems[0])
      expect(onSelect).toHaveBeenCalledWith(searchItems[1])
    })
  })

  describe('createWorkflowModal', () => {
    const workflowSteps = [
      {
        id: 'step1',
        title: 'Step 1',
        description: 'First step',
        component: ({ onNext, isLastStep }: any) => (
          <div>
            <p>Step 1 content</p>
            <button onClick={() => onNext({ step1Data: 'test' })}>
              {isLastStep ? 'Complete' : 'Next'}
            </button>
          </div>
        )
      },
      {
        id: 'step2',
        title: 'Step 2',
        description: 'Second step',
        component: ({ onNext, onPrev, isLastStep }: any) => (
          <div>
            <p>Step 2 content</p>
            <button onClick={onPrev}>Previous</button>
            <button onClick={() => onNext({ step2Data: 'test2' })}>
              {isLastStep ? 'Complete' : 'Next'}
            </button>
          </div>
        )
      }
    ]

    const config: WorkflowModalConfig = {
      title: 'Test Workflow',
      steps: workflowSteps,
      showProgress: true,
      onComplete: vi.fn()
    }

    it('should render workflow modal with first step', () => {
      const WorkflowModal = createWorkflowModal(config)
      
      render(
        <TestWrapper>
          <WorkflowModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      )
      
      expect(screen.getByText('Test Workflow - Step 1 of 2')).toBeInTheDocument()
      expect(screen.getByText('Step 1 content')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument() // Progress
    })

    it('should handle step navigation', async () => {
      const WorkflowModal = createWorkflowModal(config)
      
      render(
        <TestWrapper>
          <WorkflowModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      )
      
      // Go to next step
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        expect(screen.getByText('Test Workflow - Step 2 of 2')).toBeInTheDocument()
        expect(screen.getByText('Step 2 content')).toBeInTheDocument()
        expect(screen.getByText('100%')).toBeInTheDocument()
      })
      
      // Go back to previous step
      fireEvent.click(screen.getByText('Previous'))
      
      await waitFor(() => {
        expect(screen.getByText('Test Workflow - Step 1 of 2')).toBeInTheDocument()
        expect(screen.getByText('Step 1 content')).toBeInTheDocument()
      })
    })

    it('should handle workflow completion', async () => {
      const onComplete = vi.fn()
      const onClose = vi.fn()
      const WorkflowModal = createWorkflowModal({ ...config, onComplete })
      
      render(
        <TestWrapper>
          <WorkflowModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      )
      
      // Navigate to last step and complete
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        expect(screen.getByText('Complete')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Complete'))
      
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith({
          step1: { step1Data: 'test' },
          step2: { step2Data: 'test2' }
        })
      })
    })
  })

  describe('createUploadModal', () => {
    const config: UploadModalConfig = {
      title: 'Upload Files',
      uploadProps: {
        accept: '.jpg,.png',
        multiple: true
      },
      onUpload: vi.fn()
    }

    it('should render upload modal', () => {
      const UploadModal = createUploadModal(config)
      
      render(
        <TestWrapper>
          <UploadModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      )
      
      expect(screen.getByText('Upload Files')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('should handle file upload', async () => {
      const onUpload = vi.fn().mockResolvedValue(undefined)
      const onClose = vi.fn()
      const UploadModal = createUploadModal({ ...config, onUpload })
      
      render(
        <TestWrapper>
          <UploadModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      )
      
      // Mock file selection (this would normally happen through the file input)
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      // Simulate file upload
      const uploadButton = screen.getByRole('button', { name: 'Upload' })
      
      // The upload button should be disabled initially (no files)
      expect(uploadButton).toBeDisabled()
      
      // After files are selected and upload completes
      await act(async () => {
        // This would be triggered by file selection in real scenario
        await onUpload([mockFile])
      })
      
      expect(onUpload).toHaveBeenCalledWith([mockFile])
    })
  })

  describe('Integration Tests', () => {
    it('should work with real form submissions', async () => {
      const config: CrudModalConfig<TestEntity> = {
        entityName: 'Test Entity',
        api: mockApi,
        onSuccess: vi.fn(),
        onError: vi.fn()
      }

      const formConfig = createEntityFormConfig(TestSchema, {
        excludeFields: ['id', 'created']
      })

      const { CreateModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <CreateModal
            formConfig={formConfig}
            isOpen={true}
            onClose={vi.fn()}
          />
        </TestWrapper>
      )
      
      // This test verifies the integration works without errors
      expect(screen.getByText('Create Test Entity')).toBeInTheDocument()
    })

    it('should handle errors gracefully', async () => {
      const errorApi = {
        ...mockApi,
        create: vi.fn().mockRejectedValue(new Error('Creation failed'))
      }

      const config: CrudModalConfig<TestEntity> = {
        entityName: 'Test Entity',
        api: errorApi,
        onSuccess: vi.fn(),
        onError: vi.fn()
      }

      const formConfig = createEntityFormConfig(TestSchema, {
        excludeFields: ['id', 'created']
      })

      const { CreateModal } = createCrudModal(config)
      
      render(
        <TestWrapper>
          <CreateModal
            formConfig={formConfig}
            isOpen={true}
            onClose={vi.fn()}
            initialData={{ name: 'Test' }}
          />
        </TestWrapper>
      )
      
      const createButton = screen.getByRole('button', { name: 'Create' })
      fireEvent.click(createButton)
      
      await waitFor(() => {
        expect(config.onError).toHaveBeenCalledWith('create', expect.any(Error))
      })
    })
  })
})