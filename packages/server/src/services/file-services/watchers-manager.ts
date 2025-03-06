import { createFileChangePlugin } from './file-change-plugin';

import { db } from '@/utils/database';
import { existsSync } from 'node:fs';
import { Project } from 'shared/schema';
import { resolvePath } from '@/utils/path-utils';


export function createWatchersManager(
) {
    const watchers = new Map<string, ReturnType<typeof createFileChangePlugin>>();

    /**
     * Start watching a project's directory.
     */
    async function startWatchingProject(project: Project, ignorePatterns: string[] = []): Promise<void> {
        if (watchers.has(project.id)) {
            console.warn(`[WatchersManager] Already watching project: ${project.id}`);
            return;
        }

        const resolvedPath = resolvePath(project.path);
        
        if (!existsSync(resolvedPath)) {
            console.error(`[WatchersManager] Project path doesn't exist: ${resolvedPath}`);
            return;
        }

        const plugin = createFileChangePlugin();
        await plugin.start(project, ignorePatterns);
        watchers.set(project.id, plugin);

        console.log(`[WatchersManager] Started watching project: ${project.id} (${resolvedPath})`);
    }

    /**
     * Stop watching a project.
     */
    function stopWatchingProject(projectId: string): void {
        const plugin = watchers.get(projectId);
        if (!plugin) {
            console.warn(`[WatchersManager] Not watching project: ${projectId}`);
            return;
        }

        plugin.stop();
        watchers.delete(projectId);
        console.log(`[WatchersManager] Stopped watching project: ${projectId}`);
    }

    /**
     * Stop all watchers.
     */
    function stopAll(): void {
        for (const [projectId, plugin] of watchers.entries()) {
            plugin.stop();
            console.log(`[WatchersManager] Stopped watching project: ${projectId}`);
        }
        watchers.clear();
    }

    return {
        startWatchingProject,
        stopWatchingProject,
        stopAll
    };
}