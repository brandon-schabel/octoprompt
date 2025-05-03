import { BunFile, file, write } from 'bun'; // Removed fileURLToPath
import { mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path'; // Added dirname
// import os from 'node:os'; // Removed unused import
// import type { FileWriter } from 'bun'; // Removed problematic type import


// Top-level directory for all agent logs
export const AGENT_LOGS_DIR = './agent-logs';
const ORCHESTRATOR_LOG_FILENAME = 'orchestrator-log.jsonl'; // Standard filename for jsonl logs
const AGENT_DATA_FILENAME = 'agent-data.json'; // Standard filename for data logs

// --- Logger Setup ---

// No longer need getRandomId here as agentJobId will be provided

/**
 * Gets the paths for the agent orchestrator log file (.jsonl) and its directory
 * based on the agent job ID. Ensures the directory exists.
 * @param agentJobId - The unique ID for the agent run.
 * @returns An object containing the directory path and the full file path for the orchestrator log.
 */
export async function getOrchestratorLogFilePaths(agentJobId: string) {
	if (!agentJobId) throw new Error('agentJobId is required');
	const jobLogDir = join(AGENT_LOGS_DIR, agentJobId);
	await ensureLogDirExists(jobLogDir); // Ensure the specific job directory exists
	const filePath = join(jobLogDir, ORCHESTRATOR_LOG_FILENAME);
	return { jobLogDir, filePath, agentJobId };
}

/**
 * Gets the path for the agent data log file (.json) based on the agent job ID.
 * Assumes the directory is already created by getOrchestratorLogFilePaths or ensureLogDirExists.
 * @param agentJobId - The unique ID for the agent run.
 * @returns The full file path for the agent data log.
 */
export function getAgentDataLogFilePath(agentJobId: string): string {
	if (!agentJobId) throw new Error('agentJobId is required');
	const jobLogDir = join(AGENT_LOGS_DIR, agentJobId);
	// No need to ensure dir exists here, assume it's done when orchestrator log is set up
	return join(jobLogDir, AGENT_DATA_FILENAME);
}


// Function to get the full path for a given log ID (DEPRECATED, use getOrchestratorLogFilePaths)
// export function getLogFilePath(logId: string): string { ... } // Removed old function

// Ensure a specific log directory exists (modified to take a path)
async function ensureLogDirExists(dirPath: string) {
	try {
		await mkdir(dirPath, { recursive: true });
		// console.log(`Log directory ensured: ${dirPath}`); // Less noisy logging
	} catch (error) {
		console.error(`Failed to create or access log directory: ${dirPath}`, error);
		throw error; // Re-throw to signal failure upstream
	}
}
// No initial ensureLogDirExists call here, it's done per-job now.

// --- Logger Instance Management ---
// Removed getRandomId and getOrchestratorLogFilePath (replaced)

let logFile: BunFile | null = null;
let fileWriter: ReturnType<BunFile['writer']> | null = null;
let loggerInitialized = false;
let currentLogFilePath: string | null = null; // Store the current orchestrator log file path

/**
 * Initializes the file logger for a specific agent run's orchestrator log file.
 * @param orchestratorLogFilePath - The full path to the .jsonl log file.
 */
export async function initializeLogger(orchestratorLogFilePath: string) { // Renamed param for clarity
	if (loggerInitialized && orchestratorLogFilePath === currentLogFilePath) {
		return; // Already initialized for this file
	}
	if (fileWriter) {
		// If switching files, ensure the previous one is flushed/closed
		try {
			await fileWriter.end(); // Use end() which also flushes
			console.log(`Closed previous logger for: ${currentLogFilePath}`);
		} catch (e) { console.error(`Error closing previous logger: ${currentLogFilePath}`, e); }
		fileWriter = null; // Reset
	}

	try {
		// Ensure the directory for *this specific file* exists right before creating it.
		await ensureLogDirExists(dirname(orchestratorLogFilePath));

		logFile = file(orchestratorLogFilePath);
		fileWriter = logFile.writer();
		currentLogFilePath = orchestratorLogFilePath;

		const startLog = JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: '--- Orchestrator Log Start ---' });
		fileWriter.write(startLog + '\n');
		await fileWriter.flush();

		console.log(`Logging initialized. Orchestrator logs in ${orchestratorLogFilePath}`);
		loggerInitialized = true;

		// No need to return file info, path is known by caller
	} catch (error) {
		console.error(`FATAL: Failed to initialize file logger for ${orchestratorLogFilePath}:`, error);
		logFile = null;
		fileWriter = null;
		currentLogFilePath = null;
		loggerInitialized = false;
		throw error; // Re-throw critical failure
	}
}

type LogLevel = 'info' | 'verbose' | 'warn' | 'error';

/**
 * Logs messages to the initialized orchestrator log file (as JSONL) and potentially the console.
 * @param message The primary log message string.
 * @param level The severity level ('info', 'verbose', 'warn', 'error'). 'verbose' only goes to file.
 * @param data Optional structured data.
 */
export async function log(message: string, level: LogLevel = 'info', data?: Record<string, any>): Promise<void> {
	if (!loggerInitialized || !fileWriter) {
		console.warn("[Logger not initialized/writer error] Log attempt:", level, message, data ? JSON.stringify(data) : '');
		// Fallback console logging for non-verbose
		if (level !== 'verbose') {
			const consoleMsg = data ? `${message} ${JSON.stringify(data)}` : message;
			if (level === 'info') console.log(consoleMsg);
			else if (level === 'warn') console.warn(consoleMsg);
			else if (level === 'error') console.error(consoleMsg);
		}
		return;
	}

	const timestamp = new Date().toISOString();
	const logEntry: Record<string, any> = { timestamp, level, message };
	if (data) logEntry.data = data;
	const jsonLogLine = JSON.stringify(logEntry);

	try {
		fileWriter.write(jsonLogLine + '\n');
		// Consider removing immediate flush for performance if logs are frequent,
		// but ensure flush/end happens reliably on close/error.
		await fileWriter.flush(); // Keep flush for now for reliability during dev/debug
	} catch (error) {
		console.error(`[Logger File Write Error] ${error instanceof Error ? error.message : String(error)}`);
		const fallbackMsg = data ? `${message} ${JSON.stringify(data)}` : message;
		// Log to console on file write failure, including verbose ones
		if (level === 'info') console.info(`[File Log Failed] ${fallbackMsg}`);
		else if (level === 'verbose') console.log(`[File Log Failed - Verbose] ${fallbackMsg}`);
		else if (level === 'warn') console.warn(`[File Log Failed] ${fallbackMsg}`);
		else if (level === 'error') console.error(`[File Log Failed] ${fallbackMsg}`);
	}

	// Console logging (skip verbose)
	if (level !== 'verbose') {
		if (level === 'info') console.log(message);
		else if (level === 'warn') console.warn(message);
		else if (level === 'error') console.error(message);
	}
}

/**
 * Writes arbitrary data to the agent-data.json file for a given job ID.
 * This overwrites the file each time it's called.
 * @param agentJobId The ID of the agent run.
 * @param data The data object to write as JSON.
 */
export async function writeAgentDataLog(agentJobId: string, data: any): Promise<void> {
	const filePath = getAgentDataLogFilePath(agentJobId);
	try {
		// Ensure directory exists (might be redundant if logger is initialized, but safe)
		await ensureLogDirExists(dirname(filePath));
		await write(filePath, JSON.stringify(data, null, 2)); // Pretty-print JSON
		console.log(`Agent data log written to: ${filePath}`);
	} catch (error) {
		console.error(`Failed to write agent data log to ${filePath}:`, error);
		// Decide if this should throw - depends on how critical this data is
		// throw new Error(`Failed to write agent data log for job ${agentJobId}`);
	}
}

// --- Optional Logger Close ---
export async function closeLogger() {
	if (fileWriter) {
		try {
			await fileWriter.end(); // Ensures flush before closing
			console.log(`Logger closed for: ${currentLogFilePath}`);
		} catch (e) {
			console.error(`Error closing logger for ${currentLogFilePath}:`, e);
		} finally {
			loggerInitialized = false;
			logFile = null;
			fileWriter = null;
			currentLogFilePath = null;
		}
	}
}

// --- Function to List Log Directories (Job IDs) ---

// Removed LOG_FILE_PATTERN as we now list directories

/**
 * Lists available agent job IDs by looking for directories within AGENT_LOGS_DIR.
 * @returns A promise that resolves to an array of agentJobId strings.
 */
export async function listAgentJobs(): Promise<string[]> {
	try {
		// Ensure the top-level directory exists, but don't create it if it doesn't
		// because we only want to list *existing* job directories.
		const entries = await readdir(AGENT_LOGS_DIR, { withFileTypes: true });
		const jobIds = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
		console.log(`[Agent Logger] Found ${jobIds.length} agent job directories in ${AGENT_LOGS_DIR}`);
		return jobIds;
	} catch (error: any) {
		if (error.code === 'ENOENT') {
			console.warn(`[Agent Logger] Root log directory not found during listing: ${AGENT_LOGS_DIR}`);
			return []; // Return empty array if root directory doesn't exist
		}
		console.error(`[Agent Logger] Error listing agent job directories in ${AGENT_LOGS_DIR}:`, error);
		throw new Error('Failed to list agent job IDs.'); // Re-throw for handling in the route
	}
}

// --- End Function to List Log Files ---

// --- End Logger Setup ---
