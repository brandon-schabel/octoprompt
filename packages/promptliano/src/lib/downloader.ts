import { createWriteStream, existsSync, createReadStream } from 'fs';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { extract } from 'tar';
import AdmZip from 'adm-zip';
import { platform } from 'os';
import { logger } from './logger.js';
import { createHash } from 'crypto';
import { pathValidator } from './secure-paths.js';

interface DownloadOptions {
  installPath: string;
  version?: string;
  onProgress?: (progress: number) => void;
  preferSource?: boolean;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  assets: ReleaseAsset[];
  body?: string;
}

interface DownloadResult {
  success: boolean;
  error?: string;
  checksum?: string;
  isSource?: boolean;
}

export class PromptlianoDownloader {
  private readonly githubApiUrl = 'https://api.github.com/repos/brandon-schabel/promptliano/releases';
  private readonly userAgent = 'Promptliano-CLI';
  private readonly trustedChecksums: Map<string, string> = new Map();

  async download(options: DownloadOptions): Promise<DownloadResult> {
    try {
      // Validate installation path
      const pathValidation = pathValidator.validatePath(options.installPath);
      if (!pathValidation.valid) {
        throw new Error(`Invalid installation path: ${pathValidation.error}`);
      }
      
      // Get latest release info
      const release = await this.getLatestRelease(options.version);
      logger.info(`Downloading Promptliano ${release.tag_name}`);

      // Always prefer source for now to avoid native binding issues
      if (options.preferSource !== false) {
        return await this.downloadSource(release.tag_name, options);
      }

      // Find the bun-bundle asset (legacy path)
      const asset = release.assets.find(a => 
        a.name.includes('bun-bundle') || 
        a.name.includes('promptliano-bundle')
      );

      if (!asset) {
        throw new Error('No suitable release bundle found');
      }
      
      // Look for checksum file
      const checksumAsset = release.assets.find(a => 
        a.name.includes('checksums') || a.name.includes('sha256')
      );

      // Download to temp file with secure path
      const tempPath = pathValidator.createSafePath(options.installPath, 'download.tmp');
      const downloadResult = await this.downloadFile(
        asset.browser_download_url, 
        tempPath,
        asset.size,
        options.onProgress
      );
      
      // Verify checksum if available
      if (checksumAsset) {
        const isValid = await this.verifyChecksum(tempPath, checksumAsset.browser_download_url, asset.name);
        if (!isValid) {
          await rm(tempPath, { force: true });
          throw new Error('Checksum verification failed - download may be corrupted or tampered');
        }
      } else {
        logger.warn('No checksum file available for verification - proceeding with caution');
      }

      // Extract based on file type
      await this.extractBundle(tempPath, options.installPath);

      // Clean up
      await rm(tempPath, { force: true });

      logger.info('Download and extraction complete');
      return { success: true, checksum: downloadResult.checksum };
    } catch (error) {
      logger.error('Download failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  private async getLatestRelease(version?: string): Promise<GitHubRelease> {
    const url = version 
      ? `${this.githubApiUrl}/tags/${version}`
      : `${this.githubApiUrl}/latest`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch release info: ${response.statusText}`);
    }

    return await response.json();
  }

  private async downloadFile(
    url: string, 
    destination: string, 
    totalSize: number,
    onProgress?: (progress: number) => void
  ): Promise<{ checksum: string }> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const actualSize = contentLength || totalSize;

    let downloaded = 0;
    const stream = response.body;
    
    if (!stream) {
      throw new Error('No response body');
    }

    const reader = stream.getReader();
    const writer = createWriteStream(destination);
    const hash = createHash('sha256');

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        writer.write(value);
        hash.update(value);
        downloaded += value.length;
        
        if (onProgress && actualSize > 0) {
          const progress = Math.round((downloaded / actualSize) * 100);
          onProgress(progress);
        }
      }
    } finally {
      writer.close();
    }
    
    return { checksum: hash.digest('hex') };
  }

  private async extractBundle(bundlePath: string, targetPath: string): Promise<void> {
    const isWindows = platform() === 'win32';
    
    if (bundlePath.endsWith('.zip')) {
      // Handle ZIP files (Windows)
      const zip = new AdmZip(bundlePath);
      zip.extractAllTo(targetPath, true);
    } else if (bundlePath.endsWith('.tar.gz') || bundlePath.endsWith('.tgz')) {
      // Handle tar.gz files (Unix)
      await pipeline(
        createReadStream(bundlePath),
        extract({ cwd: targetPath })
      );
    } else {
      // Try to detect format from content
      const buffer = await readFile(bundlePath);
      if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
        // ZIP magic number
        const zip = new AdmZip(bundlePath);
        zip.extractAllTo(targetPath, true);
      } else {
        // Assume tar.gz
        await pipeline(
          createReadStream(bundlePath),
          extract({ cwd: targetPath })
        );
      }
    }
  }

  async checkForUpdates(currentVersion?: string): Promise<{
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion: string;
    releaseNotes?: string;
  }> {
    try {
      const release = await this.getLatestRelease();
      const latestVersion = release.tag_name.replace(/^v/, '');
      
      if (!currentVersion) {
        return {
          hasUpdate: true,
          latestVersion,
          releaseNotes: release.body
        };
      }

      const current = currentVersion.replace(/^v/, '');
      const hasUpdate = this.compareVersions(current, latestVersion) < 0;

      return {
        hasUpdate,
        currentVersion: current,
        latestVersion,
        releaseNotes: release.body
      };
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      throw error;
    }
  }

  private compareVersions(current: string, latest: string): number {
    // Clean versions - remove 'v' prefix and any pre-release tags
    const cleanVersion = (v: string) => {
      // Remove 'v' prefix
      v = v.replace(/^v/, '');
      // Extract just the numeric version (before any dash)
      const match = v.match(/^(\d+\.\d+\.\d+)/);
      return match ? match[1] : v;
    };
    
    const currentClean = cleanVersion(current);
    const latestClean = cleanVersion(latest);
    
    // Parse version parts
    const currentParts = currentClean.split('.').map(p => {
      const num = parseInt(p, 10);
      return isNaN(num) ? 0 : num;
    });
    const latestParts = latestClean.split('.').map(p => {
      const num = parseInt(p, 10);
      return isNaN(num) ? 0 : num;
    });

    // Compare numeric parts
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (currentPart < latestPart) return -1;
      if (currentPart > latestPart) return 1;
    }
    
    // If numeric parts are equal, check for pre-release
    // Pre-release versions are considered older
    const currentHasPreRelease = current.includes('-');
    const latestHasPreRelease = latest.includes('-');
    
    if (currentHasPreRelease && !latestHasPreRelease) return -1;
    if (!currentHasPreRelease && latestHasPreRelease) return 1;
    
    // If both have pre-release, do string comparison of full versions
    if (currentHasPreRelease && latestHasPreRelease) {
      return current.localeCompare(latest);
    }

    return 0;
  }
  
  private async verifyChecksum(
    filePath: string,
    checksumUrl: string,
    fileName: string
  ): Promise<boolean> {
    try {
      // Download checksum file
      const response = await fetch(checksumUrl, {
        headers: {
          'User-Agent': this.userAgent
        }
      });
      
      if (!response.ok) {
        logger.warn('Could not download checksum file');
        return false; // Fail secure - no checksum means no verification
      }
      
      const checksumContent = await response.text();
      
      // Parse checksum file (format: hash filename)
      const lines = checksumContent.split('\n');
      for (const line of lines) {
        const [hash, file] = line.trim().split(/\s+/);
        if (file === fileName || file?.endsWith(fileName)) {
          // Calculate file hash
          const fileBuffer = await readFile(filePath);
          const calculatedHash = createHash('sha256').update(fileBuffer).digest('hex');
          
          if (calculatedHash === hash) {
            logger.info('Checksum verified successfully');
            return true;
          } else {
            logger.error(`Checksum mismatch: expected ${hash}, got ${calculatedHash}`);
            return false;
          }
        }
      }
      
      logger.warn('No checksum found for file');
      return false; // Fail secure - no checksum means no verification
    } catch (error) {
      logger.error('Checksum verification failed:', error);
      return false; // Fail secure - verification error means no trust
    }
  }
  
  private async downloadSource(
    tagName: string,
    options: DownloadOptions
  ): Promise<DownloadResult> {
    try {
      // GitHub automatically provides source archives for tags
      const sourceUrl = `https://github.com/brandon-schabel/promptliano/archive/refs/tags/${tagName}.zip`;
      logger.info(`Downloading source code from ${sourceUrl}`);
      
      // Ensure installation directory exists
      await mkdir(options.installPath, { recursive: true });
      
      // Download to temp file
      const tempPath = pathValidator.createSafePath(options.installPath, 'source.zip');
      logger.info(`Downloading to temporary file: ${tempPath}`);
      
      const response = await fetch(sourceUrl, {
        headers: {
          'User-Agent': this.userAgent
        },
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download source: ${response.statusText}`);
      }
      
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      let downloaded = 0;
      const stream = response.body;
      
      if (!stream) {
        throw new Error('No response body');
      }
      
      const reader = stream.getReader();
      const { createWriteStream } = await import('fs');
      const writer = createWriteStream(tempPath);
      const hash = createHash('sha256');
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          writer.write(value);
          hash.update(value);
          downloaded += value.length;
          
          if (options.onProgress && contentLength > 0) {
            const progress = Math.round((downloaded / contentLength) * 100);
            options.onProgress(progress);
          }
        }
      } finally {
        writer.close();
      }
      
      // Verify download
      if (!existsSync(tempPath)) {
        throw new Error('Download failed: temporary file not created');
      }
      
      const stats = await import('fs/promises').then(fs => fs.stat(tempPath));
      logger.info(`Downloaded ${stats.size} bytes`);
      
      // Extract the source code
      try {
        await this.extractSource(tempPath, options.installPath, tagName);
      } catch (extractError) {
        // Clean up on extraction failure
        await rm(tempPath, { force: true });
        throw extractError;
      }
      
      // Clean up temp file
      await rm(tempPath, { force: true });
      
      logger.info('Source download and extraction complete');
      return { 
        success: true, 
        checksum: hash.digest('hex'),
        isSource: true 
      };
    } catch (error) {
      logger.error('Source download failed:', error);
      
      // Clean up partial installation on failure
      try {
        const files = await import('fs/promises').then(fs => fs.readdir(options.installPath));
        if (files.length === 0 || (files.length === 1 && files[0] === 'logs')) {
          await rm(options.installPath, { recursive: true, force: true });
          logger.info('Cleaned up empty installation directory');
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async extractSource(
    zipPath: string,
    targetPath: string,
    tagName: string
  ): Promise<void> {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    logger.info(`Extracting ${entries.length} entries from archive`);
    
    // GitHub archives have a top-level directory
    // Try to auto-detect the prefix from the first entry
    let prefix = '';
    if (entries.length > 0) {
      const firstEntry = entries[0].entryName;
      const match = firstEntry.match(/^[^/]+\//); // Match first directory
      if (match) {
        prefix = match[0];
        logger.info(`Detected archive prefix: "${prefix}"`);
      }
    }
    
    // Fallback prefixes if auto-detection fails
    if (!prefix) {
      // Try different prefix patterns
      const possiblePrefixes = [
        `promptliano-${tagName}/`,
        `Promptliano-${tagName}/`,
        `promptliano-${tagName.replace('v', '')}/`,
        `Promptliano-${tagName.replace('v', '')}/`
      ];
      
      for (const testPrefix of possiblePrefixes) {
        if (entries.some(e => e.entryName.startsWith(testPrefix))) {
          prefix = testPrefix;
          logger.info(`Using prefix: "${prefix}"`);
          break;
        }
      }
    }
    
    let extractedCount = 0;
    
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      
      const entryName = entry.entryName;
      let relativePath = entryName;
      
      // Remove the prefix if it exists
      if (prefix && entryName.startsWith(prefix)) {
        relativePath = entryName.slice(prefix.length);
      }
      
      // Skip if the relative path is empty (root directory entry)
      if (!relativePath) continue;
      
      const fullPath = join(targetPath, relativePath);
      
      try {
        // Ensure directory exists
        await mkdir(dirname(fullPath), { recursive: true });
        
        // Extract file
        const content = entry.getData();
        await writeFile(fullPath, content);
        extractedCount++;
        
        // Log important files
        if (relativePath === 'package.json' || relativePath.includes('package.json')) {
          logger.info(`Extracted: ${relativePath} to ${fullPath}`);
        }
      } catch (error) {
        logger.error(`Failed to extract ${entryName}:`, error);
      }
    }
    
    logger.info(`Successfully extracted ${extractedCount} files`);
    
    // Validate extraction
    const packageJsonPath = join(targetPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('Extraction failed: package.json not found in extracted files');
    }
  }
}

