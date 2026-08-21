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

describe("/api/documents routes", () => {
  const tmpFiles: string[] = [];
  const openDbs: Database[] = [];

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      db.close();
    }
    for (const f of tmpFiles.splice(0)) {
      fs.rmSync(f, { force: true, recursive: true });
      fs.rmSync(f + "-wal", { force: true });
      fs.rmSync(f + "-shm", { force: true });
    }
  });

  function tmpDb(): Database {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turnado-doc-routes-"));
    const p = path.join(dir, "test.sqlite");
    tmpFiles.push(dir);
    const db = createDb(p, 5000);
    openDbs.push(db);
    return db;
  }

  function signedInAgent(db: Database, attachmentsDir?: string) {
    const app = createApp({
      authHandler: new StubAuthHandler({ user_id: "1", user_name: "alice" }),
      allowList,
      cookieSecret,
      db,
      medicalNotebookId: 42,
      attachmentsDir,
    });
    return request.agent(app);
  }

  describe("POST /api/documents", () => {
    it("uploads a document with file and metadata, returning 201", async () => {
      const db = tmpDb();
      const attachmentsDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "turnado-att-")), "attachments");
      tmpFiles.push(attachmentsDir);
      const agent = signedInAgent(db, attachmentsDir);

      const res = await agent
        .post("/api/documents")
        .field("title", "ECG Report")
        .field("type", "test result")
        .field("documentDate", "2026-08-12")
        .field("notes", "Normal sinus rhythm")
        .attach("file", Buffer.from("dummy pdf content"), "ecg.pdf");

      expect(res.status).toBe(201);
      expect(res.body.id).toBeGreaterThan(0);
      expect(res.body.title).toBe("ECG Report");
      expect(res.body.type).toBe("test result");
      expect(res.body.documentDate).toBe("2026-08-12");
      expect(res.body.notes).toBe("Normal sinus rhythm");
      expect(res.body.file.fileName).toBe("ecg.pdf");
      expect(res.body.file.mime).toBe("application/pdf");
    });

    it("rejects upload when file is missing with 400", async () => {
      const agent = signedInAgent(tmpDb());
      const res = await agent
        .post("/api/documents")
        .field("title", "Missing file doc")
        .field("type", "letter");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/file/i);
    });

    it("rejects upload when title or type is invalid with 400", async () => {
      const agent = signedInAgent(tmpDb());
      const res = await agent
        .post("/api/documents")
        .field("title", "")
        .field("type", "invalid-type")
        .attach("file", Buffer.from("content"), "doc.pdf");

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/documents", () => {
    it("returns list of documents and filters by doctorId", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);

      // Create a doctor first
      const docRes = await agent.post("/api/doctors").send({ name: "Dr. Dave" });
      const doctorId = docRes.body.id;

      await agent
        .post("/api/documents")
        .field("title", "Doc For Dave")
        .field("type", "referral")
        .field("doctorId", String(doctorId))
        .attach("file", Buffer.from("pdf1"), "doc1.pdf");

      await agent
        .post("/api/documents")
        .field("title", "General Doc")
        .field("type", "letter")
        .attach("file", Buffer.from("pdf2"), "doc2.pdf");

      const allRes = await agent.get("/api/documents");
      expect(allRes.status).toBe(200);
      expect(allRes.body.length).toBe(2);

      const filteredRes = await agent.get(`/api/documents?doctorId=${doctorId}`);
      expect(filteredRes.status).toBe(200);
      expect(filteredRes.body.length).toBe(1);
      expect(filteredRes.body[0].title).toBe("Doc For Dave");
    });

    it("combines type and query filters", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);

      await agent
        .post("/api/documents")
        .field("title", "Cardiology Referral")
        .field("type", "referral")
        .attach("file", Buffer.from("pdf1"), "doc1.pdf");

      await agent
        .post("/api/documents")
        .field("title", "Cardiology Letter")
        .field("type", "letter")
        .attach("file", Buffer.from("pdf2"), "doc2.pdf");

      await agent
        .post("/api/documents")
        .field("title", "Neurology Referral")
        .field("type", "referral")
        .attach("file", Buffer.from("pdf3"), "doc3.pdf");

      const res = await agent.get("/api/documents?type=referral&query=cardiology");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe("Cardiology Referral");
    });
  });

  describe("GET /api/home", () => {
    it("includes recent documents on the home feed", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);

      await agent
        .post("/api/documents")
        .field("title", "Recent Doc 1")
        .field("type", "letter")
        .attach("file", Buffer.from("pdf1"), "doc1.pdf");

      const homeRes = await agent.get("/api/home");
      expect(homeRes.status).toBe(200);
      expect(homeRes.body.recentDocuments).toHaveLength(1);
      expect(homeRes.body.recentDocuments[0].title).toBe("Recent Doc 1");
    });
  });

  describe("transitive doctor tag sync on appointment/task update", () => {
    it("syncs document note tags when an appointment's doctor changes via API", async () => {
      const db = tmpDb();
      const agent = signedInAgent(db);

      const dr1Res = await agent.post("/api/doctors").send({ name: "Dr. One" });
      const dr2Res = await agent.post("/api/doctors").send({ name: "Dr. Two" });

      const apptRes = await agent.post("/api/appointments").send({
        doctorId: dr1Res.body.id,
        dateTime: "2026-08-20T10:00:00Z",
        notes: "Visit",
      });

      const docRes = await agent
        .post("/api/documents")
        .field("title", "Visit Summary")
        .field("type", "letter")
        .field("appointmentIds", JSON.stringify([apptRes.body.id]))
        .attach("file", Buffer.from("pdf content"), "summary.pdf");

      let noteTags = db
        .prepare("SELECT tagId FROM NoteTags WHERE noteId = ?")
        .all(docRes.body.id) as { tagId: number }[];
      expect(noteTags.map((r) => r.tagId)).toContain(dr1Res.body.tagId);
      expect(noteTags.map((r) => r.tagId)).not.toContain(dr2Res.body.tagId);

      // Update appointment to Dr. Two
      await agent.put(`/api/appointments/${apptRes.body.id}`).send({
        doctorId: dr2Res.body.id,
        dateTime: "2026-08-20T10:00:00Z",
        notes: "Visit",
      });

      noteTags = db
        .prepare("SELECT tagId FROM NoteTags WHERE noteId = ?")
        .all(docRes.body.id) as { tagId: number }[];
      expect(noteTags.map((r) => r.tagId)).not.toContain(dr1Res.body.tagId);
      expect(noteTags.map((r) => r.tagId)).toContain(dr2Res.body.tagId);
    });
  });
});
