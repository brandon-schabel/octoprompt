import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import {
    createProject, getProjectById, listProjects,
    updateProject, deleteProject, getProjectFiles, updateFileContent,
    resummarizeAllFiles, forceResummarizeSelectedFiles,
    summarizeSelectedFiles, removeSummariesFromFiles
} from "@/services/project-service";
import { randomString } from "./test-utils";
import { db } from "@db";
import type { RawFile } from "@/services/project-service";

/**
 * Mocks/stubs for external calls we don't want to execute in real tests.
 * They might do network calls, or read the file system, etc.
 * We'll verify that the service calls them, but we won't run them fully.
 */
const syncProjectMock = mock(() => Promise.resolve());
const forceSummarizeFilesMock = mock(() => Promise.resolve());
const summarizeFilesMock = mock(() => Promise.resolve({ included: 2, skipped: 1 }));

// We replace the actual imports in project-service with these mocks.
// If your service imports them directly from e.g. "file-sync-service",
// you can override them here. For example:
spyOn(
    await import("@/services/file-services/file-sync-service"),
    "syncProject"
).mockImplementation(syncProjectMock);

spyOn(
    await import("@/services/file-services/file-summary-service"),
    "forceSummarizeFiles"
).mockImplementation(forceSummarizeFilesMock);

spyOn(
    await import("@/services/file-services/file-summary-service"),
    "summarizeFiles"
).mockImplementation(summarizeFilesMock);

describe("Project Service", () => {
    beforeEach(() => {
        db.prepare("DELETE FROM projects").run();
        db.prepare("DELETE FROM files").run();
    });

    test("createProject and getProjectById", async () => {
        const name = `TestProj_${randomString()}`;
        const project = await createProject({
            name,
            path: "/some/random/path",
            description: "Test project desc",
        });
        expect(project.id).toBeDefined();
        expect(project.name).toBe(name);

        const fetched = await getProjectById(project.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe(project.id);
        expect(fetched!.description).toBe("Test project desc");
    });

    test("listProjects returns all created projects", async () => {
        // No projects at start
        let allProjects = await listProjects();
        expect(allProjects.length).toBe(0);

        // Create multiple
        await createProject({ name: randomString(), path: "/p1" });
        await createProject({ name: randomString(), path: "/p2" });
        await createProject({ name: randomString(), path: "/p3" });

        allProjects = await listProjects();
        expect(allProjects.length).toBe(3);
    });

    test("updateProject updates fields", async () => {
        const p = await createProject({
            name: "InitialProject",
            path: "/initial/path",
            description: "Initial desc",
        });

        const newDesc = "Updated desc";
        await updateProject(p.id, { description: newDesc });

        const fetched = await getProjectById(p.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.description).toBe(newDesc);
    });

    test("deleteProject removes project", async () => {
        const p = await createProject({
            name: "ToDelete",
            path: "/delete/path",
        });
        const deleted = await deleteProject(p.id);
        expect(deleted).toBe(true);

        const shouldBeNull = await getProjectById(p.id);
        expect(shouldBeNull).toBeNull();

        // Deleting non-existing again => false
        const again = await deleteProject(p.id);
        expect(again).toBe(false);
    });

    test("getProjectFiles returns project files or null if project not found", async () => {
        // Project with no files
        const p = await createProject({
            name: "FilesTest",
            path: "/files/test",
        });
        // No files at first
        let files = await getProjectFiles(p.id);
        expect(files).toBeDefined();
        expect(files!.length).toBe(0);

        // If we pass a random ID, we get null
        const nonexistent = await getProjectFiles("nonexistent-id");
        expect(nonexistent).toBeNull();
    });

    test("updateFileContent updates the file", async () => {
        // We can directly insert a file in DB for test setup
        const project = await createProject({ name: "F1", path: "/f1" });
        const stmt = db.prepare(`
            INSERT INTO files 
            (project_id, name, path, extension, size, content, summary, summary_last_updated_at, meta, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `);
        const insertedFile = stmt.get(project.id, "TestFile", "src/TestFile.ts", ".ts", 123, "initial content") as RawFile;

        const updatedFile = await updateFileContent(insertedFile.id, "new content");
        expect(updatedFile.content).toBe("new content");
        expect(updatedFile.updatedAt.valueOf()).toBeGreaterThan(new Date(insertedFile.updated_at).valueOf());
    });

    test("resummarizeAllFiles calls syncProject and forceSummarizeFiles", async () => {
        const project = await createProject({ name: "Summaries", path: "/sum" });
        await resummarizeAllFiles(project.id);

        // The mocks should have been called
        expect(syncProjectMock.mock.calls.length).toBe(1);
        expect(forceSummarizeFilesMock.mock.calls.length).toBe(1);
    });

    test("resummarizeAllFiles throws if project not found", async () => {
        await expect(resummarizeAllFiles("fakeId"))
            .rejects.toThrow("Project not found");
    });

    test("forceResummarizeSelectedFiles calls forceSummarizeFiles with correct file subset", async () => {
        const project = await createProject({ name: "ForceSubset", path: "/force" });
        const stmt = db.prepare(`
            INSERT INTO files 
            (project_id, name, path, extension, size, content, summary, summary_last_updated_at, meta, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `);
        const f1 = stmt.get(project.id, "file1", "file1.ts", ".ts", 111) as RawFile;
        const f2 = stmt.get(project.id, "file2", "file2.ts", ".ts", 222) as RawFile;

        forceSummarizeFilesMock.mockClear();
        // Only re-summarize f1
        const result = await forceResummarizeSelectedFiles(project.id, [f1.id]);
        expect(result.included).toBe(1);
        expect(forceSummarizeFilesMock.mock.calls.length).toBe(1);
    });

    test("summarizeSelectedFiles returns included/skipped", async () => {
        const project = await createProject({ name: "SummarizeSel", path: "/sel" });
        const stmt = db.prepare(`
            INSERT INTO files 
            (project_id, name, path, extension, size, content, summary, summary_last_updated_at, meta, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `);
        const f1 = stmt.get(project.id, "f1", "f1.ts", ".ts", 100) as RawFile;
        const f2 = stmt.get(project.id, "f2", "f2.ts", ".ts", 200) as RawFile;

        const result = await summarizeSelectedFiles(project.id, [f1.id, f2.id]);
        expect(result.included).toBe(2);
        expect(result.skipped).toBe(1); // this matches the mock's default
        expect(result.message).toBe("Requested files have been summarized");
    });

    test("removeSummariesFromFiles updates summary fields to null", async () => {
        const project = await createProject({ name: "RemoveSumm", path: "/rem" });
        const stmt = db.prepare(`
            INSERT INTO files 
            (project_id, name, path, extension, size, content, summary, summary_last_updated_at, meta, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?, 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `);
        const fileWithSummary = stmt.get(project.id, "HasSummary", "sum.ts", ".ts", 50, "Existing summary text") as RawFile;

        const result = await removeSummariesFromFiles(project.id, [fileWithSummary.id]);
        expect(result.success).toBe(true);
        expect(result.removedCount).toBe(1);

        const fetchStmt = db.prepare("SELECT * FROM files WHERE id = ?");
        const fetched = fetchStmt.get(fileWithSummary.id) as RawFile;
        expect(fetched.summary).toBeNull();
    });

});