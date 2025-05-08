import { describe, test, expect, beforeEach, mock } from "bun:test";
import { isIgnored, inferChangeType } from "./file-sync-service-unified";

describe("file-change-watcher", () => {
    beforeEach(() => {
        mock.restore();
    });

    test("isIgnored matches wildcard patterns", () => {
        const patterns = ["*.log", "dist", "*.tmp"];
        expect(isIgnored("/project/app.log", patterns)).toBe(true);
        expect(isIgnored("/project/README.md", patterns)).toBe(false);
    });

    test("inferChangeType returns created if file now exists", () => {
        mock.module("fs", () => ({
            existsSync: () => true,
        }));
        const result = inferChangeType("rename", "/some/newFile.ts");
        expect(result).toBe("created");
    });

    test("inferChangeType returns deleted if file no longer exists", () => {
        mock.module("fs", () => ({
            existsSync: () => false,
        }));
        const result = inferChangeType("rename", "/some/removed.ts");
        expect(result).toBe("deleted");
    });

    test("inferChangeType returns modified for eventType 'change'", () => {
        const result = inferChangeType("change", "/some/file.ts");
        expect(result).toBe("modified");
    });

    test("inferChangeType returns null for unknown eventType", () => {
        const result = inferChangeType("unknown", "/some/file.ts");
        expect(result).toBeNull();
    });
});