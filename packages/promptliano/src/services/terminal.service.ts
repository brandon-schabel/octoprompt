import inquirer from 'inquirer'
import chalk from 'chalk'
import { Logger } from '../utils/logger.js'

export class TerminalService {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  async confirm(message: string, defaultValue = true): Promise<boolean> {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue
      }
    ])

    return confirmed
  }

  async select<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T; description?: string }>
  ): Promise<T> {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message,
        choices: choices.map((choice) => ({
          name: choice.description ? `${choice.name} ${chalk.dim(`- ${choice.description}`)}` : choice.name,
          value: choice.value
        }))
      }
    ])

    return selected
  }

  async input(message: string, defaultValue?: string, validate?: (input: string) => boolean | string): Promise<string> {
    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message,
        default: defaultValue,
        validate
      }
    ])

    return value
  }

  async password(message: string): Promise<string> {
    const { value } = await inquirer.prompt([
      {
        type: 'password',
        name: 'value',
        message,
        mask: '*'
      }
    ])

    return value
  }

  async checkbox<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean }>
  ): Promise<T[]> {
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message,
        choices
      }
    ])

    return selected
  }

  displayBanner(): void {
    console.log(chalk.cyan('\n╔══════════════════════════════════╗'))
    console.log(chalk.cyan('║     🚀 Promptliano CLI Tool      ║'))
    console.log(chalk.cyan('║  Your AI toolkit for context     ║'))
    console.log(chalk.cyan('║        engineering               ║'))
    console.log(chalk.cyan('╚══════════════════════════════════╝\n'))
  }

  displaySuccess(title: string, message: string): void {
    console.log()
    console.log(chalk.green.bold(`✨ ${title}`))
    console.log(chalk.dim('─'.repeat(40)))
    console.log(message)
    console.log()
  }
}
