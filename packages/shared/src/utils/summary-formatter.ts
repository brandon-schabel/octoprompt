import type { ProjectFile } from "../schemas/project.schemas";

/**
 * Helper function to escape characters unsafe for XML content.
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      // Should not happen with the regex, but ensures function returns string
      default: return c;
    }
  });
}


/**
 * Optional configuration interface to control XML output.
 */
export interface SummaryXmlOptions {
    /** Whether to include <file> elements for files with no summary text. */
    includeEmptySummaries?: boolean;
    /** Placeholder text for empty summaries when includeEmptySummaries is true. */
    emptySummaryText?: string;
}

// Define default options for the XML generation
const defaultXmlOptions: Required<SummaryXmlOptions> = {
    includeEmptySummaries: false,
    emptySummaryText: "(No summary provided)"
};

/**
 * Combines all file summaries into a single XML string.
 * Each file is represented by a <file> element containing <name> and <summary>.
 *
 * Example Output: 
 * <summary_memory>
 * <file>
 * <name>src/utils.ts</name>
 * <summary>Contains utility functions for string manipulation.</summary>
 * </file>
 * <file>
 * <name>README.md</name>
 * <summary>Project documentation.</summary>
 * </file>
 * </summary_memory>
 */
export function buildCombinedFileSummariesXml(
    files: ProjectFile[],
    options: SummaryXmlOptions = {}
): string {
    // Merge provided options with defaults
    const { includeEmptySummaries, emptySummaryText } = {
        ...defaultXmlOptions,
        ...options
    };

    // Handle the case where no files are provided
    if (!files.length) {
        // Return an empty root element, which is more idiomatic for XML
        return "<summary_memory>\n</summary_memory>";
    }

    // Start the root XML element
    let output = "<summary_memory>\n";

    for (const file of files) {
        const summaryContent = file.summary?.trim();

        // Skip files with empty summaries if not configured to include them
        if (!summaryContent && !includeEmptySummaries) {
            continue;
        }

        // Start the <file> element for this file
        output += "  <file>\n"; // Indentation for readability

        output += `    <file_id>${file.id}</file_id>\n`;

        // Add the <name> element, escaping the file name
        output += `    <name>${escapeXml(file.name)}</name>\n`;

        // Add the <summary> element, escaping the content
        // Use placeholder text if summary is empty but included
        const summaryTextToInclude = summaryContent || emptySummaryText;
        output += `    <summary>${escapeXml(summaryTextToInclude)}</summary>\n`;

        // Close the <file> element
        output += "  </file>\n";
    }

    // Close the root XML element
    output += "</summary_memory>";

    return output;
}

