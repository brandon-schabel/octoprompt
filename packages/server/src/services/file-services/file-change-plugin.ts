import { getState } from '@/websocket/websocket-config';
import { FileChangeWatcher, FileChangeEvent } from './file-change-watcher';
import { FileSummaryService } from './file-summary-service';
import { FileSyncService } from './file-sync-service';
import { ProjectService } from '../project-service';
import { Project } from 'shared';

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
                    // 1) Re-sync the changed file(s) with DB
                    await this.fileSyncService.syncProject(project);

                    // 2) Grab the updated list of files from DB
                    const allFiles = await this.projectService.getProjectFiles(project.id);
                    if (!allFiles) {
                        console.warn(`[FileChangePlugin] No files returned for project: ${project.id}`);
                        return;
                    }

                    // 3) Convert the absolute changedFilePath to a relative path
                    const relativePath = changedFilePath.replace(`${project.path}/`, '');

                    // 4) Find the matching file by relative path
                    const updatedFile = allFiles.find((f) => f.path === relativePath);
                    if (!updatedFile) {
                        console.warn(`[FileChangePlugin] Could not find a DB record matching path: ${relativePath}`);
                        return;
                    }

                    console.log(`[FileChangePlugin] Rerunning summary for file ID: ${updatedFile.id} (${event})`);

                    const globalState = await getState();




                    



                    // 5) Re-run summarization for this single file
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

        // Start actual directory watch
        this.watcher.startWatching({
            directory: project.path,
            ignorePatterns,
        });
    }

    public stop(): void {
        this.watcher.stopAll();
    }
}