import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp, isLoopbackAddress } from "../src/app.js";
import { createDb } from "../src/db.js";
import { StubAuthHandler } from "./support/StubAuthHandler.js";
import { singleUserAllowList } from "./support/allowListFixture.js";

// POST /internal/die is the NAS control script's way of asking an
// already-running instance to shut itself down before a new one starts —
// see the comment above the route in app.ts and docs/nas-deployment-notes.md.
describe("POST /internal/die", () => {
  it("terminates the process without requiring auth", async () => {
    const exitProcess = vi.fn();
    const app = createApp({
      authHandler: new StubAuthHandler(),
      allowList: singleUserAllowList(),
      cookieSecret: "test-secret",
      exitProcess,
    });

    // No cookies set (unlike a signed-in agent elsewhere) — this route sits
    // ahead of the auth middleware on purpose.
    await request(app).post("/internal/die").expect(200);

    expect(exitProcess).toHaveBeenCalledWith(0);
  });

  // docs/adr/0001-wal-checkpoint-strategy.md: this is the path that actually
  // fires on every normal NAS restart, so it has to checkpoint explicitly —
  // process.exit() doesn't trigger SQLite's own automatic checkpoint.
  describe("WAL checkpoint (docs/adr/0001-wal-checkpoint-strategy.md)", () => {
    const tmpFiles: string[] = [];

    afterEach(() => {
      for (const f of tmpFiles.splice(0)) {
        fs.rmSync(f, { force: true });
        fs.rmSync(f + "-wal", { force: true });
        fs.rmSync(f + "-shm", { force: true });
      }
    });

    it("checkpoints the WAL before exiting when a db is configured", async () => {
      const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "turnado-")), "test.sqlite");
      tmpFiles.push(dbPath);
      const db = createDb(dbPath, 5000);
      db.exec("CREATE TABLE Widgets (id INTEGER PRIMARY KEY, data TEXT)");
      const insert = db.prepare("INSERT INTO Widgets (data) VALUES (?)");
      for (let i = 0; i < 500; i++) insert.run("x".repeat(200));
      expect(fs.statSync(dbPath + "-wal").size).toBeGreaterThan(0);

      const app = createApp({
        authHandler: new StubAuthHandler(),
        allowList: singleUserAllowList(),
        cookieSecret: "test-secret",
        db,
        exitProcess: vi.fn(),
      });

      await request(app).post("/internal/die").expect(200);

      expect(fs.statSync(dbPath + "-wal").size).toBe(0);
      db.close();
    });

    it("doesn't throw when no db is configured", async () => {
      const app = createApp({
        authHandler: new StubAuthHandler(),
        allowList: singleUserAllowList(),
        cookieSecret: "test-secret",
        exitProcess: vi.fn(),
      });

      await request(app).post("/internal/die").expect(200);
    });
  });
});

// supertest's in-process requests always arrive from 127.0.0.1, so the
// route's off-box rejection is exercised directly against the guard instead.
describe("isLoopbackAddress", () => {
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("accepts %s", (address) => {
    expect(isLoopbackAddress(address)).toBe(true);
  });

  it.each(["203.0.113.5", "10.100.102.204", undefined])("rejects %s", (address) => {
    expect(isLoopbackAddress(address)).toBe(false);
  });
});
