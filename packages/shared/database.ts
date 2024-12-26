import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const isDev = process.env.DEV === 'true';

const sqlite = new Database(isDev ? '../shared/sqlite.db' : 'sqlite.db');
export const db = drizzle(sqlite);