import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createApp } from "../src/app.js";
import { createDb } from "../src/db.js";
import { ReminderLog } from "../src/reminders/ReminderLog.js";
import { StubAuthHandler } from "./support/StubAuthHandler.js";
import { singleUserAllowList } from "./support/allowListFixture.js";

const allowList = singleUserAllowList();
const cookieSecret = "test-secret";

describe("/api/appointments", () => {
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

  describe("GET /api/appointments", () => {
    it("returns an empty list when no appointments exist yet", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.get("/api/appointments");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("reports missedReminder: null for an appointment with no missed reminder (issue #10)", async () => {
      const agent = signedInAgent(tmpDb());
      await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const res = await agent.get("/api/appointments");

      expect(res.body[0].missedReminder).toBeNull();
    });

    it("reports the reason when the appointment has a missed reminder logged (issue #10)", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });
      new ReminderLog(db).markMissed("appointment", created.body.id, "2026-08-31", "send failed");

      const res = await agent.get("/api/appointments");

      expect(res.body[0].missedReminder).toBe("send failed");
    });
  });

  describe("POST /api/appointments", () => {
    it("creates an appointment and returns it with a generated id", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z", status: "planned" });
      expect(res.body.id).toBeTypeOf("number");
    });

    it("400s for a missing required field instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.post("/api/appointments").send({ notes: "", dateTime: "2026-09-01T10:00:00Z" });

      expect(res.status).toBe(400);
    });

    it("owns the created appointment as the signed-in user, ignoring any client-supplied ownerUsername (issue #10)", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent
        .post("/api/appointments")
        .send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z", ownerUsername: "someone-else" });

      expect(res.body.ownerUsername).toBe("alice");
    });
  });

  describe("GET /api/appointments/:id", () => {
    it("returns the appointment with that id", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const res = await agent.get(`/api/appointments/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: created.body.id, notes: "Annual checkup" });
    });

    it("404s for an id that doesn't exist", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.get("/api/appointments/999");

      expect(res.status).toBe(404);
    });

    it("reports the missed-reminder reason on the single-item route too (issue #10)", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });
      new ReminderLog(db).markMissed("appointment", created.body.id, "2026-08-31", "window closed before delivery");

      const res = await agent.get(`/api/appointments/${created.body.id}`);

      expect(res.body.missedReminder).toBe("window closed before delivery");
    });
  });

  describe("PUT /api/appointments/:id", () => {
    it("updates the appointment and returns the new fields", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const res = await agent
        .put(`/api/appointments/${created.body.id}`)
        .send({ notes: "Rescheduled", dateTime: "2026-09-08T10:00:00Z", location: "Clinic B" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: created.body.id, notes: "Rescheduled", location: "Clinic B" });
    });

    it("404s for an id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.put("/api/appointments/999").send({ notes: "n/a", dateTime: "2026-09-01T10:00:00Z" });

      expect(res.status).toBe(404);
    });

    it("400s for a missing required field instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const res = await agent.put(`/api/appointments/${created.body.id}`).send({ notes: "", dateTime: "2026-09-01T10:00:00Z" });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/appointments/:id/status", () => {
    it("updates the appointment's status", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const res = await agent.put(`/api/appointments/${created.body.id}/status`).send({ status: "postponed" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("postponed");
    });

    it("404s for an id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.put("/api/appointments/999/status").send({ status: "done" });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/appointments/:id/summary", () => {
    it("sets the appointment's post-visit summary", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const res = await agent
        .put(`/api/appointments/${created.body.id}/summary`)
        .send({ summary: "Bloodwork normal" });

      expect(res.status).toBe(200);
      expect(res.body.summary).toBe("Bloodwork normal");
    });

    it("404s for an id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.put("/api/appointments/999/summary").send({ summary: "n/a" });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/appointments/:id/documents/:documentId", () => {
    it("attaches an already-uploaded document to the appointment's checklist", async () => {
      const agent = signedInAgent(tmpDb());
      const appt = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });
      const doc = await agent
        .post("/api/documents")
        .field("title", "Old referral")
        .field("type", "referral")
        .attach("file", Buffer.from("content"), "referral.pdf");

      const res = await agent.put(`/api/appointments/${appt.body.id}/documents/${doc.body.id}`).send();

      expect(res.status).toBe(200);
      expect(res.body.appointmentIds).toContain(appt.body.id);
    });

    it("404s for an appointment id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent
        .post("/api/documents")
        .field("title", "Old referral")
        .field("type", "referral")
        .attach("file", Buffer.from("content"), "referral.pdf");

      const res = await agent.put(`/api/appointments/999/documents/${doc.body.id}`).send();

      expect(res.status).toBe(404);
    });

    it("404s for a document id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());
      const appt = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const res = await agent.put(`/api/appointments/${appt.body.id}/documents/999`).send();

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/home", () => {
    it("includes the soonest planned appointment as nextAppointment", async () => {
      const agent = signedInAgent(tmpDb());
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: farFuture });

      const res = await agent.get("/api/home");

      expect(res.status).toBe(200);
      expect(res.body.nextAppointment).toMatchObject({ id: created.body.id });
    });

    it("is null when there's no upcoming planned appointment", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent.get("/api/home");

      expect(res.body.nextAppointment).toBeNull();
    });

    it("carries the missed-reminder reason through to nextAppointment (issue #10)", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const created = await agent.post("/api/appointments").send({ notes: "Annual checkup", dateTime: farFuture });
      new ReminderLog(db).markMissed("appointment", created.body.id, "2026-08-31", "send failed");

      const res = await agent.get("/api/home");

      expect(res.body.nextAppointment.missedReminder).toBe("send failed");
    });
  });
});
