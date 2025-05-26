import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import {
    TicketReadSchema,
    TicketTaskReadSchema,
    TicketFileReadSchema,
} from 'shared/src/schemas/ticket.schemas'
import { normalizeToUnixMs } from '../parse-timestamp'

// Define the base directory for storing ticket data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'ticket_storage')
const TICKETS_FILE = 'tickets.json'
const TICKET_DATA_SUBDIR = 'ticket_data'

// --- Schemas for Storage (matching on-disk structure) ---

// All ticket metadata - keys are stored as strings in JSON
export const TicketsStorageSchema = z.record(z.string(), TicketReadSchema)
export type TicketsStorage = z.infer<typeof TicketsStorageSchema>

// Tasks for a single ticket - keys are stored as strings in JSON but represent numeric IDs
export const TicketTasksStorageSchema = z.record(z.string(), TicketTaskReadSchema)
export type TicketTasksStorage = z.infer<typeof TicketTasksStorageSchema>

// File links for a single ticket (array of objects)
export const TicketFilesStorageSchema = z.array(TicketFileReadSchema)
export type TicketFilesStorage = z.infer<typeof TicketFilesStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the main tickets index file. */
function getTicketsIndexPath(): string {
    return path.join(DATA_DIR, TICKETS_FILE)
}

/** Gets the absolute path to a specific ticket's data directory. */
function getTicketDataDir(ticketId: number): string {
    return path.join(DATA_DIR, TICKET_DATA_SUBDIR, ticketId.toString())
}

/** Gets the absolute path to a specific ticket's tasks file. */
function getTicketTasksPath(ticketId: number): string {
    return path.join(getTicketDataDir(ticketId), 'tasks.json')
}

/** Gets the absolute path to a specific ticket's linked files file. */
function getTicketFilesPath(ticketId: number): string {
    return path.join(getTicketDataDir(ticketId), 'files.json')
}

// --- Core Read/Write Functions ---

/** Ensures the specified directory exists. */
async function ensureDirExists(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true })
    } catch (error: any) {
        if (error.code !== 'EEXIST') {
            console.error(`Error creating directory ${dirPath}:`, error)
            throw new Error(`Failed to ensure directory exists: ${dirPath}`)
        }
    }
}

/**
 * Reads and validates JSON data from a file.
 */
async function readValidatedJson<T extends ZodTypeAny>(
    filePath: string,
    schema: T,
    defaultValue: z.infer<T>
): Promise<z.infer<T>> {
    try {
        await ensureDirExists(path.dirname(filePath))
        const fileContent = await fs.readFile(filePath, 'utf-8')
        const jsonData = JSON.parse(fileContent)

        const validationResult = await schema.safeParseAsync(jsonData)

        if (!validationResult.success) {
            console.error(`Zod validation failed reading ${filePath}:`, validationResult.error.flatten().fieldErrors)
            console.warn(`Returning default value due to validation failure for ${filePath}.`)
            return defaultValue
        }
        return validationResult.data
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return defaultValue
        }
        console.error(`Error reading or parsing JSON from ${filePath}:`, error)
        throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
    }
}

/**
 * Validates data and writes it to a JSON file.
 */
async function writeValidatedJson<T extends ZodTypeAny>(
    filePath: string,
    data: unknown,
    schema: T
): Promise<z.infer<T>> {
    try {
        const validationResult = await schema.safeParseAsync(data)
        if (!validationResult.success) {
            console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.flatten().fieldErrors)
            throw new ZodError(validationResult.error.errors)
        }
        const validatedData = validationResult.data

        await ensureDirExists(path.dirname(filePath))
        const jsonString = JSON.stringify(validatedData, null, 2)
        await fs.writeFile(filePath, jsonString, 'utf-8')
        return validatedData
    } catch (error: any) {
        console.error(`Error writing JSON to ${filePath}:`, error)
        if (error instanceof ZodError) {
            throw error
        }
        throw new Error(`Failed to write JSON file at ${filePath}. Reason: ${error.message}`)
    }
}

// --- Specific Data Accessors ---

export const ticketStorage = {
    /** Reads the main tickets metadata file. */
    async readTickets(): Promise<TicketsStorage> {
        return readValidatedJson(getTicketsIndexPath(), TicketsStorageSchema, {})
    },

    /** Writes the main tickets metadata file. */
    async writeTickets(tickets: TicketsStorage): Promise<TicketsStorage> {
        return writeValidatedJson(getTicketsIndexPath(), tickets, TicketsStorageSchema)
    },

    /** Reads a specific ticket's tasks file. */
    async readTicketTasks(ticketId: number): Promise<TicketTasksStorage> {
        return readValidatedJson(getTicketTasksPath(ticketId), TicketTasksStorageSchema, {})
    },

    /** Writes a specific ticket's tasks file. */
    async writeTicketTasks(ticketId: number, tasks: TicketTasksStorage): Promise<TicketTasksStorage> {
        return writeValidatedJson(getTicketTasksPath(ticketId), tasks, TicketTasksStorageSchema)
    },

    /** Reads a specific ticket's linked files file. */
    async readTicketFiles(ticketId: number): Promise<TicketFilesStorage> {
        return readValidatedJson(getTicketFilesPath(ticketId), TicketFilesStorageSchema, [])
    },

    /** Writes a specific ticket's linked files file. */
    async writeTicketFiles(ticketId: number, files: TicketFilesStorage): Promise<TicketFilesStorage> {
        return writeValidatedJson(getTicketFilesPath(ticketId), files, TicketFilesStorageSchema)
    },

    /** Deletes a ticket's data directory (including its tasks.json and files.json). */
    async deleteTicketData(ticketId: number): Promise<void> {
        const dirPath = getTicketDataDir(ticketId)
        try {
            await fs.access(dirPath) // Check if directory exists
            await fs.rm(dirPath, { recursive: true, force: true })
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.warn(`Ticket data directory not found, nothing to delete: ${dirPath}`)
            } else {
                console.error(`Error deleting ticket data directory ${dirPath}:`, error)
                throw new Error(`Failed to delete ticket data directory: ${dirPath}. Reason: ${error.message}`)
            }
        }
    },

    /** Generates a unique ID. */
    generateId: (): number => {
        // return unix timestamp in milliseconds
        return normalizeToUnixMs(new Date())
    }
}