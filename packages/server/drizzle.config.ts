import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: 'sqlite', // 'mysql' | 'sqlite' | 'turso'
  schema: '../shared/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: "sqlite.db"
  }
})