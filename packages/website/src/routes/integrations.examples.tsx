import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { CodeExamples } from '@/components/mcp'

export const Route = createFileRoute('/integrations/examples')({
  loader: () => {
    return {
      meta: {
        title: 'Code Examples - Promptliano MCP',
        description: 'Real-world examples showing how Promptliano enhances your AI development workflow',
        keywords: ['MCP examples', 'code samples', 'AI integration', 'use cases']
      } as SeoMetadata
    }
  },
  component: ExamplesPage
})

function ExamplesPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <CodeExamples />
      </div>
    </div>
  )
}
