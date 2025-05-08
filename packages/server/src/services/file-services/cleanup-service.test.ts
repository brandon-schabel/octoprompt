import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { createCleanupService } from "./file-sync-service-unified";
import { Project } from "shared/src/schemas/project.schemas";
// No direct DB usage here, so no raw queries needed
// This file only tests the cleanup service logic/mocks



const listProjectsMock = mock(async () => [
    { id: "p1", path: "/some/fake/path" },
    { id: "p2", path: "/another/fake/path" },
] as Project[]);

spyOn(
    await import("@/services/project-service"),
    "listProjects"
).mockImplementation(listProjectsMock);

const syncProjectMock = mock(async () => { });
spyOn(
    await import("@/services/file-services/file-sync-service-unified"),
    "syncProject"
).mockImplementation(syncProjectMock);

describe("cleanup-service", () => {
    let cleanupService: ReturnType<typeof createCleanupService>;

    beforeEach(() => {
        cleanupService = createCleanupService({ intervalMs: 1000 });
    });

    test("cleanupAllProjects calls listProjects and syncProject for each", async () => {
        const results = await cleanupService.cleanupAllProjects();
        expect(listProjectsMock.mock.calls.length).toBe(1);
        expect(syncProjectMock.mock.calls.length).toBe(2);
        expect(results.length).toBe(2);
        expect(results[0].status).toBe("success");
    });

    test("start and stop methods set and clear interval", async () => {
        cleanupService.start();
        cleanupService.start(); // second call warns but doesn't create double intervals
        cleanupService.stop();
        cleanupService.stop(); // second call warns about not running
    });
});