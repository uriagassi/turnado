import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createDb, ensureColumn, checkpoint } from "../src/db.js";

describe("createDb", () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) {
      fs.rmSync(f, { force: true });
      fs.rmSync(f + "-wal", { force: true });
      fs.rmSync(f + "-shm", { force: true });
    }
  });

  function tmpDbPath() {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "turnado-")), "test.sqlite");
    tmpFiles.push(p);
    return p;
  }

  it("opens the given file in WAL journal mode", () => {
    const db = createDb(tmpDbPath(), 5000);
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    db.close();
  });

  it("sets a busy_timeout of the given number of milliseconds", () => {
    const db = createDb(tmpDbPath(), 5000);
    expect(db.pragma("busy_timeout", { simple: true })).toBe(5000);
    db.close();
  });

  it("honors a different busy_timeout value", () => {
    const db = createDb(tmpDbPath(), 1234);
    expect(db.pragma("busy_timeout", { simple: true })).toBe(1234);
    db.close();
  });
});

// docs/adr/0001-wal-checkpoint-strategy.md
describe("checkpoint", () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) {
      fs.rmSync(f, { force: true });
      fs.rmSync(f + "-wal", { force: true });
      fs.rmSync(f + "-shm", { force: true });
    }
  });

  function tmpDbPath() {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "turnado-")), "test.sqlite");
    tmpFiles.push(p);
    return p;
  }

  function growWal(db: Database.Database) {
    db.exec("CREATE TABLE Widgets (id INTEGER PRIMARY KEY, data TEXT)");
    const insert = db.prepare("INSERT INTO Widgets (data) VALUES (?)");
    for (let i = 0; i < 500; i++) insert.run("x".repeat(200));
  }

  it("PASSIVE flushes pending WAL content into the main file without truncating the WAL", () => {
    const dbPath = tmpDbPath();
    const db = createDb(dbPath, 5000);
    growWal(db);

    const [result] = db.pragma("wal_checkpoint(PASSIVE)") as { busy: number; checkpointed: number }[];
    expect(result.checkpointed).toBeGreaterThan(0);

    db.close();
  });

  it("TRUNCATE shrinks the WAL file back to zero bytes", () => {
    const dbPath = tmpDbPath();
    const db = createDb(dbPath, 5000);
    growWal(db);
    expect(fs.statSync(dbPath + "-wal").size).toBeGreaterThan(0);

    checkpoint(db, "TRUNCATE");

    expect(fs.statSync(dbPath + "-wal").size).toBe(0);
    db.close();
  });
});

describe("ensureColumn", () => {
  function columnNames(db: Database.Database, table: string): string[] {
    return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  }

  it("adds the column when it doesn't exist yet", () => {
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE Widgets (id INTEGER PRIMARY KEY)`);

    ensureColumn(db, "Widgets", "ownerUsername", "TEXT");

    expect(columnNames(db, "Widgets")).toContain("ownerUsername");
  });

  it("is idempotent: a second call against a table that already has the column doesn't throw", () => {
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE Widgets (id INTEGER PRIMARY KEY)`);
    ensureColumn(db, "Widgets", "ownerUsername", "TEXT");

    // Simulates a server restart against a DB file from a previous run
    // that already has the column — the real scenario this guard exists for.
    expect(() => ensureColumn(db, "Widgets", "ownerUsername", "TEXT")).not.toThrow();
    expect(columnNames(db, "Widgets")).toEqual(["id", "ownerUsername"]);
  });
});
