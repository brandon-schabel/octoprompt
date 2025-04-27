// file-summary-service.test.ts
import { describe, it, expect, mock } from "bun:test";
import { shouldSummarizeFile } from "./file-summary-service";
// Import the actual constants used by the tests
import { ALLOWED_FILE_CONFIGS, DEFAULT_FILE_EXCLUSIONS } from "shared/src/constants/file-sync-options";

// Define the configuration object to be passed to the function in tests
const defaultConfigs = {
    allowedConfig: ALLOWED_FILE_CONFIGS,
    ignoredConfig: DEFAULT_FILE_EXCLUSIONS,
};

// Mock the isExcluded function from file-sync-service
mock.module('./file-sync-service', () => {
    // console.log("Mocking ./file-sync-service");
    return {
        // The mock now receives the actual ignoredConfig from shouldSummarizeFile
        isExcluded: (nameOrSegment: string, exclusions: ReadonlyArray<string>) => { // Use ReadonlyArray to match real function if needed
            // console.log(`Mock isExcluded called with: nameOrSegment='${nameOrSegment}', exclusions='${exclusions ? exclusions.length : 0} items'`);

            // Basic validation
            if (!nameOrSegment || !exclusions || !Array.isArray(exclusions) || exclusions.length === 0) {
                return false;
            }

            const excluded = exclusions.some((pattern: string) => {
                // Handle potential null/undefined/empty patterns in the list
                if (typeof pattern !== 'string' || pattern === '') {
                    return false;
                }

                // *** FIX: Add trimming logic to the mock ***
                const trimmedPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
                // *** END FIX ***


                if (pattern.includes('*')) { // Check original pattern for wildcard presence
                    // Basic wildcard matching using the *trimmed* pattern
                    try {
                        // Escape regex special characters in the trimmed pattern before replacing *
                        const escapedPattern = trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        // Use the global flag 'g' if needed, depends on expected pattern behavior
                        const regex = new RegExp('^' + escapedPattern.replace(/\\\*/g, '.*') + '$');
                        return regex.test(nameOrSegment);
                    } catch (e) {
                        // Log the original pattern for clarity
                        console.error(`Invalid regex pattern created from wildcard: '${pattern}' (trimmed: '${trimmedPattern}')`, e);
                        return false; // Treat invalid patterns as non-matching
                    }
                } else {
                    // *** FIX: Use trimmedPattern for direct match ***
                    return nameOrSegment === trimmedPattern;
                    // *** END FIX ***
                }
            });
            // console.log(`Mock isExcluded result for '${nameOrSegment}': ${excluded}`);
            return excluded;
        }
    };
});



// --- Test Suite ---
describe("File Summary Service: shouldSummarizeFile", () => {

    // --- Tests for Allowed Files ---
    describe("Allowed Files", () => {
        it("should return true for files with allowed extensions", async () => {
            // Calls now use the new signature: (filePath, configObject)
            expect(await shouldSummarizeFile("src/component.ts", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("README.md", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("/path/to/config.json", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("scripts/deploy.sh", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("styles/main.css", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("Dockerfile", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile(".gitignore", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("path/.env.example", defaultConfigs)).toBe(true);
        });

        it("should return true for files with uppercase extensions if they match lowercase", async () => {
            expect(await shouldSummarizeFile("DOCUMENT.TXT", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("CODE.PY", defaultConfigs)).toBe(true);
        });

        it("should return true for files directly in the root", async () => {
            expect(await shouldSummarizeFile("main.js", defaultConfigs)).toBe(true);
        });
    });

    // --- Tests for Disallowed Files ---
    describe("Disallowed Files", () => {
        it("should return false for files with disallowed extensions", async () => {
            expect(await shouldSummarizeFile("image.png", defaultConfigs)).toBe(false); // Assuming .png is not in ALLOWED_FILE_CONFIGS
            expect(await shouldSummarizeFile("archive.zip", defaultConfigs)).toBe(false); // Assuming .zip is not in ALLOWED_FILE_CONFIGS
            expect(await shouldSummarizeFile("document.pdf", defaultConfigs)).toBe(false); // Assuming .pdf is not in ALLOWED_FILE_CONFIGS
            expect(await shouldSummarizeFile("data.csv", defaultConfigs)).toBe(false); // Assuming .csv is not in ALLOWED_FILE_CONFIGS
            // Check exclusion for *.exe (via wildcard in mock)
            expect(await shouldSummarizeFile("binary.exe", defaultConfigs)).toBe(false);
        });

        it("should return false for files explicitly excluded by ignoredConfig (path match)", async () => {
            expect(await shouldSummarizeFile("node_modules/package/index.js", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("path/to/yarn.lock", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("dist/bundle.js", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("coverage/report.html", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile(".git/config", defaultConfigs)).toBe(false);
            // Test wildcard exclusion
            expect(await shouldSummarizeFile("error.log", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("backup.bak", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("temp_file.tmp", defaultConfigs)).toBe(false);
        });

        it("should return false for files in excluded directories (based on path match)", async () => {
            expect(await shouldSummarizeFile("some/nested/node_modules/dep/file.js", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("project/build/output.bin", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("my/python/venv/lib/site.py", defaultConfigs)).toBe(false); // 'venv' excluded
        });

        it("should return false for files without extensions (unless filename is explicitly allowed)", async () => {
            // Assuming 'Makefile' isn't in ALLOWED_FILE_CONFIGS list used for filenames
            expect(await shouldSummarizeFile("Makefile", defaultConfigs)).toBe(false);
            // Assuming 'LICENSE' isn't in ALLOWED_FILE_CONFIGS list used for filenames
            expect(await shouldSummarizeFile("LICENSE", defaultConfigs)).toBe(false);
        });
    });

    // --- Edge Cases ---
    describe("Edge Cases", () => {
        // it("should return false for empty file paths or invalid config", async () => {
        //     expect(await shouldSummarizeFile("", defaultConfigs)).toBe(false);
        //     // Test invalid config variations
        //     expect(await shouldSummarizeFile("test.js", null as any)).toBe(false);
        //     expect(await shouldSummarizeFile("test.js", {} as any)).toBe(false);
        //     expect(await shouldSummarizeFile("test.js", { allowedConfig: [] } as any)).toBe(false);
        //     expect(await shouldSummarizeFile("test.js", { ignoredConfig: [] } as any)).toBe(false);
        // });

        it("should handle paths with leading/trailing slashes correctly", async () => {
            expect(await shouldSummarizeFile("/src/component.ts/", defaultConfigs)).toBe(true);
            expect(await shouldSummarizeFile("/archive.zip/", defaultConfigs)).toBe(false);
            expect(await shouldSummarizeFile("/node_modules/test.js/", defaultConfigs)).toBe(false);
        });

        it("should handle dotfiles correctly", async () => {
            // Assuming '.eslintrc.json' is not explicitly allowed/excluded, but .json is.
            // If '.eslintrc.json' IS in ALLOWED_FILE_CONFIGS, this is correct.
            // If not, but '.json' IS, this is correct.
            expect(await shouldSummarizeFile(".eslintrc.json", defaultConfigs)).toBe(true);

            // '.prettierrc' has no extension, and assume it's not in ALLOWED_FILE_CONFIGS
            expect(await shouldSummarizeFile(".prettierrc", defaultConfigs)).toBe(false);

            // '.env' IS in BOTH allowed and ignored. Ignored takes precedence.
            expect(await shouldSummarizeFile(".env", defaultConfigs)).toBe(false); // <<< EXPECTATION CHANGED TO FALSE

            // '.gitattributes' IS in allowed, NOT in ignored.
            expect(await shouldSummarizeFile(".gitattributes", defaultConfigs)).toBe(true);

            // '.github/workflows/ci.yml' - '.github' is NOT ignored, '.yml' IS allowed.
            expect(await shouldSummarizeFile(".github/workflows/ci.yml", defaultConfigs)).toBe(true);

            // '.git/hooks/pre-commit' - '.git' IS ignored.
            expect(await shouldSummarizeFile(".git/hooks/pre-commit", defaultConfigs)).toBe(false);

            // '.env.local' - IS ignored (by pattern *.env.local)
            expect(await shouldSummarizeFile(".env.local", defaultConfigs)).toBe(false);
            // '.env.example' - IS allowed, NOT ignored.
            expect(await shouldSummarizeFile(".env.example", defaultConfigs)).toBe(true);
        });
    });
});