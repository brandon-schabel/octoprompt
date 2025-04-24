// File: packages/server/src/tests/file-sync-server.test.ts
import { describe, test, expect, spyOn, beforeEach } from "bun:test";
import { db, resetDatabase } from "@db";
import { syncProject, getTextFiles, computeChecksum } from "@/services/file-services/file-sync-service";
import * as fs from "node:fs";
import type { PathOrFileDescriptor } from "node:fs";

describe("file-sync-service", () => {
    let projectId: string;

    beforeEach(() => {
        resetDatabase();
    });

    test("computeChecksum returns a hex string", () => {
        const sum = computeChecksum("Hello");
        expect(sum).toMatch(/^[0-9a-f]+$/i);
    });

    test("getTextFiles returns only matching extension files", () => {
        const mockFiles = [
            { name: "file1.ts", isDirectory: () => false, isFile: () => true },
            { name: "file2.txt", isDirectory: () => false, isFile: () => true },
            { name: "folder", isDirectory: () => true, isFile: () => false }
        ];

        spyOn(fs, "readdirSync").mockImplementation(((path: string, options?: { withFileTypes?: boolean }) => {
            if (path === '/fakeDir') {
                return options?.withFileTypes ? mockFiles : mockFiles.map(f => f.name);
            } else {
                // For any subdirectory, return an empty array to prevent recursion
                return options?.withFileTypes ? [] : [];
            }
        }) as any);
        
        spyOn(fs, "statSync").mockImplementation(((path: string) => {
            // Mock behavior based on path
            if (path === '/fakeDir') {
                return { isDirectory: () => true }; // It's a directory
            } else {
                return { isDirectory: () => false, size: 12n }; // It's a file with size
            }
        }) as any);

        const result = getTextFiles("/fakeDir", []);
        expect(result.length).toBe(2);
    });

    test.skipIf(!!process.env.CI)("syncProject handles file changes efficiently", async () => {
        // Setup project in a single statement
        const project = db.prepare(`
            INSERT INTO projects (name, path) 
            VALUES (?, ?) 
            RETURNING *
        `).get("SyncProject", "/tmp/test-sync") as any;

        // Pre-insert test file in a single statement
        const oldFile = db.prepare(`
            INSERT INTO files (project_id, name, path, extension, size, content)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *
        `).get(project.id, "old.ts", "old.ts", ".ts", 100, "old content") as any;

        // Setup mock filesystem state
        const mockFiles = [
            { name: "keep.ts", isDirectory: () => false, isFile: () => true },
            { name: "update.ts", isDirectory: () => false, isFile: () => true }
        ];

        spyOn(fs, "readdirSync").mockImplementation(((path: string, options?: { withFileTypes?: boolean }) => {
            if (typeof path === 'string' && path === '/tmp/test-sync') {
                return options?.withFileTypes ? mockFiles : mockFiles.map(f => f.name);
            } else {
                // For any subdirectory (or unexpected path), return an empty array to avoid unwanted recursion
                return options?.withFileTypes ? [] : [];
            }
        }) as any);

        const fileContents: Record<string, string> = {
            "keep.ts": "keep content",
            "update.ts": "update content"
        };

        spyOn(fs, "readFileSync").mockImplementation(((path: PathOrFileDescriptor) => {
            const fileName = String(path).split('/').pop();
            return fileName && fileName in fileContents ? fileContents[fileName] : "";
        }) as any);

        spyOn(fs, "statSync").mockImplementation(((path: string) => {
            // Mock behavior based on path
            if (path === '/tmp/test-sync') {
                 return { isDirectory: () => true }; // Project path is a directory
            } else {
                 // Files within the project directory
                 return { isDirectory: () => false, size: 99n };
            }
        }) as any);

        // Run sync
        await syncProject(project);

        // Verify results in a single query
        const results = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN path IN ('keep.ts', 'update.ts') THEN 1 ELSE 0 END) as new_files,
                SUM(CASE WHEN id = ? THEN 1 ELSE 0 END) as old_file_exists
            FROM files 
            WHERE project_id = ?
        `).get(oldFile.id, project.id) as any;

        expect(results.total).toBe(2);
        expect(results.new_files).toBe(2);
        expect(results.old_file_exists).toBe(0);
    });
});