import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { AppNavbar } from '@/components/navigation/app-navbar'
import { useState, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@/components/ui/command'
import { NavigationCommands } from '@/components/command/navigation-commands'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'
import { useGetProjects } from '@/hooks/api/use-projects-api'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { useGetState } from '@/hooks/api/use-state-api'

function LoadingScreen() {
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowError(true)
    }, 5000) // Show error message after 5 seconds

    return () => clearTimeout(timer)
  }, [])



  return (
    <div className='h-screen w-screen flex flex-col items-center justify-center bg-background'>
      <div className='relative'>
        <img src='/android-chrome-512x512.png' alt='Logo' className='w-24 h-24 animate-pulse' />
        <div className='absolute -bottom-8 left-1/2 -translate-x-1/2'>
          <div className='h-2 w-24 bg-muted rounded-full overflow-hidden'>
            <div className='h-full w-1/2 bg-primary animate-[move_1s_ease-in-out_infinite]' />
          </div>
        </div>
        <div className='absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap'>
          <p className='text-muted-foreground text-sm'>
            {!showError ? (
              <span className='animate-pulse'>Establishing websocket connection</span>
            ) : (
              <span className='text-destructive'>
                Having trouble connecting. Please check if the server is running.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const navigate = useNavigate()

  // Get data from various sources
  const { data: projectsData } = useGetProjects()

  useHotkeys('mod+k', (evt) => {
    evt.preventDefault()
    setOpen((o) => !o)
  })


  // Filter projects based on search
  const filteredProjects = (projectsData?.data ?? [])
    .filter((project) => {
      const searchLower = debouncedSearch.toLowerCase()
      return (
        project.name.toLowerCase().includes(searchLower) || project.description?.toLowerCase().includes(searchLower)
      )
    })
    .slice(0, 5) // Limit to 5 results

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation Commands */}
        <CommandGroup heading='Navigation'>
          <NavigationCommands onSelect={() => setOpen(false)} />
        </CommandGroup>
        <CommandSeparator />

        {/* Project Results */}
        {filteredProjects.length > 0 && (
          <>
            <CommandGroup heading='Projects'>
              {filteredProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => {
                    navigate({ to: '/projects', search: { projectId: project.id } })
                    setOpen(false)
                  }}
                >
                  <span>{project.name}</span>
                  {project.description && (
                    <span className='text-muted-foreground text-sm ml-2'>{project.description}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        <CommandGroup heading='Quick Actions'>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/chat', search: { prefill: false } })
              setOpen(false)
            }}
          >
            New Chat
            <CommandShortcut>⌘ N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/projects' })
              setOpen(false)
            }}
          >
            New Project
            <CommandShortcut>⌘ P</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/prompts' })
              setOpen(false)
            }}
          >
            Manage Prompts
          </CommandItem>
        </CommandGroup>

        {/* File Navigation */}
        <CommandGroup heading='File Navigation'>
          <CommandItem>
            Open File
            <CommandShortcut>⌘/Ctrl P</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Global Actions */}
        <CommandGroup heading='Global Actions'>
          <CommandItem>
            Undo <CommandShortcut>⌘/Ctrl Z</CommandShortcut>
          </CommandItem>
          <CommandItem>
            Redo <CommandShortcut>⌘/Ctrl ⇧ Z</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export const Route = createRootRouteWithContext()({
  component: RootComponent
})

function RootComponent() {
  const { data: data, isLoading: isLoadingState, } = useGetState()


  // Show loading screen until both WebSocket is connected AND initial state is received
  if (isLoadingState) {
    return <LoadingScreen />
  }

  return (
    <ErrorBoundary>
      <div className='h-screen w-screen flex flex-col'>
        <header className='flex-none'>
          <ComponentErrorBoundary componentName='Navigation'>
            <AppNavbar />
          </ComponentErrorBoundary>
        </header>

        {/* Main content area with proper overflow handling */}
        <main className='flex-1 min-h-0 overflow-auto'>
          <ComponentErrorBoundary componentName='Main Content'>
            <Outlet />
          </ComponentErrorBoundary>
        </main>

        {/* Global keyboard-driven UI components */}
        <ComponentErrorBoundary componentName='Command Palette'>
          <GlobalCommandPalette />
        </ComponentErrorBoundary>

        <ComponentErrorBoundary componentName='Development Tools'>
          {/* <ReactQueryDevtools /> */}
        </ComponentErrorBoundary>
      </div>
    </ErrorBoundary>
  )
}
