import { Link } from '@tanstack/react-router'
import { GlassCard } from '@/components/ui'

export function NotFound() {
  return (
    <div className='flex items-center justify-center min-h-[60vh] px-4'>
      <GlassCard className='p-12 text-center max-w-2xl'>
        <h1 className='text-6xl font-bold mb-4'>404</h1>
        <h2 className='text-2xl font-semibold mb-4'>Page Not Found</h2>
        <p className='text-muted-foreground mb-8'>The page you're looking for doesn't exist or has been moved.</p>
        <div className='flex gap-4 justify-center'>
          <Link to='/' className='btn btn-primary'>
            Go Home
          </Link>
          <Link to='/docs' className='btn btn-outline'>
            View Docs
          </Link>
        </div>
      </GlassCard>
    </div>
  )
}
