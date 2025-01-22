// migrateNew.ts
import Database from 'bun:sqlite';

function main() {
  // Open the new DB
  const newDb = new Database('sqlite.db');

  // Attach the old DB
  newDb.exec("ATTACH '21-jan-db.db' AS oldDb");

  // Wrap all inserts in a single transaction for speed and atomicity
  newDb.exec('BEGIN');

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
    `);

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
    `);

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
    `);

    // 4) files
    // Make sure the new schema columns match exactly. 
    // For example, "checksum" might be new or empty in old DB (if at all).
    // If the old DB doesn't have it, you can use a default or skip the column.
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
        '' AS checksum,  -- or replace with checksum if it exists in old DB
        created_at,
        updated_at
      FROM oldDb.files;
    `);

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
    `);

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
    `);

    // 7) global_state
    newDb.exec(`
      INSERT INTO global_state (
        id,
        state_json
      )
      SELECT
        id,
        state_json
      FROM oldDb.global_state;
    `);

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
    `);

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
    `);

    // 10) tickets
    newDb.exec(`
      INSERT INTO tickets (
        id,
        project_id,
        title,
        overview,
        status,
        priority,
        suggested_file_ids,
        created_at,
        updated_at
      )
      SELECT
        id,
        project_id,
        title,
        overview,
        status,
        priority,
        suggested_file_ids,
        created_at,
        updated_at
      FROM oldDb.tickets;
    `);

    // 11) ticket_files (junction table)
    newDb.exec(`
      INSERT INTO ticket_files (
        ticket_id,
        file_id
      )
      SELECT
        ticket_id,
        file_id
      FROM oldDb.ticket_files;
    `);

    // 12) ticket_tasks
    newDb.exec(`
      INSERT INTO ticket_tasks (
        id,
        ticket_id,
        content,
        done,
        order_index,
        created_at,
        updated_at
      )
      SELECT
        id,
        ticket_id,
        content,
        done,
        order_index,
        created_at,
        updated_at
      FROM oldDb.ticket_tasks;
    `);

    // Commit the transaction
    newDb.exec('COMMIT');
  } catch (error) {
    // If something fails, roll back
    newDb.exec('ROLLBACK');
    throw error;
  } finally {
    // Detach old DB, close connection
    newDb.exec('DETACH oldDb');
    newDb.close();
  }

  console.log('Migration completed successfully!');
}

main();
