import { createFileChangeWatcher, FileChangeEvent } from './file-change-watcher';
import { getProjectFiles } from '../project-service';
import { Project } from 'shared/src/schemas/project.schemas';
import { relative } from 'node:path';
import { summarizeFiles } from './file-summary-service';
import { syncProject } from './file-sync-service';
import { resolvePath } from '@/utils/path-utils';

export function createFileChangePlugin(
) {
    const watcher = createFileChangeWatcher();

    /**
     * Starts watching a project directory and re-summarizes on changes.
     */
    async function start(project: Project, ignorePatterns: string[] = []): Promise<void> {
        watcher.registerListener({
            onFileChanged: async (event: FileChangeEvent, changedFilePath: string) => {
                try {
                    // Re-sync from disk so DB is updated
                    await syncProject(project);

                    // Summaries
                    const allFiles = await getProjectFiles(project.id);
                    if (!allFiles) return;

                    const absoluteProjectPath = resolvePath(project.path);
                    const relPath = relative(absoluteProjectPath, changedFilePath);
                    const updatedFile = allFiles.find((f) => f.path === relPath);
                    if (!updatedFile) {
                        return;
                    }
                    await summarizeFiles(
                        project.id,
                        [updatedFile],
                    );
                } catch (err) {
                    console.error('[FileChangePlugin] Error handling change:', err);
                }
            }
        });

        const absoluteProjectPath = resolvePath(project.path);
        watcher.startWatching({
            directory: absoluteProjectPath,
            ignorePatterns,
            recursive: true,
        });
    }

    /**
     * Stops the file watcher.
     */
    function stop(): void {
        watcher.stopAll();
    }

    return {
        start,
        stop,
    };
}