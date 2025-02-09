import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import {
    createProject, getProjectById, listProjects,
    updateProject, deleteProject, getProjectFiles, updateFileContent,
    resummarizeAllFiles, forceResummarizeSelectedFiles,
    summarizeSelectedFiles, removeSummariesFromFiles
} from "@/services/project-service";
import { randomString } from "./test-utils";
import { db } from "@db";
import { schema } from "shared";

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
        const [insertedFile] = await db
            .insert(schema.files)
            .values({
                projectId: project.id,
                name: "TestFile",
                path: "src/TestFile.ts",
                extension: ".ts",
                size: 123,
                content: "initial content",
            })
            .returning();

        const updatedFile = await updateFileContent(insertedFile.id, "new content");
        expect(updatedFile.content).toBe("new content");
        expect(updatedFile.updatedAt.valueOf()).toBeGreaterThan(insertedFile.updatedAt.valueOf());
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
        // Insert two files
        const [f1] = await db.insert(schema.files).values({
            projectId: project.id,
            name: "file1",
            path: "file1.ts",
            extension: ".ts",
            size: 111,
        }).returning();
        const [f2] = await db.insert(schema.files).values({
            projectId: project.id,
            name: "file2",
            path: "file2.ts",
            extension: ".ts",
            size: 222,
        }).returning();

        // Only re-summarize f1
        const result = await forceResummarizeSelectedFiles(project.id, [f1.id]);
        expect(result.included).toBe(1);
        expect(forceSummarizeFilesMock.mock.calls.length).toBe(1);
    });

    test("summarizeSelectedFiles returns included/skipped", async () => {
        const project = await createProject({ name: "SummarizeSel", path: "/sel" });
        // Insert some files
        const [f1] = await db.insert(schema.files).values({
            projectId: project.id,
            name: "f1",
            path: "f1.ts",
            extension: ".ts",
            size: 100,
        }).returning();
        const [f2] = await db.insert(schema.files).values({
            projectId: project.id,
            name: "f2",
            path: "f2.ts",
            extension: ".ts",
            size: 200,
        }).returning();

        const result = await summarizeSelectedFiles(project.id, [f1.id, f2.id]);
        expect(result.included).toBe(2);
        expect(result.skipped).toBe(1); // this matches the mock's default
        expect(result.message).toBe("Requested files have been summarized");
    });

    test("removeSummariesFromFiles updates summary fields to null", async () => {
        const project = await createProject({ name: "RemoveSumm", path: "/rem" });
        // Insert file with summary
        const [fileWithSummary] = await db.insert(schema.files).values({
            projectId: project.id,
            name: "HasSummary",
            path: "sum.ts",
            extension: ".ts",
            size: 50,
            summary: "Existing summary text",
        }).returning();

        const result = await removeSummariesFromFiles(project.id, [fileWithSummary.id]);
        expect(result.success).toBe(true);
        expect(result.removedCount).toBe(1);

        // Check directly in DB
        const fetched = await db.query.files.findFirst({
            where: (f, { eq }) => eq(f.id, fileWithSummary.id),
        });
        expect(fetched?.summary).toBeNull();
    });
});