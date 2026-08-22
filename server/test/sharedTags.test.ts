import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createDb } from "../src/db.js";
import { SharedTags } from "../src/doctors/SharedTags.js";

describe("SharedTags.descendantIds", () => {
  const tmpFiles: string[] = [];
  const openDbs: Database[] = [];

  afterEach(() => {
    for (const db of openDbs.splice(0)) db.close();
    for (const f of tmpFiles.splice(0)) fs.rmSync(f, { force: true, recursive: true });
  });

  function tmpDb(): Database {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turnado-tags-"));
    const db = createDb(path.join(dir, "test.sqlite"), 5000);
    tmpFiles.push(dir);
    openDbs.push(db);
    return db;
  }

  it("includes the tag itself when it has no children", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const leafId = tags.findOrCreatePath("solo");

    expect(tags.descendantIds(leafId)).toEqual([leafId]);
  });

  it("includes every nested descendant, transitively", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const rootId = tags.findOrCreatePath("medical");
    const childId = tags.findOrCreatePath("medical/legacy-scans");
    const grandchildId = tags.findOrCreatePath("medical/legacy-scans/2020");

    expect(tags.descendantIds(rootId).sort()).toEqual([rootId, childId, grandchildId].sort());
  });
});
