import { FolderSync, Save, MessageSquare, GitBranchPlus, EyeOff, Calculator } from 'lucide-react'

const features = [
  {
    name: 'Advanced Chat Interface',
    description: 'Engage with various LLMs using either locally hosted models with LM Studio and Ollama, use OpenAI directly, or use OpenRouter.',
    icon: MessageSquare,
  },
  {
    name: 'Chat Forking',
    description: 'Fork your chat from any message to explore different conversation paths, perfect for experimenting with different prompts or recovering from undesired AI responses.',
    icon: GitBranchPlus,
  },
  {
    name: 'Smart Message Control',
    description: 'Exclude irrelevant or duplicate messages from your requests to keep conversations focused and context-efficient.',
    icon: EyeOff,
  },
  {
    name: 'Token Estimation',
    description: 'Real-time token counting helps you optimize context window usage and manage costs effectively.',
    icon: Calculator,
  },
  {
    name: 'Project Sync',
    description: 'Load and sync folders to inspect and add files to your prompts.',
    icon: FolderSync,
  },
  {
    name: 'Custom Prompts',
    description: 'Save and reuse your custom-crafted prompts for future use.',
    icon: Save,
  },
]

export function FeatureList() {
  return (
    <div className="bg-background py-12 sm:py-16 lg:py-20" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
            Powerful Features for Developers
          </h2>
          <p className="mt-4 max-w-2xl text-xl text-muted-foreground mx-auto">
            Enhance your development workflow with our comprehensive set of features.
          </p>
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="pt-6 h-full">
                <div className="flow-root bg-card rounded-lg px-6 pb-8 h-full flex flex-col min-h-[240px] border shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                  <div className="flex flex-col flex-1">
                    <div className="-mt-6">
                      <span className="inline-flex items-center justify-center p-3 bg-primary rounded-md shadow-lg ring-4 ring-background">
                        <feature.icon className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="mt-8 text-lg font-semibold text-foreground tracking-tight">{feature.name}</h3>
                    <p className="mt-5 text-base text-muted-foreground flex-1 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

