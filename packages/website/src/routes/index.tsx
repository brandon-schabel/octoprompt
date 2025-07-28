import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LandingPage } from '@/pages/landing-page'
import { SeoMetadata } from '@/schemas/seo.schemas'

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    ref: z.string().optional()
  }),
  loader: () => {
    return {
      meta: {
        title: 'Promptliano - Supercharge AI Development with Context',
        description:
          'Promptliano is the MCP server that gives AI assistants deep understanding of your codebase. Reduce tokens by 90%, work across all editors, and build faster with intelligent context management.',
        keywords: [
          'AI development',
          'MCP server',
          'MCP integration',
          'coding assistant',
          'developer tools',
          'promptliano',
          'context management',
          'token optimization',
          'VSCode',
          'Cursor',
          'Claude Desktop',
          'Claude Code'
        ],
        openGraph: {
          title: 'Promptliano - Supercharge AI Development with Context',
          description:
            'The MCP server that gives AI assistants deep understanding of your codebase. Reduce tokens by 90% while building faster.',
          type: 'website',
          images: [
            {
              url: 'https://promptliano.com/og-image.png',
              width: 1200,
              height: 630,
              alt: 'Promptliano - MCP Server for AI Development'
            }
          ]
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Promptliano - Supercharge AI Development with Context',
          description:
            'The MCP server that gives AI assistants deep understanding of your codebase. Reduce tokens by 90% while building faster.',
          image: 'https://promptliano.com/og-image.png'
        }
      } as SeoMetadata
    }
  },
  component: HomePage
})

function HomePage() {
  const { ref } = Route.useSearch()

  return (
    <>
      <LandingPage />

      {ref && (
        <div className='fixed bottom-4 right-4 bg-background/80 backdrop-blur border rounded-lg p-4 text-sm z-50'>
          Referred by: {ref}
        </div>
      )}
    </>
  )
}
