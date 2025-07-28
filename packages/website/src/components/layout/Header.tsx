import { Link, useRouterState } from '@tanstack/react-router'
import { NavigationMenu, NavigationItem } from '@/schemas/navigation.schemas'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

            <motion.button 
              className='md:hidden p-2 -mr-2 rounded-lg hover:bg-muted transition-colors'
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label='Toggle mobile menu'
              aria-expanded={isMobileMenuOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
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
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>
    </header>

    {/* Mobile Menu Overlay */}
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className='fixed inset-0 bg-black/20 backdrop-blur-md z-40 md:hidden'
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <motion.div 
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ 
              type: 'spring',
              damping: 25,
              stiffness: 300,
              duration: 0.4
            }}
            className='fixed inset-y-0 right-0 w-full max-w-sm bg-background/95 backdrop-blur-xl z-50 md:hidden border-l border-border shadow-2xl'>
          <div className='flex flex-col h-full'>
            <div className='flex items-center justify-between p-4 border-b'>
              <span className='text-lg font-semibold'>Menu</span>
              <motion.button
                onClick={() => setIsMobileMenuOpen(false)}
                className='p-2 hover:bg-muted rounded-lg transition-colors'
                aria-label='Close menu'
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </motion.button>
            </div>
            
            <nav className='flex-1 overflow-y-auto px-4 py-6'>
              <motion.div 
                className='space-y-1'
                initial='hidden'
                animate='visible'
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 0.1
                    }
                  }
                }}
              >
                {navigationItems.map((item, index) => {
                  const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))
                  
                  return (
                    <motion.div
                      key={item.id}
                      variants={{
                        hidden: { opacity: 0, x: 20 },
                        visible: { 
                          opacity: 1, 
                          x: 0,
                          transition: {
                            duration: 0.4,
                            ease: [0.4, 0, 0.2, 1]
                          }
                        }
                      }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Link
                        to={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          'block px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                          isActive 
                            ? 'bg-primary/10 text-primary shadow-sm' 
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  )
                })}
              </motion.div>
            </nav>
            
            <motion.div 
              className='border-t p-4'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.a
                href='https://github.com/brandon-schabel/promptliano'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200'
                onClick={() => setIsMobileMenuOpen(false)}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 24 24'>
                    <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
                  </svg>
                </motion.div>
                <span>GitHub</span>
              </motion.a>
            </motion.div>
          </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  )
}
