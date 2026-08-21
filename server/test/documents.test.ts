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
  groupDocumentsByType,
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
    new Doctors(db, "Doctors");
    new Appointments(db);
    new Tasks(db);
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
      expect(noteRow.noteData).toContain("Normal cholesterol");
      expect(noteRow.noteData).toContain("attachments/abc123_blood_test.pdf");

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

      // Verify Tags row under medical -> document-type
      const rootTag = db.prepare("SELECT * FROM Tags WHERE name = 'medical'").get() as any;
      expect(rootTag).toBeDefined();
      expect(rootTag.parentId).toBeNull();
      const parentTag = db.prepare("SELECT * FROM Tags WHERE name = 'document-type' AND parentId = ?").get(rootTag.tagId) as any;
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

    it("syncs doctor tags and specialty tags transitively when a linked appointment's doctor changes", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, "Doctors");
      const appointments = new Appointments(db);
      const documents = tmpDocuments(db);

      const drA = doctors.create({ name: "Dr. Alice", specialty: "Cardiology" });
      const drB = doctors.create({ name: "Dr. Bob", specialty: "Neurology" });

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

      const cardiologyTag = db.prepare("SELECT tagId FROM Tags WHERE name = 'Cardiology'").get() as { tagId: number };
      const neurologyTag = db.prepare("SELECT tagId FROM Tags WHERE name = 'Neurology'").get() as { tagId: number } | undefined;

      expect(cardiologyTag).toBeDefined();
      let noteTags = db
        .prepare("SELECT tagId FROM NoteTags WHERE noteId = ?")
        .all(doc.id) as { tagId: number }[];
      let tagIds = noteTags.map((r) => r.tagId);
      expect(tagIds).toContain(drA.tagId);
      expect(tagIds).toContain(cardiologyTag.tagId);
      if (neurologyTag) expect(tagIds).not.toContain(neurologyTag.tagId);
      expect(tagIds).not.toContain(drB.tagId);

      // Now change appointment's doctor to Dr. Bob
      appointments.update(appt.id, {
        doctorId: drB.id,
        dateTime: appt.dateTime,
        notes: appt.notes,
      });

      // Trigger transitive sync
      documents.syncDoctorTags(doc.id);

      const activeNeurologyTag = db.prepare("SELECT tagId FROM Tags WHERE name = 'Neurology'").get() as { tagId: number };
      expect(activeNeurologyTag).toBeDefined();

      noteTags = db
        .prepare("SELECT tagId FROM NoteTags WHERE noteId = ?")
        .all(doc.id) as { tagId: number }[];
      tagIds = noteTags.map((r) => r.tagId);
      expect(tagIds).not.toContain(drA.tagId);
      expect(tagIds).not.toContain(cardiologyTag.tagId);
      expect(tagIds).toContain(drB.tagId);
      expect(tagIds).toContain(activeNeurologyTag.tagId);
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

  describe("search", () => {
    it("combines type and doctor filters, returning only documents matching both", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, "Doctors");
      const documents = tmpDocuments(db);

      const drA = doctors.create({ name: "Dr. Alice" });
      const drB = doctors.create({ name: "Dr. Bob" });

      const file: UploadedFile = { fileName: "f.pdf", uniqueFilename: "u.pdf", mime: "application/pdf", hash: "h", size: 100 };

      const doc1 = documents.create(
        { title: "Blood Test Alice", type: "test result", doctorId: drA.id, documentDate: "2026-08-01" },
        file,
      );
      documents.create(
        { title: "Blood Test Bob", type: "test result", doctorId: drB.id, documentDate: "2026-08-02" },
        file,
      );
      documents.create(
        { title: "Referral Alice", type: "referral", doctorId: drA.id, documentDate: "2026-08-03" },
        file,
      );

      const results = documents.search({ type: "test result", doctorId: drA.id });

      expect(results.map((d) => d.id)).toEqual([doc1.id]);
    });

    it("combines a title text query with a date range, excluding matches outside the range", () => {
      const db = tmpDb();
      const documents = tmpDocuments(db);

      const file: UploadedFile = { fileName: "f.pdf", uniqueFilename: "u.pdf", mime: "application/pdf", hash: "h", size: 100 };

      const inRange = documents.create(
        { title: "Cardiology Referral", type: "referral", documentDate: "2026-08-10" },
        file,
      );
      // Same title text, but outside the date range.
      documents.create(
        { title: "Cardiology Referral Old", type: "referral", documentDate: "2026-01-01" },
        file,
      );
      // Inside the date range, but title doesn't match the query.
      documents.create({ title: "Unrelated Letter", type: "letter", documentDate: "2026-08-11" }, file);

      const results = documents.search({ query: "cardiology", dateFrom: "2026-08-01", dateTo: "2026-08-31" });

      expect(results.map((d) => d.id)).toEqual([inRange.id]);
    });
  });

  describe("groupDocumentsByType", () => {
    it("groups documents under their type, in VALID_DOCUMENT_TYPES declaration order, preserving input order within a group", () => {
      const db = tmpDb();
      const documents = tmpDocuments(db);
      const file: UploadedFile = { fileName: "f.pdf", uniqueFilename: "u.pdf", mime: "application/pdf", hash: "h", size: 100 };

      // Input order: referral, test result, referral — declaration order puts
      // "test result" before "referral" (see VALID_DOCUMENT_TYPES).
      const referral1 = documents.create({ title: "Referral 1", type: "referral" }, file);
      const testResult = documents.create({ title: "Test Result 1", type: "test result" }, file);
      const referral2 = documents.create({ title: "Referral 2", type: "referral" }, file);

      const grouped = groupDocumentsByType([referral1, testResult, referral2]);

      expect(grouped).toEqual([
        { type: "test result", documents: [testResult] },
        { type: "referral", documents: [referral1, referral2] },
      ]);
    });
  });
});
