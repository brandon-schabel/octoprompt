import { BunFile, file, write, fileURLToPath } from 'bun'; // Import Bun file system functions
import { mkdir, readdir } from 'node:fs/promises'; // Added readdir
import { join } from 'node:path'; // Added for LOG_DIR and getLogFilePath
import os from 'node:os'; // Added for LOG_DIR
// import type { FileWriter } from 'bun'; // Removed problematic type import




export const AGENT_LOGS_DIR = './agent-logs'


// --- Logger Setup ---
const getRandomId = () => {
    return Math.random().toString(36).substring(2, 15);
}

export const getOrchestratorLogFilePath = (logId?: string) => {
    // Ensure the directory exists (using Bun's fs is tricky, usually done outside or assumed)
    // For simplicity, we'll assume './agent-logs/' exists.
    const fileName = `agent-orchestrator-${logId ?? getRandomId()}.jsonl` // Use .jsonl extension
    const filePath = `${AGENT_LOGS_DIR}/${fileName}`;
    return {
        fileName,
        filePath,
        logId
    }
}


// // Function to get the full path for a given log ID
// export function getLogFilePath(logId: string): string {
//     // Basic validation/sanitization for logId might be needed to prevent path traversal
//     if (!logId || logId.includes('/') || logId.includes('..')) {
//         throw new Error(`Invalid logId format: ${logId}`);
//     }
//     return join(LOG_DIR, `${logId}.log`);
// }

// Ensure log directory exists (call this once at startup ideally, but safe here too)
async function ensureLogDirExists() {
    try {
        await mkdir(AGENT_LOGS_DIR, { recursive: true });
        console.log(`Log directory ensured: ${AGENT_LOGS_DIR}`); // Added confirmation
    } catch (error) {
        console.error(`Failed to create or access log directory: ${AGENT_LOGS_DIR}`, error);
        // Decide if this should be fatal. If logging is critical, maybe re-throw.
        // throw error;
    }
}
ensureLogDirExists(); // Call it on module load to ensure the directory exists before logging starts

// --- Logger Setup ---
// Removed getRandomId and getOrchestratorLogFilePath

let logFile: BunFile | null = null;
let fileWriter: ReturnType<BunFile['writer']> | null = null; // Store the writer - Use ReturnType
let loggerInitialized = false;
let currentLogFilePath: string | null = null; // Store the current path

// Accept logFilePath as an argument
export async function initializeLogger(logFilePath: string) {
    if (loggerInitialized && logFilePath === currentLogFilePath) {
        // Already initialized with the same file, do nothing
        return;
    }
    // If initialized with a different file, potentially close the old one first (optional)
    // if (fileWriter) { await fileWriter.end(); }

    try {
        logFile = file(logFilePath); // Use the provided path
        fileWriter = logFile.writer(); // Get the writer
        currentLogFilePath = logFilePath; // Store the path being used

        // Start marker as JSON
        const startLog = JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: '--- Log Start ---' });
        fileWriter.write(startLog + '\n'); // Write using the writer
        await fileWriter.flush(); // Ensure start log is written

        console.log(`Logging initialized. Verbose logs available in ${logFilePath}`);
        loggerInitialized = true;

        // Return file info if needed elsewhere (optional, maybe just return true/false)
        return {
            fileName: logFilePath.split('/').pop() || logFilePath, // Extract filename
            filePath: logFilePath
        }
    } catch (error) {
        console.error(`FATAL: Failed to initialize file logger for ${logFilePath}:`, error);
        logFile = null;
        fileWriter = null; // Reset writer on error
        currentLogFilePath = null;
        loggerInitialized = false; // Ensure we know it failed
        // Optionally re-throw or handle error
        throw error; // Re-throw to signal failure in the orchestrator
    }

}

type LogLevel = 'info' | 'verbose' | 'warn' | 'error';

/**
 * Logs messages to a file (as JSONL) and potentially the console (as text).
 * - 'info', 'warn', 'error' levels are logged to console and file.
 * - 'verbose' level is logged only to the file.
 * @param message The primary log message string.
 * @param level The severity level of the log.
 * @param data Optional: Additional structured data to include in the log entry (will be JSON stringified in the file).
 */
export async function log(message: string, level: LogLevel = 'info', data?: Record<string, any>): Promise<void> {
    // Check if initialized correctly
    if (!loggerInitialized || !fileWriter) { // Check for fileWriter too
        console.warn("[Logger not initialized or writer failed] Attempted to log:", message, data ? JSON.stringify(data) : '');
        // Still log non-verbose to console as fallback
        if (level !== 'verbose') {
            const consoleMsg = data ? `${message} ${JSON.stringify(data)}` : message;
            switch (level) {
                case 'info': console.log(consoleMsg); break;
                case 'warn': console.warn(consoleMsg); break;
                case 'error': console.error(consoleMsg); break;
            }
        }
        return;
    }

    const timestamp = new Date().toISOString();
    // Prepare JSON object for file logging, include data if provided
    const logEntry: Record<string, any> = { timestamp, level, message };
    if (data) {
        logEntry.data = data; // Add the raw data object
    }
    const jsonLogLine = JSON.stringify(logEntry);

    // Attempt to log JSONL to file using the writer
    try {
        fileWriter.write(jsonLogLine + '\n'); // Append JSON string with newline using writer
        fileWriter.flush(); // Ensure it's written immediately (can adjust for performance if needed)
    } catch (error) {
        // Log file write failure to console
        console.error(`[Logger File Write Error] ${error instanceof Error ? error.message : String(error)}`);
        // Log the original message and data to console as a fallback for this specific failure
        const fallbackMsg = data ? `${message} ${JSON.stringify(data)}` : message;
        switch (level) {
            case 'info': console.info(`[File Log Failed] ${fallbackMsg}`); break;
            case 'verbose': console.log(`[File Log Failed - Verbose] ${fallbackMsg}`); break; // Log verbose to console ONLY if file fails
            case 'warn': console.warn(`[File Log Failed] ${fallbackMsg}`); break;
            case 'error': console.error(`[File Log Failed] ${fallbackMsg}`); break;
        }
    }

    // Log to console based on level (plain text, skip verbose)
    // Keep console output clean - only log the message string by default
    switch (level) {
        case 'info':
            console.log(message);
            break;
        case 'warn':
            console.warn(message);
            break;
        case 'error':
            console.error(message);
            break;
        case 'verbose':
            // Intentionally do nothing for console output on verbose level
            break;
    }
}

// Optional: Add a function to explicitly close the writer if needed at the end of the process
// export async function closeLogger() {
//     if (fileWriter) {
//         await fileWriter.end();
//         loggerInitialized = false;
//         logFile = null;
//         fileWriter = null;
//         console.log("Logger closed.");
//     }
// }

// --- Function to List Log Files ---

const LOG_FILE_PATTERN = /^agent-orchestrator-(.+)\.jsonl$/; // Regex to match and extract logId

/**
 * Lists available agent log filenames from the AGENT_LOGS_DIR.
 * Filters for files matching the expected pattern.
 * @returns A promise that resolves to an array of log filenames (e.g., "agent-orchestrator-xyz123.jsonl").
 */
export async function listLogFiles(): Promise<string[]> {
    try {
        await ensureLogDirExists(); // Make sure directory exists
        const files = await readdir(AGENT_LOGS_DIR);
        // Filter files matching the pattern
        const logFiles = files.filter(f => LOG_FILE_PATTERN.test(f));
        console.log(`[Agent Logger] Found ${logFiles.length} log files in ${AGENT_LOGS_DIR}`);
        return logFiles;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`[Agent Logger] Log directory not found during listing: ${AGENT_LOGS_DIR}`);
            return []; // Return empty array if directory doesn't exist
        }
        console.error(`[Agent Logger] Error listing log files in ${AGENT_LOGS_DIR}:`, error);
        throw new Error('Failed to list agent log files.'); // Re-throw for handling in the route
    }
}

// --- End Function to List Log Files ---


// --- End Logger Setup ---
