import { useEffect } from 'react'

interface UseScrollToSectionOptions {
  /**
   * Search parameters object from TanStack Router
   */
  search?: Record<string, any>
  /**
   * The section parameter from the URL search params to watch for
   * @default 'section'
   */
  paramName?: string
  /**
   * Direct section ID to scroll to (overrides URL param)
   */
  section?: string
  /**
   * Delay in milliseconds before scrolling to ensure component is rendered
   * @default 100
   */
  delay?: number
  /**
   * Scroll behavior
   * @default 'smooth'
   */
  behavior?: ScrollBehavior
  /**
   * Block alignment
   * @default 'start'
   */
  block?: ScrollLogicalPosition
}

/**
 * Hook to automatically scroll to a section based on URL search parameters or direct section ID
 * 
 * @example
 * ```tsx
 * // With TanStack Router search params
 * const search = Route.useSearch()
 * useScrollToSection({ search })
 * 
 * // Direct section ID
 * useScrollToSection({ section: 'my-section' })
 * 
 * // Custom URL param
 * useScrollToSection({
 *   search,
 *   paramName: 'scrollTo',
 *   delay: 200
 * })
 * ```
 */
export function useScrollToSection(options: UseScrollToSectionOptions = {}) {
  const {
    search,
    paramName = 'section',
    section: directSection,
    delay = 100,
    behavior = 'smooth',
    block = 'start'
  } = options
  
  // Get section from search params or use direct section
  const urlSection = search?.[paramName]
  const sectionId = directSection || urlSection

  useEffect(() => {
    if (!sectionId) return
    
    // Small delay to ensure the component is rendered
    setTimeout(() => {
      let element: HTMLElement | null = null
      
      // Map section IDs to their actual element IDs
      if (sectionId === 'mcp-config') {
        element = document.getElementById('mcp-config-section')
      } else if (sectionId === 'project-summarization-settings') {
        element = document.getElementById('project-summarization-settings-section')
      } else {
        // For other sections, use the sectionId directly
        element = document.getElementById(sectionId)
      }
      
      if (element) {
        element.scrollIntoView({ behavior, block })
      }
    }, delay)
  }, [sectionId, delay, behavior, block])

  return sectionId
}