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
