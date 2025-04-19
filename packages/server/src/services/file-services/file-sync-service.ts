import { join, extname, resolve, relative } from 'node:path';
import { readdirSync, readFileSync, statSync, Dirent, existsSync } from 'node:fs';
import { db } from "@/utils/database";
import { mapFile, RawFile } from '../project-service';
import { Project } from 'shared/schema';
import { resolvePath, normalizePathForDb as normalizePathForDbUtil } from '@/utils/path-utils';

export const ALLOWED_EXTENSIONS = [
  // Documentation & Config
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.conf', '.config',

  // Web Development
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.cts', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.svg',

  // Backend Development
  '.py', '.rb', '.php', '.java', '.go', '.rs', '.cs', '.cpp', '.c', '.h', '.hpp',

  // Shell & Scripts
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.ps1',

  // Database & Query
  '.sql', '.prisma', '.graphql', '.gql',

  // Other Languages
  '.zig', '.lua', '.r', '.kt', '.swift', '.m', '.mm', '.scala', '.clj', '.ex', '.exs', 'ino',

  // Environment & Version
  '.env', '.env.example', '.python-version', '.nvmrc', '.ruby-version',

  // Docker & Container
  'Dockerfile', '.dockerignore', 'docker-compose.yml',

  // Git
  '.gitignore', '.gitattributes',
];

export const DEFAULT_EXCLUSIONS = [
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


export function normalizePathForDb(pathStr: string): string {
  return normalizePathForDbUtil(pathStr);
}

export function computeChecksum(content: string): string {
  return Bun.hash(content).toString(16);
}

export function isValidChecksum(checksum: string | null): boolean {
  return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}

export function isExcluded(name: string, exclusions: string[]): boolean {
  return exclusions.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(name);
    } else {
      return name === pattern;
    }
  });
}

export function getTextFiles(dir: string, exclusions: string[], allowedExtensions: string[] = ALLOWED_EXTENSIONS): string[] {
  let filesFound: string[] = [];
  let entries: Dirent[];

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (isExcluded(entry.name, exclusions)) {
      continue;
    }

    if (entry.isDirectory()) {
      filesFound.push(...getTextFiles(fullPath, exclusions, allowedExtensions));
    } else {
      if (allowedExtensions.some(ext => entry.name.endsWith(ext))) {
        filesFound.push(fullPath);
      }
    }
  }
  return filesFound;
}

export async function syncFileSet(project: Project, absoluteProjectPath: string, absoluteFilePaths: string[]): Promise<void> {
  // 1) Insert or update for each real file on disk
  await Promise.all(
    absoluteFilePaths.map(async (filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      const relativePath = normalizePathForDb(relative(absoluteProjectPath, filePath));
      const fileName = relativePath.split('/').pop() ?? '';
      const extension = extname(fileName) || '';
      const size = statSync(filePath).size;
      const checksum = computeChecksum(content);

      const existingFile = db.prepare(`
        SELECT * FROM files 
        WHERE project_id = ? AND path = ? 
        LIMIT 1
      `).get(project.id, relativePath) as RawFile | undefined;

      if (existingFile) {
        if (!isValidChecksum(existingFile.checksum) || existingFile.checksum !== checksum) {
          const updateStmt = db.prepare(`
            UPDATE files 
            SET content = ?, extension = ?, size = ?, checksum = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
            RETURNING *
          `);
          const updated = updateStmt.get(content, extension, size, checksum, existingFile.id) as RawFile;
          mapFile(updated); // Validate the update was successful
        }
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO files (project_id, name, path, extension, size, content, checksum) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING *
        `);
        const created = insertStmt.get(
          project.id,
          fileName,
          relativePath,
          extension,
          size,
          content,
          checksum
        ) as RawFile;
        mapFile(created);
      }
    })
  );

  // Handle deletions in a single batch operation
  const existingPaths = new Set(
    absoluteFilePaths.map(fp => normalizePathForDb(relative(absoluteProjectPath, fp)))
  );

  const dbFiles = db.prepare(`
    SELECT * FROM files 
    WHERE project_id = ?
  `).all(project.id) as RawFile[];

  const filesToDelete = dbFiles.filter(dbFile =>
    !existingPaths.has(normalizePathForDb(dbFile.path))
  );

  if (filesToDelete.length > 0) {
    const placeholders = filesToDelete.map(() => '?').join(', ');
    const deleteStmt = db.prepare(`
      DELETE FROM files 
      WHERE id IN (${placeholders})
      RETURNING *
    `);
    const deleted = deleteStmt.all(...filesToDelete.map(f => f.id)) as RawFile[];
    deleted.forEach(mapFile);
  }
}

export async function syncProject(project: Project, exclusions: string[] = DEFAULT_EXCLUSIONS): Promise<void> {
  const absoluteProjectPath = resolvePath(project.path);
  const projectFiles = getTextFiles(absoluteProjectPath, exclusions);
  await syncFileSet(project, absoluteProjectPath, projectFiles);
}

export async function syncProjectFolder(project: Project, folderPath: string, exclusions: string[] = DEFAULT_EXCLUSIONS): Promise<void> {
  const absoluteProjectPath = resolvePath(project.path);
  const absoluteFolderToSync = resolve(absoluteProjectPath, folderPath);
  const folderFiles = getTextFiles(absoluteFolderToSync, exclusions);

  await syncFileSet(project, absoluteProjectPath, folderFiles);

  // Remove DB records for files no longer in this subfolder
  const dbFilesInFolder = db.prepare(`
    SELECT * FROM files 
    WHERE project_id = ?
  `).all(project.id) as RawFile[];

  const folderPathsSet = new Set(folderFiles.map(fp =>
    normalizePathForDb(relative(absoluteProjectPath, fp))
  ));

  const toDelete = dbFilesInFolder.filter(dbFile =>
    normalizePathForDb(dbFile.path).startsWith(normalizePathForDb(folderPath)) &&
    !folderPathsSet.has(normalizePathForDb(dbFile.path))
  );

  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => '?').join(', ');
    const deleteStmt = db.prepare(`
      DELETE FROM files 
      WHERE id IN (${placeholders})
      RETURNING *
    `);
    const deleted = deleteStmt.all(...toDelete.map(td => td.id)) as RawFile[];
    deleted.forEach(mapFile); // Validate the deletes were successful
  }
}