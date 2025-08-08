import chalk from 'chalk'
import { existsSync } from 'fs'
import { appendFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { homedir } from 'os'

export class Logger {
  private logFile: string
  private debugMode: boolean
  private maxLogSize: number = 10 * 1024 * 1024 // 10MB
  private maxBackups: number = 3

  constructor() {
    this.logFile = join(homedir(), '.promptliano', 'logs', 'cli.log')
    this.debugMode = process.env.DEBUG === 'true' || process.env.PROMPTLIANO_DEBUG === 'true'
  }

  async info(message: string, ...args: any[]) {
    if (this.debugMode) {
      console.log(chalk.blue('[INFO]'), message, ...args)
    }
    await this.writeToFile('INFO', message, args)
  }

  async warn(message: string, ...args: any[]) {
    console.warn(chalk.yellow('[WARN]'), message, ...args)
    await this.writeToFile('WARN', message, args)
  }

  async error(message: string, ...args: any[]) {
    console.error(chalk.red('[ERROR]'), message, ...args)
    await this.writeToFile('ERROR', message, args)
  }

  async debug(message: string, ...args: any[]) {
    if (this.debugMode) {
      console.log(chalk.gray('[DEBUG]'), message, ...args)
    }
    await this.writeToFile('DEBUG', message, args)
  }

  private async writeToFile(level: string, message: string, args: any[]) {
    try {
      const timestamp = new Date().toISOString()
      const logEntry = `${timestamp} [${level}] ${message} ${args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ')}\n`

      // Ensure log directory exists
      const logDir = dirname(this.logFile)
      if (!existsSync(logDir)) {
        await mkdir(logDir, { recursive: true })
      }

      // Check if rotation is needed
      await this.rotateLogsIfNeeded()

      await appendFile(this.logFile, logEntry)
    } catch (error) {
      // Silently fail if we can't write logs
    }
  }

  private async rotateLogsIfNeeded() {
    try {
      if (!existsSync(this.logFile)) {
        return
      }

      const { stat, rename } = await import('fs/promises')
      const stats = await stat(this.logFile)

      if (stats.size >= this.maxLogSize) {
        // Rotate existing backups
        for (let i = this.maxBackups - 1; i > 0; i--) {
          const oldFile = `${this.logFile}.${i}`
          const newFile = `${this.logFile}.${i + 1}`

          if (existsSync(oldFile)) {
            if (i === this.maxBackups - 1) {
              // Delete the oldest backup
              const { unlink } = await import('fs/promises')
              await unlink(oldFile)
            } else {
              await rename(oldFile, newFile)
            }
          }
        }

        // Rotate current log to .1
        await rename(this.logFile, `${this.logFile}.1`)
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }
}

export const logger = new Logger()
