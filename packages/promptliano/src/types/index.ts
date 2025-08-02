export interface CLIConfig {
  devServerPath?: string
  defaultEditor?: 'cursor' | 'vscode' | 'windsurf'
  githubToken?: string
}

export interface DevServerOptions {
  port?: number
  detached?: boolean
  skipInstall?: boolean
}

export interface DownloadOptions {
  version?: string
  platform?: 'darwin' | 'linux' | 'win32'
  outputPath?: string
}

export interface ProjectInitOptions {
  name?: string
  editor?: 'cursor' | 'vscode' | 'windsurf'
  skipMcp?: boolean
}

export interface CommandContext {
  config: CLIConfig
  verbose: boolean
}
