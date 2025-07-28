import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { ConfigGenerator } from '@/components/mcp'

export const Route = createFileRoute('/integrations/config')({
  loader: () => {
    return {
      meta: {
        title: 'MCP Configuration Generator - Promptliano',
        description: 'Generate custom MCP configuration files for Promptliano with our interactive tool',
        keywords: ['MCP config', 'configuration generator', 'mcp.json']
      } as SeoMetadata
    }
  },
  component: ConfigPage
})

function ConfigPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <ConfigGenerator />
      </div>
    </div>
  )
}
