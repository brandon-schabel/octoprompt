import { FileChangeWatcher, FileChangeEvent } from './file-change-watcher';
import { FileSummaryService } from './file-summary-service';
import { FileSyncService } from './file-sync-service';
import { ProjectService } from '../project-service';
import { Project } from 'shared';
import { resolve, relative } from 'node:path';
import { websocketStateAdapter } from '@/utils/websocket/websocket-state-adapter';

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
                    // 1) Always call syncProject, which handles insert/update/remove from DB
                    await this.fileSyncService.syncProject(project);

                    // 2) Re-fetch updated list of files from DB
                    const allFiles = await this.projectService.getProjectFiles(project.id);
                    if (!allFiles) {
                        console.warn(`[FileChangePlugin] No files returned for project: ${project.id}`);
                        return;
                    }

                    // 3) Convert the absolute changedFilePath to a relative path
                    const absoluteProjectPath = resolve(project.path);
                    const relativePath = relative(absoluteProjectPath, changedFilePath);

                    // 4) Lookup the DB record for that file’s path
                    const updatedFile = allFiles.find((f) => f.path === relativePath);
                    if (!updatedFile) {
                        return;
                    }


                    // 5) Re-run summarization for this single file
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

        // Start the actual directory watch
        this.watcher.startWatching({
            directory: project.path,
            ignorePatterns,
        });
    }

    public stop(): void {
        this.watcher.stopAll();
    }
}