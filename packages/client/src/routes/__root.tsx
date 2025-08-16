// File: packages/client/src/routes/__root.tsx
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { RouterContext } from '../main'
// Removed: import { AppNavbar } from '@/components/navigation/app-navbar';
import { AppSidebar } from '@/components/navigation/app-sidebar' // Added
import { SidebarProvider, SidebarTrigger } from '@promptliano/ui' // Added
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
} from '@promptliano/ui' // Assuming @ui maps to @/components/ui
import { NavigationCommands } from '@/components/navigation/navigation-commands'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'
import { useGetProjects } from '@/hooks/api/use-projects-api'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { useNavigate } from '@tanstack/react-router'
import {
  useGetActiveProjectTabId,
  useGetAppSettings,
  useGetProjectTab,
  useGetProjectTabs
} from '@/hooks/use-kv-local-storage'
import { MenuIcon } from 'lucide-react' // For a custom trigger example
import { Button } from '@promptliano/ui'
import { useMigrateDefaultTab } from '@/hooks/use-migrate-default-tab'
import { useMigrateTabViews } from '@/hooks/use-migrate-tab-views'
import { useSyncProviderSettings } from '@/hooks/use-sync-provider-settings'

function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const navigate = useNavigate()
  const { data: projectsData } = useGetProjects()

  useHotkeys('mod+k', (evt) => {
    evt.preventDefault()
    setOpen((o) => !o)
  })

  // Add hotkey for asset generator
  useHotkeys('mod+g', (evt) => {
    evt.preventDefault()
    navigate({ to: '/assets' })
  })

  const filteredProjects = (projectsData ?? [])
    .filter((project) => {
      const searchLower = debouncedSearch.toLowerCase()
      return (
        project.name.toLowerCase().includes(searchLower) || project.description?.toLowerCase().includes(searchLower)
      )
    })
    .slice(0, 5)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading='Navigation'>
          <NavigationCommands onSelect={() => setOpen(false)} />
        </CommandGroup>
        <CommandSeparator />
        {filteredProjects.length > 0 && (
          <>
            <CommandGroup heading='Projects'>
              {filteredProjects.map((project: any) => (
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
          <CommandItem // This might now be redundant if "Add Project" is in sidebar's "Open Projects" flow
            onSelect={() => {
              // Potentially trigger the new project dialog from AppSidebar context if needed,
              // or navigate and let AppSidebar handle it.
              // For now, navigating to /projects which should show the project management UI.
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
          <CommandItem
            onSelect={() => {
              navigate({ to: '/providers' })
              setOpen(false)
            }}
          >
            Manage Providers
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/assets' })
              setOpen(false)
            }}
          >
            Generate Assets
            <CommandShortcut>⌘ G</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading='File Navigation'>
          <CommandItem>
            Open File
            <CommandShortcut>⌘/Ctrl P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
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

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent
})

function RootComponent() {
  const [activeProjectTabId] = useGetActiveProjectTabId()
  const navigate = useNavigate()

  // Migrate legacy defaultTab to numeric ID system
  useMigrateDefaultTab()

  // Migrate old tab views to new Manage sub-view structure
  useMigrateTabViews()

  // Sync provider settings (custom URLs) with server
  useSyncProviderSettings()

  // Redirect from old /keys route to new /providers route
  useEffect(() => {
    if (window.location.pathname === '/keys') {
      navigate({ to: '/providers', replace: true })
    }
  }, [])

  return (
    <ErrorBoundary>
      <SidebarProvider>
        {/* defaultOpen={initialSidebarOpen} can be used here */}
        <div className='flex h-screen w-screen bg-background text-foreground'>
          {/* Ensure background and text colors are set */}
          <ComponentErrorBoundary componentName='Sidebar'>
            <AppSidebar />
          </ComponentErrorBoundary>
          <main className='flex-1 min-h-0 overflow-auto relative'>
            {/* pt-[env(safe-area-inset-top)] can be added if needed */}
            {/* Example of a manual SidebarTrigger fixed in the content area */}
            {/* You might not need this if SidebarRail is sufficient */}
            <div className='absolute top-4 left-4 z-20 md:hidden'>
              {/* Show only on mobile, or remove if rail is enough */}
              <SidebarTrigger asChild>
                <Button variant='ghost' size='icon'>
                  <MenuIcon />
                </Button>
              </SidebarTrigger>
            </div>
            <ComponentErrorBoundary componentName='Main Content'>
              <Outlet />
            </ComponentErrorBoundary>
          </main>
          <ComponentErrorBoundary componentName='Command Palette'>
            <GlobalCommandPalette />
          </ComponentErrorBoundary>
          <ComponentErrorBoundary componentName='Development Tools'>
            {/* <ReactQueryDevtools /> */}
          </ComponentErrorBoundary>
        </div>
      </SidebarProvider>
    </ErrorBoundary>
  )
}
