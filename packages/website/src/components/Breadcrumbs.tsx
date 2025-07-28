import { Link, useMatches } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

export function Breadcrumbs() {
  const matches = useMatches()

  // Filter out root and index routes for cleaner breadcrumbs
  const breadcrumbs = matches
    .filter((match) => match.pathname !== '/' && match.pathname !== '')
    .map((match) => {
      // Extract readable name from pathname
      const segments = match.pathname.split('/').filter(Boolean)
      const name = segments[segments.length - 1]?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())

      return {
        path: match.pathname,
        name: name || 'Home'
      }
    })

  if (breadcrumbs.length === 0) return null

  return (
    <nav aria-label='Breadcrumb' className='mb-6'>
      <ol className='flex items-center space-x-2 text-sm text-muted-foreground'>
        <li>
          <Link to='/' className='hover:text-primary'>
            Home
          </Link>
        </li>
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className='flex items-center'>
            <ChevronRight className='mx-2 h-4 w-4' />
            {index === breadcrumbs.length - 1 ? (
              <span className='text-foreground font-medium'>{crumb.name}</span>
            ) : (
              <Link to={crumb.path} className='hover:text-primary'>
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
