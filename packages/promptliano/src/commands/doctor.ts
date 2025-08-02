import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { SystemChecker } from '../lib/system-checker.js'
import { logger } from '../lib/logger.js'
import { displayVersionInfo } from '../lib/version-display.js'

export function doctorCommand(program: Command) {
  program
    .command('doctor')
    .description('Diagnose and fix common Promptliano issues')
    .option('--fix', 'Attempt to fix issues automatically')
    .action(async (options) => {
      try {
        await runDoctor(options)
      } catch (error) {
        logger.error('Doctor command failed:', error)
        process.exit(1)
      }
    })
}

async function runDoctor(options: any = {}) {
  await displayVersionInfo()
  console.log(chalk.bold.cyan('🩺 Promptliano Doctor'))
  console.log(chalk.gray('Checking system health...\n'))

  const checker = new SystemChecker()
  const results: any[] = []

  // Check Node.js version
  const nodeSpinner = ora('Checking Node.js version...').start()
  const nodeCheck = await checker.checkNodeVersion()
  if (nodeCheck.valid) {
    nodeSpinner.succeed(`Node.js ${nodeCheck.version} ✓`)
  } else {
    nodeSpinner.fail(`Node.js ${nodeCheck.version} (requires ${nodeCheck.required}+)`)
    results.push({ type: 'error', message: `Node.js version ${nodeCheck.required}+ required`, fix: 'Update Node.js' })
  }

  // Check Bun installation
  const bunSpinner = ora('Checking Bun installation...').start()
  const bunCheck = await checker.checkBun()
  if (bunCheck.installed) {
    bunSpinner.succeed(`Bun ${bunCheck.version} ✓`)
  } else {
    bunSpinner.fail('Bun not installed')
    results.push({ type: 'error', message: 'Bun is required', fix: 'Install Bun' })
  }

  // Check Promptliano installation
  const promptlianoSpinner = ora('Checking Promptliano installation...').start()
  const promptlianoCheck = await checker.checkPromptliano()
  if (promptlianoCheck.installed) {
    promptlianoSpinner.succeed(`Promptliano installed at ${promptlianoCheck.path} ✓`)
  } else {
    promptlianoSpinner.fail('Promptliano not installed')
    results.push({ type: 'error', message: 'Promptliano not found', fix: 'Run: npx promptliano@latest' })
  }

  // Check MCP configurations
  const mcpSpinner = ora('Checking MCP configurations...').start()
  const mcpCheck = await checker.checkMCPConfigs()
  if (mcpCheck.configured.length > 0) {
    mcpSpinner.succeed(`MCP configured for ${mcpCheck.configured.join(', ')} ✓`)
  } else {
    mcpSpinner.warn('No MCP configurations found')
    results.push({ type: 'warning', message: 'No editors configured', fix: 'Run: promptliano config' })
  }

  // Check server status
  const serverSpinner = ora('Checking server status...').start()
  const serverCheck = await checker.checkServer()
  if (serverCheck.running) {
    serverSpinner.succeed(`Server running on port ${serverCheck.port} ✓`)
  } else {
    serverSpinner.info('Server not running')
  }

  // Check network connectivity
  const networkSpinner = ora('Checking network connectivity...').start()
  const networkCheck = await checker.checkNetwork()
  if (networkCheck.connected) {
    networkSpinner.succeed('Network connectivity ✓')
  } else {
    networkSpinner.fail('Network connectivity issues')
    results.push({ type: 'error', message: 'Cannot reach GitHub', fix: 'Check internet connection' })
  }

  // Display results
  console.log('\n' + chalk.bold('Diagnostic Results:'))
  console.log(chalk.gray('─'.repeat(50)))

  if (results.length === 0) {
    console.log(chalk.green('✅ All checks passed! Promptliano is healthy.'))
  } else {
    // Group by type
    const errors = results.filter((r) => r.type === 'error')
    const warnings = results.filter((r) => r.type === 'warning')

    if (errors.length > 0) {
      console.log(chalk.red.bold(`\n❌ ${errors.length} error(s) found:`))
      errors.forEach((e) => {
        console.log(chalk.red(`  • ${e.message}`))
        if (e.fix) console.log(chalk.gray(`    Fix: ${e.fix}`))
      })
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow.bold(`\n⚠️  ${warnings.length} warning(s) found:`))
      warnings.forEach((w) => {
        console.log(chalk.yellow(`  • ${w.message}`))
        if (w.fix) console.log(chalk.gray(`    Fix: ${w.fix}`))
      })
    }

    // Attempt fixes if requested
    if (options.fix && errors.length > 0) {
      console.log(chalk.cyan.bold('\n🔧 Attempting automatic fixes...'))

      for (const error of errors) {
        if (error.fix === 'Install Bun') {
          const fixSpinner = ora('Installing Bun...').start()
          try {
            await checker.installBun()
            fixSpinner.succeed('Bun installed')
          } catch (e) {
            fixSpinner.fail('Failed to install Bun')
          }
        }
      }
    }
  }

  console.log('\n' + chalk.gray('─'.repeat(50)))
  console.log(chalk.gray('Run'), chalk.bold('promptliano doctor --fix'), chalk.gray('to attempt automatic fixes'))
}
