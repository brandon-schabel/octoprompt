import { Component, type PropsWithChildren } from 'react'
import { Button } from '@promptliano/ui'
import { AlertCircle } from 'lucide-react'

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  constructor(props: PropsWithChildren) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can log the error to an error reporting service here
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className=' flex items-center justify-center p-4'>
          <div className='max-w-md w-full space-y-4 text-center'>
            <AlertCircle className='w-12 h-12 mx-auto text-destructive' />
            <h2 className='text-2xl font-bold'>Something went wrong</h2>
            <p className='text-muted-foreground'>{this.state.error?.message || 'An unexpected error occurred'}</p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
