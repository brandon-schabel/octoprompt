import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { Troubleshooting } from '@/components/mcp'

export const Route = createFileRoute('/integrations/troubleshooting')({
  loader: () => {
    return {
      meta: {
        title: 'Troubleshooting Guide - Promptliano MCP',
        description: 'Find solutions to common issues and debug problems with Promptliano MCP integration',
        keywords: ['MCP troubleshooting', 'debug', 'common issues', 'solutions']
      } as SeoMetadata
    }
  },
  component: TroubleshootingPage
})

function TroubleshootingPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl'>
        <Troubleshooting />
      </div>
    </div>
  )
}
