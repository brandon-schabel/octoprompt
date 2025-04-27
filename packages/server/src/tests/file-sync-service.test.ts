// File: packages/server/src/tests/file-sync-server.test.ts
import { describe, test, expect, spyOn, beforeEach } from "bun:test";
import { db, resetDatabase } from "@db";
import { syncProject, getTextFiles, computeChecksum } from "@/services/file-services/file-sync-service";
import * as fs from "node:fs";
import type { PathOrFileDescriptor } from "node:fs";
import ignore from "ignore";

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
            // Files expected to be kept
            { name: "file1.ts", isDirectory: () => false, isFile: () => true },
            { name: "file2.txt", isDirectory: () => false, isFile: () => true },
            // File to be ignored by extension check in getTextFiles
            { name: "image.png", isDirectory: () => false, isFile: () => true },
            // File to be ignored by explicit ignore rule
            { name: "ignored.log", isDirectory: () => false, isFile: () => true },
            // Directory to be ignored by rule (and hardcoded check)
            { name: "node_modules", isDirectory: () => true, isFile: () => false },
            // Normal directory to recurse into (will return empty)
            { name: "folder", isDirectory: () => true, isFile: () => false }
        ];

        spyOn(fs, "readdirSync").mockImplementation(((path: string, options?: { withFileTypes?: boolean }) => {
            // Simulate reading '/fakeProjectRoot'
            if (path === '/fakeProjectRoot') {
                return options?.withFileTypes ? mockFiles : mockFiles.map(f => f.name);
            }
            // Simulate reading subdirectories (return empty)
            else if (path === '/fakeProjectRoot/folder' || path === '/fakeProjectRoot/node_modules') {
                return options?.withFileTypes ? [] : [];
            }
            // Default empty for unexpected paths
            else {
                return options?.withFileTypes ? [] : [];
            }
        }) as any);

        spyOn(fs, "statSync").mockImplementation(((path: string) => {
            // Mock directories
            if (path === '/fakeProjectRoot' || path === '/fakeProjectRoot/folder' || path === '/fakeProjectRoot/node_modules') {
                return { isDirectory: () => true, isFile: () => false };
            }
            // Mock files
            else if (path.startsWith('/fakeProjectRoot/')) {
                return { isDirectory: () => false, isFile: () => true, size: 10 };
            }
            // Default: throw error for unexpected paths? Or return basic stat?
            else {
                throw new Error(`ENOENT: statSync mock doesn't handle path: ${path}`);
            }
        }) as any);

        // Create an ignore instance with rules for the test
        const ig = ignore();
        ig.add('node_modules'); // Should be ignored by name
        ig.add('*.log');      // Should ignore ignored.log

        // --- CORRECTED CALL ---
        // Provide a string project root and the ignore instance.
        // Use ALLOWED_FILE_CONFIGS from the actual constants for realistic filtering.
        const result = getTextFiles("/fakeProjectRoot", "/fakeProjectRoot", ig /*, ALLOWED_FILE_CONFIGS (implicitly uses default) */);

        // --- VERIFICATION ---
        // Expect only paths to file1.ts and file2.txt
        expect(result).toEqual([
            '/fakeProjectRoot/file1.ts',
            '/fakeProjectRoot/file2.txt'
        ]);
        // Ensure length matches expectation
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