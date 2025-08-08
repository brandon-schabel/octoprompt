import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, writeFile, appendFile } from 'fs/promises'
import { join, dirname } from 'path'
import { homedir, platform } from 'os'
import { logger } from './logger.js'

interface StartOptions {
  installPath: string
  port?: number
  detached?: boolean
}

interface StartResult {
  success: boolean
  error?: string
  port?: number
  pid?: number
  logPath?: string
  errorLogPath?: string
}

export class ServerManager {
  private defaultPort = 3579 // Match server's default port

  async start(options: StartOptions): Promise<StartResult> {
    try {
      const port = options.port || this.defaultPort

      // Check for source server first (preferred)
      const sourceServerPath = join(options.installPath, 'packages', 'server', 'server.ts')
      const sourceStartPath = join(options.installPath, 'packages', 'server', 'start-server.ts')
      // Legacy bundled server path
      const bundledServerPath = join(options.installPath, 'server.js')

      let serverPath: string
      let scriptPath: string
      let isBundled = false

      if (existsSync(sourceServerPath)) {
        // Prefer source version - use server.ts directly
        serverPath = join(options.installPath, 'packages', 'server')
        scriptPath = 'server.ts'
        logger.info('Using source server at:', sourceServerPath)
      } else if (existsSync(sourceStartPath)) {
        // Alternative source path
        serverPath = join(options.installPath, 'packages', 'server')
        scriptPath = 'start-server.ts'
        logger.info('Using source server at:', sourceStartPath)
      } else if (existsSync(bundledServerPath)) {
        // Fallback to bundled version
        serverPath = options.installPath
        scriptPath = bundledServerPath
        isBundled = true
        logger.info('Using bundled server at:', bundledServerPath)
      } else {
        return {
          success: false,
          error: 'Server script not found. Is Promptliano installed?'
        }
      }

      // Set up log files
      const logDir = join(homedir(), '.promptliano', 'logs')
      await mkdir(logDir, { recursive: true })
      const logPath = join(logDir, 'server.log')
      const errorLogPath = join(logDir, 'server-error.log')

      // Clear old error log
      await writeFile(errorLogPath, `Server startup attempt at ${new Date().toISOString()}\n`)

      // Prepare environment
      const env = {
        ...process.env,
        PORT: port.toString(),
        PROMPTLIANO_PORT: port.toString(), // Some servers might check this too
        NODE_ENV: 'production',
        PROMPTLIANO_HOME: options.installPath
      }

      // Start server with appropriate command
      const args = isBundled ? [scriptPath] : ['run', scriptPath]

      // Prepare stdio configuration
      let stdioConfig: any = 'inherit'
      let stdoutFd: number | undefined
      let stderrFd: number | undefined

      if (options.detached) {
        // Import openSync from fs
        const { openSync } = await import('fs')

        try {
          // Open files and get their file descriptors for redirection
          stdoutFd = openSync(logPath, 'a') // 'a' for append
          stderrFd = openSync(errorLogPath, 'a')
          stdioConfig = ['ignore', stdoutFd, stderrFd]
        } catch (fileError) {
          logger.error('Failed to open log files:', fileError)
          return {
            success: false,
            error: `Failed to create log files. Please check permissions for ${logDir}`,
            errorLogPath
          }
        }
      }

      let child
      try {
        child = spawn('bun', args, {
          cwd: serverPath,
          env,
          detached: options.detached,
          stdio: stdioConfig
        })
      } catch (spawnError) {
        logger.error('Failed to spawn the server process:', spawnError)

        // Clean up file descriptors if spawn failed
        if (stdoutFd !== undefined) {
          const { closeSync } = await import('fs')
          try {
            closeSync(stdoutFd)
            closeSync(stderrFd!)
          } catch (e) {
            // Ignore close errors
          }
        }

        return {
          success: false,
          error: `Failed to start the server process. Please check permissions and ensure Bun is installed correctly. Details: ${spawnError instanceof Error ? spawnError.message : String(spawnError)}`,
          errorLogPath
        }
      }

      // Capture stderr for error detection if not detached
      let startupError = ''
      if (!options.detached && child.stderr) {
        child.stderr.on('data', (data) => {
          const errorText = data.toString()
          startupError += errorText
          if (errorText.includes('Failed to load native binding')) {
            logger.error('Native binding error detected')
          }
        })
      }

      if (options.detached) {
        child.unref()
      }

      // Wait for server to start (source servers start faster)
      const startupDelay = isBundled ? 8000 : 2000
      logger.info(`Waiting ${startupDelay}ms for server to start...`)
      await new Promise((resolve) => setTimeout(resolve, startupDelay))

      // Verify server is running with retry logic
      let healthCheckPassed = false
      let lastError: any = null
      const maxRetries = isBundled ? 5 : 3
      const retryDelay = 2000

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(`Health check attempt ${attempt}/${maxRetries}...`)

          // Check if fetch is available (Node.js 18+)
          if (typeof fetch === 'undefined') {
            logger.warn('fetch not available, skipping health check')
            healthCheckPassed = true // Assume success if we can't check
            break
          }

          const response = await fetch(`http://localhost:${port}/api/health`, {
            signal: AbortSignal.timeout(5000)
          })

          if (response.ok) {
            healthCheckPassed = true
            logger.info('Health check passed')
            break
          } else {
            lastError = new Error(`Health check returned ${response.status}`)
          }
        } catch (error: any) {
          lastError = error
          // Check if it's a connection refused error
          if (error.cause?.code === 'ECONNREFUSED' && attempt < maxRetries) {
            logger.warn(`Server not ready yet, retrying in ${retryDelay}ms...`)
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
            continue
          }
        }
      }

      if (!healthCheckPassed) {
        logger.error('All health check attempts failed:', lastError)

        // Kill the process if health check fails
        if (child.pid) {
          try {
            process.kill(child.pid, 'SIGTERM')
          } catch (e) {
            logger.error('Failed to kill unhealthy server process:', e)
          }
        }

        // Clean up file descriptors
        if (stdoutFd !== undefined) {
          const { closeSync } = await import('fs')
          try {
            closeSync(stdoutFd)
            closeSync(stderrFd!)
          } catch (e) {
            // Ignore close errors
          }
        }

        // Read error log for better diagnostics
        let errorDetails = ''
        if (options.detached) {
          try {
            const { readFile } = await import('fs/promises')
            const errorLog = await readFile(errorLogPath, 'utf-8')
            if (errorLog.includes('Failed to load native binding')) {
              errorDetails = 'Native binding error detected. '
            } else if (errorLog.includes('port') && errorLog.includes('in use')) {
              errorDetails = 'Port conflict detected. '
            }
          } catch (e) {
            // Ignore read errors
          }
        } else {
          if (startupError.includes('Failed to load native binding')) {
            errorDetails = 'Native binding error detected. '
          } else if (startupError.includes('port') && startupError.includes('in use')) {
            errorDetails = 'Port conflict detected. '
          }
        }

        // Check for specific error patterns in the logs
        if (errorDetails.includes('port') || startupError.includes('port')) {
          return {
            success: false,
            error: `Port ${port} appears to be in use. Try:\n1. Stop any existing Promptliano servers\n2. Use a different port with --port option\n3. Check what's using port ${port}: lsof -i :${port}`,
            errorLogPath
          }
        }

        // Check if this might be a native binding issue
        if (isBundled) {
          return {
            success: false,
            error: `${errorDetails}The bundled server failed to start. This is often due to platform-specific native bindings. Try:\n1. Reinstalling Promptliano\n2. Installing from source instead of the bundle\n3. Checking the error log at: ${errorLogPath}`,
            errorLogPath
          }
        }

        return {
          success: false,
          error: `Server failed to start properly. Check the error log at: ${errorLogPath}`,
          errorLogPath
        }
      }

      // Clean up file descriptors on successful start (they're now owned by the child process)
      // This is important to prevent file descriptor leaks
      if (stdoutFd !== undefined && options.detached) {
        const { closeSync } = await import('fs')
        try {
          closeSync(stdoutFd)
          closeSync(stderrFd!)
        } catch (e) {
          // Ignore close errors - the child process now owns these
        }
      }

      // Only save PID after successful health check
      if (options.detached && healthCheckPassed && child.pid) {
        const pidPath = join(logDir, 'server.pid')
        await writeFile(pidPath, child.pid.toString())
      }

      return {
        success: true,
        port,
        pid: child.pid,
        logPath,
        errorLogPath
      }
    } catch (error) {
      logger.error('Failed to start server:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async stop(): Promise<boolean> {
    try {
      const pidPath = join(homedir(), '.promptliano', 'logs', 'server.pid')

      if (!existsSync(pidPath)) {
        logger.info('No server PID file found')
        return false
      }

      const { readFile, unlink } = await import('fs/promises')
      const pidStr = await readFile(pidPath, 'utf-8')
      const pid = parseInt(pidStr.trim())

      if (isNaN(pid)) {
        logger.error('Invalid PID in file')
        return false
      }

      // Try graceful shutdown with SIGTERM
      process.kill(pid, 'SIGTERM')

      // Wait for process to exit gracefully (5 seconds)
      let processExited = false
      const maxWaitTime = 5000
      const checkInterval = 100
      let waited = 0

      while (waited < maxWaitTime) {
        try {
          process.kill(pid, 0) // Check if process still exists
          await new Promise((resolve) => setTimeout(resolve, checkInterval))
          waited += checkInterval
        } catch (e) {
          // Process no longer exists
          processExited = true
          break
        }
      }

      // If process didn't exit gracefully, force kill
      if (!processExited) {
        logger.warn(`Process ${pid} did not exit gracefully, forcing termination`)
        try {
          process.kill(pid, 'SIGKILL')
          // Wait a bit for forced termination
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (e) {
          // Process may have already exited
        }
      }

      // Clean up PID file
      await unlink(pidPath)

      logger.info(`Server stopped (PID: ${pid})`)
      return true
    } catch (error: any) {
      if (error.code === 'ESRCH') {
        // Process doesn't exist
        logger.info('Server process not found')
        return false
      }

      logger.error('Failed to stop server:', error)
      return false
    }
  }

  async restart(options: StartOptions): Promise<StartResult> {
    await this.stop()

    // Wait a moment for clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return this.start(options)
  }

  async status(): Promise<{
    running: boolean
    pid?: number
    port?: number
  }> {
    try {
      const pidPath = join(homedir(), '.promptliano', 'logs', 'server.pid')

      if (!existsSync(pidPath)) {
        return { running: false }
      }

      const { readFile } = await import('fs/promises')
      const pidStr = await readFile(pidPath, 'utf-8')
      const pid = parseInt(pidStr.trim())

      if (isNaN(pid)) {
        return { running: false }
      }

      // Check if process is running
      try {
        process.kill(pid, 0)

        // Also check if server responds
        if (typeof fetch !== 'undefined') {
          try {
            const response = await fetch(`http://localhost:${this.defaultPort}/api/health`, {
              signal: AbortSignal.timeout(2000)
            })

            if (response.ok) {
              return {
                running: true,
                pid,
                port: this.defaultPort
              }
            }
          } catch {
            // Server not responding
          }
        }
      } catch (error) {
        // Process not running or server not responding
      }

      return { running: false }
    } catch (error) {
      logger.error('Failed to check server status:', error)
      return { running: false }
    }
  }
}
