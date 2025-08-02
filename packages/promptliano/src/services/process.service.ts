import { spawn, exec, ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { Logger } from '../utils/logger.js'
import { writeFileSync, unlinkSync } from 'node:fs'
import { fileExists } from '../utils/paths.js'

const execAsync = promisify(exec)

export class ProcessService {
  private logger: Logger
  private processes: Map<string, ChildProcess> = new Map()

  constructor(logger: Logger) {
    this.logger = logger

    // Handle cleanup on exit
    process.on('exit', () => this.cleanup())
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
  }

  async runCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync(command, { cwd })
      return result
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}`)
    }
  }

  spawnProcess(
    command: string,
    args: string[],
    options: {
      cwd?: string
      detached?: boolean
      name?: string
    } = {}
  ): ChildProcess {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      detached: options.detached,
      stdio: options.detached ? 'ignore' : 'pipe'
    })

    if (options.name) {
      this.processes.set(options.name, proc)
    }

    if (!options.detached) {
      proc.stdout?.on('data', (data) => {
        this.logger.debug(`[${options.name || command}] ${data.toString().trim()}`)
      })

      proc.stderr?.on('data', (data) => {
        this.logger.error(`[${options.name || command}] ${data.toString().trim()}`)
      })
    }

    proc.on('error', (error) => {
      this.logger.error(`Process error: ${error.message}`)
    })

    return proc
  }

  async killProcess(name: string): Promise<void> {
    const proc = this.processes.get(name)
    if (proc && !proc.killed) {
      proc.kill('SIGTERM')
      this.processes.delete(name)
    }
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await this.runCommand(
        process.platform === 'darwin' ? `lsof -i :${port}` : `netstat -tulpn | grep :${port}`
      )
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }

  writePidFile(pid: number, filePath: string): void {
    writeFileSync(filePath, pid.toString())
  }

  readPidFile(filePath: string): number | null {
    if (!fileExists(filePath)) {
      return null
    }

    try {
      const pid = parseInt(require('fs').readFileSync(filePath, 'utf-8'), 10)
      return isNaN(pid) ? null : pid
    } catch {
      return null
    }
  }

  removePidFile(filePath: string): void {
    if (fileExists(filePath)) {
      unlinkSync(filePath)
    }
  }

  private cleanup(): void {
    for (const [name, proc] of this.processes) {
      if (!proc.killed) {
        this.logger.debug(`Cleaning up process: ${name}`)
        proc.kill('SIGTERM')
      }
    }
    this.processes.clear()
  }
}
