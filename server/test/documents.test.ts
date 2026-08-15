import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createDb } from "../src/db.js";
import {
  Documents,
  DocumentCreateInput,
  UploadedFile,
  DocumentNotFoundError,
  InvalidDocumentInputError,
} from "../src/documents/Documents.js";
import { Doctors } from "../src/doctors/Doctors.js";
import { Appointments } from "../src/appointments/Appointments.js";
import { Tasks } from "../src/tasks/Tasks.js";

const MEDICAL_NOTEBOOK_ID = 42;

describe("Documents", () => {
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turnado-doc-"));
    const p = path.join(dir, "test.sqlite");
    tmpFiles.push(dir);
    const db = createDb(p, 5000);
    openDbs.push(db);
    return db;
  }

  function tmpDocuments(db: Database) {
    return new Documents(db, {
      medicalNotebookId: MEDICAL_NOTEBOOK_ID,
    });
  }

  describe("create & storage mapping", () => {
    it("writes to Notes, Attachments, DocumentMeta, Tags, and NoteTags without altering unrelated Notes columns", () => {
      const db = tmpDb();
      const documents = tmpDocuments(db);

      const file: UploadedFile = {
        fileName: "blood_test.pdf",
        uniqueFilename: "abc123_blood_test.pdf",
        mime: "application/pdf",
        hash: "hash12345",
        size: 1024,
      };

      const input: DocumentCreateInput = {
        title: "Blood Test Results",
        type: "test result",
        documentDate: "2026-08-10",
        notes: "Normal cholesterol",
      };

      const doc = documents.create(input, file);

      expect(doc.id).toBeGreaterThan(0);
      expect(doc.title).toBe("Blood Test Results");
      expect(doc.type).toBe("test result");
      expect(doc.documentDate).toBe("2026-08-10");
      expect(doc.notes).toBe("Normal cholesterol");
      expect(doc.file.fileName).toBe("blood_test.pdf");

      // Verify Notes table row
      const noteRow = db.prepare("SELECT * FROM Notes WHERE noteId = ?").get(doc.id) as any;
      expect(noteRow).toBeDefined();
      expect(noteRow.notebookId).toBe(MEDICAL_NOTEBOOK_ID);
      expect(noteRow.title).toBe("Blood Test Results");
      expect(noteRow.noteData).toBe("Normal cholesterol");

      // Verify Attachments table row
      const attachmentRow = db.prepare("SELECT * FROM Attachments WHERE noteId = ?").get(doc.id) as any;
      expect(attachmentRow).toBeDefined();
      expect(attachmentRow.fileName).toBe("blood_test.pdf");
      expect(attachmentRow.uniqueFilename).toBe("abc123_blood_test.pdf");
      expect(attachmentRow.mime).toBe("application/pdf");
      expect(attachmentRow.size).toBe(1024);

      // Verify DocumentMeta row
      const metaRow = db.prepare("SELECT * FROM DocumentMeta WHERE noteId = ?").get(doc.id) as any;
      expect(metaRow).toBeDefined();
      expect(metaRow.documentDate).toBe("2026-08-10");
      expect(metaRow.doctorId).toBeNull();

      // Verify Tags row under medical/document-type
      const parentTag = db.prepare("SELECT * FROM Tags WHERE name = 'medical/document-type'").get() as any;
      expect(parentTag).toBeDefined();
      const typeTag = db.prepare("SELECT * FROM Tags WHERE name = 'test result' AND parentId = ?").get(parentTag.tagId) as any;
      expect(typeTag).toBeDefined();

      // Verify NoteTags row
      const noteTagRow = db.prepare("SELECT * FROM NoteTags WHERE noteId = ? AND tagId = ?").get(doc.id, typeTag.tagId) as any;
      expect(noteTagRow).toBeDefined();
    });
  });

  describe("cross-linking & transitive doctor-tag sync", () => {
    it("links a document to multiple appointments and tasks simultaneously", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, "Doctors");
      const appointments = new Appointments(db);
      const tasks = new Tasks(db);
      const documents = tmpDocuments(db);

      const drA = doctors.create({ name: "Dr. Alice" });
      const drB = doctors.create({ name: "Dr. Bob" });

      const appt1 = appointments.create({
        doctorId: drA.id,
        dateTime: "2026-08-20T10:00:00Z",
        notes: "Cardio checkup",
      });
      const appt2 = appointments.create({
        doctorId: drB.id,
        dateTime: "2026-08-25T11:00:00Z",
        notes: "Follow up",
      });

      const task1 = tasks.create({
        type: "test",
        title: "Blood test",
        doctorId: drA.id,
      });
      const task2 = tasks.create({
        type: "form_17",
        title: "Form 17 for clinic",
        doctorId: null,
      });

      const file: UploadedFile = {
        fileName: "lab.pdf",
        uniqueFilename: "unique_lab.pdf",
        mime: "application/pdf",
        hash: "hash_lab",
        size: 512,
      };

      const doc = documents.create(
        {
          title: "Lab Results",
          type: "test result",
          appointmentIds: [appt1.id, appt2.id],
          taskIds: [task1.id, task2.id],
        },
        file,
      );

      const retrieved = documents.get(doc.id)!;
      expect(retrieved.appointmentIds).toEqual(expect.arrayContaining([appt1.id, appt2.id]));
      expect(retrieved.taskIds).toEqual(expect.arrayContaining([task1.id, task2.id]));

      // Verify transitive doctor tags for drA and drB
      const noteTags = db
        .prepare("SELECT tagId FROM NoteTags WHERE noteId = ?")
        .all(doc.id) as { tagId: number }[];
      const tagIds = noteTags.map((r) => r.tagId);

      expect(tagIds).toContain(drA.tagId);
      expect(tagIds).toContain(drB.tagId);
    });

    it("syncs doctor tags transitively when a linked appointment's doctor changes", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, "Doctors");
      const appointments = new Appointments(db);
      const documents = tmpDocuments(db);

      const drA = doctors.create({ name: "Dr. Alice" });
      const drB = doctors.create({ name: "Dr. Bob" });

      const appt = appointments.create({
        doctorId: drA.id,
        dateTime: "2026-08-20T10:00:00Z",
        notes: "Initial visit",
      });

      const file: UploadedFile = {
        fileName: "referral.pdf",
        uniqueFilename: "unique_ref.pdf",
        mime: "application/pdf",
        hash: "hash_ref",
        size: 512,
      };

      const doc = documents.create(
        {
          title: "Referral Letter",
          type: "referral",
          appointmentIds: [appt.id],
        },
        file,
      );

      let noteTags = db
        .prepare("SELECT tagId FROM NoteTags WHERE noteId = ?")
        .all(doc.id) as { tagId: number }[];
      let tagIds = noteTags.map((r) => r.tagId);
      expect(tagIds).toContain(drA.tagId);
      expect(tagIds).not.toContain(drB.tagId);

      // Now change appointment's doctor to Dr. Bob
      appointments.update(appt.id, {
        doctorId: drB.id,
        dateTime: appt.dateTime,
        notes: appt.notes,
      });

      // Trigger transitive sync
      documents.syncDoctorTags(doc.id);

      noteTags = db
        .prepare("SELECT tagId FROM NoteTags WHERE noteId = ?")
        .all(doc.id) as { tagId: number }[];
      tagIds = noteTags.map((r) => r.tagId);
      expect(tagIds).not.toContain(drA.tagId);
      expect(tagIds).toContain(drB.tagId);
    });
  });

  describe("listing queries", () => {
    it("listRecent returns recently created documents ordered newest first", () => {
      const db = tmpDb();
      const documents = tmpDocuments(db);

      const file: UploadedFile = {
        fileName: "f.pdf",
        uniqueFilename: "u_f.pdf",
        mime: "application/pdf",
        hash: "h",
        size: 100,
      };

      const doc1 = documents.create({ title: "Doc 1", type: "letter" }, file);
      const doc2 = documents.create({ title: "Doc 2", type: "referral" }, file);
      const doc3 = documents.create({ title: "Doc 3", type: "approval" }, file);

      const recent = documents.listRecent(2);
      expect(recent.length).toBe(2);
      expect(recent[0].id).toBe(doc3.id);
      expect(recent[1].id).toBe(doc2.id);
    });

    it("listByDoctor returns documents linked directly or transitively to a doctor", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, "Doctors");
      const appointments = new Appointments(db);
      const tasks = new Tasks(db);
      const documents = tmpDocuments(db);

      const drA = doctors.create({ name: "Dr. Alice" });
      const drB = doctors.create({ name: "Dr. Bob" });

      const apptA = appointments.create({ doctorId: drA.id, dateTime: "2026-08-20T10:00:00Z", notes: "A" });
      const taskB = tasks.create({ doctorId: drB.id, title: "T", type: "test" });

      const file: UploadedFile = { fileName: "f.pdf", uniqueFilename: "u.pdf", mime: "application/pdf", hash: "h", size: 100 };

      // doc1: direct link to drA
      const doc1 = documents.create({ title: "Direct A", type: "letter", doctorId: drA.id }, file);
      // doc2: linked via appt with drA
      const doc2 = documents.create({ title: "Appt A", type: "referral", appointmentIds: [apptA.id] }, file);
      // doc3: linked via task with drB
      const doc3 = documents.create({ title: "Task B", type: "test result", taskIds: [taskB.id] }, file);

      const drADocs = documents.listByDoctor(drA.id);
      expect(drADocs.map((d) => d.id)).toEqual(expect.arrayContaining([doc1.id, doc2.id]));
      expect(drADocs.map((d) => d.id)).not.toContain(doc3.id);

      const drBDocs = documents.listByDoctor(drB.id);
      expect(drBDocs.map((d) => d.id)).toEqual([doc3.id]);
    });
  });
});
