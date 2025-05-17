import { Database } from 'bun:sqlite'

const db = new Database('database.sqlite')

// Create the "chats" table
db.exec(`
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT,
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
`)

// Create the "chat_messages" table
db.exec(`
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
`)

// Create the "projects" table
db.exec(`
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT DEFAULT "",
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
`)

// Create the "files" table
db.exec(`
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    extension TEXT NOT NULL,
    size INTEGER NOT NULL,
    content TEXT,
    summary TEXT DEFAULT "",
    summary_last_updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    meta TEXT DEFAULT "",
    checksum TEXT DEFAULT "",
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`)

// Create the "prompts" table
db.exec(`
CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
`)

// Create the "prompt_projects" table
db.exec(`
CREATE TABLE IF NOT EXISTS prompt_projects (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    prompt_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`)

// Create the "provider_keys" table
db.exec(`
CREATE TABLE IF NOT EXISTS provider_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider TEXT NOT NULL,
    key TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
`)

// Create the "tickets" table
db.exec(`
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    overview TEXT DEFAULT "",
    status TEXT DEFAULT "open",
    priority TEXT DEFAULT "normal",
    suggested_file_ids TEXT DEFAULT "[]",
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`)

// Create the "ticket_files" table (junction table with a composite primary key)
db.exec(`
CREATE TABLE IF NOT EXISTS ticket_files (
    ticket_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    PRIMARY KEY (ticket_id, file_id),
    FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);
`)

// Create the "ticket_tasks" table
db.exec(`
CREATE TABLE IF NOT EXISTS ticket_tasks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ticket_id TEXT NOT NULL,
    content TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at INTEGER NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
`)

// Create the "file_changes" table
db.exec(`
CREATE TABLE IF NOT EXISTS file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    original_content TEXT NOT NULL,
    suggested_diff TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);
`)

console.log('All tables created successfully.')
