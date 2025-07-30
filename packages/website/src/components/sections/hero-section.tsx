import { HeroGradient } from '@/components/ui'
import { CTAButton, CTAButtonOutline } from '@/components/ui'
import { CodeTerminal } from '@/components/ui'
import { AnimateOnScroll } from '@/components/ui'
import { ScreenshotCarousel } from '@/components/ui'
import { DownloadButtonCompact } from '@/components/ui'
import { Logo } from '@/components/ui'
import type { HeroSection } from '@/schemas'
import { ArrowRight, Github, Download } from 'lucide-react'

const heroScreenshots = [
  {
    src: '/assets/screenshots/project-context-overview.webp',
    alt: 'Promptliano Project Context Overview',
    title: 'Intelligent Context Management',
    description: 'Build context with file selection, prompts, and user input'
  },
  {
    src: '/assets/screenshots/recommended-files-dialog.webp',
    alt: 'AI-Powered File Suggestions',
    title: 'Smart File Recommendations',
    description: 'AI suggests the most relevant files for your task'
  },
  {
    src: '/assets/screenshots/tickets-overview-with-tasks.webp',
    alt: 'Project Management with Tickets',
    title: 'Organized Project Management',
    description: 'Track progress with tickets, tasks, and AI-generated suggestions'
  }
]

export function HeroSection() {
  const heroData: HeroSection = {
    title: 'Supercharge AI Development with Promptliano',
    // subtitle:
    // 'Promptliano is the MCP server that gives AI assistants deep understanding of your codebase, enabling faster and more accurate development.',
    subtitle:
      'Promptliano augments your AI assistant with deep understanding of your codebase using the MCP protocol. It comes with a powerful UI that works as the central command hub for your AI workflow.',
    ctas: [
      {
        id: 'get-started',
        text: 'Get Started',
        href: '/docs/getting-started',
        variant: 'primary',
        size: 'lg',
        icon: 'ArrowRight'
      },
      {
        id: 'view-github',
        text: 'View on GitHub',
        href: 'https://github.com/brandon-schabel/promptliano',
        variant: 'outline',
        size: 'lg',
        icon: 'Github',
        target: '_blank'
      }
    ],
    backgroundGradient: {
      from: 'hsl(var(--primary))',
      to: 'hsl(var(--secondary))',
      direction: 'to-br'
    },
    decorativeElements: [
      { type: 'grid', position: 'center', opacity: 0.1 },
      { type: 'dots', position: 'top-right', opacity: 0.05 }
    ]
  }

  return (
    <div className='relative min-h-screen flex items-center overflow-hidden'>
      {/* Background decorative elements */}
      <div className='absolute inset-0 -z-10 overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5' />
        <div className='absolute inset-0 bg-grid-white/[0.02] bg-[length:50px_50px]' />
        <div className='absolute right-0 top-0 -mt-20 -mr-20 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[128px]' />
        <div className='absolute left-0 bottom-0 -mb-20 -ml-20 h-[500px] w-[500px] rounded-full bg-secondary/10 blur-[128px]' />
      </div>

      <div className='container mx-auto px-4 py-16 lg:py-24'>
        <div className='grid gap-12 lg:grid-cols-2 lg:gap-16 items-center'>
          {/* Left column - Content */}
          <div className='space-y-6 max-w-xl'>
            {/* <AnimateOnScroll> */}
            {/* <div className='flex justify-center md:justify-start mb-6'> */}
            {/* <Logo size='lg' showGlow={true} /> */}
            {/* </div> */}
            {/* </AnimateOnScroll> */}

            <HeroGradient title={heroData.title} subtitle={heroData.subtitle} centered={false} className='text-left'>
              <div className='flex flex-wrap gap-4'>
                <CTAButton href={heroData.ctas[0].href} size='lg'>
                  {heroData.ctas[0].text}
                  <ArrowRight className='ml-2 h-4 w-4' />
                </CTAButton>
                <CTAButton href='/downloads' size='lg' variant='secondary'>
                  <Download className='mr-2 h-4 w-4' />
                  Downloads
                </CTAButton>
                <CTAButtonOutline href={heroData.ctas[1].href} size='lg' target='_blank' className='whitespace-nowrap'>
                  <Github className='mr-2 h-4 w-4' />
                  {heroData.ctas[1].text}
                </CTAButtonOutline>
              </div>
            </HeroGradient>

            {/* Key benefits - moved higher up for better spacing */}
            <AnimateOnScroll>
              <div className='grid gap-3 text-sm mt-6'>
                <div className='flex items-center gap-3'>
                  <div className='h-2 w-2 rounded-full bg-accent flex-shrink-0' />
                  <span className='text-muted-foreground'>Works with VSCode, Cursor, Claude Desktop & Claude Code</span>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='h-2 w-2 rounded-full bg-accent flex-shrink-0' />
                  <span className='text-muted-foreground'>60-70% fewer tokens with intelligent context management</span>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='h-2 w-2 rounded-full bg-accent flex-shrink-0' />
                  <span className='text-muted-foreground'>Human-in-the-loop workflow for better AI collaboration</span>
                </div>
              </div>
            </AnimateOnScroll>
          </div>

          {/* Right column - Screenshot carousel */}
          <div className='space-y-4'>
            <AnimateOnScroll>
              <ScreenshotCarousel
                screenshots={heroScreenshots}
                autoPlay={true}
                interval={4000}
                showIndicators={true}
                showControls={true}
                className='shadow-2xl'
              />
            </AnimateOnScroll>

            {/* Download button */}
            <AnimateOnScroll>
              <div className='flex justify-center'>
                <DownloadButtonCompact />
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </div>
    </div>
  )
}
