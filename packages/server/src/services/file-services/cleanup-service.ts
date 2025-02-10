import { listProjects } from "../project-service";
import { syncProject } from "./file-sync-service";

export type CleanupResult =
    | ({ status: "success"; removedCount: number } & { projectId: string })
    | ({ status: "error"; error: unknown } & { projectId: string });

export interface CleanupOptions {
    intervalMs: number;
}

export type MinimalProject = {
    id: string;
    path: string;
};

/**
 * Creates a "cleanup service" that can be started/stopped
 * and can run a periodic cleanupAllProjects task.
 */
export function createCleanupService(
    options: CleanupOptions
) {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    /**
     * Runs cleanup on all projects by synchronizing them.
     */
    async function cleanupAllProjects(): Promise<CleanupResult[]> {
        try {
            const projects = await listProjects();
            const results: CleanupResult[] = [];

            for (const project of projects) {
                try {
                    // This line uses fileSyncService to ensure the project's files are up to date
                    await syncProject(project);
                    results.push({
                        projectId: project.id,
                        status: "success",
                        removedCount: 0
                    });
                } catch (error) {
                    results.push({
                        projectId: project.id,
                        status: "error",
                        error
                    });
                }
            }
            return results;
        } catch (error) {
            console.error("[CleanupService] Fatal error fetching projects:", error);
            return [];
        }
    }

    /**
     * Starts the periodic cleanup with the provided interval.
     */
    function start(): void {
        if (intervalId) {
            console.warn("[CleanupService] Cleanup already started.");
            return;
        }

        intervalId = setInterval(() => {
            cleanupAllProjects().catch((err) => {
                console.error("[CleanupService] Error during cleanupAllProjects:", err);
            });
        }, options.intervalMs);

        console.log(`[CleanupService] Started periodic cleanup every ${options.intervalMs}ms`);
    }

    /**
     * Stops the periodic cleanup.
     */
    function stop(): void {
        if (!intervalId) {
            console.warn("[CleanupService] Cleanup is not running.");
            return;
        }
        clearInterval(intervalId);
        intervalId = null;
        console.log("[CleanupService] Stopped periodic cleanup.");
    }

    return {
        start,
        stop,
        cleanupAllProjects,
    };
}