import type { Database } from "better-sqlite3";
import { SharedTags } from "../doctors/SharedTags.js";

export type DocumentType =
  | "test result"
  | "letter"
  | "referral"
  | "appointment invitation"
  | "Form 17"
  | "approval"
  | "other";

export const VALID_DOCUMENT_TYPES: Set<DocumentType> = new Set([
  "test result",
  "letter",
  "referral",
  "appointment invitation",
  "Form 17",
  "approval",
  "other",
]);

export interface UploadedFile {
  fileName: string;
  uniqueFilename: string;
  mime: string;
  hash: string;
  size: number;
}

export interface DocumentCreateInput {
  title: string;
  type: DocumentType;
  documentDate?: string | null;
  doctorId?: number | null;
  notes?: string | null;
  appointmentIds?: number[];
  taskIds?: number[];
}

export interface Document {
  id: number; // noteId
  notebookId: number;
  title: string;
  type: DocumentType;
  documentDate: string | null;
  doctorId: number | null;
  notes: string | null;
  file: UploadedFile;
  appointmentIds: number[];
  taskIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface NoteRow {
  noteId: number;
  notebookId: number;
  title: string;
  noteData: string | null;
  createTime: string;
  updateTime: string;
  updatedBy: string | null;
}

interface DocumentMetaRow {
  noteId: number;
  documentDate: string | null;
  doctorId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AttachmentRow {
  attachmentId: number;
  noteId: number;
  fileName: string;
  uniqueFilename: string;
  mime: string;
  hash: string;
  size: number;
}

interface TagNameRow {
  name: string;
}

interface DoctorTagRow {
  tagId: number;
}

interface DoctorIdRow {
  doctorId: number;
}

interface NoteIdRow {
  noteId: number;
}

export class DocumentNotFoundError extends Error {
  constructor(id: number) {
    super(`Document ${id} not found`);
    this.name = "DocumentNotFoundError";
  }
}

export class InvalidDocumentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentInputError";
  }
}

export interface DocumentsConfig {
  medicalNotebookId: number;
  documentTypeParentTagName?: string;
  doctorsParentTagName?: string;
}

export class Documents {
  private readonly db: Database;
  private readonly tags: SharedTags;
  private readonly medicalNotebookId: number;
  private readonly docTypeParentTagName: string;
  private readonly doctorsParentTagName: string;

  constructor(db: Database, config: DocumentsConfig) {
    this.db = db;
    this.tags = new SharedTags(db);
    this.medicalNotebookId = config.medicalNotebookId;
    this.docTypeParentTagName = config.documentTypeParentTagName ?? "medical/document-type";
    this.doctorsParentTagName = config.doctorsParentTagName ?? "medical/doctors";

    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Notes (
        noteId INTEGER PRIMARY KEY AUTOINCREMENT,
        notebookId INTEGER NOT NULL,
        title TEXT NOT NULL,
        noteData TEXT,
        createTime TEXT NOT NULL DEFAULT (date('now')),
        updateTime TEXT NOT NULL DEFAULT (date('now')),
        updatedBy TEXT
      );

      CREATE TABLE IF NOT EXISTS Attachments (
        attachmentId INTEGER PRIMARY KEY AUTOINCREMENT,
        noteId INTEGER NOT NULL,
        fileName TEXT NOT NULL,
        uniqueFilename TEXT NOT NULL,
        mime TEXT NOT NULL,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS NoteTags (
        noteId INTEGER NOT NULL,
        tagId INTEGER NOT NULL,
        PRIMARY KEY (noteId, tagId)
      );

      CREATE TABLE IF NOT EXISTS DocumentMeta (
        noteId INTEGER PRIMARY KEY,
        documentDate TEXT,
        doctorId INTEGER,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS AppointmentDocuments (
        noteId INTEGER NOT NULL,
        appointmentId INTEGER NOT NULL,
        PRIMARY KEY (noteId, appointmentId)
      );

      CREATE TABLE IF NOT EXISTS TaskDocuments (
        noteId INTEGER NOT NULL,
        taskId INTEGER NOT NULL,
        PRIMARY KEY (noteId, taskId)
      );
    `);
  }

  create(input: DocumentCreateInput, file: UploadedFile): Document {
    this.validate(input, file);

    const insertNote = this.db.prepare(`
      INSERT INTO Notes (notebookId, title, noteData, createTime, updateTime, updatedBy)
      VALUES (@notebookId, @title, @noteData, date('now'), date('now'), 'turnado')
    `);

    const insertAttachment = this.db.prepare(`
      INSERT INTO Attachments (noteId, fileName, uniqueFilename, mime, hash, size)
      VALUES (@noteId, @fileName, @uniqueFilename, @mime, @hash, @size)
    `);

    const insertMeta = this.db.prepare(`
      INSERT INTO DocumentMeta (noteId, documentDate, doctorId)
      VALUES (@noteId, @documentDate, @doctorId)
    `);

    const insertNoteTag = this.db.prepare(`
      INSERT OR IGNORE INTO NoteTags (noteId, tagId)
      VALUES (@noteId, @tagId)
    `);

    const insertAppointmentDoc = this.db.prepare(`
      INSERT OR IGNORE INTO AppointmentDocuments (noteId, appointmentId)
      VALUES (@noteId, @appointmentId)
    `);

    const insertTaskDoc = this.db.prepare(`
      INSERT OR IGNORE INTO TaskDocuments (noteId, taskId)
      VALUES (@noteId, @taskId)
    `);

    const typeTagId = this.findOrCreateDocumentTypeTag(input.type);

    let createdId = 0;
    const tx = this.db.transaction(() => {
      const noteResult = insertNote.run({
        notebookId: this.medicalNotebookId,
        title: input.title.trim(),
        noteData: input.notes?.trim() || null,
      });

      createdId = Number(noteResult.lastInsertRowid);

      insertAttachment.run({
        noteId: createdId,
        fileName: file.fileName,
        uniqueFilename: file.uniqueFilename,
        mime: file.mime,
        hash: file.hash,
        size: file.size,
      });

      insertMeta.run({
        noteId: createdId,
        documentDate: input.documentDate || null,
        doctorId: input.doctorId ?? null,
      });

      insertNoteTag.run({
        noteId: createdId,
        tagId: typeTagId,
      });

      if (input.appointmentIds) {
        for (const apptId of input.appointmentIds) {
          insertAppointmentDoc.run({ noteId: createdId, appointmentId: apptId });
        }
      }

      if (input.taskIds) {
        for (const taskId of input.taskIds) {
          insertTaskDoc.run({ noteId: createdId, taskId });
        }
      }

      this.syncDoctorTags(createdId);
    });

    tx();

    return this.getOrThrow(createdId);
  }

  get(id: number): Document | undefined {
    const note = this.db
      .prepare(`SELECT * FROM Notes WHERE noteId = ? AND notebookId = ?`)
      .get(id, this.medicalNotebookId) as NoteRow | undefined;
    if (!note) return undefined;

    const meta = this.db
      .prepare(`SELECT * FROM DocumentMeta WHERE noteId = ?`)
      .get(id) as DocumentMetaRow | undefined;
    const attachment = this.db
      .prepare(`SELECT * FROM Attachments WHERE noteId = ? ORDER BY attachmentId DESC LIMIT 1`)
      .get(id) as AttachmentRow | undefined;

    const typeTag = this.db
      .prepare(
        `SELECT t.name FROM NoteTags nt
         JOIN Tags t ON t.tagId = nt.tagId
         JOIN Tags parent ON parent.tagId = t.parentId
         WHERE nt.noteId = ? AND parent.name = ?`,
      )
      .get(id, this.docTypeParentTagName) as TagNameRow | undefined;

    const appointmentRows = this.db
      .prepare(`SELECT appointmentId FROM AppointmentDocuments WHERE noteId = ?`)
      .all(id) as { appointmentId: number }[];

    const taskRows = this.db
      .prepare(`SELECT taskId FROM TaskDocuments WHERE noteId = ?`)
      .all(id) as { taskId: number }[];

    return {
      id: note.noteId,
      notebookId: note.notebookId,
      title: note.title,
      type: (typeTag?.name as DocumentType) || "other",
      documentDate: meta?.documentDate ?? null,
      doctorId: meta?.doctorId ?? null,
      notes: note.noteData ?? null,
      file: attachment
        ? {
            fileName: attachment.fileName,
            uniqueFilename: attachment.uniqueFilename,
            mime: attachment.mime,
            hash: attachment.hash,
            size: attachment.size,
          }
        : {
            fileName: "",
            uniqueFilename: "",
            mime: "",
            hash: "",
            size: 0,
          },
      appointmentIds: appointmentRows.map((r) => r.appointmentId),
      taskIds: taskRows.map((r) => r.taskId),
      createdAt: meta?.createdAt ?? note.createTime,
      updatedAt: meta?.updatedAt ?? note.updateTime,
    };
  }

  list(): Document[] {
    const notes = this.db
      .prepare(`SELECT noteId FROM Notes WHERE notebookId = ? ORDER BY noteId DESC`)
      .all(this.medicalNotebookId) as NoteIdRow[];
    return notes.map((n) => this.get(n.noteId)!).filter(Boolean);
  }

  listRecent(limit = 5): Document[] {
    const notes = this.db
      .prepare(`SELECT noteId FROM Notes WHERE notebookId = ? ORDER BY noteId DESC LIMIT ?`)
      .all(this.medicalNotebookId, limit) as NoteIdRow[];
    return notes.map((n) => this.get(n.noteId)!).filter(Boolean);
  }

  listByDoctor(doctorId: number): Document[] {
    // Note IDs directly linked via DocumentMeta or via linked Appointments/Tasks
    const rows = this.db
      .prepare(
        `SELECT DISTINCT n.noteId FROM Notes n
         LEFT JOIN DocumentMeta dm ON dm.noteId = n.noteId
         LEFT JOIN AppointmentDocuments ad ON ad.noteId = n.noteId
         LEFT JOIN Appointments a ON a.id = ad.appointmentId
         LEFT JOIN TaskDocuments td ON td.noteId = n.noteId
         LEFT JOIN Tasks t ON t.id = td.taskId
         WHERE n.notebookId = ? AND (
           dm.doctorId = ? OR a.doctorId = ? OR t.doctorId = ?
         )
         ORDER BY n.noteId DESC`,
      )
      .all(this.medicalNotebookId, doctorId, doctorId, doctorId) as NoteIdRow[];

    return rows.map((r) => this.get(r.noteId)!).filter(Boolean);
  }

  listByTask(taskId: number): Document[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT n.noteId FROM Notes n
         JOIN TaskDocuments td ON td.noteId = n.noteId
         WHERE n.notebookId = ? AND td.taskId = ?
         ORDER BY n.noteId DESC`,
      )
      .all(this.medicalNotebookId, taskId) as NoteIdRow[];

    return rows.map((r) => this.get(r.noteId)!).filter(Boolean);
  }

  listByAppointment(appointmentId: number): Document[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT n.noteId FROM Notes n
         JOIN AppointmentDocuments ad ON ad.noteId = n.noteId
         WHERE n.notebookId = ? AND ad.appointmentId = ?
         ORDER BY n.noteId DESC`,
      )
      .all(this.medicalNotebookId, appointmentId) as NoteIdRow[];

    return rows.map((r) => this.get(r.noteId)!).filter(Boolean);
  }

  private getOrThrow(id: number): Document {
    const doc = this.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    return doc;
  }

  /**
   * Transitive doctor-tag synchronization:
   * Finds all distinct doctor IDs linked to this document:
   * 1. Direct link in DocumentMeta.doctorId
   * 2. Appointments linked via AppointmentDocuments -> Appointments.doctorId
   * 3. Tasks linked via TaskDocuments -> Tasks.doctorId
   *
   * Then ensures the Note in NoteTags has the corresponding doctor tag (under medical/doctors),
   * and removes any doctor tags that are no longer linked.
   */
  syncDoctorTags(noteId: number): void {
    const meta = this.db
      .prepare(`SELECT doctorId FROM DocumentMeta WHERE noteId = ?`)
      .get(noteId) as DocumentMetaRow | undefined;
    const directDoctorId = meta?.doctorId;

    const apptDoctorRows = this.db
      .prepare(
        `SELECT a.doctorId FROM AppointmentDocuments ad
         JOIN Appointments a ON a.id = ad.appointmentId
         WHERE ad.noteId = ? AND a.doctorId IS NOT NULL`,
      )
      .all(noteId) as DoctorIdRow[];

    const taskDoctorRows = this.db
      .prepare(
        `SELECT t.doctorId FROM TaskDocuments td
         JOIN Tasks t ON t.id = td.taskId
         WHERE td.noteId = ? AND t.doctorId IS NOT NULL`,
      )
      .all(noteId) as DoctorIdRow[];

    const doctorIds = new Set<number>();
    if (directDoctorId) doctorIds.add(directDoctorId);
    for (const r of apptDoctorRows) doctorIds.add(r.doctorId);
    for (const r of taskDoctorRows) doctorIds.add(r.doctorId);

    // Get tag IDs for all these doctors
    const targetTagIds = new Set<number>();
    if (doctorIds.size > 0) {
      const placeholders = Array.from(doctorIds).map(() => "?").join(",");
      const doctorRows = this.db
        .prepare(`SELECT tagId FROM Doctors WHERE id IN (${placeholders})`)
        .all(...Array.from(doctorIds)) as DoctorTagRow[];
      for (const d of doctorRows) {
        if (d.tagId) targetTagIds.add(d.tagId);
      }
    }

    // Get all doctor tags currently associated with this note
    const existingDoctorTagRows = this.db
      .prepare(
        `SELECT nt.tagId FROM NoteTags nt
         JOIN Doctors d ON d.tagId = nt.tagId
         WHERE nt.noteId = ?`,
      )
      .all(noteId) as DoctorTagRow[];

    const existingTagIds = new Set<number>(existingDoctorTagRows.map((r) => r.tagId));

    // Add missing tags
    const insertNoteTag = this.db.prepare(`INSERT OR IGNORE INTO NoteTags (noteId, tagId) VALUES (?, ?)`);
    for (const tagId of targetTagIds) {
      if (!existingTagIds.has(tagId)) {
        insertNoteTag.run(noteId, tagId);
      }
    }

    // Remove tags no longer linked
    const deleteNoteTag = this.db.prepare(`DELETE FROM NoteTags WHERE noteId = ? AND tagId = ?`);
    for (const tagId of existingTagIds) {
      if (!targetTagIds.has(tagId)) {
        deleteNoteTag.run(noteId, tagId);
      }
    }
  }

  private syncDoctorTagsForLinkedEntity(table: "AppointmentDocuments" | "TaskDocuments", foreignKey: "appointmentId" | "taskId", id: number): void {
    const rows = this.db
      .prepare(`SELECT noteId FROM ${table} WHERE ${foreignKey} = ?`)
      .all(id) as NoteIdRow[];
    for (const r of rows) {
      this.syncDoctorTags(r.noteId);
    }
  }

  syncDoctorTagsForAppointment(appointmentId: number): void {
    this.syncDoctorTagsForLinkedEntity("AppointmentDocuments", "appointmentId", appointmentId);
  }

  syncDoctorTagsForTask(taskId: number): void {
    this.syncDoctorTagsForLinkedEntity("TaskDocuments", "taskId", taskId);
  }

  private findOrCreateDocumentTypeTag(type: DocumentType): number {
    const parentId = this.findOrCreateTag(this.docTypeParentTagName, null);
    return this.findOrCreateTag(type, parentId);
  }

  private findOrCreateTag(name: string, parentId: number | null): number {
    const existing = this.tags.findByName(name);
    if (existing) return existing.tagId;
    return this.tags.create(name, parentId);
  }

  private validate(input: DocumentCreateInput, file: UploadedFile): void {
    if (!input.title?.trim()) {
      throw new InvalidDocumentInputError("title is required");
    }
    if (!input.type || !VALID_DOCUMENT_TYPES.has(input.type)) {
      throw new InvalidDocumentInputError(`type must be one of: ${Array.from(VALID_DOCUMENT_TYPES).join(", ")}`);
    }
    if (!file || !file.fileName || !file.uniqueFilename) {
      throw new InvalidDocumentInputError("file is required");
    }
  }
}
