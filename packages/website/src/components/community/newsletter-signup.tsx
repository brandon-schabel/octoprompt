import { GlassCard } from '@/components/ui/glass-card'
import { Mail, Send, CheckCircle } from 'lucide-react'
import { useState } from 'react'

export function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setStatus('error')
      setMessage('Please enter a valid email address')
      return
    }

    setStatus('loading')

    // Simulate API call
    setTimeout(() => {
      setStatus('success')
      setMessage('Thanks for subscribing! Check your email to confirm.')
      setEmail('')

      // Reset after 5 seconds
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 5000)
    }, 1000)
  }

  return (
    <GlassCard className='p-8 relative overflow-hidden'>
      <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent' />

      <div className='relative z-10'>
        <div className='flex items-center gap-3 mb-6'>
          <div className='w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center'>
            <Mail className='w-5 h-5 text-primary' />
          </div>
          <div>
            <h3 className='text-2xl font-bold'>Stay Updated</h3>
            <p className='text-muted-foreground'>Get the latest news, features, and community updates</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='relative'>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Enter your email address'
              disabled={status === 'loading' || status === 'success'}
              className='w-full px-4 py-3 bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed'
            />

            <button
              type='submit'
              disabled={status === 'loading' || status === 'success'}
              className='absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {status === 'loading' ? (
                <div className='w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin' />
              ) : status === 'success' ? (
                <CheckCircle className='w-5 h-5' />
              ) : (
                <Send className='w-5 h-5' />
              )}
            </button>
          </div>

          {message && <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}

          <div className='text-xs text-muted-foreground'>
            <p>We respect your privacy. Unsubscribe at any time.</p>
            <p className='mt-1'>
              By subscribing, you agree to our{' '}
              <a href='/privacy' className='underline hover:text-foreground'>
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </form>

        <div className='mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-border/50'>
          <div className='text-center'>
            <p className='text-2xl font-bold'>10K+</p>
            <p className='text-sm text-muted-foreground'>Subscribers</p>
          </div>
          <div className='text-center'>
            <p className='text-2xl font-bold'>Weekly</p>
            <p className='text-sm text-muted-foreground'>Updates</p>
          </div>
          <div className='text-center'>
            <p className='text-2xl font-bold'>100%</p>
            <p className='text-sm text-muted-foreground'>Free</p>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
