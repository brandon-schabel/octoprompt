import { describe, test, expect } from "bun:test";
import { isIgnored, inferChangeType } from "@/services/file-services/file-change-watcher";
import { existsSync } from "fs";

describe("file-change-watcher", () => {
    test("isIgnored matches wildcard patterns", () => {
        const patterns = ["*.log", "dist", "*.tmp"];
        expect(isIgnored("/project/app.log", patterns)).toBe(true);
        expect(isIgnored("/project/README.md", patterns)).toBe(false);
    });

    test("inferChangeType returns created if file now exists", () => {
        (existsSync as any) = () => true;
        const result = inferChangeType("rename", "/some/newFile.ts");
        expect(result).toBe("created");
    });

    test("inferChangeType returns deleted if file no longer exists", () => {
        (existsSync as any) = () => false;
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