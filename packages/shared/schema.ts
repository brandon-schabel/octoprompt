import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
    sqliteTable,
    text,
    integer,
    type SQLiteTableWithColumns,
    primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

// Re-export SQLite types
export type { SQLiteTableWithColumns };

// Chat sessions table
export const chats = sqliteTable(
    "chats",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
        title: text("title"),
        createdAt: integer("created_at", { mode: "timestamp" })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    }
);

// Define base types for Chat
export type Chat = InferSelectModel<typeof chats>;
export type NewChat = InferInsertModel<typeof chats>;

export const chatMessages = sqliteTable("chat_messages", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    chatId: text("chat_id")
        .notNull()
        .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
});

// Define base types for ChatMessage
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type NewChatMessage = InferInsertModel<typeof chatMessages>;

// Extended type with optional tempId
export type ExtendedChatMessage = ChatMessage & {
    tempId?: string;
};

export const projects = sqliteTable(
    "projects",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
        name: text("name").notNull(),
        description: text("description").default(""),
        path: text("path").notNull(),
        createdAt: integer("created_at", { mode: "timestamp" })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    }
);

export type Project = InferSelectModel<typeof projects>;

export const files = sqliteTable("files", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    projectId: text("project_id")
        .notNull()
        .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    path: text("path").notNull(),
    extension: text("extension").notNull(),
    size: integer("size").notNull(),
    content: text("content"),

    // NEW FIELDS:
    summary: text("summary").default(""),
    summaryLastUpdatedAt: integer("summary_last_updated_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    meta: text("meta").default(""),
    checksum: text("checksum").default(""),

    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
});

export const projectFileSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    path: z.string(),
    extension: z.string(),
    size: z.number(),
    content: z.string().nullable(),
    summary: z.string().default(""),
    summaryLastUpdatedAt: z.date().optional(),
    meta: z.string().default(""),
    checksum: z.string().default(""),
    createdAt: z.date(),
    updatedAt: z.date(),
});


export type ProjectFileInferredSchema = z.infer<typeof projectFileSchema>
export type ProjectFile = InferSelectModel<typeof files>;

export const prompts = sqliteTable("prompts", {
    // NEW/UPDATED: Removed projectId; each prompt is no longer tied to a single project
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    name: text("name").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
});

export type Prompt = InferSelectModel<typeof prompts>;

export const promptProjects = sqliteTable("prompt_projects", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    promptId: text("prompt_id")
        .notNull()
        .references(() => prompts.id, { onDelete: "cascade" }),
    projectId: text("project_id")
        .notNull()
        .references(() => projects.id, { onDelete: "cascade" }),
});



// TODO: store book marks in a more structured way in the DB
// export const bookmarks = sqliteTable("bookmarks", {
//     id: text("id")
//         .primaryKey()
//         .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
//     // e.g. a JSON string of file ids
//     fileIds: text("file_ids").notNull().default("[]"),
//     // e.g. name for the bookmark group
//     name: text("name").default(""),
//     createdAt: integer("created_at", { mode: "timestamp" })
//         .default(sql`CURRENT_TIMESTAMP`)
//         .notNull(),
//     updatedAt: integer("updated_at", { mode: "timestamp" })
//         .default(sql`CURRENT_TIMESTAMP`)
//         .notNull(),
// });

// export type Bookmark = InferSelectModel<typeof bookmarks>;


export const flags = sqliteTable("flags", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    key: text("key").notNull(),
    enabled: integer("enabled", { mode: 'boolean' }).notNull().default(false),
    description: text("description").default(""),
    data: text("data").default(""),
});

export type FlagModel = InferSelectModel<typeof flags>;

export const providerKeys = sqliteTable("provider_keys", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    provider: text("provider").notNull(),    // e.g. "openai", "openrouter", "lmstudio", "ollama"
    key: text("key").notNull(),              // the actual license/API key
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
});

export type ProviderKey = InferSelectModel<typeof providerKeys>;


// ----------------------
// TICKETS (NEW)
// ----------------------
export const tickets = sqliteTable("tickets", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    projectId: text("project_id")
        .notNull()
        .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    overview: text("overview").default(""),
    status: text("status").default("open"),   // e.g. "open", "in_progress", "closed"
    priority: text("priority").default("normal"), // e.g. "low", "normal", "high"

    /**
     * NEW FIELD: suggestedFileIds - a JSON string storing an array of file IDs.
     * Because SQLite doesn't have an array type, we store it as JSON text.
     */
    suggestedFileIds: text("suggested_file_ids").default("[]"),

    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
});

// For Drizzle
export type Ticket = InferSelectModel<typeof tickets>;
export type NewTicket = InferInsertModel<typeof tickets>;

// Relationship table for associating files to a ticket
export const ticketFiles = sqliteTable("ticket_files", {
    ticketId: text("ticket_id")
        .notNull()
        .references(() => tickets.id, { onDelete: "cascade" }),
    fileId: text("file_id")
        .notNull()
        .references(() => files.id, { onDelete: "cascade" }),
    // If you want to store additional fields, e.g. a reason or notes, add them here
    // e.g. "notes" or "type" of link
}, (ticketFiles) => ({
    pk: primaryKey({ columns: [ticketFiles.ticketId, ticketFiles.fileId] }),
}));

export type TicketFile = InferSelectModel<typeof ticketFiles>;

/** --- TICKET TASKS --- **/
export const ticketTasks = sqliteTable("ticket_tasks", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    ticketId: text("ticket_id")
        .notNull()
        .references(() => tickets.id, { onDelete: "cascade" }),
    content: text("content").notNull(),  // e.g. "Implement auth flow"
    done: integer("done", { mode: "boolean" })
        .default(false) // false
        .notNull(),
    orderIndex: integer("order_index")
        .default(0)
        .notNull(), // used for reordering
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
});
export type TicketTask = InferSelectModel<typeof ticketTasks>;
export type NewTicketTask = InferInsertModel<typeof ticketTasks>;


export const fileChanges = sqliteTable("file_changes", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filePath: text("file_path").notNull(),
    originalContent: text("original_content").notNull(),
    suggestedDiff: text("suggested_diff").notNull(),
    status: text("status").notNull(), // e.g. "pending", "confirmed"
    timestamp: integer("timestamp", { mode: "number" }).notNull(),
});