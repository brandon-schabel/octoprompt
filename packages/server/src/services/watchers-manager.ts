import { FileChangePlugin } from './file-change-plugin';
import { FileSummaryService } from './file-summary-service';
import { FileSyncService } from './file-sync-service';
import { Project } from 'shared';
import { ProjectService } from './project-service';

export class WatchersManager {
    private watchers: Map<string, FileChangePlugin> = new Map();

    constructor(
        private summaryService: FileSummaryService,
        private fileSyncService: FileSyncService,
        private projectService: ProjectService,
    ) { }

    /**
     * Starts watching a project’s directory if not already watching.
     */
    public startWatchingProject(project: Project, ignorePatterns: string[] = []): void {
        if (this.watchers.has(project.id)) {
            console.warn(`[WatchersManager] Already watching project: ${project.id}`);
            return;
        }

        const plugin = new FileChangePlugin(this.summaryService, this.fileSyncService, this.projectService);
        plugin.start(project, ignorePatterns);
        this.watchers.set(project.id, plugin);
        console.log(`[WatchersManager] Started watcher for project: ${project.id}`);
    }

    /**
     * Stops watching a project’s directory if currently watching.
     */
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

    /**
     * Stops all watchers and clears them from memory.
     */
    public stopAll(): void {
        for (const [projectId, plugin] of this.watchers.entries()) {
            plugin.stop();
            console.log(`[WatchersManager] Stopped watcher for project: ${projectId}`);
        }
        this.watchers.clear();
    }
}