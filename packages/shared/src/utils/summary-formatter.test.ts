import { test, expect } from "bun:test";
// Assuming the refactored function is in './summary-formatter-xml.ts'
// Adjust the import path as necessary
import { buildCombinedFileSummariesXml, type SummaryXmlOptions } from "./summary-formatter-xml";
import type { ProjectFile } from "../schemas/project.schemas"; // Assuming this path is correct

// Use a compatible interface for testing, ProjectFile might have more fields
interface TestProjectFile {
    name: string;
    summary?: string;
}

test("returns empty <summary_memory> block when file list is empty", () => {
    const result = buildCombinedFileSummariesXml([]);
    // Updated expectation for empty XML block
    expect(result).toBe("<summary_memory>\n</summary_memory>");
});

test("formats a single file with a summary using default options (XML)", () => {
    const files: TestProjectFile[] = [
        { name: "TestFile.ts", summary: "This is a summary." }
    ];
    // Use the new function name. Cast might be needed if TestProjectFile isn't identical to ProjectFile
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);

    // Expected output is now XML
    const expected =
        `<summary_memory>
  <file>
    <name>TestFile.ts</name>
    <summary>This is a summary.</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

test("skips files with empty/whitespace summary when includeEmptySummaries is false (default)", () => {
    const files: TestProjectFile[] = [
        { name: "File1.ts", summary: "Valid summary" },
        { name: "File2.ts", summary: "   " }, // Whitespace-only summary
        { name: "File3.ts", summary: undefined } // Undefined summary
    ];
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);

    // Only File1 should be included in the XML
    const expected =
        `<summary_memory>
  <file>
    <name>File1.ts</name>
    <summary>Valid summary</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

test("includes files with empty/undefined summary when includeEmptySummaries is true (XML)", () => {
    const files: TestProjectFile[] = [
        { name: "File1.ts", summary: "Valid summary" },
        { name: "File2.ts", summary: "   " }, // Whitespace-only summary
        { name: "File3.ts", summary: undefined } // Undefined summary
    ];
    // Use the new options interface
    const options: SummaryXmlOptions = { includeEmptySummaries: true };
    const result = buildCombinedFileSummariesXml(files as ProjectFile[], options);

    // File2 and File3 should be included with the default placeholder
    const expected =
        `<summary_memory>
  <file>
    <name>File1.ts</name>
    <summary>Valid summary</summary>
  </file>
  <file>
    <name>File2.ts</name>
    <summary>(No summary provided)</summary>
  </file>
  <file>
    <name>File3.ts</name>
    <summary>(No summary provided)</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

test("uses custom emptySummaryText when includeEmptySummaries is true (XML)", () => {
    const files: TestProjectFile[] = [
        { name: "NeedsSummary.ts", summary: "" }
    ];
    // Test the custom placeholder text option
    const options: SummaryXmlOptions = {
        includeEmptySummaries: true,
        emptySummaryText: "[Summary Missing]"
    };
    const result = buildCombinedFileSummariesXml(files as ProjectFile[], options);
    const expected =
        `<summary_memory>
  <file>
    <name>NeedsSummary.ts</name>
    <summary>[Summary Missing]</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});


test("formats multiple files with valid summaries (XML)", () => {
    const files: TestProjectFile[] = [
        { name: "File1.ts", summary: "Summary 1" },
        { name: "File2.js", summary: "Summary 2" }
    ];
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);
    const expected =
        `<summary_memory>
  <file>
    <name>File1.ts</name>
    <summary>Summary 1</summary>
  </file>
  <file>
    <name>File2.js</name>
    <summary>Summary 2</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});


test("correctly escapes special XML characters in name and summary", () => {
    const files: TestProjectFile[] = [
        { name: "file_with_<_&_>_chars.ts", summary: "Summary with \"quotes\" & 'apostrophes' > data <" }
    ];
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);
    const expected =
        `<summary_memory>
  <file>
    <name>file_with_&lt;<em>&amp;</em>&gt;_chars.ts</name>
    <summary>Summary with &quot;quotes&quot; &amp; &apos;apostrophes&apos; &gt; data &lt;</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

// Removed the test for headerStyle/footerStyle as those options are no longer valid.
// Added a new test specifically for XML escaping.
// Added a test for custom emptySummaryText.