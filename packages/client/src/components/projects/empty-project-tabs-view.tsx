import { Button } from '@ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui'
import { Badge } from '@ui'
import { 
  FolderOpen, 
  Layers, 
  Sparkles, 
  Keyboard, 
  GripVertical,
  Save,
  ArrowRight,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PromptlianoTooltip } from '../promptliano/promptliano-tooltip'
import { ShortcutDisplay } from '../app-shortcut-display'

interface EmptyProjectTabsViewProps {
  onOpenProjectInTab: () => void
  className?: string
}

export function EmptyProjectTabsView({ onOpenProjectInTab, className }: EmptyProjectTabsViewProps) {
  const features = [
    {
      icon: Layers,
      title: 'Multi-Context Management',
      description: 'Work on different features simultaneously with isolated contexts',
      color: 'text-blue-500'
    },
    {
      icon: Save,
      title: 'Persistent State',
      description: 'Your file selections and prompts are saved automatically per tab',
      color: 'text-green-500'
    },
    {
      icon: Keyboard,
      title: 'Quick Navigation',
      description: 'Switch between tabs instantly with keyboard shortcuts',
      shortcut: ['t', '1-9'],
      color: 'text-purple-500'
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Names',
      description: 'Tabs can auto-generate descriptive names based on your work',
      color: 'text-yellow-500'
    },
    {
      icon: GripVertical,
      title: 'Drag & Drop',
      description: 'Reorder tabs to match your workflow preferences',
      color: 'text-orange-500'
    }
  ]

  const keyboardShortcuts = (
    <div className="space-y-2 text-sm">
      <p className="font-medium mb-2">Keyboard Shortcuts:</p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2">
          <span className="text-muted-foreground">Next tab:</span>
          <ShortcutDisplay shortcut={['t', 'tab']} />
        </li>
        <li className="flex items-center gap-2">
          <span className="text-muted-foreground">Previous tab:</span>
          <ShortcutDisplay shortcut={['t', 'shift', 'tab']} />
        </li>
        <li className="flex items-center gap-2">
          <span className="text-muted-foreground">Quick switch:</span>
          <ShortcutDisplay shortcut={['t', '1-9']} />
        </li>
      </ul>
    </div>
  )

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[600px] p-8 relative overflow-hidden", className)}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:50px_50px]" />
        <div className="absolute right-0 top-0 -mt-20 -mr-20 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute left-0 bottom-0 -mb-20 -ml-20 h-[400px] w-[400px] rounded-full bg-secondary/10 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl w-full space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Layers className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">Welcome to Project Tabs</h2>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Project Tabs help you manage multiple contexts within your project. Each tab maintains its own file selections, 
            prompts, and user input, allowing you to work on different features without losing your place.
          </p>
        </div>

        {/* Main CTA Card */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Get Started</CardTitle>
            <CardDescription>Create your first project tab to begin organizing your work</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button 
              size="lg" 
              onClick={onOpenProjectInTab}
              className="gap-2 shadow-sm"
            >
              <FolderOpen className="h-5 w-5" />
              Open New Project in Tab
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-border/50 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all duration-200 hover:shadow-md group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20",
                    feature.color
                  )}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      {feature.title}
                      {feature.shortcut && (
                        <Badge variant="outline" className="text-xs">
                          <ShortcutDisplay shortcut={feature.shortcut} />
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Learn More Section */}
        <div className="flex justify-center">
          <PromptlianoTooltip>
            {keyboardShortcuts}
          </PromptlianoTooltip>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <Info className="h-4 w-4" />
            Learn keyboard shortcuts
          </Button>
        </div>
      </div>
    </div>
  )
}