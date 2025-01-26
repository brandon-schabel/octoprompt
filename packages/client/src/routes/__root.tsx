import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { APIInterface } from '@/utils/api/api-interface'
import { AppNavbar } from "@/components/navigation/app-navbar"
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { NavigationCommands } from '@/components/command/navigation-commands'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'

type RouterContext = {
  api: APIInterface
}

function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)

  useHotkeys("mod+k", (evt) => {
    evt.preventDefault()
    setOpen((o) => !o)
  })

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <NavigationCommands onSelect={() => setOpen(false)} />
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="File Navigation">
          <CommandItem>
            Open File
            <CommandShortcut>⌘/Ctrl P</CommandShortcut>
          </CommandItem>
          <CommandItem>
            Toggle Voice Input
            <CommandShortcut>V</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Global Actions">
          <CommandItem>Undo <CommandShortcut>⌘/Ctrl Z</CommandShortcut></CommandItem>
          <CommandItem>Redo <CommandShortcut>⌘/Ctrl ⇧ Z</CommandShortcut></CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <ErrorBoundary>
      <div className="h-screen w-screen flex flex-col">
        <header className="flex-none">
          <ComponentErrorBoundary componentName="Navigation">
            <AppNavbar />
          </ComponentErrorBoundary>
        </header>

        {/* Main content area with proper overflow handling */}
        <main className="flex-1 min-h-0 overflow-auto">
          <ComponentErrorBoundary componentName="Main Content">
            <Outlet />
          </ComponentErrorBoundary>
        </main>

        {/* Global keyboard-driven UI components */}
        <ComponentErrorBoundary componentName="Command Palette">
          <GlobalCommandPalette />
        </ComponentErrorBoundary>

        {/* {process.env.NODE_ENV === 'development' && (
            <TanStackRouterDevtools
              position="bottom-left"
              toggleButtonProps={{
                style: {
                  marginLeft: '60px',
                  marginBottom: "15px"
                }
              }}
            />
          )} */}
        <ComponentErrorBoundary componentName="Development Tools">
          <ReactQueryDevtools />
        </ComponentErrorBoundary>
      </div>
    </ErrorBoundary>
  )
}