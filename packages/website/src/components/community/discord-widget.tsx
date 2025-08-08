import { GlassCard } from '@/components/ui'
import { Users, MessageSquare, ArrowRight } from 'lucide-react'

interface DiscordWidgetProps {
  serverId?: string
  inviteLink: string
}

export function DiscordWidget({ serverId = '123456789', inviteLink }: DiscordWidgetProps) {
  return (
    <GlassCard className='p-8 relative overflow-hidden'>
      <div className='absolute inset-0 bg-gradient-to-br from-[#5865F2]/10 to-transparent' />

      <div className='relative z-10'>
        <div className='flex items-center gap-3 mb-6'>
          <div className='w-12 h-12 bg-[#5865F2] rounded-xl flex items-center justify-center'>
            <MessageSquare className='w-6 h-6 text-white' />
          </div>
          <div>
            <h3 className='text-2xl font-bold'>Join our Discord</h3>
            <p className='text-muted-foreground'>Connect with the community</p>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4 mb-6'>
          <div className='bg-background/50 rounded-lg p-4'>
            <div className='flex items-center gap-2 text-muted-foreground mb-1'>
              <Users className='w-4 h-4' />
              <span className='text-sm'>Online Members</span>
            </div>
            <p className='text-2xl font-bold'>1,247</p>
          </div>
          <div className='bg-background/50 rounded-lg p-4'>
            <div className='flex items-center gap-2 text-muted-foreground mb-1'>
              <MessageSquare className='w-4 h-4' />
              <span className='text-sm'>Active Channels</span>
            </div>
            <p className='text-2xl font-bold'>23</p>
          </div>
        </div>

        <div className='space-y-3 mb-6'>
          <div className='flex items-center gap-3'>
            <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
            <p className='text-sm text-muted-foreground'>Live discussions happening now</p>
          </div>
          <div className='flex -space-x-2'>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className='w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 border-2 border-background'
                style={{ zIndex: 8 - i }}
              />
            ))}
            <div className='w-8 h-8 rounded-full bg-background/80 border-2 border-background flex items-center justify-center text-xs font-medium'>
              +89
            </div>
          </div>
        </div>

        <a
          href={inviteLink}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-lg font-medium transition-colors'
        >
          Join Discord Server
          <ArrowRight className='w-4 h-4' />
        </a>
      </div>

      {serverId && (
        <iframe
          src={`https://discord.com/widget?id=${serverId}&theme=dark`}
          width='350'
          height='500'
          allowTransparency={true}
          frameBorder='0'
          sandbox='allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts'
          className='hidden xl:block absolute right-8 top-8 opacity-50'
        />
      )}
    </GlassCard>
  )
}
