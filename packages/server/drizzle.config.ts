import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: 'sqlite', // 'mysql' | 'sqlite' | 'turso'
  schema: '../shared/schema.ts',
  dbCredentials: {
    url: "sqlite.db"
  }
})