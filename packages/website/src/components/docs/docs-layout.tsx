import { useState, useEffect } from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { DocsSidebar } from './docs-sidebar'
import { DocsSearch } from './docs-search'
import { Menu, X } from 'lucide-react'

export function DocsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Close sidebar on route change for mobile
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className='min-h-screen flex'>
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className='lg:hidden fixed top-20 left-4 z-50 p-2 rounded-md bg-background/80 backdrop-blur-sm border'
      >
        {sidebarOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 bg-background border-r transition-transform lg:translate-x-0 lg:static lg:inset-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className='h-full flex flex-col pt-20 lg:pt-6'>
          <div className='px-4 pb-4'>
            <DocsSearch />
          </div>
          <DocsSidebar />
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className='fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className='flex-1 min-w-0'>
        <div className='container mx-auto px-4 py-8 max-w-4xl'>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
