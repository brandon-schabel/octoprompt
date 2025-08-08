import { Command } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import { MCPConfigurator } from '../lib/mcp-configurator.js'
import { detectEditors } from '../lib/editor-detector.js'
import { logger } from '../lib/logger.js'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export function configCommand(program: Command) {
  program
    .command('config')
    .description('Configure MCP for your AI editor')
    .option('-e, --editor <editor>', 'Editor to configure (claude, vscode, cursor, windsurf, continue)')
    .option('-p, --project <path>', 'Project path')
    .option('--remove', 'Remove MCP configuration')
    .action(async (options) => {
      try {
        await configureProject(options)
      } catch (error) {
        logger.error('Configuration failed:', error)
        process.exit(1)
      }
    })
}

export async function configureProject(options: any = {}) {
  console.log(chalk.bold.cyan('\n🔧 Configure MCP for Project\n'))

  // Check for Promptliano installation
  const promptlianoPath = join(homedir(), '.promptliano')
  if (!existsSync(promptlianoPath)) {
    console.log(chalk.red('❌ Promptliano is not installed.'))
    console.log(chalk.yellow('Run'), chalk.bold('npx promptliano@latest'), chalk.yellow('to install it first.'))
    process.exit(1)
  }

  // Detect editors if not specified
  let selectedEditor = options.editor
  if (!selectedEditor) {
    const detectedEditors = await detectEditors()

    if (detectedEditors.length === 0) {
      console.log(chalk.red('❌ No supported AI editors found.'))
      console.log(chalk.yellow('Supported editors: Claude Desktop, VS Code, Cursor, Windsurf, Continue'))
      process.exit(1)
    }

    if (detectedEditors.length === 1) {
      selectedEditor = detectedEditors[0].id
      console.log(chalk.green(`✓ Found ${detectedEditors[0].name}`))
    } else {
      const { editor } = await inquirer.prompt([
        {
          type: 'list',
          name: 'editor',
          message: 'Select editor to configure:',
          choices: detectedEditors.map((e) => ({
            name: `${e.name} (${e.version})`,
            value: e.id
          }))
        }
      ])
      selectedEditor = editor
    }
  }

  // Get project path
  let projectPath = options.project
  if (!projectPath) {
    const { path } = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: 'Enter project path:',
        default: process.cwd(),
        validate: (input) => {
          if (!existsSync(input)) {
            return 'Path does not exist'
          }
          return true
        }
      }
    ])
    projectPath = path
  }

  // Remove configuration if requested
  if (options.remove) {
    const configurator = new MCPConfigurator()
    await configurator.removeConfiguration(selectedEditor, projectPath)
    console.log(chalk.green('✅ MCP configuration removed'))
    return
  }

  // Configure MCP
  const configurator = new MCPConfigurator()
  const result = await configurator.configure({
    editor: selectedEditor,
    projectPath,
    promptlianoPath
  })

  if (result.success) {
    console.log(chalk.green('\n✅ MCP configuration complete!'))
    console.log(chalk.cyan('\nNext steps:'))
    console.log('  1. Restart', chalk.bold(result.editorName))
    console.log('  2. Look for Promptliano tools in the MCP panel')
    console.log('  3. The project context is automatically loaded')

    if (result.configPath) {
      console.log(chalk.gray(`\nConfiguration saved to: ${result.configPath}`))
    }
  } else {
    console.log(chalk.red(`\n❌ Configuration failed: ${result.error}`))
  }
}
