import { Component, type PropsWithChildren } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ComponentErrorBoundaryProps = PropsWithChildren & {
  componentName: string
}

type ComponentErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export class ComponentErrorBoundary extends Component<ComponentErrorBoundaryProps, ComponentErrorBoundaryState> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.componentName}:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-destructive rounded-lg m-2">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error in {this.props.componentName}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false, error: null })
            }}
          >
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
} 