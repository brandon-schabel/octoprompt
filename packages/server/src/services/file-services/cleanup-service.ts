import { FileSyncService } from "./file-sync-service";
import { ProjectService } from "../project-service";
import { Project } from "shared";

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

export class CleanupService {
    private intervalId: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly fileSyncService: FileSyncService,
        private readonly projectService: ProjectService,
        private readonly options: CleanupOptions
    ) { }

    public start(): void {
        if (this.intervalId) {
            console.warn("[CleanupService] Cleanup already started.");
            return;
        }

        this.intervalId = setInterval(() => {
            this.cleanupAllProjects().catch((err) => {
                console.error("[CleanupService] Error during cleanupAllProjects:", err);
            });
        }, this.options.intervalMs);

        console.log(`[CleanupService] Started periodic cleanup every ${this.options.intervalMs}ms`);
    }

    public stop(): void {
        if (!this.intervalId) {
            console.warn("[CleanupService] Cleanup is not running.");
            return;
        }
        clearInterval(this.intervalId);
        this.intervalId = null;
        console.log("[CleanupService] Stopped periodic cleanup.");
    }

    public async cleanupAllProjects(): Promise<CleanupResult[]> {
        try {
            const projects = await this.projectService.listProjects();
            const results: CleanupResult[] = [];

            for (const project of projects) {
                try {
                    await this.fileSyncService.syncProject(project);
                    results.push({
                        projectId: project.id,
                        status: "success",
                        removedCount: 0 // Could detect how many we removed if needed
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
}