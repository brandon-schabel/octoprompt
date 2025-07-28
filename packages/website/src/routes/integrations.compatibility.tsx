import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { CompatibilityMatrix } from '@/components/mcp'

export const Route = createFileRoute('/integrations/compatibility')({
  loader: () => {
    return {
      meta: {
        title: 'Compatibility Matrix - Promptliano MCP',
        description: 'Check feature compatibility and version requirements for Promptliano across different editors',
        keywords: ['MCP compatibility', 'version requirements', 'supported features', 'editor support']
      } as SeoMetadata
    }
  },
  component: CompatibilityPage
})

function CompatibilityPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>Compatibility & Requirements</h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
            Detailed compatibility information for Promptliano MCP across all supported editors
          </p>
        </div>

        <CompatibilityMatrix />
      </div>
    </div>
  )
}
