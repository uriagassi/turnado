import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb } from "../src/db.js";

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
