// database.ts
import { Database } from "bun:sqlite";
import type { MyAppState } from "./counter-handlers";

const db = new Database("app.db");

function createTables() {
    // Create a table to store the application state as JSON
    db.run(`
        CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY,
            json TEXT NOT NULL
        )
    `);
}

export function initializeDatabase() {
    createTables();
}

export async function loadInitialStateFromDb(): Promise<MyAppState> {
    // We'll assume there's only a single row (id=1) for the global state
    const row = db.query("SELECT json FROM app_state WHERE id = 1").get() as { json: string } | undefined;

    if (row && row.json) {
        return JSON.parse(row.json) as MyAppState;
    }

    // If we don't have any saved data in the DB yet, return a default
    return {
        counter: 0,
    };
}

export async function saveStateToDb(state: MyAppState): Promise<void> {
    const jsonState = JSON.stringify(state);

    // If row with id=1 already exists, update; otherwise insert
    db.run(`
        INSERT INTO app_state (id, json)
        VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET json=excluded.json
    `, [jsonState]);
}