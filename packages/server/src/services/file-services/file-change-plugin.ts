import { createFileChangeWatcher, FileChangeEvent } from './file-change-watcher';
import { getProjectFiles } from '../project-service';
import { schema } from 'shared';
import { resolve, relative } from 'node:path';
import { websocketStateAdapter } from '@/utils/websocket/websocket-state-adapter';
import { summarizeFiles } from './file-summary-service';
import { syncProject } from './file-sync-service';

type Project = schema.Project;

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

                    const absoluteProjectPath = resolve(project.path);
                    const relPath = relative(absoluteProjectPath, changedFilePath);
                    const updatedFile = allFiles.find((f) => f.path === relPath);
                    if (!updatedFile) {
                        return;
                    }
                    const globalState = await websocketStateAdapter.getState();
                    await summarizeFiles(
                        project.id,
                        [updatedFile],
                        globalState
                    );
                } catch (err) {
                    console.error('[FileChangePlugin] Error handling file change:', err);
                }
            },
        });

        watcher.startWatching({
            directory: project.path,
            ignorePatterns,
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