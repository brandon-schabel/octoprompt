import { ProjectService } from "@/services/project-service";
import { json } from "@bnk/router";
import { ApiError } from "shared";
import { FileSummaryService } from "@/services/file-services/file-summary-service";
import { ProjectFile } from "shared/schema";
import { matchesAnyPattern } from "shared/src/utils/pattern-matcher";
import { buildCombinedFileSummaries } from "shared/src/utils/summary-formatter";
import { websocketStateAdapter } from "./websocket/websocket-state-adapter";

const projectService = new ProjectService();
const fileSummaryService = new FileSummaryService();


const buildProjectSummary = (includedFiles: ProjectFile[]) => {
    // Build the combined summaries using your summary-formatter
    return buildCombinedFileSummaries(includedFiles, {
        // We can override the header style to show the file path
        headerStyle: (file) => `File: ${file.name}, File ID: ${file.id}`,
        sectionDelimiter: "---",
        includeEmptySummaries: false
    });
}


export const getFullProjectSummary = async (projectId: string) => {
    const project = await projectService.getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    // Fetch all file summaries from the database
    const allFiles = await fileSummaryService.getFileSummaries(projectId);
    if (!allFiles.length) {
        return json({
            success: false,
            message: "No summaries available. Please summarize files first."
        });
    }

    // Retrieve global state to get ignore patterns (or other filtering preferences)
    const globalState = await websocketStateAdapter.getState();
    const ignorePatterns = globalState.settings.summarizationIgnorePatterns || [];
    const allowPatterns = globalState.settings.summarizationAllowPatterns || [];

    // Filter out files that match ignore patterns (unless a file also matches an allow pattern, if applicable)
    // The same logic your summarization page uses can be applied here:
    function isIncluded(file: ProjectFile): boolean {
        // If any ignore pattern matches, we skip—unless an allow pattern overrides it.
        const matchesIgnore = matchesAnyPattern(file.path, ignorePatterns);
        if (matchesIgnore && !matchesAnyPattern(file.path, allowPatterns)) {
            return false;
        }
        return true;
    }

    // Filter down to the "included" files
    const includedFiles = allFiles.filter(isIncluded);

    return buildProjectSummary(includedFiles)
}
