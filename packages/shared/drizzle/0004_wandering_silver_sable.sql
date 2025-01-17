-- Disable foreign key constraints
PRAGMA foreign_keys = OFF;

-- Begin a transaction
BEGIN TRANSACTION;

-- Create a new table with the additional column
CREATE TABLE files_new (
    -- Include all existing columns
    id INTEGER PRIMARY KEY,
    -- ... other columns ...
    checksum TEXT DEFAULT ''
);

-- Copy data from the old table to the new table
INSERT INTO files_new (id, /* other columns */, checksum)
SELECT id, /* other columns */, '' FROM files;

-- Drop the old table
DROP TABLE files;

-- Rename the new table to the original table name
ALTER TABLE files_new RENAME TO files;

-- Commit the transaction
COMMIT;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
