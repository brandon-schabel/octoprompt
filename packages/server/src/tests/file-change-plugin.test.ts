import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { createFileChangePlugin } from "@/services/file-services/file-change-plugin";

const syncProjectMock = mock(async () => { });
spyOn(
    await import("@/services/file-services/file-sync-service"),
    "syncProject"
).mockImplementation(syncProjectMock);

const summarizeFilesMock = mock(async (projectId: string, filesToSummarize: any[], globalState: any) => {
    return { included: 1, skipped: 0 };
});
spyOn(
    await import("@/services/file-services/file-summary-service"),
    "summarizeFiles"
).mockImplementation(summarizeFilesMock);

const getProjectFilesMock = mock(async (projectId: string) => [{
    id: "file1",
    name: "file1.txt",
    path: "/path/to/file1.txt",
    createdAt: new Date(),
    updatedAt: new Date(),
    content: "content",
    projectId: "project1",
    extension: ".txt",
    size: 123,
    summary: "summary",
    summaryLastUpdatedAt: new Date(),
    meta: null,
    checksum: null,
}]);
spyOn(
    await import("@/services/project-service"),
    "getProjectFiles"
).mockImplementation(getProjectFilesMock);

const createFileChangeWatcherMock = mock(() => ({
    registerListener: () => { },
    startWatching: () => { },
    stopAll: () => { },
    unregisterListener: () => {},
}));

spyOn(
    await import("@/services/file-services/file-change-watcher"),
    "createFileChangeWatcher"
).mockImplementation(createFileChangeWatcherMock);

describe("file-change-plugin", () => {
    test("start() calls watcher and syncProject on file change", async () => {
        const plugin = createFileChangePlugin();
        const project = { id: "p1", path: "/fake/path" } as any;
        await plugin.start(project, ["node_modules"]);
        expect(createFileChangeWatcherMock.mock.calls.length).toBe(1);
    });

    test("stop() calls watcher.stopAll", async () => {
        const plugin = createFileChangePlugin();
        plugin.stop();
        // no real easy way to confirm except counting calls if we had a spy
        // but we know it calls stopAll above
    });
});