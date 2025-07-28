import { useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard, AnimateOnScroll } from '@/components/ui'
import { PlayCircle, Monitor, Zap, Code2, Brain, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoDemo {
  id: string
  title: string
  description: string
  duration: string
  thumbnail: string
  videoUrl: string
  category: 'setup' | 'features' | 'integration' | 'advanced'
  tags: string[]
}

const videoDemos: VideoDemo[] = [
  {
    id: 'quick-start',
    title: 'Quick Start Guide',
    description: 'Get Promptliano up and running in under 5 minutes',
    duration: '4:32',
    thumbnail: '/demos/quick-start-thumb.jpg',
    videoUrl: 'https://youtube.com/embed/demo1',
    category: 'setup',
    tags: ['installation', 'configuration', 'beginner']
  },
  {
    id: 'vscode-integration',
    title: 'VS Code Integration Deep Dive',
    description: 'Complete walkthrough of VS Code setup and features',
    duration: '8:15',
    thumbnail: '/demos/vscode-thumb.jpg',
    videoUrl: 'https://youtube.com/embed/demo2',
    category: 'integration',
    tags: ['vscode', 'mcp', 'setup']
  },
  {
    id: 'cursor-workflow',
    title: 'Cursor AI Workflow',
    description: 'Boost your productivity with Cursor + Promptliano',
    duration: '6:45',
    thumbnail: '/demos/cursor-thumb.jpg',
    videoUrl: 'https://youtube.com/embed/demo3',
    category: 'integration',
    tags: ['cursor', 'ai', 'workflow']
  },
  {
    id: 'file-suggestions',
    title: 'Smart File Suggestions',
    description: 'How AI-powered file search saves 60-70% of tokens',
    duration: '5:20',
    thumbnail: '/demos/file-search-thumb.jpg',
    videoUrl: 'https://youtube.com/embed/demo4',
    category: 'features',
    tags: ['search', 'ai', 'performance']
  },
  {
    id: 'ticket-management',
    title: 'Ticket & Task Management',
    description: 'Organize your development workflow with tickets',
    duration: '7:10',
    thumbnail: '/demos/tickets-thumb.jpg',
    videoUrl: 'https://youtube.com/embed/demo5',
    category: 'features',
    tags: ['tickets', 'tasks', 'workflow']
  },
  {
    id: 'advanced-config',
    title: 'Advanced Configuration',
    description: "Customize Promptliano for your team's needs",
    duration: '9:30',
    thumbnail: '/demos/advanced-thumb.jpg',
    videoUrl: 'https://youtube.com/embed/demo6',
    category: 'advanced',
    tags: ['configuration', 'advanced', 'teams']
  }
]

const categories = [
  { id: 'all', name: 'All Videos', icon: <PlayCircle className='w-4 h-4' /> },
  { id: 'setup', name: 'Setup', icon: <Monitor className='w-4 h-4' /> },
  { id: 'features', name: 'Features', icon: <Zap className='w-4 h-4' /> },
  { id: 'integration', name: 'Integrations', icon: <Code2 className='w-4 h-4' /> },
  { id: 'advanced', name: 'Advanced', icon: <Brain className='w-4 h-4' /> }
]

export function VideoDemos() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedVideo, setSelectedVideo] = useState<VideoDemo | null>(null)

  const filteredVideos =
    selectedCategory === 'all' ? videoDemos : videoDemos.filter((video) => video.category === selectedCategory)

  return (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold mb-4'>Video Tutorials</h2>
        <p className='text-muted-foreground max-w-2xl mx-auto'>
          Learn how to use Promptliano with our comprehensive video guides
        </p>
      </div>

      {/* Category Filter */}
      <div className='flex gap-2 justify-center flex-wrap'>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-lg border transition-all flex items-center gap-2',
              selectedCategory === category.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50'
            )}
          >
            {category.icon}
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* Video Grid */}
      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filteredVideos.map((video) => (
          <AnimateOnScroll key={video.id}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassCard
                className='overflow-hidden cursor-pointer hover:border-primary/50 transition-all'
                onClick={() => setSelectedVideo(video)}
              >
                {/* Thumbnail */}
                <div className='relative aspect-video bg-gradient-to-br from-primary/20 to-primary/10'>
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <div className='w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur'>
                      <PlayCircle className='w-8 h-8 text-primary' />
                    </div>
                  </div>
                  <div className='absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur rounded text-xs'>
                    {video.duration}
                  </div>
                </div>

                {/* Content */}
                <div className='p-4'>
                  <h3 className='font-semibold mb-2'>{video.title}</h3>
                  <p className='text-sm text-muted-foreground mb-3'>{video.description}</p>
                  <div className='flex gap-2 flex-wrap'>
                    {video.tags.map((tag) => (
                      <span key={tag} className='text-xs px-2 py-1 bg-primary/10 text-primary rounded-full'>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </AnimateOnScroll>
        ))}
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div
          className='fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4'
          onClick={() => setSelectedVideo(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className='bg-background rounded-lg max-w-4xl w-full overflow-hidden'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video Player */}
            <div className='aspect-video bg-black'>
              <div className='w-full h-full flex items-center justify-center'>
                <div className='text-center'>
                  <PlayCircle className='w-16 h-16 text-primary mx-auto mb-4' />
                  <p className='text-muted-foreground mb-4'>Video player placeholder</p>
                  <a
                    href={selectedVideo.videoUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-2 text-primary hover:underline'
                  >
                    Watch on YouTube
                    <ExternalLink className='w-4 h-4' />
                  </a>
                </div>
              </div>
            </div>

            {/* Video Info */}
            <div className='p-6'>
              <h3 className='text-xl font-semibold mb-2'>{selectedVideo.title}</h3>
              <p className='text-muted-foreground mb-4'>{selectedVideo.description}</p>
              <div className='flex items-center justify-between'>
                <div className='flex gap-2'>
                  {selectedVideo.tags.map((tag) => (
                    <span key={tag} className='text-xs px-2 py-1 bg-primary/10 text-primary rounded-full'>
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className='px-4 py-2 border border-border rounded-lg hover:bg-primary/10 transition-colors'
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* CTA */}
      <AnimateOnScroll>
        <GlassCard className='p-8 text-center'>
          <h3 className='text-2xl font-bold mb-4'>Want More Tutorials?</h3>
          <p className='text-muted-foreground mb-6'>
            Subscribe to our YouTube channel for the latest Promptliano tips and tricks
          </p>
          <a
            href='https://youtube.com/@promptliano'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
          >
            <PlayCircle className='w-5 h-5' />
            Subscribe on YouTube
          </a>
        </GlassCard>
      </AnimateOnScroll>
    </div>
  )
}
