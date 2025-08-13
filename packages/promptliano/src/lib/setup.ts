import { existsSync } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import ora from 'ora'
import chalk from 'chalk'
import { PromptlianoDownloader } from './downloader.js'
import { MCPConfigurator } from './mcp-configurator.js'
import { ServerManager } from './server-manager.js'
import { SystemChecker } from './system-checker.js'
import { logger } from './logger.js'
import { validateInstallPath } from './secure-paths.js'
import { safeExec } from './safe-exec.js'

export interface SetupOptions {
  installPath?: string
  skipDownload?: boolean
  skipServer?: boolean
  skipMcp?: boolean
  editors?: string[]
  project?: string
  installBun?: boolean
}

export class PromptlianoSetup {
  private installPath: string
  private downloader: PromptlianoDownloader
  private configurator: MCPConfigurator
  private serverManager: ServerManager
  private systemChecker: SystemChecker

  constructor() {
    this.installPath = join(homedir(), '.promptliano')
    this.downloader = new PromptlianoDownloader()
    this.configurator = new MCPConfigurator()
    this.serverManager = new ServerManager()
    this.systemChecker = new SystemChecker()
  }

  async install(options: { installPath: string; skipServer?: boolean; skipMcp?: boolean; branch?: string }): Promise<{
    success: boolean
    error?: string
    serverStarted?: boolean
    port?: number
  }> {
    try {
      this.installPath = options.installPath

      // Validate installation path
      const pathValidation = validateInstallPath(this.installPath)
      if (!pathValidation.valid) {
        throw new Error(pathValidation.error)
      }

      // Check system requirements
      await this.checkRequirements({})

      // Download and install
      const downloadSpinner = ora('Downloading Promptliano...').start()
      const downloadResult = await this.downloader.download({
        installPath: this.installPath
      })

      if (!downloadResult.success) {
        downloadSpinner.fail('Download failed')
        return { success: false, error: downloadResult.error }
      }

      downloadSpinner.succeed('Promptliano downloaded')

      // Install dependencies
      const installSpinner = ora('Installing dependencies...').start()
      try {
        await safeExec('bun install', { cwd: this.installPath })
        installSpinner.succeed('Dependencies installed')
      } catch (error) {
        installSpinner.fail('Failed to install dependencies')
        throw error
      }

      // Start server if requested
      let serverStarted = false
      let port = 3579

      if (!options.skipServer) {
        const serverSpinner = ora('Starting server...').start()
        const serverResult = await this.serverManager.start({
          installPath: this.installPath,
          port,
          detached: true
        })

        if (serverResult.success) {
          serverSpinner.succeed('Server started')
          serverStarted = true
          port = serverResult.port || port
        } else {
          serverSpinner.warn('Server start failed (you can start it manually later)')
        }
      }

      return {
        success: true,
        serverStarted,
        port
      }
    } catch (error) {
      logger.error('Installation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async run(options: SetupOptions) {
    try {
      // Set custom install path if provided
      if (options.installPath) {
        this.installPath = options.installPath
      }

      // Check system requirements
      await this.checkRequirements(options)

      // Download and install Promptliano
      if (!options.skipDownload) {
        await this.downloadAndInstall()
      }

      // Configure MCP for editors
      if (!options.skipMcp && options.editors && options.editors.length > 0) {
        await this.configureMCP(options.editors, options.project)
      }

      // Start server
      if (!options.skipServer) {
        await this.startServer()
      }

      logger.info('Setup completed successfully')
    } catch (error) {
      logger.error('Setup failed:', error)
      throw error
    }
  }

  private async checkRequirements(options: SetupOptions) {
    const spinner = ora('Checking system requirements...').start()

    try {
      // Check Node.js version
      const nodeCheck = await this.systemChecker.checkNodeVersion()
      if (!nodeCheck.valid) {
        spinner.fail(`Node.js ${nodeCheck.required}+ required (found ${nodeCheck.version})`)
        throw new Error('Node.js version requirement not met')
      }

      // Check/Install Bun
      const bunCheck = await this.systemChecker.checkBun()
      if (!bunCheck.installed) {
        if (options.installBun) {
          spinner.text = 'Installing Bun...'
          await this.systemChecker.installBun()
          spinner.succeed('Bun installed successfully')
        } else {
          spinner.fail('Bun is required but not installed')
          throw new Error('Bun installation required')
        }
      } else {
        spinner.succeed('System requirements met')
      }
    } catch (error) {
      spinner.fail('System requirements check failed')
      throw error
    }
  }

  private async downloadAndInstall() {
    const spinner = ora('Downloading Promptliano...').start()

    try {
      // Check if already installed
      if (existsSync(this.installPath)) {
        const serverPath = join(this.installPath, 'packages', 'server')
        if (existsSync(serverPath)) {
          spinner.info('Promptliano already installed, skipping download')
          return
        }
        // Clean up incomplete installation
        await rm(this.installPath, { recursive: true, force: true })
      }

      // Create installation directory
      await mkdir(this.installPath, { recursive: true })

      // Download latest release
      const downloadResult = await this.downloader.download({
        installPath: this.installPath,
        onProgress: (progress) => {
          spinner.text = `Downloading Promptliano source... ${progress}%`
        },
        preferSource: true
      })

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Download failed')
      }

      spinner.succeed('Promptliano source downloaded')

      // Build from source if we downloaded source code
      if (downloadResult.isSource) {
        await this.buildFromSource()
      }
    } catch (error) {
      spinner.fail('Download failed')
      throw error
    }
  }

  private async buildFromSource() {
    const spinner = ora('Building Promptliano from source...').start()
    let buildFailed = false

    try {
      // Verify package.json exists
      const packageJsonPath = join(this.installPath, 'package.json')
      if (!existsSync(packageJsonPath)) {
        throw new Error(`package.json not found at ${packageJsonPath}. Source extraction may have failed.`)
      }

      // Step 1: Install dependencies
      spinner.text = 'Installing dependencies...'
      const { execSync } = await import('child_process')

      logger.info(`Running bun install in ${this.installPath}`)

      try {
        execSync('bun install', {
          cwd: this.installPath,
          stdio: 'pipe',
          encoding: 'utf-8'
        })
      } catch (installError: any) {
        logger.error('Bun install output:', installError.stdout)
        logger.error('Bun install errors:', installError.stderr)
        throw new Error(`Failed to install dependencies: ${installError.message}`)
      }

      // Step 2: Build the UI package (required dependency for client)
      const uiPath = join(this.installPath, 'packages', 'ui')
      const uiDistPath = join(uiPath, 'dist')
      let uiBuildFailed = false

      // Check if UI is already built
      if (existsSync(uiDistPath)) {
        logger.info('UI package already built, skipping UI build')
        spinner.text = 'UI components ready, building client application...'
      } else {
        spinner.text = 'Building UI components...'
        
        try {
          const uiBuildResult = execSync('bun run build', {
            cwd: uiPath,
            stdio: 'pipe',
            encoding: 'utf-8'
          })
          logger.info('UI build output:', uiBuildResult)
          
          // Verify UI build output
          if (existsSync(uiDistPath)) {
            logger.info('UI build successful, artifacts at:', uiDistPath)
          } else {
            uiBuildFailed = true
            logger.warn('UI dist directory not found after build')
          }
        } catch (uiError: any) {
          uiBuildFailed = true
          logger.error('UI build failed:', uiError.message)
          if (uiError.stdout) logger.error('UI build stdout:', uiError.stdout)
          if (uiError.stderr) logger.error('UI build stderr:', uiError.stderr)
          // Don't throw - continue to attempt client build
          spinner.warn('UI build encountered issues, continuing with client build...')
        }
      }

      // Step 3: Build the client application
      spinner.text = 'Building client application...'
      const clientPath = join(this.installPath, 'packages', 'client')
      let buildError = ''

      try {
        const buildResult = execSync('bun run build', {
          cwd: clientPath,
          stdio: 'pipe',
          encoding: 'utf-8'
        })
        logger.info('Client build output:', buildResult)
      } catch (buildErr: any) {
        buildFailed = true
        buildError = buildErr.message
        logger.error('Client build failed:', buildErr.message)
        if (buildErr.stdout) logger.error('Build stdout:', buildErr.stdout)
        if (buildErr.stderr) logger.error('Build stderr:', buildErr.stderr)
      }

      // Step 4: Verify client build output (vite builds directly to server/client-dist)
      const clientDistPath = join(this.installPath, 'packages', 'server', 'client-dist')

      if (existsSync(clientDistPath)) {
        logger.info('Client build successful, artifacts at:', clientDistPath)
      } else if (buildFailed) {
        // Build failed but we can continue without client
        spinner.warn('Client build failed, but server can still run')
        console.log(chalk.yellow('\n⚠️  Client build failed'))
        console.log(chalk.gray('The server will start but without the web interface.'))
        console.log(chalk.gray('To manually build the packages later, run:'))
        if (uiBuildFailed) {
          console.log(chalk.cyan(`  cd ${uiPath}`))
          console.log(chalk.cyan('  bun run build'))
        }
        console.log(chalk.cyan(`  cd ${clientPath}`))
        console.log(chalk.cyan('  bun run build'))
        console.log()

        // Don't throw error - let server start without client
        logger.warn(`Client build skipped due to error: ${buildError}`)
      } else {
        // Build might have succeeded but output is not where expected
        logger.warn('Client dist directory not found at expected location, continuing without client')
        logger.info('Expected location:', clientDistPath)
      }

      // Update success message to reflect what was built
      let successMessage = 'Promptliano built successfully'
      if (buildFailed && uiBuildFailed) {
        successMessage = 'Promptliano installed (server only - UI and client builds failed)'
      } else if (buildFailed) {
        successMessage = 'Promptliano installed (server and UI ready - client build failed)'
      } else if (uiBuildFailed) {
        successMessage = 'Promptliano built (UI build had issues but client built)'
      }
      
      spinner.succeed(successMessage)
    } catch (error) {
      spinner.fail('Build failed')
      logger.error('Build error:', error)
      throw new Error(`Failed to build Promptliano: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async configureMCP(editors: string[], projectPath?: string) {
    const spinner = ora('Configuring MCP...').start()

    try {
      const results = []

      for (const editor of editors) {
        spinner.text = `Configuring MCP for ${editor}...`

        const result = await this.configurator.configure({
          editor,
          projectPath: projectPath || process.cwd(),
          promptlianoPath: this.installPath
        })

        if (result.success) {
          results.push({ editor, success: true })
        } else {
          results.push({ editor, success: false, error: result.error })
        }
      }

      // Report results
      const successful = results.filter((r) => r.success)
      const failed = results.filter((r) => !r.success)

      if (successful.length > 0) {
        spinner.succeed(`MCP configured for ${successful.map((r) => r.editor).join(', ')}`)
      }

      if (failed.length > 0) {
        console.log(chalk.yellow('\nSome configurations failed:'))
        failed.forEach((f) => {
          console.log(chalk.red(`  • ${f.editor}: ${f.error}`))
        })
      }
    } catch (error) {
      spinner.fail('MCP configuration failed')
      throw error
    }
  }

  private async startServer() {
    const spinner = ora('Starting Promptliano server...').start()

    try {
      const result = await this.serverManager.start({
        installPath: this.installPath,
        detached: true
      })

      if (result.success) {
        spinner.succeed(`Server started on port ${result.port}`)
        console.log(chalk.gray(`Server PID: ${result.pid}`))
        console.log(chalk.gray(`View logs: ${result.logPath}`))
        if (result.errorLogPath) {
          console.log(chalk.gray(`Error logs: ${result.errorLogPath}`))
        }
        console.log()
        console.log(chalk.cyan('The server runs in the background. To stop it:'))
        console.log(chalk.cyan(`  promptliano server stop`))
      } else {
        spinner.fail('Failed to start server')

        // Show detailed error information
        console.log()
        console.log(chalk.red('❌ Server startup failed'))
        console.log()
        console.log(chalk.yellow('Error details:'))
        console.log(result.error)

        if (result.errorLogPath) {
          console.log()
          console.log(chalk.gray('For more details, check the error log:'))
          console.log(chalk.gray(result.errorLogPath))
        }

        // If it's a native binding error, suggest alternatives
        if (result.error?.includes('native binding')) {
          console.log()
          console.log(chalk.yellow('💡 Suggestions:'))
          console.log('1. Try running:', chalk.cyan('promptliano update --force'))
          console.log('2. Or install from source if the issue persists')
          console.log('3. Visit:', chalk.cyan('https://github.com/brandon-schabel/promptliano/issues'))
        }

        throw new Error(result.error)
      }
    } catch (error) {
      spinner.fail('Server start failed')
      throw error
    }
  }
}
