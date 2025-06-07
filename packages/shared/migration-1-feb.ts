// migrateNew.ts
import Database from 'bun:sqlite'

function main() {
  // Open the new DB
  const newDb = new Database('sqlite.db')

  // Attach the old DB
  newDb.exec("ATTACH 'sqlite-old.db' AS oldDb")

  // Wrap all inserts in a single transaction for speed and atomicity
  newDb.exec('BEGIN')

  try {
    // 1) chats
    newDb.exec(`
      INSERT INTO chats (
        id,
        title,
        created_at,
        updated_at
      )
      SELECT
        id,
        title,
        created_at,
        updated_at
      FROM oldDb.chats;
    `)

    // 2) chat_messages
    newDb.exec(`
      INSERT INTO chat_messages (
        id,
        chat_id,
        role,
        content,
        created_at
      )
      SELECT
        id,
        chat_id,
        role,
        content,
        created_at
      FROM oldDb.chat_messages;
    `)

    // 3) projects
    newDb.exec(`
      INSERT INTO projects (
        id,
        name,
        description,
        path,
        created_at,
        updated_at
      )
      SELECT
        id,
        name,
        description,
        path,
        created_at,
        updated_at
      FROM oldDb.projects;
    `)

    // 4) files
    newDb.exec(`
      INSERT INTO files (
        id,
        project_id,
        name,
        path,
        extension,
        size,
        content,
        summary,
        summary_last_updated_at,
        meta,
        checksum,
        created_at,
        updated_at
      )
      SELECT
        id,
        project_id,
        name,
        path,
        extension,
        size,
        content,
        summary,
        summary_last_updated_at,
        meta,
        '' AS checksum,  -- use default value since old DB doesn't have checksum
        created_at,
        updated_at
      FROM oldDb.files;
    `)

    // 5) prompts
    newDb.exec(`
      INSERT INTO prompts (
        id,
        name,
        content,
        created_at,
        updated_at
      )
      SELECT
        id,
        name,
        content,
        created_at,
        updated_at
      FROM oldDb.prompts;
    `)

    // 6) prompt_projects
    newDb.exec(`
      INSERT INTO prompt_projects (
        id,
        prompt_id,
        project_id
      )
      SELECT
        id,
        prompt_id,
        project_id
      FROM oldDb.prompt_projects;
    `)

    // 7) global_state is deprecated.
    // Instead of migrating its data, drop the table from the new DB if it exists.
    newDb.exec(`DROP TABLE IF EXISTS global_state;`)

    // 8) flags
    newDb.exec(`
      INSERT INTO flags (
        id,
        key,
        enabled,
        description,
        data
      )
      SELECT
        id,
        key,
        enabled,
        description,
        data
      FROM oldDb.flags;
    `)

    // 9) provider_keys
    newDb.exec(`
      INSERT INTO provider_keys (
        id,
        provider,
        key,
        created_at,
        updated_at
      )
      SELECT
        id,
        provider,
        key,
        created_at,
        updated_at
      FROM oldDb.provider_keys;
    `)




    // 10) file_changes is a new table.
    // Since legacy data doesn't exist for it, no INSERT is necessary.
    // (It will be empty in the new DB.)

    // Commit the transaction
    newDb.exec('COMMIT')
  } catch (error) {
    // Roll back if something fails
    newDb.exec('ROLLBACK')
    throw error
  } finally {
    // Detach the old DB and close the connection
    newDb.exec('DETACH oldDb')
    newDb.close()
  }

  console.log('Migration completed successfully!')
}

main()
