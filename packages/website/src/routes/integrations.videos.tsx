import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { VideoDemos } from '@/components/mcp'

export const Route = createFileRoute('/integrations/videos')({
  loader: () => {
    return {
      meta: {
        title: 'Video Tutorials - Promptliano MCP',
        description: 'Watch comprehensive video guides on setting up and using Promptliano MCP integration',
        keywords: ['MCP videos', 'tutorials', 'video guides', 'demos']
      } as SeoMetadata
    }
  },
  component: VideosPage
})

function VideosPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <VideoDemos />
      </div>
    </div>
  )
}
