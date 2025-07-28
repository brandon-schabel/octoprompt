import { AnimateOnScroll, GlassCard } from '@/components/ui'
import { TestimonialSection, Testimonial } from '@/schemas'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react'

const testimonials: Testimonial[] = [
  {
    id: 'testimonial-1',
    quote:
      "Promptliano has completely transformed how I work with AI assistants. The context management is incredible - it's like having a senior developer who knows my entire codebase.",
    author: {
      name: 'Sarah Chen',
      role: 'Senior Full Stack Developer',
      company: 'TechCorp',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'
    },
    rating: 5,
    featured: true,
    createdAt: '2024-01-15T10:00:00Z',
    tags: ['productivity', 'ai', 'developer-experience']
  },
  {
    id: 'testimonial-2',
    quote:
      "The token reduction is real! We're saving thousands of dollars monthly on API costs while getting better, more accurate AI suggestions. Promptliano paid for itself in the first week.",
    author: {
      name: 'Michael Rodriguez',
      role: 'Engineering Manager',
      company: 'StartupXYZ',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael'
    },
    rating: 5,
    featured: true,
    createdAt: '2024-01-20T14:00:00Z',
    tags: ['productivity', 'mcp']
  },
  {
    id: 'testimonial-3',
    quote:
      'As someone who switches between VSCode and Cursor frequently, having consistent context across both editors is a game-changer. The MCP integration just works!',
    author: {
      name: 'Emily Watson',
      role: 'Frontend Engineer',
      company: 'DesignLabs',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily'
    },
    rating: 5,
    featured: false,
    createdAt: '2024-02-01T09:00:00Z',
    tags: ['mcp', 'developer-experience']
  },
  {
    id: 'testimonial-4',
    quote:
      "The human-in-the-loop workflow gives me confidence. I stay in control while the AI handles the heavy lifting. It's collaborative programming at its best.",
    author: {
      name: 'David Kim',
      role: 'Backend Developer',
      company: 'CloudScale',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David'
    },
    rating: 5,
    featured: true,
    createdAt: '2024-02-10T16:00:00Z',
    tags: ['collaboration', 'ai']
  },
  {
    id: 'testimonial-5',
    quote:
      "Git integration is phenomenal. My AI assistant understands branch context, commit history, and can even help with complex rebases. It's like pair programming with someone who never forgets.",
    author: {
      name: 'Lisa Thompson',
      role: 'DevOps Engineer',
      company: 'InfraCo',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa'
    },
    rating: 5,
    featured: false,
    createdAt: '2024-02-15T11:00:00Z',
    tags: ['developer-experience', 'productivity']
  }
]

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const testimonialData: TestimonialSection = {
    title: 'Loved by Developers Worldwide',
    subtitle: 'See what developers are saying about their experience with Promptliano',
    testimonials,
    layout: 'carousel',
    autoplay: true,
    autoplayInterval: 5000
  }

  // Auto-advance carousel
  useEffect(() => {
    if (!testimonialData.autoplay || isPaused) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, testimonialData.autoplayInterval)

    return () => clearInterval(interval)
  }, [isPaused, testimonialData.autoplay, testimonialData.autoplayInterval])

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  return (
    <section className='relative py-24 overflow-hidden'>
      {/* Background decoration */}
      <div className='absolute inset-0 -z-10'>
        <div className='absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-primary/5' />
      </div>

      <div className='container mx-auto px-4'>
        <AnimateOnScroll>
          <div className='text-center max-w-3xl mx-auto mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>{testimonialData.title}</h2>
            <p className='text-lg text-muted-foreground'>{testimonialData.subtitle}</p>
          </div>
        </AnimateOnScroll>

        {/* Carousel */}
        <div
          className='max-w-4xl mx-auto'
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className='relative'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                <GlassCard className='p-8 md:p-12'>
                  {/* Quote icon */}
                  <Quote className='h-12 w-12 text-primary/20 mb-6' />

                  {/* Rating */}
                  {testimonials[currentIndex].rating && (
                    <div className='flex gap-1 mb-4'>
                      {Array.from({ length: testimonials[currentIndex].rating || 0 }).map((_, i) => (
                        <Star key={i} className='h-5 w-5 fill-yellow-500 text-yellow-500' />
                      ))}
                    </div>
                  )}

                  {/* Quote */}
                  <blockquote className='text-lg md:text-xl mb-8 leading-relaxed'>
                    "{testimonials[currentIndex].quote}"
                  </blockquote>

                  {/* Author */}
                  <div className='flex items-center gap-4'>
                    <img
                      src={testimonials[currentIndex].author.avatar}
                      alt={testimonials[currentIndex].author.name}
                      className='w-14 h-14 rounded-full bg-muted'
                    />
                    <div>
                      <p className='font-semibold'>{testimonials[currentIndex].author.name}</p>
                      <p className='text-sm text-muted-foreground'>
                        {testimonials[currentIndex].author.role}
                        {testimonials[currentIndex].author.company &&
                          ` at ${testimonials[currentIndex].author.company}`}
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className='mt-6 flex flex-wrap gap-2'>
                    {testimonials[currentIndex].tags.map((tag) => (
                      <span key={tag} className='text-xs px-3 py-1 rounded-full bg-primary/10 text-primary'>
                        {tag}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <button
              onClick={handlePrevious}
              className='absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 p-2 rounded-full bg-background/80 border border-border hover:bg-muted transition-colors'
              aria-label='Previous testimonial'
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <button
              onClick={handleNext}
              className='absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 p-2 rounded-full bg-background/80 border border-border hover:bg-muted transition-colors'
              aria-label='Next testimonial'
            >
              <ChevronRight className='h-5 w-5' />
            </button>
          </div>

          {/* Dots indicator */}
          <div className='mt-8 flex justify-center gap-2'>
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 transition-all duration-300 rounded-full ${
                  index === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-muted hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
