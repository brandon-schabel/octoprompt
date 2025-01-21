import { FileChangePlugin } from './file-change-plugin';
import { FileSummaryService } from './file-summary-service';
import { FileSyncService } from './file-sync-service';
import { Project } from 'shared';
import { ProjectService } from '../project-service';

// DRIZZLE IMPORTS FOR DB CLEANUP:
import { db } from 'shared/database';
import { files, eq } from 'shared';

import { existsSync } from 'node:fs';

/**
 * The WatchersManager ensures each project has a FileChangePlugin
 * that keeps the DB in sync as files change. 
 * 
 * This revised version checks if the project directory exists before 
 * starting the watcher. If not, we can optionally remove the project’s 
 * files from DB and skip the watcher.
 */
export class WatchersManager {
    private watchers: Map<string, FileChangePlugin> = new Map();

    constructor(
        private summaryService: FileSummaryService,
        private fileSyncService: FileSyncService,
        private projectService: ProjectService,
    ) { }

    public async startWatchingProject(project: Project, ignorePatterns: string[] = []): Promise<void> {
        if (this.watchers.has(project.id)) {
            console.warn(`[WatchersManager] Already watching project: ${project.id}`);
            return;
        }

        // 1) Check if the project directory actually exists on disk
        if (!existsSync(project.path)) {
            console.warn(`[WatchersManager] Directory does not exist for project: ${project.id} at ${project.path}.`);

            // 2) Optionally: remove the files from DB (since the disk folder is gone).
            await db.delete(files).where(eq(files.projectId, project.id));
            console.log(`[WatchersManager] Removed DB entries for project ${project.id} because directory is missing.`);

            // 3) Return early to avoid calling the watcher.
            return;
        }

        // 4) Otherwise, proceed to create and start the plugin
        const plugin = new FileChangePlugin(this.summaryService, this.fileSyncService, this.projectService);
        plugin.start(project, ignorePatterns);

        // 5) Keep a reference to the plugin in our watchers map
        this.watchers.set(project.id, plugin);
        console.log(`[WatchersManager] Started watcher for project: ${project.id}`);
    }

    public stopWatchingProject(projectId: string): void {
        const plugin = this.watchers.get(projectId);
        if (!plugin) {
            console.warn(`[WatchersManager] No watcher found for project: ${projectId}`);
            return;
        }

        plugin.stop();
        this.watchers.delete(projectId);
        console.log(`[WatchersManager] Stopped watcher for project: ${projectId}`);
    }

    public stopAll(): void {
        for (const [projectId, plugin] of this.watchers.entries()) {
            plugin.stop();
            console.log(`[WatchersManager] Stopped watcher for project: ${projectId}`);
        }
        this.watchers.clear();
    }
}