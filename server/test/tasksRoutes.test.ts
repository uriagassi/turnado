import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createApp } from "../src/app.js";
import { createDb } from "../src/db.js";
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
  });
});
