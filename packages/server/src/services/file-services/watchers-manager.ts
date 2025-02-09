import { createFileChangePlugin } from './file-change-plugin';

import { db } from '@/utils/database';
import { eq } from '@db';
import { schema } from 'shared';
import { existsSync } from 'node:fs';

const { files } = schema;

export function createWatchersManager(
) {
    const watchers = new Map<string, ReturnType<typeof createFileChangePlugin>>();

    /**
     * Start watching a project's directory.
     */
    async function startWatchingProject(project: schema.Project, ignorePatterns: string[] = []): Promise<void> {
        if (watchers.has(project.id)) {
            console.warn(`[WatchersManager] Already watching project: ${project.id}`);
            return;
        }

        if (!existsSync(project.path)) {
            console.warn(`[WatchersManager] Directory does not exist for project: ${project.id} at ${project.path}.`);
            await db.delete(files).where(eq(files.projectId, project.id));
            console.log(`[WatchersManager] Removed DB entries for project ${project.id} because directory is missing.`);
            return;
        }

        const plugin = createFileChangePlugin();
        await plugin.start(project, ignorePatterns);

        watchers.set(project.id, plugin);
        console.log(`[WatchersManager] Started watcher for project: ${project.id}`);
    }

    /**
     * Stops watching a specific project's directory.
     */
    function stopWatchingProject(projectId: string): void {
        const plugin = watchers.get(projectId);
        if (!plugin) {
            console.warn(`[WatchersManager] No watcher found for project: ${projectId}`);
            return;
        }

        plugin.stop();
        watchers.delete(projectId);
        console.log(`[WatchersManager] Stopped watcher for project: ${projectId}`);
    }

    /**
     * Stops all watchers for all projects.
     */
    function stopAll(): void {
        for (const [projectId, plugin] of watchers.entries()) {
            plugin.stop();
            console.log(`[WatchersManager] Stopped watcher for project: ${projectId}`);
        }
        watchers.clear();
    }

    return {
        startWatchingProject,
        stopWatchingProject,
        stopAll,
    };
}