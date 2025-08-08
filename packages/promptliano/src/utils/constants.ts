import { homedir } from 'node:os'
import { join } from 'node:path'

export const PROMPTLIANO_HOME = join(homedir(), '.promptliano')
export const DEV_SERVER_PATH = join(PROMPTLIANO_HOME, 'dev')
export const CONFIG_PATH = join(PROMPTLIANO_HOME, 'config.json')
export const DOWNLOADS_PATH = join(PROMPTLIANO_HOME, 'downloads')

export const GITHUB_REPO = 'brandon-schabel/promptliano'
export const GITHUB_API_BASE = 'https://api.github.com'

export const BUN_INSTALL_SCRIPT = 'https://bun.sh/install'

export const DEFAULT_PORT = 3006
