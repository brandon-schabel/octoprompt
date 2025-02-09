import { BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { sqliteDBPath } from './db-config';
import { schema } from "shared";

const isDev = process.env.DEV === 'true';

const sqlite = new Database(isDev ? sqliteDBPath : 'sqlite.db');
export const db = drizzle({ client: sqlite, schema });

export default db;


export type {
    InferSelectModel,
    InferInsertModel,
} from 'drizzle-orm';

export type {
    SQL,
    SQLWrapper,
} from 'drizzle-orm/sql';

export {
    eq,
    and,
    or,
    not,
    sql,
    inArray,
    desc
} from 'drizzle-orm';

export type AppDB = BunSQLiteDatabase<typeof schema> 