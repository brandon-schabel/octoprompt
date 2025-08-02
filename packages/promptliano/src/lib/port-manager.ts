import { createServer } from 'net'
import { logger } from './logger.js'
import { safeGetPortProcess, safePowerShell } from './safe-exec.js'

export interface PortCheckResult {
  available: boolean
  inUse?: boolean
  error?: string
  suggestedPort?: number
}

export interface PortRange {
  start: number
  end: number
}

export class PortManager {
  private defaultPort: number = 3579
  private portRange: PortRange = { start: 3579, end: 3588 }
  private maxPortAttempts: number = 10

  async checkPort(port: number): Promise<PortCheckResult> {
    return new Promise((resolve) => {
      const server = createServer()

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve({
            available: false,
            inUse: true
          })
        } else if (err.code === 'EACCES') {
          resolve({
            available: false,
            error: 'Permission denied. Ports below 1024 require root access.'
          })
        } else {
          resolve({
            available: false,
            error: err.message
          })
        }
      })

      server.once('listening', () => {
        server.close(() => {
          resolve({
            available: true,
            inUse: false
          })
        })
      })

      server.listen(port)
    })
  }

  async findAvailablePort(preferredPort?: number): Promise<number> {
    // Try preferred port first
    if (preferredPort) {
      const result = await this.checkPort(preferredPort)
      if (result.available) {
        return preferredPort
      }
    }

    // Try default port
    const defaultResult = await this.checkPort(this.defaultPort)
    if (defaultResult.available) {
      return this.defaultPort
    }

    // Scan port range with max attempts limit
    let attempts = 0
    for (let port = this.portRange.start; port <= this.portRange.end && attempts < this.maxPortAttempts; port++) {
      attempts++
      const result = await this.checkPort(port)
      if (result.available) {
        return port
      }
    }

    throw new Error(
      `No available ports found after checking ${attempts} ports in range ${this.portRange.start}-${this.portRange.end}`
    )
  }

  async getPortInfo(port: number): Promise<{
    port: number
    status: 'available' | 'in-use' | 'error'
    process?: string
    error?: string
  }> {
    const checkResult = await this.checkPort(port)

    if (checkResult.available) {
      return {
        port,
        status: 'available'
      }
    }

    if (checkResult.inUse) {
      // Try to find process using the port
      const process = await this.findProcessUsingPort(port)
      return {
        port,
        status: 'in-use',
        process
      }
    }

    return {
      port,
      status: 'error',
      error: checkResult.error
    }
  }

  async findProcessUsingPort(port: number): Promise<string | undefined> {
    const { platform } = process

    try {
      const processInfo = await safeGetPortProcess(port)
      if (!processInfo) {
        return undefined
      }

      const lines = processInfo.split('\n').filter((line) => line)

      if (lines.length > 0) {
        if (platform === 'win32') {
          // Parse PowerShell output
          const pidMatch = lines[0].match(/OwningProcess\s*:\s*(\d+)/)
          if (pidMatch) {
            const pid = parseInt(pidMatch[1], 10)

            // Get process name from PID
            try {
              const { stdout: processInfo } = await safePowerShell(
                `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name`
              )
              const name = processInfo.trim()
              return `${name} (PID: ${pid})`
            } catch {
              return `Process PID: ${pid}`
            }
          }
        } else {
          // Unix format: node 12345
          const [name, pid] = lines[0].split(/\s+/)
          return `${name} (PID: ${pid})`
        }
      }
    } catch (error) {
      logger.debug('Failed to find process using port:', error)
    }

    return undefined
  }

  async waitForPort(port: number, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now()
    const checkInterval = 500

    while (Date.now() - startTime < timeout) {
      const result = await this.checkPort(port)
      if (!result.available) {
        // Port is in use, which means service is running
        return true
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }

    return false
  }

  async killProcessOnPort(port: number): Promise<boolean> {
    const info = await this.getPortInfo(port)

    if (info.status !== 'in-use' || !info.process) {
      return false
    }

    // Extract PID from process string
    const pidMatch = info.process.match(/PID:\s*(\d+)/)
    if (!pidMatch) {
      return false
    }

    const pid = parseInt(pidMatch[1])

    try {
      process.kill(pid, 'SIGTERM')

      // Wait for process to die
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check if port is now free
      const checkResult = await this.checkPort(port)
      return checkResult.available
    } catch (error) {
      logger.error(`Failed to kill process on port ${port}:`, error)
      return false
    }
  }

  suggestAlternativePorts(unavailablePort: number, count: number = 5): number[] {
    const suggestions: number[] = []
    const basePort = Math.floor(unavailablePort / 10) * 10

    // Try ports near the requested one
    for (let offset = 1; suggestions.length < count && offset < 50; offset++) {
      if (basePort + offset !== unavailablePort) {
        suggestions.push(basePort + offset)
      }
      if (basePort - offset > 1024 && basePort - offset !== unavailablePort) {
        suggestions.push(basePort - offset)
      }
    }

    return suggestions.slice(0, count)
  }
}
