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

export interface DocumentSearchFilters {
  /** Case-insensitive substring match against the document title. */
  query?: string;
  type?: DocumentType;
  /** Matches a document linked to this doctor directly, or transitively via a linked appointment/task (same rule as listByDoctor). */
  doctorId?: number;
  /** Inclusive lower bound on documentDate. */
  dateFrom?: string;
  /** Inclusive upper bound on documentDate. */
  dateTo?: string;
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

/** Input to `Documents.adopt()` (issue #14) — no title/notes/file, since those already exist on the Note being promoted. */
export interface AdoptInput {
  type: DocumentType;
  documentDate?: string | null;
  doctorId?: number | null;
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

function buildNoteData(notesText: string | undefined | null, file: UploadedFile): string {
  const mimeType = (file.mime || "").toLowerCase();
  const fileName = (file.fileName || "").toLowerCase();
  let attachmentHtml = "";

  if (mimeType.startsWith("image") || /\.(jpe?g|png|webp|gif|svg|avif|heic|bmp|tiff)$/i.test(fileName)) {
    attachmentHtml = `<img class='paperless-attachment' src='attachments/${file.uniqueFilename}' alt='${file.fileName}' hash='${file.hash}'/>`;
  } else if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
    attachmentHtml = `<embed class='paperless-attachment' src='attachments/${file.uniqueFilename}' type='${file.mime || "application/pdf"}' hash='${file.hash}'/>`;
  } else {
    attachmentHtml = `<div class='paperless-attachment-file' data-src='attachments/${file.uniqueFilename}'><span>${file.fileName}</span></div>`;
  }

  const trimmed = notesText?.trim();
  if (trimmed) {
    return `${attachmentHtml}\n<div>${trimmed}</div>`;
  }
  return attachmentHtml;
}

function extractNotesText(noteData: string | null): string | null {
  if (!noteData) return null;
  const stripped = noteData
    .replace(/<img\s+class=['"]paperless-attachment['"][^>]*>/gi, "")
    .replace(/<embed\s+class=['"]paperless-attachment['"][^>]*>/gi, "")
    .replace(/<div\s+class=['"]paperless-attachment-file['"][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div class=['"]paperless-merged-note['"][\s\S]*?<\/div>/gi, "")
    .trim()
    .replace(/^<div>([\s\S]*)<\/div>$/i, "$1")
    .replace(/^<p>([\s\S]*)<\/p>$/i, "$1")
    .trim();
  return stripped.length > 0 ? stripped : null;
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
  medicalNotebookId?: number;
  medicalNotebookName?: string;
  documentTypeParentTagName?: string;
  doctorsParentTagName?: string;
  specialtyParentTagName?: string;
}

export class Documents {
  private readonly db: Database;
  private readonly tags: SharedTags;
  private readonly medicalNotebookId: number;
  private readonly docTypeParentTagName: string;
  private readonly doctorsParentTagName: string;
  private readonly specialtyParentTagName: string;

  constructor(db: Database, config: DocumentsConfig) {
    this.db = db;
    this.tags = new SharedTags(db);
    this.ensureTables();
    this.medicalNotebookId = this.resolveNotebookId(config);
    this.docTypeParentTagName = config.documentTypeParentTagName ?? "medical/document-type";
    this.doctorsParentTagName = config.doctorsParentTagName ?? "medical/doctors";
    this.specialtyParentTagName = config.specialtyParentTagName ?? "medical/specialty";
  }

  private resolveNotebookId(config: DocumentsConfig): number {
    if (config.medicalNotebookName) {
      const row = this.db
        .prepare(`SELECT notebookId FROM Notebooks WHERE name = ?`)
        .get(config.medicalNotebookName) as { notebookId: number } | undefined;
      if (row) return row.notebookId;

      try {
        const res = this.db
          .prepare(`INSERT INTO Notebooks (name, type) VALUES (?, NULL)`)
          .run(config.medicalNotebookName);
        return res.lastInsertRowid as number;
      } catch {
        // Fall through
      }
    }
    if (config.medicalNotebookId !== undefined && config.medicalNotebookId !== null) {
      return config.medicalNotebookId;
    }
    return 0;
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Notebooks (
        notebookId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT
      );

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
        noteData: buildNoteData(input.notes, file),
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
      .prepare(
        `SELECT attachmentId, noteId, fileName, coalesce(uniqueFileName, uniqueFilename) AS uniqueFilename, mime, hash, size
         FROM Attachments WHERE noteId = ? ORDER BY attachmentId DESC LIMIT 1`,
      )
      .get(id) as AttachmentRow | undefined;

    const docTypeParentId = this.findOrCreateDocumentTypeParentTagId();
    const typeTag = this.db
      .prepare(
        `SELECT t.name FROM NoteTags nt
         JOIN Tags t ON t.tagId = nt.tagId
         WHERE nt.noteId = ? AND t.parentId = ?`,
      )
      .get(id, docTypeParentId) as TagNameRow | undefined;

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
      notes: extractNotesText(note.noteData),
      file: attachment
        ? {
            fileName: attachment.fileName,
            uniqueFilename: attachment.uniqueFilename || (attachment as any).uniqueFileName || "",
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

  /** Documents linked to a doctor directly, or transitively via a linked appointment/task — same rule `search({ doctorId })` applies for its doctor filter, so this just delegates to it. */
  listByDoctor(doctorId: number): Document[] {
    return this.search({ doctorId });
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

  search(filters: DocumentSearchFilters): Document[] {
    const conditions: string[] = ["n.notebookId = ?"];
    const params: (string | number)[] = [this.medicalNotebookId];

    if (filters.doctorId !== undefined) {
      conditions.push(`n.noteId IN (
        SELECT n2.noteId FROM Notes n2
        LEFT JOIN DocumentMeta dm ON dm.noteId = n2.noteId
        LEFT JOIN AppointmentDocuments ad ON ad.noteId = n2.noteId
        LEFT JOIN Appointments a ON a.id = ad.appointmentId
        LEFT JOIN TaskDocuments td ON td.noteId = n2.noteId
        LEFT JOIN Tasks t ON t.id = td.taskId
        WHERE dm.doctorId = ? OR a.doctorId = ? OR t.doctorId = ?
      )`);
      params.push(filters.doctorId, filters.doctorId, filters.doctorId);
    }

    if (filters.type) {
      const docTypeParentId = this.findOrCreateDocumentTypeParentTagId();
      conditions.push(`n.noteId IN (
        SELECT nt.noteId FROM NoteTags nt
        JOIN Tags tg ON tg.tagId = nt.tagId
        WHERE tg.parentId = ? AND tg.name = ?
      )`);
      params.push(docTypeParentId, filters.type);
    }

    const trimmedQuery = filters.query?.trim();
    if (trimmedQuery) {
      conditions.push(`n.title LIKE ? COLLATE NOCASE`);
      params.push(`%${trimmedQuery}%`);
    }

    if (filters.dateFrom) {
      conditions.push(`n.noteId IN (SELECT noteId FROM DocumentMeta WHERE documentDate >= ?)`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push(`n.noteId IN (SELECT noteId FROM DocumentMeta WHERE documentDate <= ?)`);
      params.push(filters.dateTo);
    }

    const rows = this.db
      .prepare(`SELECT n.noteId FROM Notes n WHERE ${conditions.join(" AND ")} ORDER BY n.noteId DESC`)
      .all(...params) as NoteIdRow[];

    return rows.map((r) => this.get(r.noteId)!).filter(Boolean);
  }

  /** Links an already-created document to an already-created task (see app.ts's auto Form-17 linkage on invitation upload, where the task can't exist yet at document-creation time). Re-syncs doctor tags since the linked task may carry its own doctorId. */
  linkTask(noteId: number, taskId: number): void {
    this.db.prepare(`INSERT OR IGNORE INTO TaskDocuments (noteId, taskId) VALUES (?, ?)`).run(noteId, taskId);
    this.syncDoctorTags(noteId);
  }

  /** Links an already-created document to an already-created appointment (issue #9: attaching an existing document to an appointment's checklist via the searchable picker, rather than only linking at upload time). Re-syncs doctor tags since the linked appointment may carry its own doctorId. */
  linkAppointment(noteId: number, appointmentId: number): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO AppointmentDocuments (noteId, appointmentId) VALUES (?, ?)`)
      .run(noteId, appointmentId);
    this.syncDoctorTags(noteId);
  }

  /**
   * Promotes an already-existing Note in the shared archive into this
   * app's Document model (issue #14's adoption tool) — as opposed to
   * `create()`, which writes a brand-new Note/Attachment from an upload.
   * The Note's title/notes/attachment are left exactly as they already
   * are; adoption only moves it into the medical notebook (so `get()`/
   * `list()`/`search()` — which all filter on notebookId — find it),
   * tags its type, and records the doctor/date the same way `create()`
   * does.
   */
  adopt(noteId: number, input: AdoptInput): Document {
    this.validateAdopt(noteId, input);

    const typeTagId = this.findOrCreateDocumentTypeTag(input.type);

    const updateNotebook = this.db.prepare(`UPDATE Notes SET notebookId = @notebookId WHERE noteId = @noteId`);
    const insertMeta = this.db.prepare(`
      INSERT INTO DocumentMeta (noteId, documentDate, doctorId)
      VALUES (@noteId, @documentDate, @doctorId)
    `);
    const insertNoteTag = this.db.prepare(`
      INSERT OR IGNORE INTO NoteTags (noteId, tagId)
      VALUES (@noteId, @tagId)
    `);

    const tx = this.db.transaction(() => {
      updateNotebook.run({ notebookId: this.medicalNotebookId, noteId });

      insertMeta.run({
        noteId,
        documentDate: input.documentDate || null,
        doctorId: input.doctorId ?? null,
      });

      insertNoteTag.run({ noteId, tagId: typeTagId });

      this.syncDoctorTags(noteId);
    });
    tx();

    return this.getOrThrow(noteId);
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

    // Get doctor tags and specialty tags for all these doctors
    const targetDoctorTagIds = new Set<number>();
    const targetSpecialtyTagIds = new Set<number>();

    if (doctorIds.size > 0) {
      const placeholders = Array.from(doctorIds).map(() => "?").join(",");
      const doctorRows = this.db
        .prepare(`SELECT tagId, specialty FROM Doctors WHERE id IN (${placeholders})`)
        .all(...Array.from(doctorIds)) as (DoctorTagRow & { specialty: string | null })[];
      for (const d of doctorRows) {
        if (d.tagId) targetDoctorTagIds.add(d.tagId);
        if (d.specialty && d.specialty.trim().length > 0) {
          const specTagId = this.findOrCreateSpecialtyTag(d.specialty.trim());
          targetSpecialtyTagIds.add(specTagId);
        }
      }
    }

    // Doctor tags sync
    const existingDoctorTagRows = this.db
      .prepare(
        `SELECT nt.tagId FROM NoteTags nt
         JOIN Doctors d ON d.tagId = nt.tagId
         WHERE nt.noteId = ?`,
      )
      .all(noteId) as DoctorTagRow[];

    const existingDoctorTagIds = new Set<number>(existingDoctorTagRows.map((r) => r.tagId));

    const insertNoteTag = this.db.prepare(`INSERT OR IGNORE INTO NoteTags (noteId, tagId) VALUES (?, ?)`);
    const deleteNoteTag = this.db.prepare(`DELETE FROM NoteTags WHERE noteId = ? AND tagId = ?`);

    for (const tagId of targetDoctorTagIds) {
      if (!existingDoctorTagIds.has(tagId)) {
        insertNoteTag.run(noteId, tagId);
      }
    }
    for (const tagId of existingDoctorTagIds) {
      if (!targetDoctorTagIds.has(tagId)) {
        deleteNoteTag.run(noteId, tagId);
      }
    }

    // Specialty tags sync
    const specParentId = this.findOrCreateSpecialtyParentTagId();
    const existingSpecialtyTagRows = this.db
      .prepare(
        `SELECT nt.tagId FROM NoteTags nt
         JOIN Tags t ON t.tagId = nt.tagId
         WHERE nt.noteId = ? AND t.parentId = ?`,
      )
      .all(noteId, specParentId) as { tagId: number }[];

    const existingSpecialtyTagIds = new Set<number>(existingSpecialtyTagRows.map((r) => r.tagId));

    for (const tagId of targetSpecialtyTagIds) {
      if (!existingSpecialtyTagIds.has(tagId)) {
        insertNoteTag.run(noteId, tagId);
      }
    }
    for (const tagId of existingSpecialtyTagIds) {
      if (!targetSpecialtyTagIds.has(tagId)) {
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

  private findOrCreateSpecialtyTag(specialty: string): number {
    const parentId = this.findOrCreateSpecialtyParentTagId();
    return this.findOrCreateTag(specialty, parentId);
  }

  private findOrCreateSpecialtyParentTagId(): number {
    return this.tags.findOrCreatePath(this.specialtyParentTagName);
  }

  private findOrCreateDocumentTypeTag(type: DocumentType): number {
    const parentId = this.findOrCreateDocumentTypeParentTagId();
    return this.findOrCreateTag(type, parentId);
  }

  private findOrCreateDocumentTypeParentTagId(): number {
    return this.tags.findOrCreatePath(this.docTypeParentTagName);
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
    this.validateType(input.type);
    if (!file || !file.fileName || !file.uniqueFilename) {
      throw new InvalidDocumentInputError("file is required");
    }
  }

  /** Shared by validate() and validateAdopt() — the one piece both create() and adopt() actually check the same way. */
  private validateType(type: DocumentType | undefined): void {
    if (!type || !VALID_DOCUMENT_TYPES.has(type)) {
      throw new InvalidDocumentInputError(`type must be one of: ${Array.from(VALID_DOCUMENT_TYPES).join(", ")}`);
    }
  }

  private validateAdopt(noteId: number, input: AdoptInput): void {
    const note = this.db.prepare(`SELECT noteId FROM Notes WHERE noteId = ?`).get(noteId) as NoteIdRow | undefined;
    if (!note) throw new DocumentNotFoundError(noteId);

    this.validateType(input.type);

    const existingMeta = this.db.prepare(`SELECT noteId FROM DocumentMeta WHERE noteId = ?`).get(noteId) as
      | NoteIdRow
      | undefined;
    if (existingMeta) {
      throw new InvalidDocumentInputError(`Note ${noteId} has already been adopted`);
    }
  }
}
