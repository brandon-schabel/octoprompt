import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { LocalFirstContent } from '@/components/local-first/local-first-content'

export const Route = createFileRoute('/local-first')({
  loader: () => {
    return {
      meta: {
        title: 'Local First Architecture - Promptliano',
        description:
          'Discover how Promptliano runs entirely on your machine with local database, encryption, and privacy-first design. Works without AI, enhanced with AI.',
        keywords: [
          'local first',
          'privacy',
          'encryption',
          'local database',
          'offline development',
          'data security',
          'self-hosted',
          'no tracking'
        ],
        openGraph: {
          title: 'Local First Architecture - Promptliano',
          description: 'Everything runs on your machine. Your data, your control.',
          type: 'website'
        }
      } as SeoMetadata
    }
  },
  component: LocalFirstPage
})

function LocalFirstPage() {
  return (
    <div className='min-h-screen'>
      <LocalFirstContent />
    </div>
  )
}
