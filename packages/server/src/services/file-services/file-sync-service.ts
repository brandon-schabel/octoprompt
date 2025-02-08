import { join, extname, resolve, relative } from 'node:path';
import { readdirSync, readFileSync, statSync, Dirent } from 'node:fs';
import { type Project } from 'shared';
import { files, eq, and, inArray } from 'shared';
import { db } from "shared/database";

const ALLOWED_EXTENSIONS = [
  // Documentation & Config
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.conf', '.config',

  // Web Development
  '.ts', '.tsx', '.js', '.jsx', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',

  // Backend Development
  '.py', '.rb', '.php', '.java', '.go', '.rs', '.cs', '.cpp', '.c', '.h', '.hpp',

  // Shell & Scripts
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.ps1',

  // Database & Query
  '.sql', '.prisma', '.graphql', '.gql',

  // Other Languages
  '.zig', '.lua', '.r', '.kt', '.swift', '.m', '.mm', '.scala', '.clj', '.ex', '.exs',

  // Environment & Version
  '.env', '.env.example', '.python-version', '.nvmrc', '.ruby-version',

  // Docker & Container
  'Dockerfile', '.dockerignore', 'docker-compose.yml',

  // Git
  '.gitignore', '.gitattributes',
];

const DEFAULT_EXCLUSIONS = [
  // Node
  'node_modules',
  '.npm',
  'yarn.lock',
  // plus many more patterns omitted for brevity...
  'poetry.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'dist',
  'build',
  'drizzle',
  // Coverage & Test
  'coverage',
  '.nyc_output',
  '.coverage',
  'htmlcov',
  '.hypothesis',

  // Docker
  '.docker',
  'docker-compose.override.yml',

  // Environment & secrets
  '.env.local',
  '.env.*.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
  '*.pem',
  '*.key',
  '*.cert',

  // Cache directories
  '.cache',
  '.parcel-cache',
  '.eslintcache',
  '.stylelintcache',
  '.prettiercache',
  '.sass-cache',
  '.webpack',
  '.rollup.cache',
  '.turbo',

  // Temporary & backup
  'temp',
  'tmp',
  '*.swp',
  '*~',
  '*.bak',
  '*.orig',
  '*.rej',
  '.stack-work',
  '.ccache',

];

// Normalize paths for DB storage to avoid OS-specific slash issues
function normalizePathForDb(path: string): string {
  return path.replace(/\\/g, '/');
}

function computeChecksum(content: string): string {
  return Bun.hash(content).toString(16);
}

function isValidChecksum(checksum: string | null): boolean {
  return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}

export class FileSyncService {
  constructor(
    private exclusions: string[] = [...DEFAULT_EXCLUSIONS, /* ...customExclusions, etc... */]
  ) { }

  public async syncProject(project: Project): Promise<void> {
    const absoluteProjectPath = resolve(project.path);

    // Gather all text files from project path
    const projectFiles = this.getTextFiles(absoluteProjectPath);
    // Sync them
    await this.syncFileSet(project, absoluteProjectPath, projectFiles);
  }

  public async syncProjectFolder(project: Project, folderPath: string): Promise<void> {
    const absoluteProjectPath = resolve(project.path);
    const absoluteFolderToSync = resolve(project.path, folderPath);

    // Gather only the text files within that subfolder
    const folderFiles = this.getTextFiles(absoluteFolderToSync);

    await this.syncFileSet(project, absoluteProjectPath, folderFiles);

    // Optionally remove DB records that no longer exist in that subfolder
    // (If you do NOT want to remove them, omit these lines)
    const dbFilesInFolder = await db.select().from(files).where(eq(files.projectId, project.id));
    const relevantDBFiles = dbFilesInFolder.filter(dbFile =>
      normalizePathForDb(dbFile.path).startsWith(normalizePathForDb(folderPath))
    );
    const folderPathsSet = new Set(folderFiles.map(fp =>
      normalizePathForDb(relative(absoluteProjectPath, fp))
    ));
    const toDelete = relevantDBFiles.filter(dbFile => !folderPathsSet.has(normalizePathForDb(dbFile.path)));
    if (toDelete.length > 0) {
      await db.delete(files).where(inArray(files.id, toDelete.map(td => td.id)));
    }
  }

  /**
   * Syncs a given set of absoluteFilePaths with the DB: Upsert new or changed files,
   * optionally remove those that don't exist anymore.
   */
  private async syncFileSet(
    project: Project,
    absoluteProjectPath: string,
    absoluteFilePaths: string[]
  ): Promise<void> {
    // 1) Insert or update for each real file on disk
    await Promise.all(
      absoluteFilePaths.map(async (filePath) => {
        const content = readFileSync(filePath, 'utf-8');
        // Normalize the relative path for DB
        const relativePath = normalizePathForDb(
          relative(absoluteProjectPath, filePath)
        );
        const fileName = relativePath.split('/').pop() ?? '';
        const extension = extname(fileName) || '';
        const size = statSync(filePath).size;
        const checksum = computeChecksum(content);

        // Try to find an existing DB record matching this path
        const [existingFile] = await db.select()
          .from(files)
          .where(
            and(
              eq(files.projectId, project.id),
              eq(files.path, relativePath) // must match the normalized path
            )
          )
          .limit(1);

        if (existingFile) {
          // If the checksums differ, update content, size, etc. (but keep the same file ID)
          if (!isValidChecksum(existingFile.checksum) || existingFile.checksum !== checksum) {
            await db.update(files)
              .set({
                content,
                extension,
                size,
                checksum,
                updatedAt: new Date()
              })
              .where(eq(files.id, existingFile.id))
              .run();
          }
        } else {
          // Insert a brand-new record
          await db.insert(files)
            .values({
              projectId: project.id,
              name: fileName,
              path: relativePath,
              extension,
              size,
              content,
              checksum
            })
            .run();
        }
      })
    );

    // 2) Optionally remove from DB any file that no longer exists on disk.
    //    If you want to KEEP the old files in the DB (and keep their summaries),
    //    then comment this out or handle it differently.
    const existingPaths = new Set(
      absoluteFilePaths.map(fp => normalizePathForDb(relative(absoluteProjectPath, fp)))
    );

    const dbFiles = await db.select()
      .from(files)
      .where(eq(files.projectId, project.id));

    const filesToDelete = dbFiles.filter(dbFile =>
      !existingPaths.has(normalizePathForDb(dbFile.path))
    );

    if (filesToDelete.length > 0) {
      await db.delete(files)
        .where(inArray(files.id, filesToDelete.map(f => f.id)));
    }
  }

  /**
   * Recursively gather text-like files from the specified directory,
   * skipping excluded directories / patterns.
   */
  private getTextFiles(dir: string): string[] {
    let filesFound: string[] = [];
    let entries: Dirent[];

    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // Could not read directory (permission issue, etc.)
      return [];
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // If excluded, skip
      if (this.isExcluded(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        filesFound.push(...this.getTextFiles(fullPath));
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
        // Convert wildcard to a basic regex
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