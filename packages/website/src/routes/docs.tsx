import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { DocsLayout } from '@/components/docs'

export const Route = createFileRoute('/docs')({
  loader: () => {
    return {
      meta: {
        title: 'Documentation - Promptliano',
        description:
          'Comprehensive documentation for Promptliano. Learn how to get started, explore API references, and discover best practices.',
        keywords: ['documentation', 'guides', 'API reference', 'Promptliano docs']
      } as SeoMetadata
    }
  },
  component: DocsLayout
})
