// File: packages/server/src/tests/file-sync-server.test.ts
import { describe, test, expect, spyOn } from "bun:test";
import { db } from "@db";
import { syncProject, getTextFiles, computeChecksum } from "@/services/file-services/file-sync-service";
import * as fs from "node:fs";

describe("file-sync-service", () => {
    test("computeChecksum returns a hex string", () => {
        const sum = computeChecksum("Hello");
        expect(sum).toMatch(/^[0-9a-f]+$/i);
    });

    test("getTextFiles returns only matching extension files", () => {
        spyOn(fs, "readdirSync").mockImplementation(((path, options) => {
            if (options && options.withFileTypes) {
                return [
                    { name: "file1.ts", isDirectory: () => false },
                    { name: "file2.txt", isDirectory: () => false },
                    { name: "folder", isDirectory: () => true }
                ];
            } else {
                return ["file1.ts", "file2.txt", "folder"];
            }
        }) as any);
        spyOn(fs, "statSync").mockImplementation(() => ({ size: 12n } as any));

        const result = getTextFiles("/fakeDir", []);
        expect(result.length).toBe(2);
    });

    test("syncProject inserts or updates DB records, removes missing", async () => {
        // Insert a project row
        db.run(
            `INSERT INTO projects (name, path) VALUES (?, ?)`,
            ["SyncProject", "/tmp/test-sync"]
        );
        const projId = ((db.query("SELECT last_insert_rowid() AS id").get() as { id: number }).id).toString();

        // Pre-insert a file that will later be removed
        db.run(
            `
      INSERT INTO files (project_id, name, path, extension, size, content)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
            [projId, "old.ts", "old.ts", ".ts", 100, "old content"]
        );
        const oldFileId = ((db.query("SELECT last_insert_rowid() AS id").get() as { id: number }).id).toString();

        // Mock readdirSync so only "keep.ts" and "update.ts" appear
        spyOn(fs, "readdirSync").mockImplementation(((path, options) => {
            if (options && options.withFileTypes) {
                return [
                    { name: "keep.ts", isDirectory: () => false },
                    { name: "update.ts", isDirectory: () => false }
                ];
            }
            return ["keep.ts", "update.ts"];
        }) as any);

        // Mock readFileSync
        spyOn(fs, "readFileSync").mockImplementation((filePath: string) => {
            if (filePath.endsWith("keep.ts")) return "keep content";
            if (filePath.endsWith("update.ts")) return "update content";
            return "";
        });

        spyOn(fs, "statSync").mockImplementation(() => ({ size: 99n } as any));

        // Let the function run
        const projectRow = db.query("SELECT * FROM projects WHERE id = ?").get(projId);
        await syncProject(projectRow);

        // oldFile should be removed
        const maybeOld = db
            .query("SELECT * FROM files WHERE id = ?")
            .get(oldFileId);
        expect(maybeOld).toBeUndefined();

        // keep.ts and update.ts should be in DB
        const all = db
            .query("SELECT * FROM files WHERE project_id = ?")
            .all(projId);
        expect(all.length).toBe(2);
        expect(all.find(x => x.path === "keep.ts")).toBeTruthy();
        expect(all.find(x => x.path === "update.ts")).toBeTruthy();
    });
});