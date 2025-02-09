import { join, extname, resolve, relative } from 'node:path';
import { readdirSync, readFileSync, statSync, Dirent } from 'node:fs';
import { schema } from 'shared';
import { db, eq, and, inArray } from "@db";

export const ALLOWED_EXTENSIONS = [
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

const { files } = schema;
type Project = schema.Project;

export function normalizePathForDb(pathStr: string): string {
  return pathStr.replace(/\\/g, '/');
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

      const [existingFile] = await db.select()
        .from(files)
        .where(
          and(
            eq(files.projectId, project.id),
            eq(files.path, relativePath)
          )
        )
        .limit(1);

      if (existingFile) {
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

  // 2) Optionally remove from DB any file that no longer exists on disk
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

export async function syncProject(project: Project, exclusions: string[] = DEFAULT_EXCLUSIONS): Promise<void> {
  const absoluteProjectPath = resolve(project.path);
  const projectFiles = getTextFiles(absoluteProjectPath, exclusions);
  await syncFileSet(project, absoluteProjectPath, projectFiles);
}

export async function syncProjectFolder(project: Project, folderPath: string, exclusions: string[] = DEFAULT_EXCLUSIONS): Promise<void> {
  const absoluteProjectPath = resolve(project.path);
  const absoluteFolderToSync = resolve(project.path, folderPath);
  const folderFiles = getTextFiles(absoluteFolderToSync, exclusions);

  await syncFileSet(project, absoluteProjectPath, folderFiles);

  // Optionally remove DB records for files no longer in this subfolder
  const dbFilesInFolder = await db.select().from(files).where(eq(files.projectId, project.id));
  const folderPathsSet = new Set(folderFiles.map(fp =>
    normalizePathForDb(relative(absoluteProjectPath, fp))
  ));
  const toDelete = dbFilesInFolder.filter(dbFile =>
    normalizePathForDb(dbFile.path).startsWith(normalizePathForDb(folderPath)) &&
    !folderPathsSet.has(normalizePathForDb(dbFile.path))
  );
  if (toDelete.length > 0) {
    await db.delete(files).where(inArray(files.id, toDelete.map(td => td.id)));
  }
}