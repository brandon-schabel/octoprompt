import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { SetupWizard } from '@/components/mcp'

export const Route = createFileRoute('/integrations/setup')({
  loader: () => {
    return {
      meta: {
        title: 'MCP Setup Wizard - Promptliano',
        description: 'Step-by-step guide to set up Promptliano MCP integration with your favorite editor',
        keywords: ['MCP setup', 'installation guide', 'configuration wizard']
      } as SeoMetadata
    }
  },
  component: SetupPage
})

function SetupPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>MCP Setup Wizard</h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
            Follow our interactive step-by-step guide to get Promptliano running with your development environment
          </p>
        </div>

        <SetupWizard />
      </div>
    </div>
  )
}
