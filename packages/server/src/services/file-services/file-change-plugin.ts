import { FileChangeWatcher, FileChangeEvent } from './file-change-watcher';
import { FileSummaryService } from './file-summary-service';
import { FileSyncService } from './file-sync-service';
import { ProjectService } from '../project-service';
import { schema } from 'shared';
import { resolve, relative } from 'node:path';
import { websocketStateAdapter } from '@/utils/websocket/websocket-state-adapter';

type Project = schema.Project;

export class FileChangePlugin {
    private watcher: FileChangeWatcher;
    private summaryService: FileSummaryService;
    private fileSyncService: FileSyncService;
    private projectService: ProjectService;

    constructor(
        summaryService: FileSummaryService,
        fileSyncService: FileSyncService,
        projectService: ProjectService
    ) {
        this.watcher = new FileChangeWatcher();
        this.summaryService = summaryService;
        this.fileSyncService = fileSyncService;
        this.projectService = projectService;
    }

    public start(project: Project, ignorePatterns: string[] = []): void {
        this.watcher.registerListener({
            onFileChanged: async (event: FileChangeEvent, changedFilePath: string) => {
                try {
                    // Always re-sync from disk so DB is updated with new content
                    await this.fileSyncService.syncProject(project);

                    // Summaries
                    const allFiles = await this.projectService.getProjectFiles(project.id);
                    if (!allFiles) return;

                    const absoluteProjectPath = resolve(project.path);
                    const relativePath = relative(absoluteProjectPath, changedFilePath);
                    const updatedFile = allFiles.find((f) => f.path === relativePath);
                    if (!updatedFile) {
                        return;
                    }
                    const globalState = await websocketStateAdapter.getState();
                    await this.summaryService.summarizeFiles(
                        project.id,
                        [updatedFile],
                        globalState
                    );
                } catch (err) {
                    console.error('[FileChangePlugin] Error handling file change:', err);
                }
            },
        });

        this.watcher.startWatching({
            directory: project.path,
            ignorePatterns,
        });
    }

    public stop(): void {
        this.watcher.stopAll();
    }
}