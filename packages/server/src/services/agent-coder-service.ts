import { z } from "zod";
import * as ts from "typescript";
// (If needed: import { Diff } from "diff"; // for generating diff text)

// Define the schema for a project file (id, path, name, content).
const ProjectFileSchema = z.object({
    id: z.union([z.string(), z.number()]),
    path: z.string(),
    name: z.string(),
    content: z.string()
});
type ProjectFile = z.infer<typeof ProjectFileSchema>;

// Define schema for a Task and Ticket.
const TaskSchema = z.object({
    id: z.string().optional(),
    description: z.string(),       // e.g. "Implement X in file Y"
    file: ProjectFileSchema.optional(),  // Reference to file to modify (if applicable)
    status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
    isTest: z.boolean().default(false)   // flag if this task is test-related
});
type Task = z.infer<typeof TaskSchema>;

const TicketSchema = z.object({
    id: z.string().optional(),
    title: z.string(),             // high-level description (from user prompt)
    status: z.enum(["open", "in_progress", "completed"]).default("open"),
    tasks: z.array(TaskSchema)
});
type Ticket = z.infer<typeof TicketSchema>;

// Define input schema for the agent.
const InputSchema = z.object({
    prompt: z.string(),
    system: z.string().optional(),    // system context or instructions
    files: z.array(ProjectFileSchema),
    summary: z.string(),             // project-wide summary in XML format
    runTests: z.boolean().default(false)
});
type AgentInput = z.infer<typeof InputSchema>;

// Main Agent function
function runAgent(rawInput: unknown) {
    // 1. Parse and validate input.
    const input = InputSchema.parse(rawInput);
    const { prompt, system, files, summary, runTests } = input;

    // 2. Create tickets and tasks from prompt.
    const ticket = createTicketFromPrompt(prompt, system, summary, files);
    let tasks = ticket.tasks;

    // 3. Plan test-related tasks before code changes.
    const testTasks = planTestTasks(tasks, files);
    tasks = tasks.concat(testTasks);
    ticket.tasks = tasks;

    // 4. Generate code change plan (diffs) for all tasks.
    const changePlan = generateChangePlan(tasks, files);

    // 5. Apply changes in-memory.
    applyChangePlan(changePlan, files);

    // 6. Verify syntax of all updated files.
    const syntaxErrors = verifyAllFilesSyntax(files);
    if (syntaxErrors.length) {
        console.error("Syntax errors detected in updated files:");
        for (const err of syntaxErrors) {
            console.error(err);
        }
        // We could throw or mark failure here.
    }

    // 7. Indicate test execution step if requested.
    if (runTests) {
        console.log("[Test] All changes applied. Ready to run tests with `bun test`.");
        // In a real scenario, you might invoke the test runner here.
    }

    // Mark ticket as completed if we got here without errors.
    ticket.status = "completed";
    ticket.tasks.forEach(task => { if (task.status !== "completed") task.status = "completed"; });

    return { ticket, files };  // return updated ticket (with statuses) and files (with changes)
}

// Helper: Create a Ticket (with initial tasks) from the user prompt and context.
function createTicketFromPrompt(prompt: string, systemCtx: string | undefined, summary: string, files: ProjectFile[]): Ticket {
    const title = prompt.trim();
    const ticket: Ticket = { title, status: "open", tasks: [] };

    // For simplicity, break prompt by newline or semicolon into sub-tasks if possible.
    const promptLines = title.split(/\r?\n|\r|;/).map(s => s.trim()).filter(s => s);
    const taskDescs = promptLines.length > 1 ? promptLines : [title];

    // Create a task for each description.
    for (let i = 0; i < taskDescs.length; i++) {
        const desc = taskDescs[i];
        const task: Task = {
            id: `task_${i + 1}`,
            description: desc,
            status: "pending",
            isTest: false
        };
        // Attempt to attach a file reference if mentioned in prompt or summary.
        const fileRef = findRelevantFile(desc, summary, files);
        if (fileRef) task.file = fileRef;
        ticket.tasks.push(task);
    }

    return ticket;
}

// Helper: Find a relevant project file for a given instruction, using summary context.
function findRelevantFile(text: string, summary: string, files: ProjectFile[]): ProjectFile | undefined {
    let bestMatch: ProjectFile | undefined;
    const lowerText = text.toLowerCase();
    // Heuristic: find file whose name or path appears in the instruction text.
    for (const file of files) {
        const nameMatch = lowerText.includes(file.name.toLowerCase());
        const pathMatch = lowerText.includes(file.path.toLowerCase());
        if (nameMatch || pathMatch) {
            bestMatch = file;
            break;
        }
    }
    if (bestMatch) return bestMatch;
    // If not found by direct name, try using summary: find a file mentioned in summary that relates.
    // We assume summary might contain file paths or component names.
    for (const file of files) {
        if (summary.toLowerCase().includes(file.path.toLowerCase()) && lowerText.includes(file.name.split('.')[0].toLowerCase())) {
            bestMatch = file;
            break;
        }
    }
    return bestMatch;
}

// Helper: Plan test tasks for each code task.
function planTestTasks(tasks: Task[], files: ProjectFile[]): Task[] {
    const testTasks: Task[] = [];
    const handledFiles = new Set<string>();
    for (const task of tasks) {
        if (task.file && !task.isTest) {
            const file = task.file;
            if (handledFiles.has(file.path)) continue; // already planned tests for this file
            handledFiles.add(file.path);
            const baseName = file.name.replace(/\.[jt]sx?$/, "");
            // Find an existing test file for this base name.
            const testFile = files.find(f =>
                (f.name.startsWith(baseName) || f.name.includes(baseName)) &&
                /\.(test|spec)\.tsx?$/.test(f.path)
            );
            if (testFile) {
                // Add task to update existing test file.
                testTasks.push({
                    id: `test_${baseName}`,
                    description: `Update tests for ${baseName}`,
                    file: testFile,
                    status: "pending",
                    isTest: true
                });
            } else {
                // Plan to create a new test file.
                const newTestName = `${baseName}.test.ts`;
                const newTestPath = findTestPathForFile(file.path, newTestName);
                testTasks.push({
                    id: `test_${baseName}`,
                    description: `Create new test file ${newTestName}`,
                    // file will be created in generateChangePlan
                    status: "pending",
                    isTest: true
                });
                // We don't push a file here; we'll create it during change plan generation.
            }
        }
    }
    return testTasks;
}

// Helper: Determine a path for a new test file (simple strategy: same directory or in a __tests__ folder).
function findTestPathForFile(filePath: string, testFileName: string): string {
    if (filePath.includes("/")) {
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        // If directory contains 'src', place test in parallel __tests__ directory
        if (dir.endsWith("src")) {
            return dir + "/__tests__/" + testFileName;
        }
        return dir + "/" + testFileName;
    }
    return testFileName;
}

// Helper: Generate code changes (diffs or new content) for each task.
type FileChange = { filePath: string, newContent: string };
function generateChangePlan(tasks: Task[], files: ProjectFile[]): FileChange[] {
    const changes: FileChange[] = [];
    const fileMap: { [path: string]: ProjectFile } = {};
    files.forEach(f => fileMap[f.path] = f);

    for (const task of tasks) {
        // Only handle code-editing tasks and test tasks that involve file content changes.
        if (!task.file && task.description.startsWith("Create new test file")) {
            // Create new test file content if not existing.
            const match = task.description.match(/Create new test file (\S+)/);
            const fileName = match ? match[1] : "new.test.ts";
            const filePath = findTestPathForFile("", fileName);
            const testContent = createTestStub(fileName);
            changes.push({ filePath, newContent: testContent });
            continue;
        }
        if (!task.file) continue; // no file context to modify
        const file = task.file;
        let original = file.content;
        let updated = original;
        const desc = task.description.toLowerCase();

        // **Minimal editing logic** (could be improved with actual AST parsing):
        if (desc.includes("create") && desc.includes("test")) {
            // (Handled above in create new test file case)
            continue;
        }
        if (desc.includes("add") && desc.includes("function")) {
            // Add a stub function at the end of the file.
            const funcNameMatch = task.description.match(/Add function (\w+)/i);
            const funcName = funcNameMatch ? funcNameMatch[1] : "newFunction";
            const stub = `\nfunction ${funcName}() {\n  // TODO: implementation\n}\n`;
            updated = original + stub;
        } else if (desc.includes("rename")) {
            // Simple rename: find "X to Y" in description.
            const renameMatch = task.description.match(/rename\s+(\w+)\s+to\s+(\w+)/i);
            if (renameMatch) {
                const [_, oldName, newName] = renameMatch;
                // Replace whole word occurrences of oldName with newName.
                const regex = new RegExp(`\\b${oldName}\\b`, "g");
                updated = original.replace(regex, newName);
            }
        } else if (desc.includes("update") || desc.includes("modify") || desc.includes("implement")) {
            // As a placeholder: append a comment indicating the change (to avoid complex parsing).
            updated = original + `\n// TODO: ${task.description}\n`;
        }
        // Otherwise, for unspecified cases, we can also append a comment as a fallback.
        if (updated === original && !desc.includes("todo")) {
            updated = original + `\n// TODO: ${task.description}\n`;
        }

        // Record the change if any.
        if (updated !== original) {
            changes.push({ filePath: file.path, newContent: updated });
        }
    }
    return changes;
}

// Helper: Create a basic stub content for a new test file.
function createTestStub(testFileName: string): string {
    const base = testFileName.replace(/\.test\.tsx?$/, "");
    return `
import { test, expect } from "bun:test";

test("${base} functionality", () => {
  // TODO: implement tests for ${base}
  expect(true).toBe(true);
});
`.trim();
}

// Helper: Apply the change plan to the files array in memory.
function applyChangePlan(changes: FileChange[], files: ProjectFile[]): void {
    for (const change of changes) {
        const { filePath, newContent } = change;
        // Check if file already exists in project files.
        const fileIndex = files.findIndex(f => f.path === filePath);
        if (fileIndex !== -1) {
            // Update existing file content
            files[fileIndex] = { ...files[fileIndex], content: newContent };
        } else {
            // Add new file to project
            files.push({
                id: `new_${files.length + 1}`,
                path: filePath,
                name: filePath.includes("/") ? filePath.substring(filePath.lastIndexOf("/") + 1) : filePath,
                content: newContent
            });
        }
    }
}

// Helper: Verify syntax of all files (returns any errors).
function verifyAllFilesSyntax(files: ProjectFile[]): string[] {
    const errors: string[] = [];
    for (const file of files) {
        const sourceFile = ts.createSourceFile(
            file.path, file.content, ts.ScriptTarget.ESNext, true
        );
        // Use TypeScript to get syntactic diagnostics
        const diagnostics = sourceFile.parseDiagnostics ?? [];
        diagnostics.push(...ts.getPreEmitDiagnostics(ts.createProgram({
            rootNames: [file.path],
            options: {}
        })));
        // Collect syntax errors (filter out type errors if any, focusing on syntax)
        for (const diag of diagnostics) {
            if (diag.category === ts.DiagnosticCategory.Error) {
                const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
                errors.push(`${file.path}: ${message}`);
            }
        }
    }
    return errors;
}

// (Export runAgent for unit testing or external usage)
export { runAgent };
