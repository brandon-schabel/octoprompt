import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'

export const Route = createFileRoute('/about')({
  loader: () => {
    return {
      meta: {
        title: 'About Promptliano - Our Mission',
        description:
          'Learn about Promptliano, our mission to revolutionize AI-powered development, and the team behind the innovation.',
        keywords: ['about promptliano', 'AI development tools', 'company mission', 'developer productivity'],
        openGraph: {
          title: 'About Promptliano - Our Mission',
          description: 'Learn about Promptliano and our mission to revolutionize AI-powered development.',
          type: 'website'
        }
      } as SeoMetadata
    }
  },
  component: AboutPage
})

function AboutPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-4xl'>
        <h1 className='text-4xl md:text-5xl font-bold mb-8 text-center'>About Promptliano</h1>

        <GlassCard className='p-8 mb-12'>
          <h2 className='text-2xl font-semibold mb-4'>Our Mission</h2>
          <p className='text-lg leading-relaxed text-muted-foreground mb-4'>
            Promptliano was born from a simple observation: AI has incredible potential to transform software
            development, but the tools to harness this power effectively were fragmented and complex.
          </p>
          <p className='text-lg leading-relaxed text-muted-foreground'>
            We set out to create a unified platform that seamlessly integrates AI assistance into every aspect of the
            development workflow, from project management to code generation, making AI a natural extension of the
            developer's thought process.
          </p>
        </GlassCard>

        <div className='grid md:grid-cols-2 gap-8 mb-12'>
          <GlassCard className='p-6'>
            <h3 className='text-xl font-semibold mb-3'>Built for Developers</h3>
            <p className='text-muted-foreground'>
              Every feature in Promptliano is designed with developers in mind. We understand the complexity of modern
              software development and have crafted tools that adapt to your workflow, not the other way around.
            </p>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-xl font-semibold mb-3'>Open Integration</h3>
            <p className='text-muted-foreground'>
              Through the Model Context Protocol (MCP), Promptliano works seamlessly with your favorite tools - VS Code,
              Cursor, Claude Desktop, and more. No vendor lock-in, just enhanced productivity.
            </p>
          </GlassCard>
        </div>

        <GlassCard className='p-8 mb-12'>
          <h2 className='text-2xl font-semibold mb-4'>Key Principles</h2>
          <ul className='space-y-4'>
            <li className='flex items-start'>
              <span className='text-2xl mr-3'>🎯</span>
              <div>
                <h4 className='font-semibold mb-1'>Context is King</h4>
                <p className='text-muted-foreground'>
                  AI is only as good as the context it has. Promptliano excels at building and maintaining rich context
                  about your projects.
                </p>
              </div>
            </li>
            <li className='flex items-start'>
              <span className='text-2xl mr-3'>⚡</span>
              <div>
                <h4 className='font-semibold mb-1'>Speed & Efficiency</h4>
                <p className='text-muted-foreground'>
                  Every feature is optimized for speed, from instant file search to efficient token usage in AI
                  interactions.
                </p>
              </div>
            </li>
            <li className='flex items-start'>
              <span className='text-2xl mr-3'>🔓</span>
              <div>
                <h4 className='font-semibold mb-1'>Open & Extensible</h4>
                <p className='text-muted-foreground'>
                  Built on open standards and protocols, Promptliano grows with your needs and integrates with your
                  existing tools.
                </p>
              </div>
            </li>
          </ul>
        </GlassCard>

        <div className='text-center'>
          <h2 className='text-2xl font-semibold mb-4'>Join the Revolution</h2>
          <p className='text-lg text-muted-foreground mb-8'>
            Be part of the community that's shaping the future of AI-powered development.
          </p>
          <div className='flex gap-4 justify-center'>
            <a href='/community' className='btn btn-primary'>
              Join Community
            </a>
            <a href='/docs/getting-started' className='btn btn-outline'>
              Get Started
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
