import { GlassCard } from '@/components/ui'
import { motion } from 'framer-motion'
import { Github, Twitter, MessageSquare, Mail, ExternalLink, Heart, Code2 } from 'lucide-react'

const footerLinks = {
  product: [
    { label: 'Features', href: '/features' },
    { label: 'Changelog', href: '/changelog' },
    { label: 'Roadmap', href: '/roadmap' }
  ],
  developers: [
    { label: 'Documentation', href: '/docs' },
    { label: 'Getting Started', href: '/docs/getting-started' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'Examples', href: '/examples' }
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' }
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'License', href: '/license' }
  ]
}

const socialLinks = [
  {
    icon: Github,
    href: 'https://github.com/brandon-schabel/promptliano',
    label: 'GitHub',
    color: 'hover:text-gray-400'
  },
  {
    icon: Twitter,
    href: 'https://twitter.com/promptliano',
    label: 'Twitter',
    color: 'hover:text-blue-400'
  },
  {
    icon: MessageSquare,
    href: 'https://discord.gg/Z2nDnVQKKm',
    label: 'Discord',
    color: 'hover:text-indigo-400'
  }
]

export function Footer() {
  return (
    <footer className='relative border-t border-border'>
      {/* Newsletter Section */}
      {/* <div className='container mx-auto px-4 py-12'>
        <GlassCard className='p-8 md:p-12 text-center max-w-2xl mx-auto'>
          <h3 className='text-2xl font-bold mb-4'>Stay Updated</h3>
          <p className='text-muted-foreground mb-6'>
            Get the latest updates on Promptliano features and best practices for AI development
          </p>
          <form className='flex flex-col sm:flex-row gap-4 max-w-md mx-auto'>
            <input
              type='email'
              placeholder='Enter your email'
              className='flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
              required
            />
            <button
              type='submit'
              className='px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium'
            >
              Subscribe
            </button>
          </form>
          <p className='text-xs text-muted-foreground mt-4'>No spam, unsubscribe anytime. We respect your privacy.</p>
        </GlassCard>
      </div> */}

      {/* Main Footer */}
      <div className='container mx-auto px-4 py-12'>
        <div className='grid grid-cols-2 md:grid-cols-5 gap-8'>
          {/* Logo and Description */}
          <div className='col-span-2 md:col-span-1'>
            <div className='flex items-center gap-2 mb-4'>
              <Code2 className='h-6 w-6 text-primary' />
              <span className='text-xl font-bold'>Promptliano</span>
            </div>
            <p className='text-sm text-muted-foreground mb-4'>
              The MCP server that gives AI assistants deep understanding of your codebase.
            </p>
            <div className='flex gap-3'>
              {socialLinks.map((link) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={`text-muted-foreground transition-colors ${link.color}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={link.label}
                >
                  <link.icon className='h-5 w-5' />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className='font-semibold mb-4'>Product</h4>
            <ul className='space-y-2'>
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className='text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1'
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className='font-semibold mb-4'>Developers</h4>
            <ul className='space-y-2'>
              {footerLinks.developers.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className='text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1'
                  >
                    {link.label}
                    {link.href.startsWith('/docs') && <ExternalLink className='h-3 w-3' />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className='font-semibold mb-4'>Company</h4>
            <ul className='space-y-2'>
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className='font-semibold mb-4'>Legal</h4>
            <ul className='space-y-2'>
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className='mt-12 pt-8 border-t border-border'>
          <div className='flex flex-col md:flex-row justify-between items-center gap-4'>
            <p className='text-sm text-muted-foreground'>
              © {new Date().getFullYear()} Promptliano. All rights reserved.
            </p>
            <div className='flex items-center gap-1 text-sm text-muted-foreground'>
              <span>Made with</span>
              <Heart className='h-4 w-4 text-red-500 fill-red-500' />
              <span>by developers, for developers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
