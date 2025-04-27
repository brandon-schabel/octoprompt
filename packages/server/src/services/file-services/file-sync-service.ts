import { join, extname, resolve, relative } from 'node:path';
import { readdirSync, readFileSync, statSync, Dirent } from 'node:fs'; // Removed existsSync as it wasn't used
import { db } from "@/utils/database";
// Import Project type from the single source of truth
import { resolvePath, normalizePathForDb as normalizePathForDbUtil } from '@/utils/path-utils';
import { Project } from 'shared/src/schemas/project.schemas';

// --- Constants (ALLOWED_EXTENSIONS, DEFAULT_EXCLUSIONS) remain the same ---
export const ALLOWED_EXTENSIONS = [
  // Documentation & Config
  '.md', 'mdc', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.conf', '.config',

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
  'pnpm-lock.yaml',
  'package-lock.json',

  // Python
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  '*.pyc',
  '*.pyo',
  '*.pyd',
  '.Python',
  'build',
  'develop-eggs',
  'dist',
  'downloads',
  'eggs',
  '.eggs',
  'lib',
  'lib64',
  'parts',
  'sdist',
  'var',
  'wheels',
  'share/python-wheels',
  '*.egg-info',
  '.installed.cfg',
  '*.egg',
  'MANIFEST',
  'pip-log.txt',
  'pip-delete-this-directory.txt',
  'htmlcov',
  '.tox',
  '.nox',
  '.coverage',
  '.coverage.*',
  '.cache',
  'nosetests.xml',
  'coverage.xml',
  '*.cover',
  '*.py,cover',
  '.hypothesis',
  '.pybuilder',
  'target',
  'profile_default',
  'ipython_config.py',
  'pipenv.lock',
  'poetry.lock',

  // Ruby
  '.bundle',
  'vendor/bundle',
  'log',
  'tmp',
  '.byebug_history',
  'Gemfile.lock',
  'coverage',
  '.rvmrc',
  '.rbenv-version',

  // Go
  'vendor',
  '*.exe',
  '*.test',
  '*.out',

  // Rust
  'target',
  'Cargo.lock',

  // Java/Scala/Kotlin
  '*.class',
  '*.jar',
  '*.war',
  '*.ear',
  'hs_err_pid*',
  '.gradle',
  'build',
  '.idea/libraries', // Common IDE files
  '*.iml',           // Common IDE files

  // .NET
  '[Bb]in',
  '[Oo]bj',
  '.vs',

  // PHP
  'vendor',
  'composer.lock',

  // General Build/Dist
  'dist',
  'build',
  'out',
  'bin',
  'obj',
  'release',
  'Debug',
  'Release',
  'debug', // lowercase variants

  // OS Generated
  '.DS_Store',
  'Thumbs.db',
  '.Spotlight-V100',
  '.Trashes',
  'ehthumbs.db',
  'Desktop.ini',

  // Git
  '.git', // Exclude the git directory itself

  // IDE/Editor specific
  '.idea',
  '.vscode',
  '*.sublime-project',
  '*.sublime-workspace',
  '.project', // Eclipse
  '.classpath', // Eclipse
  '.settings', // Eclipse
  'nbproject', // Netbeans

  // Coverage & Test Reports
  'coverage',
  '.nyc_output',
  '.coverage',
  'htmlcov', // Already listed but good to have
  'lcov.info',
  'test-results',
  'junit.xml',

  // Docker build context related
  '.dockerignore', // Usually specifies more exclusions
  '.docker',
  'docker-compose.override.yml',

  // Secrets / Sensitive Keys (common patterns)
  '*.pem',
  '*.key',
  '*.crt',
  '*.p12',
  '*.pfx',
  '*.asc',
  'private.key',
  'public.key',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  '*.env.local',
  '.env.*.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
  'secrets.yml',
  'credentials.json',

  // Temporary & Backup Files
  '*.tmp',
  '*.temp',
  '*.swp', // Vim swap files
  '*~',    // Emacs/Vim backup files
  '*.bak',
  '*.old',
  '*.orig',
  '*.rej', // Patch rejection files
  '.#*',   // Emacs lock files

  // Cache Directories (common frameworks/tools)
  '.cache',
  '.npm/_cacache',
  '.yarn/cache',
  '.pnpm-store',
  '.parcel-cache',
  '.eslintcache',
  '.stylelintcache',
  '.prettiercache',
  '.sass-cache',
  '.webpack', // Might be project-specific cache
  '.rollup.cache',
  '.turbo',
  '.angular/cache',
  '.next', // Next.js build output/cache
  '.nuxt', // Nuxt.js build output/cache
  '.svelte-kit', // SvelteKit build output/cache

  // Misc
  '*.log',
  '.vagrant',
  '.terraform',
  '.terragrunt-cache',
  '*.tfstate',
  '*.tfstate.backup',
  '.metals', // Scala Metals LSP cache
  '.bloop',  // Bloop Scala build server cache
  '.stack-work', // Haskell Stack build cache
  '.cabal-sandbox', // Haskell Cabal sandbox
  '.direnv', // direnv environment cache
  '.clj-kondo/.cache', // Clojure Kondo linter cache
  'db.sqlite3', // Common Django default DB name
  'db.sqlite3-journal',
  '*.db', // General DB files (use with caution)
  '*.db-journal',
  '*.rdb', // Redis dump file
  '.pyre/', // Pyre type checker cache
  'cython_debug', // Cython debug files
];


// --- Utility functions (normalizePathForDb, computeChecksum, isValidChecksum, isExcluded, getTextFiles) remain the same ---
export function normalizePathForDb(pathStr: string): string {
  return normalizePathForDbUtil(pathStr);
}

export function computeChecksum(content: string): string {
  // Consider using a more robust/standard hashing algorithm if needed, but Bun.hash is fast.
  // Potentially use crypto module for SHA-256 for better collision resistance if critical.
  // import { createHash } from 'node:crypto';
  // return createHash('sha256').update(content).digest('hex');
  return Bun.hash(content).toString(16);
}

export function isValidChecksum(checksum: string | null): boolean {
  return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}

export function isExcluded(name: string, exclusions: string[]): boolean {
  // This simple check might not handle complex glob patterns or nested paths correctly.
  // Consider using a library like 'micromatch' or 'ignore' for more robust .gitignore-style pattern matching.
  return exclusions.some(pattern => {
    if (pattern.includes('*')) {
      // Basic wildcard matching, might need refinement for paths
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
    // Check if directory exists before reading
    if (!statSync(dir).isDirectory()) {
      console.warn(`[FileSync] Path is not a directory or doesn't exist: ${dir}`);
      return [];
    }
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error: any) {
    // Log specific error
    console.error(`[FileSync] Error reading directory ${dir}: ${error.message}`);
    return []; // Return empty array on error (e.g., permission denied)
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const entryName = entry.name; // Use entry name for exclusion checks

    if (isExcluded(entryName, exclusions)) {
      continue;
    }

    if (entry.isDirectory()) {
      filesFound.push(...getTextFiles(fullPath, exclusions, allowedExtensions));
    } else if (entry.isFile()) { // Explicitly check if it's a file
      // Check against allowed extensions OR if the exact filename is allowed (e.g., 'Dockerfile')
      const extension = extname(entryName);
      if (allowedExtensions.includes(extension) || allowedExtensions.includes(entryName)) {
        try {
          // Optional: Basic check to avoid excessively large files if needed
          // const stats = statSync(fullPath);
          // const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB example limit
          // if (stats.size > MAX_FILE_SIZE) {
          //     console.warn(`[FileSync] Skipping large file: ${fullPath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
          //     continue;
          // }
          filesFound.push(fullPath);
        } catch (statError: any) {
          // Handle error getting stats if necessary (e.g., file removed between readdir and stat)
          console.error(`[FileSync] Error stating file ${fullPath}: ${statError.message}`);
        }
      }
    }
    // Silently ignore other entry types (symlinks, sockets, etc.) for now
  }
  return filesFound;
}

/**
 * Synchronizes a specific set of absolute file paths with the database for a given project.
 * Handles inserts, updates (based on checksum), and deletions.
 */
export async function syncFileSet(project: Project, absoluteProjectPath: string, absoluteFilePaths: string[]): Promise<void> {
  console.log(`[FileSync] Starting sync for project ${project.id} (${project.name}) with ${absoluteFilePaths.length} files.`);
  const dbTransaction = db.transaction(async (filesToProcess: string[]) => {
    // Prepare statements once for efficiency within the transaction
    const selectStmt = db.prepare<any, [string, string]>(`
            SELECT id, checksum FROM files
            WHERE project_id = ? AND path = ?
            LIMIT 1
        `);
    const updateStmt = db.prepare<any, [string, string, number, string, string]>(`
            UPDATE files
            SET content = ?, extension = ?, size = ?, checksum = ?, updated_at = strftime('%s', 'now') * 1000
            WHERE id = ?
        `); // RETURNING * removed - not needed here
    const insertStmt = db.prepare<any, [string, string, string, string, number, string, string]>(`
            INSERT INTO files (project_id, name, path, extension, size, content, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
        `); // RETURNING * removed - not needed here

    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0; // Count files skipped due to unchanged checksum

    // 1) Insert or update for each real file on disk
    for (const filePath of filesToProcess) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        // Normalize path for DB consistency (e.g., using '/')
        const relativePath = normalizePathForDb(relative(absoluteProjectPath, filePath));
        const fileName = relativePath.split('/').pop() ?? ''; // Basic name extraction
        const extension = extname(fileName) || (fileName.startsWith('.') ? fileName : ''); // Handle dotfiles like .gitignore
        const size = statSync(filePath).size;
        const checksum = computeChecksum(content);

        // Use looser typing for raw DB result
        const existingFile = selectStmt.get(project.id, relativePath) as { id: string; checksum: string | null; } | undefined;

        if (existingFile) {
          // Update only if checksum is different or was previously invalid/null
          if (!isValidChecksum(existingFile.checksum) || existingFile.checksum !== checksum) {
            updateStmt.run(content, extension, size, checksum, existingFile.id);
            updatedCount++;
          } else {
            skippedCount++; // File exists and checksum matches, skip update
          }
        } else {
          // Insert new file record
          insertStmt.run(
            project.id,
            fileName,
            relativePath,
            extension,
            size,
            content,
            checksum
          );
          insertedCount++;
        }
      } catch (fileError: any) {
        console.error(`[FileSync] Error processing file ${filePath}: ${fileError.message}. Skipping file.`);
        // Decide if the whole transaction should fail or just skip this file
      }
    }
    console.log(`[FileSync] Processed files - Inserted: ${insertedCount}, Updated: ${updatedCount}, Skipped (Unchanged): ${skippedCount}`);

    // 2) Handle deletions in a single batch operation
    const currentFilePathsSet = new Set(
      filesToProcess.map(fp => normalizePathForDb(relative(absoluteProjectPath, fp)))
    );

    // Fetch only paths and IDs from DB for efficiency
    const dbFiles = db.prepare<{ path: string; id: string }, [string]>(`
            SELECT id, path FROM files
            WHERE project_id = ?
        `).all(project.id);

    const filesToDelete = dbFiles.filter(dbFile =>
      // Ensure comparison uses normalized paths
      !currentFilePathsSet.has(normalizePathForDb(dbFile.path))
    );

    if (filesToDelete.length > 0) {
      console.log(`[FileSync] Deleting ${filesToDelete.length} files from DB that no longer exist on disk.`);
      const placeholders = filesToDelete.map(() => '?').join(', ');
      const deleteStmt = db.prepare(`
                DELETE FROM files
                WHERE id IN (${placeholders})
            `); // RETURNING * removed - not needed here
      deleteStmt.run(...filesToDelete.map(f => f.id));
    } else {
      console.log(`[FileSync] No files needed deletion from DB.`);
    }

  }); // End of transaction function

  try {
    await dbTransaction(absoluteFilePaths); // Execute the transaction
    console.log(`[FileSync] Successfully completed sync for project ${project.id}.`);
  } catch (error) {
    console.error(`[FileSync] Error during sync transaction for project ${project.id}:`, error);
    // Rethrow or handle the error appropriately
    throw new Error(`Sync failed for project ${project.id}`);
  }
}

/**
 * Synchronizes all allowed text files in a project's directory with the database.
 */
export async function syncProject(project: Project, exclusions: string[] = DEFAULT_EXCLUSIONS): Promise<void> {
  try {
    const absoluteProjectPath = resolvePath(project.path); // Handles ~ and resolves to absolute
    if (!statSync(absoluteProjectPath).isDirectory()) {
      console.error(`[FileSync] Project path is not a valid directory: ${absoluteProjectPath}`);
      throw new Error(`Project path is not a valid directory: ${project.path}`);
    }
    console.log(`[FileSync] Starting full sync for project '${project.name}' (${project.id}) at path: ${absoluteProjectPath}`);
    const projectFiles = getTextFiles(absoluteProjectPath, exclusions, ALLOWED_EXTENSIONS);
    console.log(`[FileSync] Found ${projectFiles.length} files to potentially sync.`);
    await syncFileSet(project, absoluteProjectPath, projectFiles);
  } catch (error: any) {
    console.error(`[FileSync] Failed to sync project ${project.id} (${project.name}): ${error.message}`);
    // Optionally rethrow or handle differently
    throw error;
  }
}

/**
 * Synchronizes allowed text files within a specific subfolder of a project.
 * Also removes database entries for files that were previously in this folder but are now gone.
 */
export async function syncProjectFolder(project: Project, folderPath: string, exclusions: string[] = DEFAULT_EXCLUSIONS): Promise<void> {
  try {
    const absoluteProjectPath = resolvePath(project.path);
    const absoluteFolderToSync = resolve(absoluteProjectPath, folderPath); // Resolve subfolder path

    if (!statSync(absoluteFolderToSync).isDirectory()) {
      console.error(`[FileSync] Folder path is not a valid directory: ${absoluteFolderToSync}`);
      throw new Error(`Folder path is not a valid directory: ${folderPath}`);
    }

    console.log(`[FileSync] Starting sync for folder '${folderPath}' in project '${project.name}' (${project.id}) at path: ${absoluteFolderToSync}`);
    const folderFiles = getTextFiles(absoluteFolderToSync, exclusions, ALLOWED_EXTENSIONS);
    console.log(`[FileSync] Found ${folderFiles.length} files in folder ${folderPath} to potentially sync.`);

    // Sync the files found within the folder (handles updates/inserts)
    await syncFileSet(project, absoluteProjectPath, folderFiles); // Use absoluteProjectPath for relative path calculation

    // --- Deletion logic specific to the folder ---
    // Fetch IDs and paths of all files currently in the DB *for this project* that *start with the target folder path*
    const normalizedDbFolderPath = normalizePathForDb(folderPath); // Normalize folder path once
    const dbFilesInFolder = db.prepare<{ id: string; path: string }, [string, string]>(`
            SELECT id, path FROM files
            WHERE project_id = ? AND path LIKE ? -- Use LIKE for path prefix matching
        `).all(project.id, `${normalizedDbFolderPath}%`); // Use % wildcard

    // Create a set of normalized relative paths for files currently existing *on disk* within the folder
    const currentFolderPathsSet = new Set(
      folderFiles.map(fp => normalizePathForDb(relative(absoluteProjectPath, fp)))
    );

    // Find files that are in the DB under this folder path but NOT currently on disk in this folder
    const filesToDelete = dbFilesInFolder.filter(dbFile =>
      // dbFile.path is already normalized if inserted correctly
      !currentFolderPathsSet.has(dbFile.path) // Direct comparison should work if paths are consistently normalized
    );

    if (filesToDelete.length > 0) {
      console.log(`[FileSync] Deleting ${filesToDelete.length} files from DB previously in folder '${folderPath}' but now removed.`);
      const placeholders = filesToDelete.map(() => '?').join(', ');
      const deleteStmt = db.prepare(`
                DELETE FROM files
                WHERE id IN (${placeholders})
            `); // RETURNING removed
      deleteStmt.run(...filesToDelete.map(f => f.id));
    } else {
      console.log(`[FileSync] No files needed deletion from DB for folder '${folderPath}'.`);
    }
    console.log(`[FileSync] Successfully completed sync for folder '${folderPath}' in project ${project.id}.`);

  } catch (error: any) {
    console.error(`[FileSync] Failed to sync folder '${folderPath}' for project ${project.id} (${project.name}): ${error.message}`);
    // Optionally rethrow or handle differently
    throw error;
  }
}