import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

export interface MigrationConfig {
  version: string
  description: string
  up: () => Promise<void>
  down?: () => Promise<void>
}

const MigrationStateSchema = z.object({
  currentVersion: z.string(),
  migrations: z.array(z.object({
    version: z.string(),
    description: z.string(),
    appliedAt: z.number(),
    success: z.boolean(),
    error: z.string().optional()
  }))
})

type MigrationState = z.infer<typeof MigrationStateSchema>

export class MigrationManager {
  private migrations: Map<string, MigrationConfig> = new Map()
  private statePath: string

  constructor(private basePath: string) {
    this.statePath = path.join(basePath, 'data', '.migration-state.json')
  }

  /**
   * Register a migration
   */
  register(migration: MigrationConfig): void {
    if (this.migrations.has(migration.version)) {
      throw new Error(`Migration ${migration.version} already registered`)
    }
    this.migrations.set(migration.version, migration)
  }

  /**
   * Get current migration state
   */
  async getState(): Promise<MigrationState> {
    try {
      const content = await fs.readFile(this.statePath, 'utf-8')
      const data = JSON.parse(content)
      return MigrationStateSchema.parse(data)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // No migration state exists yet
        return {
          currentVersion: '0.0.0',
          migrations: []
        }
      }
      throw new Error(`Failed to read migration state: ${error.message}`)
    }
  }

  /**
   * Save migration state
   */
  private async saveState(state: MigrationState): Promise<void> {
    const dir = path.dirname(this.statePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8')
  }

  /**
   * Run pending migrations
   */
  async migrate(targetVersion?: string): Promise<void> {
    const state = await this.getState()
    const sortedMigrations = this.getSortedMigrations()
    
    console.log(`Current version: ${state.currentVersion}`)
    
    for (const migration of sortedMigrations) {
      // Skip if already applied
      if (this.compareVersions(migration.version, state.currentVersion) <= 0) {
        continue
      }

      // Skip if past target version
      if (targetVersion && this.compareVersions(migration.version, targetVersion) > 0) {
        continue
      }

      console.log(`Running migration ${migration.version}: ${migration.description}`)
      
      const startTime = Date.now()
      try {
        await migration.up()
        
        state.migrations.push({
          version: migration.version,
          description: migration.description,
          appliedAt: Date.now(),
          success: true
        })
        state.currentVersion = migration.version
        
        await this.saveState(state)
        
        const duration = Date.now() - startTime
        console.log(`✓ Migration ${migration.version} completed in ${duration}ms`)
      } catch (error: any) {
        console.error(`✗ Migration ${migration.version} failed: ${error.message}`)
        
        state.migrations.push({
          version: migration.version,
          description: migration.description,
          appliedAt: Date.now(),
          success: false,
          error: error.message
        })
        
        await this.saveState(state)
        throw error
      }
    }
    
    console.log(`Migrations complete. Current version: ${state.currentVersion}`)
  }

  /**
   * Rollback to a specific version
   */
  async rollback(targetVersion: string): Promise<void> {
    const state = await this.getState()
    
    if (this.compareVersions(targetVersion, state.currentVersion) >= 0) {
      console.log(`Already at or below version ${targetVersion}`)
      return
    }

    const appliedMigrations = state.migrations
      .filter(m => m.success)
      .sort((a, b) => this.compareVersions(b.version, a.version))

    for (const applied of appliedMigrations) {
      if (this.compareVersions(applied.version, targetVersion) <= 0) {
        break
      }

      const migration = this.migrations.get(applied.version)
      if (!migration?.down) {
        throw new Error(`Migration ${applied.version} does not support rollback`)
      }

      console.log(`Rolling back migration ${applied.version}: ${applied.description}`)
      
      try {
        await migration.down()
        
        // Remove from applied migrations
        state.migrations = state.migrations.filter(m => m.version !== applied.version)
        
        // Update current version
        const remaining = state.migrations.filter(m => m.success)
        state.currentVersion = remaining.length > 0 
          ? remaining[remaining.length - 1].version 
          : '0.0.0'
        
        await this.saveState(state)
        
        console.log(`✓ Rolled back migration ${applied.version}`)
      } catch (error: any) {
        console.error(`✗ Rollback of ${applied.version} failed: ${error.message}`)
        throw error
      }
    }
    
    console.log(`Rollback complete. Current version: ${state.currentVersion}`)
  }

  /**
   * Get migration status
   */
  async status(): Promise<void> {
    const state = await this.getState()
    const allMigrations = this.getSortedMigrations()
    
    console.log(`\nMigration Status`)
    console.log(`Current Version: ${state.currentVersion}\n`)
    
    for (const migration of allMigrations) {
      const applied = state.migrations.find(m => m.version === migration.version)
      
      if (applied) {
        const status = applied.success ? '✓' : '✗'
        const date = new Date(applied.appliedAt).toLocaleString()
        console.log(`${status} ${migration.version} - ${migration.description} (${date})`)
        if (applied.error) {
          console.log(`  Error: ${applied.error}`)
        }
      } else {
        const isPending = this.compareVersions(migration.version, state.currentVersion) > 0
        const status = isPending ? '○' : '-'
        console.log(`${status} ${migration.version} - ${migration.description}`)
      }
    }
  }

  /**
   * Get sorted migrations
   */
  private getSortedMigrations(): MigrationConfig[] {
    return Array.from(this.migrations.values())
      .sort((a, b) => this.compareVersions(a.version, b.version))
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string) => {
      const parts = v.split('.').map(p => parseInt(p, 10))
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
      }
    }

    const vA = parseVersion(a)
    const vB = parseVersion(b)

    if (vA.major !== vB.major) return vA.major - vB.major
    if (vA.minor !== vB.minor) return vA.minor - vB.minor
    return vA.patch - vB.patch
  }

  /**
   * Create a data backup before migrations
   */
  async backup(backupName?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = backupName || `backup-${timestamp}`
    const backupDir = path.join(this.basePath, 'backups', name)
    const dataDir = path.join(this.basePath, 'data')

    await fs.mkdir(backupDir, { recursive: true })

    // Copy all data files
    await this.copyDirectory(dataDir, backupDir)

    console.log(`Backup created at: ${backupDir}`)
    return backupDir
  }

  /**
   * Restore from a backup
   */
  async restore(backupPath: string): Promise<void> {
    const dataDir = path.join(this.basePath, 'data')
    
    // Verify backup exists
    try {
      await fs.access(backupPath)
    } catch {
      throw new Error(`Backup not found: ${backupPath}`)
    }

    // Create temporary backup of current data
    const tempBackup = await this.backup('temp-restore')

    try {
      // Clear current data directory
      await fs.rm(dataDir, { recursive: true, force: true })
      await fs.mkdir(dataDir, { recursive: true })

      // Restore from backup
      await this.copyDirectory(backupPath, dataDir)

      console.log(`Restored from backup: ${backupPath}`)
      
      // Clean up temp backup
      await fs.rm(tempBackup, { recursive: true, force: true })
    } catch (error) {
      // Restore failed, try to recover from temp backup
      console.error('Restore failed, attempting to recover...')
      await this.copyDirectory(tempBackup, dataDir)
      throw error
    }
  }

  /**
   * Helper to copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true })
    
    const entries = await fs.readdir(src, { withFileTypes: true })
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }
}