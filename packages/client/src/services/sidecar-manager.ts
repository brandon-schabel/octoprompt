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
      console.log('[SidecarManager] Setting up event listeners...')

      // Set up event listeners before starting
      this.unsubscribeReady = await listen('octoprompt-server-ready', () => {
        console.log('[SidecarManager] Server ready event received')
        this.isReady = true
      })

      this.unsubscribeTerminated = await listen<number | null>('octoprompt-server-terminated', (event) => {
        console.error('[SidecarManager] Server terminated with code:', event.payload)
        this.isReady = false
      })

      // Start the server via Rust command
      console.log('[SidecarManager] Invoking start_octoprompt_server...')
      const result = await invoke<string>('start_octoprompt_server')
      console.log('[SidecarManager] Start command result:', result)

      // Wait for server to be ready or timeout
      console.log('[SidecarManager] Waiting for server to be ready...')
      await this.waitForReady()
      console.log('[SidecarManager] Server is ready!')
    } catch (error) {
      console.error('[SidecarManager] Failed to start server:', error)
      this.startupPromise = null
      throw error
    }
  }

  private async waitForReady(timeout = 30000): Promise<void> {
    const start = Date.now()
    let checkCount = 0

    console.log(`[SidecarManager] Waiting for server (timeout: ${timeout}ms)...`)

    // First check if server is already running
    const initialCheck = await this.checkHealth()
    if (initialCheck) {
      console.log('[SidecarManager] Server already running (initial check)')
      this.isReady = true
      return
    }

    // Wait for ready event or health check
    while (!this.isReady && Date.now() - start < timeout) {
      checkCount++

      // Try health check
      const healthy = await this.checkHealth()
      if (healthy) {
        console.log(`[SidecarManager] Server ready after ${checkCount} health checks`)
        this.isReady = true
        return
      }

      // Log progress every 5 checks
      if (checkCount % 5 === 0) {
        console.log(`[SidecarManager] Still waiting... (${Date.now() - start}ms elapsed, ${checkCount} checks)`)
      }

      // Wait a bit before next check
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (!this.isReady) {
      const error = `Server failed to start within ${timeout}ms timeout (${checkCount} health checks attempted)`
      console.error(`[SidecarManager] ${error}`)
      throw new Error(error)
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
      const result = await invoke<boolean>('check_server_status')
      if (result) {
        console.log('[SidecarManager] Health check passed')
      }
      return result
    } catch (error) {
      console.error('[SidecarManager] Health check failed:', error)
      return false
    }
  }

  isServerReady(): boolean {
    return this.isReady
  }

  // Alternative method using Command directly (if needed)
  async startWithCommand(): Promise<Child> {
    const command = Command.sidecar('octoprompt-server', ['--port', '3147'])

    const child = await command.spawn()

    // Set up event handlers using the correct Tauri v2 API
    command.on('close', (data) => {
      console.log(`Server process exited with code ${data.code} and signal ${data.signal}`)
      this.isReady = false
    })

    command.on('error', (error) => {
      console.error('Server error:', error)
    })

    command.stdout.on('data', (line: string) => {
      console.log('Server:', line)
      if (line.includes('Server running') || line.includes('Listening on')) {
        this.isReady = true
      }
    })

    command.stderr.on('data', (line: string) => {
      console.error('Server error:', line)
    })

    // Wait for server to be ready
    await this.waitForReady()

    return child
  }
}

// Singleton instance
export const sidecarManager = new OctoPromptSidecarManager()
