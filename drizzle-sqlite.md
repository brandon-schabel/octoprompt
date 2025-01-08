# Drizzle ORM with SQLite Guide for Bun + React TypeScript Projects

## Table of Contents
1. Project Setup
2. Database Configuration
3. Schema Definition
4. Migrations
5. CRUD Operations
6. Query Examples
7. Best Practices
8. Testing

## 1. Project Setup

First, create a new project and install the required dependencies:

```bash
# Create new project
bun create react my-app
cd my-app

# Install dependencies
bun add drizzle-orm @libsql/client
bun add -D drizzle-kit @types/bun
```

## 2. Database Configuration

Create a database configuration file:

```typescript:src/db/index.ts
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

// Create SQLite database instance
const sqlite = new Database('sqlite.db');

// Create Drizzle instance
export const db = drizzle(sqlite);
```

Create a Drizzle configuration file:

```typescript:drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    url: 'sqlite.db',
  },
} satisfies Config;
```

## 3. Schema Definition

Define your database schema with strong typing:

```typescript:src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Define user table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$default(() => new Date()),
});

// Define post table with relations
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$default(() => new Date()),
});

// Define types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

## 4. Migrations

Generate and run migrations:

```typescript:src/db/migrate.ts
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { db } from './index';

// Run migrations
async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runMigrations();
```

Generate migrations with Drizzle Kit:

```bash
bun run drizzle-kit generate:sqlite
```

## 5. CRUD Operations

Create a data access layer:

```typescript:src/db/repositories/userRepository.ts
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { users, type NewUser, type User } from '../schema';

export class UserRepository {
  async create(data: NewUser): Promise<User> {
    const [user] = await db.insert(users)
      .values(data)
      .returning();
    return user;
  }

  async findById(id: number): Promise<User | undefined> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async findAll(): Promise<User[]> {
    return db.select().from(users);
  }

  async update(id: number, data: Partial<NewUser>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async delete(id: number): Promise<void> {
    await db.delete(users)
      .where(eq(users.id, id));
  }
}
```

## 6. Query Examples

Complex queries with relations:

```typescript:src/db/repositories/postRepository.ts
import { eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { posts, users, type Post } from '../schema';

export class PostRepository {
  // Get posts with author information
  async getPostsWithAuthors() {
    return db.select({
      post: posts,
      author: users,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id));
  }

  // Get post count by author
  async getPostCountByAuthor() {
    return db.select({
      authorId: users.id,
      authorName: users.name,
      postCount: sql<number>`count(${posts.id})`,
    })
    .from(users)
    .leftJoin(posts, eq(posts.authorId, users.id))
    .groupBy(users.id, users.name);
  }

  // Get latest posts with pagination
  async getLatestPosts(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    
    return db.select()
      .from(posts)
      .orderBy(sql`${posts.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
  }
}
```

## 7. Best Practices

### Error Handling

```typescript:src/db/utils/errorHandler.ts
export class DatabaseError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function handleDatabaseError(error: unknown): never {
  if (error instanceof Error) {
    throw new DatabaseError(error.message, error);
  }
  throw new DatabaseError('An unknown database error occurred', error);
}
```

### Repository Pattern Implementation

```typescript:src/db/repositories/baseRepository.ts
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '../index';

export abstract class BaseRepository<T, TNew> {
  constructor(protected table: SQLiteTable) {}

  protected async handleQuery<R>(
    query: Promise<R>
  ): Promise<R> {
    try {
      return await query;
    } catch (error) {
      throw new DatabaseError('Query failed', error);
    }
  }
}
```

## 8. Testing

```typescript:src/db/__tests__/userRepository.test.ts
import { expect, test, describe } from "bun:test";
import { UserRepository } from '../repositories/userRepository';
import { db } from '../index';

describe('UserRepository', () => {
  const repo = new UserRepository();

  test('should create a new user', async () => {
    const newUser = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const user = await repo.create(newUser);
    expect(user.email).toBe(newUser.email);
    expect(user.name).toBe(newUser.name);
  });

  test('should find user by id', async () => {
    const user = await repo.findById(1);
    expect(user).toBeDefined();
  });

  // Clean up after tests
  afterAll(async () => {
    await db.delete(users);
  });
});
```

