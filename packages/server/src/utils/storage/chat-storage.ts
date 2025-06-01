// src/utils/chat-storage.ts
import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import { ChatSchema, ChatMessageSchema, type Chat, type ChatMessage } from '@octoprompt/schemas'
import { randomUUID } from 'crypto' // Assuming access to crypto
import { normalizeToUnixMs } from '../parse-timestamp'

// Define the base directory for storing chat data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'chat_storage')
const CHAT_DATA_SUBDIR = 'chat_data'

// --- Schemas for Storage ---
// Store all chats (metadata) as a map (Record) keyed by chatId
export const ChatsStorageSchema = z.record(z.string(), ChatSchema)
export type ChatsStorage = z.infer<typeof ChatsStorageSchema>

// Store messages within a specific chat as a map (Record) keyed by messageId
export const ChatMessagesStorageSchema = z.record(z.string(), ChatMessageSchema)
export type ChatMessagesStorage = z.infer<typeof ChatMessagesStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the main chats index file. */
function getChatsIndexPath(): string {
    return path.join(DATA_DIR, 'chats.json')
}

/** Gets the absolute path to a specific chat's data directory. */
function getChatDataDir(chatId: number): string {
    return path.join(DATA_DIR, CHAT_DATA_SUBDIR, chatId.toString())
}

/** Gets the absolute path to a specific chat's messages file. */
function getChatMessagesPath(chatId: number): string {
    return path.join(getChatDataDir(chatId), 'messages.json')
}

// --- Core Read/Write Functions (Adapted from project-storage.ts) ---

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
            console.error(`Zod validation failed reading ${filePath}:`, validationResult.error.errors)
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
            console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.errors)
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

export const chatStorage = {
    /** Reads the main chats metadata file. */
    async readChats(): Promise<ChatsStorage> {
        return readValidatedJson(getChatsIndexPath(), ChatsStorageSchema, {})
    },

    /** Writes the main chats metadata file. */
    async writeChats(chats: ChatsStorage): Promise<ChatsStorage> {
        return writeValidatedJson(getChatsIndexPath(), chats, ChatsStorageSchema)
    },

    /** Reads a specific chat's messages file. */
    async readChatMessages(chatId: number): Promise<ChatMessagesStorage> {
        return readValidatedJson(getChatMessagesPath(chatId), ChatMessagesStorageSchema, {})
    },

    /** Writes a specific chat's messages file. */
    async writeChatMessages(chatId: number, messages: ChatMessagesStorage): Promise<ChatMessagesStorage> {
        return writeValidatedJson(getChatMessagesPath(chatId), messages, ChatMessagesStorageSchema)
    },

    /** Deletes a chat's data directory (including its messages.json). */
    async deleteChatData(chatId: number): Promise<void> {
        const dirPath = getChatDataDir(chatId)
        try {
            await fs.access(dirPath) // Check if directory exists
            await fs.rm(dirPath, { recursive: true, force: true })
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.warn(`Chat data directory not found, nothing to delete: ${dirPath}`)
            } else {
                console.error(`Error deleting chat data directory ${dirPath}:`, error)
                throw new Error(`Failed to delete chat data directory: ${dirPath}. Reason: ${error.message}`)
            }
        }
    },

    /** Generates a unique ID. */
    generateId: (): number => {
        return normalizeToUnixMs(new Date())
    }
}