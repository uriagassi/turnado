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

describe("/api/tasks routes", () => {
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

  function signedInAgent(db: Database) {
    const app = createApp({
      authHandler: new StubAuthHandler({ user_id: "1", user_name: "alice" }),
      allowList,
      cookieSecret,
      db,
    });
    return request.agent(app);
  }

  describe("GET /api/tasks", () => {
    it("returns empty list when no tasks exist", async () => {
      const agent = signedInAgent(tmpDb());
      const res = await agent.get("/api/tasks");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filters tasks by doctorId and status", async () => {
      const agent = signedInAgent(tmpDb());
      await agent.post("/api/tasks").send({ type: "test", title: "Test 1", doctorId: 5, status: "open" });
      await agent.post("/api/tasks").send({ type: "test", title: "Test 2", doctorId: 5, status: "done" });
      await agent.post("/api/tasks").send({ type: "test", title: "Test 3", doctorId: 8, status: "open" });

      const resDoctor5 = await agent.get("/api/tasks?doctorId=5");
      expect(resDoctor5.status).toBe(200);
      expect(resDoctor5.body).toHaveLength(2);

      const resOpen = await agent.get("/api/tasks?status=open");
      expect(resOpen.status).toBe(200);
      expect(resOpen.body).toHaveLength(2);

      const resDoctor5Open = await agent.get("/api/tasks?doctorId=5&status=open");
      expect(resDoctor5Open.status).toBe(200);
      expect(resDoctor5Open.body).toHaveLength(1);
    });

    it("reports the missed-reminder reason for a task, and null for one with none (issue #10)", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      const missed = await agent.post("/api/tasks").send({ type: "test", title: "Blood test", dueDate: "2026-09-01" });
      const clean = await agent.post("/api/tasks").send({ type: "test", title: "Other test", dueDate: "2026-09-01" });
      new ReminderLog(db).markMissed("task", missed.body.id, "2026-09-01", "send failed");

      const res = await agent.get("/api/tasks");

      const missedBody = res.body.find((t: { id: number }) => t.id === missed.body.id);
      const cleanBody = res.body.find((t: { id: number }) => t.id === clean.body.id);
      expect(missedBody.missedReminder).toBe("send failed");
      expect(cleanBody.missedReminder).toBeNull();
    });

    it("clears a stale missedReminder once the task's due date is rescheduled (issue #10)", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      const created = await agent.post("/api/tasks").send({ type: "test", title: "Blood test", dueDate: "2026-09-01" });
      new ReminderLog(db).markMissed("task", created.body.id, "2026-09-01", "send failed");

      await agent.put(`/api/tasks/${created.body.id}`).send({ type: "test", title: "Blood test", dueDate: "2026-09-15" });

      const res = await agent.get("/api/tasks");

      expect(res.body[0].missedReminder).toBeNull();
    });

    it("flags each other's id in similarTaskIds for two open tasks with the same type/doctor and a due date within 30 days (issue #12)", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent.post("/api/doctors").send({ name: "Dr. Who" });
      const a = await agent
        .post("/api/tasks")
        .send({ type: "test", title: "Blood test A", doctorId: doc.body.id, dueDate: "2026-09-01" });
      const b = await agent
        .post("/api/tasks")
        .send({ type: "test", title: "Blood test B", doctorId: doc.body.id, dueDate: "2026-09-20" });
      const unrelated = await agent
        .post("/api/tasks")
        .send({ type: "form_17", title: "Unrelated", doctorId: doc.body.id, dueDate: "2026-09-01" });

      const res = await agent.get("/api/tasks");

      const bodyA = res.body.find((t: { id: number }) => t.id === a.body.id);
      const bodyB = res.body.find((t: { id: number }) => t.id === b.body.id);
      const bodyUnrelated = res.body.find((t: { id: number }) => t.id === unrelated.body.id);
      expect(bodyA.similarTaskIds).toEqual([b.body.id]);
      expect(bodyB.similarTaskIds).toEqual([a.body.id]);
      expect(bodyUnrelated.similarTaskIds).toEqual([]);
    });

    it("never flags a task with no doctor linked, even against an otherwise-identical task (NULL-doctor exclusion, issue #12)", async () => {
      const agent = signedInAgent(tmpDb());
      await agent.post("/api/tasks").send({ type: "test", title: "No doctor A", dueDate: "2026-09-01" });
      const b = await agent.post("/api/tasks").send({ type: "test", title: "No doctor B", dueDate: "2026-09-01" });

      const res = await agent.get("/api/tasks");

      const bodyB = res.body.find((t: { id: number }) => t.id === b.body.id);
      expect(bodyB.similarTaskIds).toEqual([]);
    });

    it("excludes a done task from the candidate pool, and never flags a done task itself (open/in-progress-only pool, issue #12)", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent.post("/api/doctors").send({ name: "Dr. Who" });
      const open = await agent
        .post("/api/tasks")
        .send({ type: "test", title: "Open", doctorId: doc.body.id, dueDate: "2026-09-01", status: "open" });
      const done = await agent
        .post("/api/tasks")
        .send({ type: "test", title: "Done", doctorId: doc.body.id, dueDate: "2026-09-01", status: "done" });

      const res = await agent.get("/api/tasks");

      const bodyOpen = res.body.find((t: { id: number }) => t.id === open.body.id);
      const bodyDone = res.body.find((t: { id: number }) => t.id === done.body.id);
      expect(bodyOpen.similarTaskIds).toEqual([]);
      expect(bodyDone.similarTaskIds).toEqual([]);
    });

    it("carries similarTaskIds through POST, GET :id, PUT and GET /api/home (issue #12)", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent.post("/api/doctors").send({ name: "Dr. Who" });
      const a = await agent
        .post("/api/tasks")
        .send({ type: "test", title: "A", doctorId: doc.body.id, dueDate: "2026-09-01" });
      expect(a.body.similarTaskIds).toEqual([]);

      const b = await agent
        .post("/api/tasks")
        .send({ type: "test", title: "B", doctorId: doc.body.id, dueDate: "2026-09-05" });
      expect(b.body.similarTaskIds).toEqual([a.body.id]);

      const getRes = await agent.get(`/api/tasks/${a.body.id}`);
      expect(getRes.body.similarTaskIds).toEqual([b.body.id]);

      const putRes = await agent
        .put(`/api/tasks/${a.body.id}`)
        .send({ type: "test", title: "A renamed", doctorId: doc.body.id, dueDate: "2026-09-01" });
      expect(putRes.body.similarTaskIds).toEqual([b.body.id]);

      const homeRes = await agent.get("/api/home");
      const homeA = homeRes.body.openItems.find((t: { id: number }) => t.id === a.body.id);
      expect(homeA.similarTaskIds).toEqual([b.body.id]);
    });
  });

  describe("POST /api/tasks", () => {
    it("creates a task and returns 201 with generated id", async () => {
      const agent = signedInAgent(tmpDb());
      const res = await agent.post("/api/tasks").send({
        type: "form_17",
        title: "Get Form 17 for Neurology",
        institution: "Assuta Tel Aviv",
        status: "open",
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTypeOf("number");
      expect(res.body.type).toBe("form_17");
      expect(res.body.title).toBe("Get Form 17 for Neurology");
      expect(res.body.institution).toBe("Assuta Tel Aviv");
    });

    it("returns 400 for invalid task input", async () => {
      const agent = signedInAgent(tmpDb());
      const res = await agent.post("/api/tasks").send({
        type: "doctor_visit",
        title: "Visit neurologist without doctorId",
      });
      expect(res.status).toBe(400);
    });

    it("owns the created task as the signed-in user, ignoring any client-supplied ownerUsername (issue #10)", async () => {
      const agent = signedInAgent(tmpDb());

      const res = await agent
        .post("/api/tasks")
        .send({ type: "test", title: "Blood test", ownerUsername: "someone-else" });

      expect(res.body.ownerUsername).toBe("alice");
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("returns the task if found, or 404", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/tasks").send({
        type: "general_approval",
        title: "Travel insurance",
      });

      const res = await agent.get(`/api/tasks/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);

      const missing = await agent.get("/api/tasks/9999");
      expect(missing.status).toBe(404);
    });

    it("reports the missed-reminder reason on the single-item route too (issue #10)", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      const created = await agent.post("/api/tasks").send({ type: "test", title: "Blood test", dueDate: "2026-09-01" });
      new ReminderLog(db).markMissed("task", created.body.id, "2026-09-01", "window closed before delivery");

      const res = await agent.get(`/api/tasks/${created.body.id}`);

      expect(res.body.missedReminder).toBe("window closed before delivery");
    });
  });

  describe("PUT /api/tasks/:id and status", () => {
    it("updates task fields", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/tasks").send({
        type: "test",
        title: "Initial Test",
      });

      const res = await agent.put(`/api/tasks/${created.body.id}`).send({
        type: "test",
        title: "Updated Test Title",
        status: "in-progress",
      });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Updated Test Title");
      expect(res.body.status).toBe("in-progress");
    });

    it("updates task status via /api/tasks/:id/status", async () => {
      const agent = signedInAgent(tmpDb());
      const created = await agent.post("/api/tasks").send({
        type: "test",
        title: "MRI Scan",
        status: "open",
      });

      const res = await agent.put(`/api/tasks/${created.body.id}/status`).send({
        status: "done",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("done");
    });

    it("marks doctor_visit as done and sets dueDate when linking an appointment", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent.post("/api/doctors").send({ name: "Dr. Who" });
      const appt = await agent.post("/api/appointments").send({
        doctorId: doc.body.id,
        dateTime: "2026-09-20T09:00:00.000Z",
        notes: "Visit Dr. Who",
      });

      const task = await agent.post("/api/tasks").send({
        type: "doctor_visit",
        title: "Schedule visit with Dr. Who",
        doctorId: doc.body.id,
        status: "open",
      });

      const res = await agent.put(`/api/tasks/${task.body.id}/pending-appointment`).send({
        pendingAppointmentId: appt.body.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.pendingAppointmentId).toBe(appt.body.id);
      expect(res.body.status).toBe("done");
      expect(res.body.dueDate).toBe("2026-09-20");
    });

    it("sets dueDate and marks in-progress when linking an appointment to a test task", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent.post("/api/doctors").send({ name: "Dr. Who" });
      const appt = await agent.post("/api/appointments").send({
        doctorId: doc.body.id,
        dateTime: "2026-09-22T14:30:00.000Z",
        notes: "CT Scan",
      });

      const task = await agent.post("/api/tasks").send({
        type: "test",
        title: "CT Scan",
        requiresAdvanceScheduling: true,
        status: "open",
      });

      const res = await agent.put(`/api/tasks/${task.body.id}/pending-appointment`).send({
        pendingAppointmentId: appt.body.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.pendingAppointmentId).toBe(appt.body.id);
      expect(res.body.status).toBe("in-progress");
      expect(res.body.dueDate).toBe("2026-09-22");
    });
  });

  describe("PUT /api/tasks/:id/documents/:documentId", () => {
    it("attaches an already-uploaded document to the task", async () => {
      const agent = signedInAgent(tmpDb());
      const task = await agent.post("/api/tasks").send({ type: "test", title: "Blood test" });
      const doc = await agent
        .post("/api/documents")
        .field("title", "Old referral")
        .field("type", "referral")
        .attach("file", Buffer.from("content"), "referral.pdf");

      const res = await agent.put(`/api/tasks/${task.body.id}/documents/${doc.body.id}`).send();

      expect(res.status).toBe(200);
      expect(res.body.taskIds).toContain(task.body.id);
    });

    it("404s for a task id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent
        .post("/api/documents")
        .field("title", "Old referral")
        .field("type", "referral")
        .attach("file", Buffer.from("content"), "referral.pdf");

      const res = await agent.put(`/api/tasks/999/documents/${doc.body.id}`).send();

      expect(res.status).toBe(404);
    });

    it("404s for a document id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());
      const task = await agent.post("/api/tasks").send({ type: "test", title: "Blood test" });

      const res = await agent.put(`/api/tasks/${task.body.id}/documents/999`).send();

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/tasks/:id/documents/:documentId", () => {
    it("detaches a document from the task without deleting the document", async () => {
      const agent = signedInAgent(tmpDb());
      const task = await agent.post("/api/tasks").send({ type: "test", title: "Blood test" });
      const doc = await agent
        .post("/api/documents")
        .field("title", "Old referral")
        .field("type", "referral")
        .field("taskIds", JSON.stringify([task.body.id]))
        .attach("file", Buffer.from("content"), "referral.pdf");
      expect(doc.body.taskIds).toContain(task.body.id);

      const res = await agent.delete(`/api/tasks/${task.body.id}/documents/${doc.body.id}`).send();

      expect(res.status).toBe(200);
      expect(res.body.taskIds).not.toContain(task.body.id);

      const stillThere = await agent.get(`/api/documents/${doc.body.id}`);
      expect(stillThere.status).toBe(200);
    });

    it("404s for a task id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());
      const doc = await agent
        .post("/api/documents")
        .field("title", "Old referral")
        .field("type", "referral")
        .attach("file", Buffer.from("content"), "referral.pdf");

      const res = await agent.delete(`/api/tasks/999/documents/${doc.body.id}`).send();

      expect(res.status).toBe(404);
    });

    it("404s for a document id that doesn't exist, instead of crashing", async () => {
      const agent = signedInAgent(tmpDb());
      const task = await agent.post("/api/tasks").send({ type: "test", title: "Blood test" });

      const res = await agent.delete(`/api/tasks/${task.body.id}/documents/999`).send();

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/home integration", () => {
    it("returns openItems array with non-done tasks sorted with no-due-date first then chronological", async () => {
      const agent = signedInAgent(tmpDb());
      await agent.post("/api/tasks").send({
        type: "test",
        title: "Task 1 (later)",
        dueDate: "2026-09-10",
        status: "open",
      });
      await agent.post("/api/tasks").send({
        type: "form_17",
        title: "Task 2 (earlier)",
        dueDate: "2026-08-20",
        status: "in-progress",
      });
      await agent.post("/api/tasks").send({
        type: "general_approval",
        title: "Task with no date",
        dueDate: null,
        status: "open",
      });
      await agent.post("/api/tasks").send({
        type: "test",
        title: "Task 3 (done - should be excluded from home feed)",
        dueDate: "2026-08-15",
        status: "done",
      });

      const homeRes = await agent.get("/api/home");
      expect(homeRes.status).toBe(200);
      expect(homeRes.body.openItems).toHaveLength(3);
      expect(homeRes.body.openItems[0].title).toBe("Task with no date");
      expect(homeRes.body.openItems[1].title).toBe("Task 2 (earlier)");
      expect(homeRes.body.openItems[2].title).toBe("Task 1 (later)");
    });

    it("carries the missed-reminder reason through to an open item (issue #10)", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);
      const created = await agent.post("/api/tasks").send({ type: "test", title: "Blood test", dueDate: "2026-09-01", status: "open" });
      new ReminderLog(db).markMissed("task", created.body.id, "2026-09-01", "send failed");

      const homeRes = await agent.get("/api/home");

      expect(homeRes.body.openItems[0].missedReminder).toBe("send failed");
    });
  });
});
