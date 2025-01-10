// packages/server/src/services/code-editor-service.ts
import { ProjectService } from "@/services/project-service";
import { APIProviders, ProjectFile } from "shared";
import { ChatService } from "../chat/chat-service";
import { UnifiedProviderService } from "../providers/unified-provider-service";

// Define your structure for diff-based responses:
interface FileToEdit {
    path: string;
    original_snippet: string;
    new_snippet: string;
}

interface CodeEditResponse {
    assistant_reply: string;
    files_to_edit?: FileToEdit[];
}

export class CodeEditorService {
    private projectService: ProjectService;
    private unifiedProviderService: UnifiedProviderService;

    constructor() {
        this.projectService = new ProjectService();
        this.unifiedProviderService = new UnifiedProviderService();
    }

    /**
     * Edits a project file using an LLM-based diff approach.
     * @param projectId The ID of the project containing the file
     * @param fileId The file ID to edit
     * @param userInstruction The user's instruction about what to change
     * @param provider The LLM provider (e.g. "openai", "anthropic", etc.)
     * @returns The updated file record
     */
    async editProjectFile({
        projectId,
        fileId,
        userInstruction,
        provider = "openai",
    }: {
        projectId: string;
        fileId: string;
        userInstruction: string;
        provider?: APIProviders;
    }): Promise<ProjectFile> {
        // 1) Fetch project to ensure existence
        const project = await this.projectService.getProjectById(projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        // 2) Fetch the file from the DB
        const projectFiles = await this.projectService.getProjectFiles(projectId);
        if (!projectFiles) {
            throw new Error("No files found for this project");
        }

        const targetFile = projectFiles.find((f) => f.id === fileId);
        if (!targetFile) {
            throw new Error("File not found");
        }

        // 3) Build a specialized prompt for the LLM
        //    In your code, you might store a system prompt or instructions about returning JSON.
        const prompt = `
      You are a senior code assistant.
      The user wants to edit the following file: ${targetFile.name}

      Current file content:
      \`\`\`
      ${targetFile.content}
      \`\`\`

      The user's instruction:
      ${userInstruction}

      Please return a JSON object with the shape:
      {
        "assistant_reply": "<description of changes>",
        "files_to_edit": [
          {
            "path": "${targetFile.name}",
            "original_snippet": "...",
            "new_snippet": "..."
          }
        ]
      }

      Make sure "original_snippet" matches EXACT text from the file so we can replace it safely.
    `;

        // 4) Use your existing "processMessage" flow
        //    We'll store the user request in the chat, then parse the resulting JSON.
        const userMessage = prompt;
        const stream = await this.unifiedProviderService.processMessage({
            chatId: "internal-code-edit-chat", // or dynamically create a chat
            userMessage,
            provider,
            options: {}, // can pass model, temperature, etc.
        });

        // 5) Stream the data. In your code, you might parse SSE chunks, but for simplicity:
        const responseText = await this.streamToString(stream);
        //    Attempt to parse the JSON from the LLM's final content
        let editResponse: CodeEditResponse;
        try {
            // Some LLMs might produce extra text, so you may do a substring approach
            const jsonMatch = this.extractJsonBlock(responseText);
            editResponse = JSON.parse(jsonMatch);
        } catch {
            throw new Error("Failed to parse JSON diff from LLM response");
        }

        // 6) If we have files_to_edit, apply the first snippet
        if (editResponse.files_to_edit && editResponse.files_to_edit.length > 0) {
            const edit = editResponse.files_to_edit[0];
            if (!edit.original_snippet || !edit.new_snippet) {
                throw new Error("Invalid diff object from LLM");
            }

            // 7) Apply the snippet replacement in memory
            const currentContent = targetFile.content || "";
            if (!currentContent.includes(edit.original_snippet)) {
                throw new Error(`Original snippet not found in file content: ${edit.original_snippet}`);
            }

            const updatedContent = currentContent.replace(edit.original_snippet, edit.new_snippet);

            // 8) Save the updated file to DB
            const updatedFile = await this.projectService.updateFileContent(fileId, updatedContent);

            // (Optional) Return updated file or a success object
            return updatedFile;
        } else {
            throw new Error("No diff edits returned by the LLM");
        }
    }

    /**
     * Converts a ReadableStream<Uint8Array> to string (for demonstration).
     * In your environment, you might handle SSE chunk by chunk.
     */
    private async streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
        }
        const decoder = new TextDecoder();
        return decoder.decode(new Uint8Array(chunks.flat()));
    }

    /**
     * Example method to extract the final JSON portion from a big text
     * if the LLM returns extra tokens.
     */
    private extractJsonBlock(fullText: string): string {
        // naive approach: look for first '{' and last '}' and parse
        const startIndex = fullText.indexOf("{");
        const endIndex = fullText.lastIndexOf("}");
        if (startIndex === -1 || endIndex === -1) {
            throw new Error("No JSON object found in the text");
        }
        return fullText.slice(startIndex, endIndex + 1);
    }
}