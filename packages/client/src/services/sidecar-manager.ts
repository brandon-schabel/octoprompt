import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Command, Child } from '@tauri-apps/plugin-shell'

export class OctoPromptSidecarManager {
  private isReady = false
  private startupPromise: Promise<void> | null = null
  private unsubscribeReady: (() => void) | null = null
  private unsubscribeTerminated: (() => void) | null = null

  async start(): Promise<void> {
    // If already starting, return the existing promise
    if (this.startupPromise) {
      return this.startupPromise
    }

    this.startupPromise = this.performStart()
    return this.startupPromise
  }

  private async performStart(): Promise<void> {
    try {
      // Set up event listeners before starting
      this.unsubscribeReady = await listen('octoprompt-server-ready', () => {
        console.log('OctoPrompt server is ready')
        this.isReady = true
      })

      this.unsubscribeTerminated = await listen<number | null>(
        'octoprompt-server-terminated',
        (event) => {
          console.log('OctoPrompt server terminated with code:', event.payload)
          this.isReady = false
        }
      )

      // Start the server via Rust command
      const result = await invoke<string>('start_octoprompt_server')
      console.log(result)

      // Wait for server to be ready or timeout
      await this.waitForReady()
    } catch (error) {
      this.startupPromise = null
      throw error
    }
  }

  private async waitForReady(timeout = 30000): Promise<void> {
    const start = Date.now()
    
    // First check if server is already running
    const initialCheck = await this.checkHealth()
    if (initialCheck) {
      this.isReady = true
      return
    }

    // Wait for ready event or health check
    while (!this.isReady && Date.now() - start < timeout) {
      // Try health check
      const healthy = await this.checkHealth()
      if (healthy) {
        this.isReady = true
        return
      }
      
      // Wait a bit before next check
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (!this.isReady) {
      throw new Error('Server failed to start within timeout')
    }
  }

  async stop(): Promise<void> {
    try {
      const result = await invoke<string>('stop_octoprompt_server')
      console.log(result)
      this.isReady = false
      this.startupPromise = null
      
      // Clean up listeners
      if (this.unsubscribeReady) {
        this.unsubscribeReady()
        this.unsubscribeReady = null
      }
      if (this.unsubscribeTerminated) {
        this.unsubscribeTerminated()
        this.unsubscribeTerminated = null
      }
    } catch (error) {
      console.error('Failed to stop server:', error)
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      return await invoke<boolean>('check_server_status')
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  isServerReady(): boolean {
    return this.isReady
  }

  // Alternative method using Command directly (if needed)
  async startWithCommand(): Promise<Child> {
    const command = Command.sidecar('binaries/octoprompt-server', ['--port', '3147'])
    
    const child = await command.spawn()
    
    // Monitor stdout for readiness
    child.stdout.on('data', (line: string) => {
      console.log('Server:', line)
      if (line.includes('Server running') || line.includes('Listening on')) {
        this.isReady = true
      }
    })
    
    // Handle errors
    child.stderr.on('data', (line: string) => {
      console.error('Server error:', line)
    })
    
    // Wait for server to be ready
    await this.waitForReady()
    
    return child
  }
}

// Singleton instance
export const sidecarManager = new OctoPromptSidecarManager()