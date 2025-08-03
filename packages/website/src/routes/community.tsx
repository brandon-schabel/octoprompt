import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { DiscordWidget, Contributors, Roadmap, Resources, NewsletterSignup } from '@/components/community'
import { Calendar, Users, BookOpen, Github, Twitter, Youtube, MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/community')({
  loader: () => {
    return {
      meta: {
        title: 'Community - Promptliano',
        description:
          'Join the Promptliano community. Connect with developers, share experiences, and shape the future of AI-powered development.',
        keywords: ['community', 'discord', 'github', 'open source', 'developer community']
      } as SeoMetadata
    }
  },
  component: CommunityPage
})

interface SocialLink {
  platform: string
  title: string
  url: string
  icon: React.ReactNode
}

const socialLinks: SocialLink[] = [
  {
    platform: 'Discord',
    title: 'Join our Discord',
    url: 'https://discord.gg/Z2nDnVQKKm',
    icon: <MessageSquare className='w-5 h-5' />
  },
  {
    platform: 'X',
    title: 'Follow on X',
    url: 'https://twitter.com/promptliano',
    icon: <Twitter className='w-5 h-5' />
  }
]

function CommunityPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        {/* Hero Section */}
        <div className='text-center mb-16'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>Join the Community</h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto mb-8'>
            Connect with thousands of developers who are building the future of AI-powered development
          </p>

          {/* Social Links */}
          <div className='flex items-center justify-center gap-4'>
            {socialLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-2 px-4 py-2 bg-background/50 hover:bg-background/80 rounded-lg transition-colors'
                title={link.title}
              >
                {link.icon}
                <span className='text-sm font-medium'>{link.platform}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Discord Widget */}
        {/* <section className='mb-16'>
          <DiscordWidget inviteLink='https://discord.gg/Z2nDnVQKKm' />
        </section> */}

        {/* Contributors Section */}
        {/* <section className='mb-16'>
          <Contributors />
        </section> */}

        {/* Two Column Layout: Roadmap & Newsletter */}
        {/* <div className='grid lg:grid-cols-3 gap-8 mb-16'>
          <div className='lg:col-span-2'>
            <Roadmap />
          </div>
          <div>
            <NewsletterSignup />

            <GlassCard className='p-6 mt-8'>
              <div className='flex items-center gap-2 mb-4'>
                <Calendar className='w-5 h-5 text-primary' />
                <h3 className='text-lg font-semibold'>Upcoming Events</h3>
              </div>
              <div className='space-y-3'>
                <div className='p-3 bg-background/50 rounded-lg'>
                  <h4 className='font-medium text-sm'>Community Call</h4>
                  <p className='text-xs text-muted-foreground'>Every Thursday at 3 PM UTC</p>
                </div>
                <div className='p-3 bg-background/50 rounded-lg'>
                  <h4 className='font-medium text-sm'>AI Development Workshop</h4>
                  <p className='text-xs text-muted-foreground'>Feb 15, 2025 - 2 PM UTC</p>
                </div>
                <div className='p-3 bg-background/50 rounded-lg'>
                  <h4 className='font-medium text-sm'>Promptliano Hackathon</h4>
                  <p className='text-xs text-muted-foreground'>March 1-3, 2025</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div> */}

        {/* Resources Section */}
        {/* <section className='mb-16'>
          <Resources />
        </section> */}

        {/* Community Guidelines */}
        {/* <GlassCard className='p-8 text-center'>
          <Users className='w-12 h-12 text-primary mx-auto mb-4' />
          <h2 className='text-2xl font-bold mb-4'>Community Guidelines</h2>
          <p className='text-muted-foreground mb-6 max-w-2xl mx-auto'>
            Our community thrives on respect, collaboration, and innovation. We welcome developers of all skill levels
            and backgrounds to contribute, learn, and grow together.
          </p>
          <div className='grid md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto'>
            <div>
              <h3 className='font-semibold mb-2'>Be Respectful</h3>
              <p className='text-sm text-muted-foreground'>
                Treat everyone with kindness and respect. We have zero tolerance for harassment or discrimination.
              </p>
            </div>
            <div>
              <h3 className='font-semibold mb-2'>Be Helpful</h3>
              <p className='text-sm text-muted-foreground'>
                Share your knowledge, help others learn, and ask questions when you need help.
              </p>
            </div>
            <div>
              <h3 className='font-semibold mb-2'>Be Constructive</h3>
              <p className='text-sm text-muted-foreground'>
                Provide thoughtful feedback, suggest improvements, and work together to build amazing things.
              </p>
            </div>
          </div>
          <div className='mt-8'>
            <a
              href='https://github.com/brandon-schabel/promptliano/blob/main/CODE_OF_CONDUCT.md'
              className='text-primary hover:underline font-medium'
              target='_blank'
              rel='noopener noreferrer'
            >
              Read our full Code of Conduct →
            </a>
          </div>
        </GlassCard> */}
      </div>
    </div>
  )
}
