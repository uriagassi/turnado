import Database from "better-sqlite3";

/**
 * Opens the shared SQLite DB file used by this app and the sibling
 * document-archive app. WAL journal mode + a busy_timeout make
 * concurrent multi-process access to the same file safe; both are
 * DB-file-level settings, so the sibling app's connection benefits too.
 */
export function createDb(dbPath: string, busyTimeoutMs: number): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma(`busy_timeout = ${busyTimeoutMs}`);
  return db;
}

/**
 * Runs an explicit WAL checkpoint — see docs/adr/0001-wal-checkpoint-strategy.md
 * for why this app has to do this itself (the sibling paperless.node app does
 * no WAL/checkpoint management of its own, and this app's own connection is
 * never the "last one closes" that would trigger SQLite's automatic full
 * checkpoint). PASSIVE is non-blocking, safe to call on any timer; TRUNCATE
 * fully flushes and shrinks the WAL back to zero, appropriate right before
 * exiting since a brief block on the way out doesn't matter.
 */
export function checkpoint(db: Database.Database, mode: "PASSIVE" | "TRUNCATE"): void {
  db.pragma(`wal_checkpoint(${mode})`);
}

/**
 * Idempotently adds a column to an already-existing table — guarded by
 * checking `PRAGMA table_info` first, since SQLite has no
 * `ADD COLUMN IF NOT EXISTS` and this app has no migration framework of its
 * own. Shared by Appointments.ts and Tasks.ts (issue #10's `ownerUsername`
 * column, the first column ever added to an already-shipped table here) so
 * a future migration doesn't have to recopy the guard. `table`/`column`/
 * `ddlType` are always call-site literals, never user input, so the plain
 * string interpolation into the ALTER TABLE statement is safe.
 */
export function ensureColumn(db: Database.Database, table: string, column: string, ddlType: string): void {
  const hasColumn = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
    (col) => col.name === column,
  );
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
  }
}
