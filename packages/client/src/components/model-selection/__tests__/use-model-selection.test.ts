import { describe, expect, it, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useModelSelection } from '../use-model-selection'
import { useGetModels } from '@/hooks/api/use-gen-ai-api'

// Mock the dependencies
vi.mock('@/hooks/api/use-gen-ai-api')
vi.mock('@/hooks/utility-hooks/use-local-storage', () => ({
  useLocalStorage: vi.fn((key, defaultValue) => {
    const [value, setValue] = vi.requireActual('react').useState(defaultValue)
    return [value, setValue]
  })
}))

describe('useModelSelection', () => {
  const mockModelsData = {
    data: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useGetModels).mockReturnValue({
      data: mockModelsData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useModelSelection())

    expect(result.current.provider).toBe('openrouter')
    expect(result.current.model).toBe('')
    expect(result.current.isLoadingModels).toBe(false)
    expect(result.current.availableModels).toEqual(mockModelsData.data)
  })

  it('should use custom default values', () => {
    const { result } = renderHook(() =>
      useModelSelection({
        defaultProvider: 'openai',
        defaultModel: 'gpt-4'
      })
    )

    expect(result.current.provider).toBe('openai')
    expect(result.current.model).toBe('gpt-4')
  })

  it('should auto-select first model when provider changes', async () => {
    const { result } = renderHook(() => useModelSelection())

    // Wait for effect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.model).toBe('gpt-4')
  })

  it('should call callbacks when provider changes', () => {
    const onProviderChange = vi.fn()
    const onModelChange = vi.fn()

    const { result } = renderHook(() =>
      useModelSelection({
        onProviderChange,
        onModelChange
      })
    )

    act(() => {
      result.current.setProvider('anthropic')
    })

    expect(onProviderChange).toHaveBeenCalledWith('anthropic')
    expect(result.current.provider).toBe('anthropic')
  })

  it('should call callbacks when model changes', () => {
    const onModelChange = vi.fn()

    const { result } = renderHook(() =>
      useModelSelection({
        onModelChange
      })
    )

    act(() => {
      result.current.setModel('gpt-3.5-turbo')
    })

    expect(onModelChange).toHaveBeenCalledWith('gpt-3.5-turbo')
    expect(result.current.model).toBe('gpt-3.5-turbo')
  })

  it('should handle loading state', () => {
    vi.mocked(useGetModels).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    } as any)

    const { result } = renderHook(() => useModelSelection())

    expect(result.current.isLoadingModels).toBe(true)
    expect(result.current.availableModels).toEqual([])
  })

  it('should clear model when provider changes', () => {
    const { result } = renderHook(() =>
      useModelSelection({
        defaultModel: 'gpt-4'
      })
    )

    expect(result.current.model).toBe('gpt-4')

    act(() => {
      result.current.setProvider('anthropic')
    })

    expect(result.current.model).toBe('')
  })
})
