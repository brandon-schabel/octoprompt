import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: 'sqlite', // 'mysql' | 'sqlite' | 'turso'
  schema: 'schema.ts',
  dbCredentials: {
    url: "sqlite.db"
  }
})