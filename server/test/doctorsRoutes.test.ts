import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createApp } from "../src/app.js";
import { createDb } from "../src/db.js";
import { StubAuthHandler } from "./support/StubAuthHandler.js";

const allowList = { alice: "en" };
const cookieSecret = "test-secret";

describe("/api/doctors", () => {
  const tmpFiles: string[] = [];
  const openDbs: Database[] = [];

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      db.close();
    }
    for (const f of tmpFiles.splice(0)) {
      fs.rmSync(f, { force: true });
      fs.rmSync(f + "-wal", { force: true });
      fs.rmSync(f + "-shm", { force: true });
    }
  });

  function tmpDb(): Database {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "turnado-")), "test.sqlite");
    tmpFiles.push(p);
    const db = createDb(p, 5000);
    openDbs.push(db);
    return db;
  }

  /** A logged-in agent (see StubAuthHandler) hitting an app backed by the given db. */
  function signedInAgent(db: Database) {
    const app = createApp({
      authHandler: new StubAuthHandler({ user_id: "1", user_name: "alice" }),
      allowList,
      cookieSecret,
      db,
    });
    return request.agent(app);
  }

  describe("GET /api/doctors", () => {
    it("returns an empty list when no doctors exist yet", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.get("/api/doctors");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("POST /api/doctors", () => {
    it("creates a doctor and returns it with a generated id", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent
        .post("/api/doctors")
        .send({ name: "Dr. Jane Smith", specialty: "Cardiology", notes: "Family physician" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: "Dr. Jane Smith",
        specialty: "Cardiology",
        notes: "Family physician",
      });
      expect(res.body.id).toBeTypeOf("number");
    });

    it("shows up in a subsequent GET /api/doctors", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      await agent.post("/api/doctors").send({ name: "Dr. Jane Smith", notes: "Family physician" });

      const res = await agent.get("/api/doctors");

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ name: "Dr. Jane Smith" });
    });
  });

  describe("GET /api/doctors/:id", () => {
    it("returns the doctor with that id", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent
        .post("/api/doctors")
        .send({ name: "Dr. Jane Smith", notes: "Family physician" });

      const res = await agent.get(`/api/doctors/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: created.body.id, name: "Dr. Jane Smith" });
    });

    it("404s for an id that doesn't exist", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.get("/api/doctors/999");

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/doctors/:id", () => {
    it("updates the doctor and returns the new fields", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent
        .post("/api/doctors")
        .send({ name: "Dr. Jane Smith", notes: "Family physician" });

      const res = await agent
        .put(`/api/doctors/${created.body.id}`)
        .send({ name: "Dr. Jane A. Smith", specialty: "Cardiology", notes: "Cardiology only" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.body.id,
        name: "Dr. Jane A. Smith",
        specialty: "Cardiology",
        notes: "Cardiology only",
      });
    });
  });
});
