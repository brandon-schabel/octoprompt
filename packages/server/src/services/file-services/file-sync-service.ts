import { join, extname } from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';

import { type Project } from 'shared';
import { files, eq, and, inArray } from 'shared';
import { db } from "shared/database";

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.json'];
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
];

const customExclusions = process.env.EXCLUDE_PATTERNS
  ? process.env.EXCLUDE_PATTERNS.split(',').map(p => p.trim())
  : [];

const EXCLUSIONS = [...DEFAULT_EXCLUSIONS, ...customExclusions];

export class FileSyncService {
  constructor(
    private exclusions: string[] = EXCLUSIONS
  ) { }

  public async syncProject(project: Project): Promise<void> {
    const projectPath = project.path;
    const projectFiles = this.getTextFiles(projectPath);

    await Promise.all(projectFiles.map(async (filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      const relativePath = filePath.replace(projectPath, '').replace(/^\//, '');
      const fileName = relativePath.split('/').pop() || '';
      const extension = extname(fileName) || '';
      const stats = statSync(filePath);
      const size = stats.size;

      const [existingFile] = await db.select()
        .from(files)
        .where(and(
          eq(files.projectId, project.id),
          eq(files.path, relativePath)
        ))
        .limit(1);

      if (existingFile) {
        // Update existing file if content or metadata changed
        await db.update(files)
          .set({
            content,
            extension,
            size,
            updatedAt: new Date()
          })
          .where(eq(files.id, existingFile.id));
      } else {
        // Insert new file
        await db.insert(files)
          .values({
            projectId: project.id,
            name: fileName,
            path: relativePath,
            extension,
            size,
            content
          });
      }
    }));

    // Clean up deleted files
    const existingPaths = new Set(projectFiles.map(
      filePath => filePath.replace(projectPath, '').replace(/^\//, '')
    ));

    const dbFiles = await db.select()
      .from(files)
      .where(eq(files.projectId, project.id));

    const filesToDelete = dbFiles.filter(file => !existingPaths.has(file.path));
    if (filesToDelete.length > 0) {
      await db.delete(files)
        .where(inArray(
          files.id,
          filesToDelete.map(f => f.id)
        ));
    }
  }

  private getTextFiles(dir: string): string[] {
    let filesFound: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (this.isExcluded(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        filesFound = filesFound.concat(this.getTextFiles(fullPath));
      } else {
        if (ALLOWED_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
          filesFound.push(fullPath);
        }
      }
    }

    return filesFound;
  }

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