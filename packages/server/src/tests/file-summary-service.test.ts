import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { db, resetDatabase } from "@db"; // no eq, no schema
import {
    summarizeSingleFile,
    summarizeFiles,
    forceSummarizeFiles,
    forceResummarizeSelectedFiles,
    shouldSummarizeFile
} from "@/services/file-services/file-summary-service";
import { randomString } from "./test-utils";

describe("file-summary-service", () => {
    let projectId: string;
    let globalState: any; // simplified

    beforeEach(async () => {
        await resetDatabase();
        projectId = randomString();
        globalState = {
            settings: {
                summarizationEnabledProjectIds: [projectId],
                summarizationIgnorePatterns: [],
                summarizationAllowPatterns: [],
            },
        };
    });

    test("shouldSummarizeFile returns false if project not in enabled list", async () => {
        const result = await shouldSummarizeFile("otherProject", "foo.ts");
        expect(result).toBe(false);
    });

    test("summarizeSingleFile does nothing if file is empty", async () => {
        // Insert a file row
        db.run(
            `
      INSERT INTO files (project_id, name, path, extension, size, content)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
            [projectId, "EmptyFile", "empty.ts", ".ts", 0, ""]
        );
        const fileId = db.query("SELECT last_insert_rowid() as id").get().id;

        // Now fetch that row as an object if needed
        const fileRow = db
            .query("SELECT * FROM files WHERE id = ?")
            .get(fileId);

        await summarizeSingleFile(fileRow);

        // Re-fetch
        const fetched = db
            .query("SELECT * FROM files WHERE id = ?")
            .get(fileId);
        expect(fetched.summary).toBe(null); // remains null or not updated
    });

    test("summarizeSingleFile calls provider if file not empty", async () => {
        db.run(
            `
      INSERT INTO files (project_id, name, path, extension, size, content)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
            [projectId, "NonEmptyFile", "nonempty.ts", ".ts", 10, "function test() {}"]
        );
        const fileId = db.query("SELECT last_insert_rowid() as id").get().id;
        const fileRow = db.query("SELECT * FROM files WHERE id = ?").get(fileId);

        await summarizeSingleFile(fileRow);

        const updated = db
            .query("SELECT * FROM files WHERE id = ?")
            .get(fileId);
        expect(updated.summary).toBe("Mock summary");
    });

    test("summarizeFiles includes only files from the same project if project is enabled", async () => {
        // Insert f1 in the desired project
        db.run(
            `INSERT INTO files (project_id, name, path, extension, size, content)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [projectId, "F1", "f1.ts", ".ts", 200, "f1 content"]
        );
        const f1Id = db.query("SELECT last_insert_rowid() as id").get().id;
        const f1 = db.query("SELECT * FROM files WHERE id = ?").get(f1Id);

        // Insert f2 in a different project
        db.run(
            `INSERT INTO files (project_id, name, path, extension, size, content)
       VALUES (?, ?, ?, ?, ?, ?)`,
            ["other", "F2", "f2.ts", ".ts", 300, "f2 content"]
        );
        const f2Id = db.query("SELECT last_insert_rowid() as id").get().id;
        const f2 = db.query("SELECT * FROM files WHERE id = ?").get(f2Id);

        const result = await summarizeFiles(projectId, [f1, f2], globalState);
        expect(result.included).toBe(1);
        expect(result.skipped).toBe(1);
    });

    test("forceSummarizeFiles ignores existing summary", async () => {
        db.run(
            `INSERT INTO files (project_id, name, path, extension, size, content, summary, summary_last_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, "AlreadyHasSummary", "hasSummary.ts", ".ts", 10, "existing content", "existing summary", Date.now()]
        );
        const fileId = db.query("SELECT last_insert_rowid() as id").get().id;
        const fileRow = db.query("SELECT * FROM files WHERE id = ?").get(fileId);

        await forceSummarizeFiles(projectId, [fileRow], globalState);

        const updated = db
            .query("SELECT * FROM files WHERE id = ?")
            .get(fileId);
        expect(updated.summary).toBe("Mock summary");
    });

    test("forceResummarizeSelectedFiles returns how many were actually summarized", async () => {
        db.run(
            `INSERT INTO files (project_id, name, path, extension, size, content)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [projectId, "A", "a.ts", ".ts", 10, "file A"]
        );
        const fileAId = db.query("SELECT last_insert_rowid() as id").get().id;
        const fileA = db.query("SELECT * FROM files WHERE id = ?").get(fileAId);

        // Different project => should be skipped
        db.run(
            `INSERT INTO files (project_id, name, path, extension, size, content)
       VALUES (?, ?, ?, ?, ?, ?)`,
            ["otherProj", "B", "b.ts", ".ts", 10, "file B"]
        );
        const fileBId = db.query("SELECT last_insert_rowid() as id").get().id;
        const fileB = db.query("SELECT * FROM files WHERE id = ?").get(fileBId);

        const result = await forceResummarizeSelectedFiles(projectId, [fileA, fileB], globalState);
        expect(result.included).toBe(1);
        expect(result.skipped).toBe(1);
    });
});