import { join, extname, resolve, relative } from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';

import { type Project } from 'shared';
import { files, eq, and, inArray } from 'shared';
import { db } from "shared/database";

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.python-version', '.toml', '.yaml', '.yml', ];
const DEFAULT_EXCLUSIONS = [
  'node_modules',
  '.npm',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.gradle',
  '.nuget',
  '.cargo',
  '.stack-work',
  '.ccache',
  '.idea',
  '.vscode',
  '*.swp',
  '*~',
  '*.tmp',
  '*.temp',
  '*.bak',
  '*.meta',
  'package-lock.json',
  'dist',
  'build',
  'out',
  'public',
  'node_modules',
  'package-lock.json',
  'dist',
  'build',
  'out',
  'public',
  'client-dist',
  "*.lock",
  "*.lockfile",
  "*.lock.json",
  "*.lock.yaml",
  "*.lock.yml",
];

const customExclusions = process.env.EXCLUDE_PATTERNS
  ? process.env.EXCLUDE_PATTERNS.split(',').map(p => p.trim())
  : [];

const EXCLUSIONS = [...DEFAULT_EXCLUSIONS, ...customExclusions];

/**
 * Hash file content to detect changes. Bun.hash is much faster than rolling our own.
 */
function computeChecksum(content: string): string {
  return Bun.hash(content).toString(16);
}

/**
 * Check if the checksum is a valid hex string.
 */
function isValidChecksum(checksum: string | null): boolean {
  return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}

/**
 * FileSyncService is responsible for:
 * 1. Reading all allowed files from a project directory.
 * 2. Inserting/Updating them in the DB.
 * 3. Removing files from the DB that no longer exist on disk.
 */
export class FileSyncService {
  constructor(
    private exclusions: string[] = EXCLUSIONS
  ) { }

  /**
   * Sync a single project’s file records with its on-disk files.
   */
  public async syncProject(project: Project): Promise<void> {
    // Always resolve the path so we have a stable absolute path to the project folder.
    const absoluteProjectPath = resolve(project.path);

    // 1) Find local text files
    const projectFiles = this.getTextFiles(absoluteProjectPath);

    // 2) Insert or update each file in the DB
    await Promise.all(projectFiles.map(async (filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      // Derive the relative path from the absolute path
      const relativePath = relative(absoluteProjectPath, filePath);
      const fileName = relativePath.split('/').pop() ?? '';
      const extension = extname(fileName) || '';
      const stats = statSync(filePath);
      const size = stats.size;
      const checksum = computeChecksum(content);

      // Check existing DB record
      const [existingFile] = await db.select()
        .from(files)
        .where(and(
          eq(files.projectId, project.id),
          eq(files.path, relativePath)
        ))
        .limit(1);

      if (existingFile) {
        // If existing record's checksum is invalid or different, update
        if (!isValidChecksum(existingFile.checksum) || existingFile.checksum !== checksum) {
          await db.update(files)
            .set({
              content,
              extension,
              size,
              checksum,
              updatedAt: new Date()
            })
            .where(eq(files.id, existingFile.id));
        }
      } else {
        // Insert brand-new record
        await db.insert(files)
          .values({
            projectId: project.id,
            name: fileName,
            path: relativePath,
            extension,
            size,
            content,
            checksum
          });
      }
    }));

    // 3) Clean up DB records for files that no longer exist on disk
    const existingPaths = new Set(
      projectFiles.map(filePath => relative(absoluteProjectPath, filePath))
    );

    const dbFiles = await db.select()
      .from(files)
      .where(eq(files.projectId, project.id));

    // If a DB file’s path is not in existingPaths, it means that file was deleted from disk
    const filesToDelete = dbFiles.filter(file => !existingPaths.has(file.path));

    if (filesToDelete.length > 0) {
      await db.delete(files)
        .where(inArray(
          files.id,
          filesToDelete.map(f => f.id)
        ));
    }
  }

  /**
   * Recursively gather all text-like files from the specified directory (absolute path),
   * ignoring any directory/file name matching configured exclusion patterns.
   */
  private getTextFiles(dir: string): string[] {
    let filesFound: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // If excluded, skip
      if (this.isExcluded(entry.name)) {
        continue;
      }

      // Recurse into subdirectories
      if (entry.isDirectory()) {
        filesFound = filesFound.concat(this.getTextFiles(fullPath));
      } else {
        // If matches one of the allowed text-like file extensions
        if (ALLOWED_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
          filesFound.push(fullPath);
        }
      }
    }

    return filesFound;
  }

  /**
   * Check if a file or directory name (not path) matches the exclusion patterns.
   * Simple wildcard matching supported.
   */
  private isExcluded(name: string): boolean {
    return this.exclusions.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
        );
        return regex.test(name);
      } else {
        return name === pattern;
      }
    });
  }
}