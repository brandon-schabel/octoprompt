import { BunFile, file, write, fileURLToPath } from 'bun'; // Import Bun file system functions
// import type { FileWriter } from 'bun'; // Removed problematic type import


// --- Logger Setup ---
const getRandomId = () => {
    return Math.random().toString(36).substring(2, 15);
}

const getOrchestratorLogFilePath = () => {
    // Ensure the directory exists (using Bun's fs is tricky, usually done outside or assumed)
    // For simplicity, we'll assume './agent-logs/' exists.
    const fileName = `agent-orchestrator-${getRandomId()}.jsonl` // Use .jsonl extension
    const filePath = `./agent-logs/${fileName}`;
    return {
        fileName,
        filePath
    }
}

let logFile: BunFile | null = null;
let fileWriter: ReturnType<BunFile['writer']> | null = null; // Store the writer - Use ReturnType
let loggerInitialized = false;


export async function initializeLogger() {
    if (loggerInitialized) return;

    const { filePath, fileName } = getOrchestratorLogFilePath();
    try {
        logFile = file(filePath);
        fileWriter = logFile.writer(); // Get the writer

        // Start marker as JSON
        const startLog = JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: '--- Log Start ---' });
        fileWriter.write(startLog + '\n'); // Write using the writer
        // Don't flush immediately, let subsequent logs handle it or flush periodically if needed

        console.log(`Logging initialized. Verbose logs available in ${filePath}`);
        loggerInitialized = true;

        // Return file info if needed elsewhere
        return {
            fileName,
            filePath
        }
    } catch (error) {
        console.error("FATAL: Failed to initialize file logger:", error);
        logFile = null;
        fileWriter = null; // Reset writer on error
        loggerInitialized = false; // Ensure we know it failed
        // Optionally re-throw or handle error
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

// --- End Logger Setup ---
