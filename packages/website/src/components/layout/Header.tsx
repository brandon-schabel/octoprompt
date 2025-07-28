import { Link, useRouterState } from '@tanstack/react-router'
import { NavigationMenu, NavigationItem } from '@/schemas/navigation.schemas'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui'
import { useState, useEffect } from 'react'

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'local-first', label: 'Local First', href: '/local-first' },
  { id: 'integrations', label: 'Integrations', href: '/integrations' },
  { id: 'docs', label: 'Docs', href: '/docs' },
  { id: 'downloads', label: 'Downloads', href: '/downloads' },
  { id: 'community', label: 'Community', href: '/community' },
  { id: 'about', label: 'About', href: '/about' }
]

export function Header() {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  return (
    <>
      <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='container mx-auto px-4'>
        <div className='flex h-14 items-center justify-between'>
          <Link to='/' className='flex items-center space-x-3 group'>
            <Logo size='sm' showGlow={false} className='transition-transform group-hover:scale-105' />
            <span className='text-xl font-bold'>Promptliano</span>
          </Link>

          <nav className='hidden md:flex items-center space-x-6'>
            {navigationItems.map((item) => {
              const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))

              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className={cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  activeProps={{
                    className: 'text-primary'
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className='flex items-center space-x-4'>
            <a
              href='https://github.com/brandon-schabel/promptliano'
              target='_blank'
              rel='noopener noreferrer'
              className='text-muted-foreground hover:text-primary'
            >
              <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 24 24'>
                <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
              </svg>
            </a>

            <button 
              className='md:hidden'
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label='Toggle mobile menu'
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <svg className='h-6 w-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              ) : (
                <svg className='h-6 w-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>

    {/* Mobile Menu Overlay */}
    {isMobileMenuOpen && (
      <>
        <div 
          className='fixed inset-0 bg-black/50 z-40 md:hidden'
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div className='fixed inset-y-0 right-0 w-full max-w-sm bg-background z-50 md:hidden transform transition-transform duration-300 ease-in-out'>
          <div className='flex flex-col h-full'>
            <div className='flex items-center justify-between p-4 border-b'>
              <span className='text-lg font-semibold'>Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className='p-2 hover:bg-muted rounded-lg transition-colors'
                aria-label='Close menu'
              >
                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
            
            <nav className='flex-1 overflow-y-auto px-4 py-6'>
              <div className='space-y-1'>
                {navigationItems.map((item) => {
                  const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))
                  
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'block px-4 py-3 rounded-lg text-base font-medium transition-colors hover:bg-muted',
                        isActive ? 'bg-muted text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </nav>
            
            <div className='border-t p-4'>
              <a
                href='https://github.com/brandon-schabel/promptliano'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-muted transition-colors'
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  )
}
