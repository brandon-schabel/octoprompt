import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { extract } from 'tar'
import { Logger } from '../utils/logger.js'
import { GITHUB_API_BASE, GITHUB_REPO } from '../utils/constants.js'
import { ensureDir } from '../utils/paths.js'
import { join } from 'node:path'

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
  assets: GitHubAsset[]
}

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
}

export class DownloadService {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  async getLatestRelease(): Promise<GitHubRelease> {
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json'
        }
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      throw new Error(`Failed to fetch release info: ${error}`)
    }
  }

  async getAllReleases(): Promise<GitHubRelease[]> {
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases`

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json'
        }
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      throw new Error(`Failed to fetch releases: ${error}`)
    }
  }

  async downloadFile(url: string, outputPath: string): Promise<void> {
    const spinner = this.logger.spinner(`Downloading from ${url}`)

    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      ensureDir(join(outputPath, '..'))

      const fileStream = createWriteStream(outputPath)
      await pipeline(response.body as any, fileStream)

      spinner.succeed('Download completed')
    } catch (error) {
      spinner.fail('Download failed')
      throw error
    }
  }

  async extractTarball(tarballPath: string, outputDir: string): Promise<void> {
    const spinner = this.logger.spinner('Extracting archive')

    try {
      ensureDir(outputDir)

      await extract({
        file: tarballPath,
        cwd: outputDir
      })

      spinner.succeed('Extraction completed')
    } catch (error) {
      spinner.fail('Extraction failed')
      throw error
    }
  }

  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}
