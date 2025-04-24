import type { ProjectFile } from "../schemas/project.schemas";

/**
 * Optional configuration interface to control the output style
 * or any other formatting rules you want.
 */
export interface SummaryFormatOptions {
    sectionDelimiter?: string; // e.g. "-----"
    headerStyle?: (file: ProjectFile) => string;
    footerStyle?: (file: ProjectFile) => string;
    includeEmptySummaries?: boolean; // Whether to include items with no summary
}

const defaultOptions: Required<SummaryFormatOptions> = {
    sectionDelimiter: "----------------------------------------",
    headerStyle: (file: ProjectFile) => `File: ${file.name}`,
    footerStyle: () => "",
    includeEmptySummaries: false
};

/**
 * Combines all file summaries into a single multiline string.
 * Each file's name is displayed before its summary, with a separator in between.
 */
export function buildCombinedFileSummaries(
    files: ProjectFile[],
    options: SummaryFormatOptions = {}
): string {
    const { sectionDelimiter, headerStyle, footerStyle, includeEmptySummaries } = {
        ...defaultOptions,
        ...options
    };

    if (!files.length) {
        return "No files provided.";
    }

    let output = "<summary_memory>\n";

    for (const file of files) {
        // Skip empty summaries if not configured to include them.
        if (!file.summary?.trim() && !includeEmptySummaries) {
            continue;
        }

        // Build header for this file
        output += `${headerStyle(file)}\n`;

        // Add the actual summary
        output += file.summary?.trim() || "(No summary provided)";

        // Optional trailing text
        const footerText = footerStyle(file);
        if (footerText) {
            output += `\n${footerText}`;
        }

        // Add the delimiter after each file
        output += `\n${sectionDelimiter}\n\n`;
    }

    output += "</summary_memory>";
    return output;
}