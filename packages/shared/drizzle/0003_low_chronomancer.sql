-- existing code (if any) before migration changes...

-- Disable foreign keys to avoid constraint errors during ALTER
PRAGMA foreign_keys=OFF;

-- 1) Drop "prompt_projects" table because it references "prompts" and will fail once "prompts" is dropped/renamed
DROP TABLE IF EXISTS "prompt_projects";

-- 2) Recreate the "prompts" table without the removed projectId column
CREATE TABLE "__new_prompts" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "content" text NOT NULL,
    "created_at" integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Copy existing data over
INSERT INTO "__new_prompts"("id", "name", "content", "created_at", "updated_at")
SELECT "id", "name", "content", "created_at", "updated_at"
FROM "prompts";

-- Drop the old table
DROP TABLE "prompts";

-- Rename the new table
ALTER TABLE "__new_prompts" RENAME TO "prompts";

-- 3) Recreate "prompt_projects" referencing the newly renamed "prompts" table
CREATE TABLE "prompt_projects" (
    "id" text PRIMARY KEY NOT NULL,
    "prompt_id" text NOT NULL,
    "project_id" text NOT NULL,
    FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Re-enable foreign keys
PRAGMA foreign_keys=ON;

-- existing code (if any) after migration changes...