import type { Database, Statement } from "better-sqlite3";
import { ensureColumn } from "../db.js";

export type TaskType = "test" | "doctor_visit" | "form_17" | "general_approval";
export type TaskStatus = "open" | "in-progress" | "done";

export interface TaskInput {
  type: TaskType;
  title: string;
  status?: TaskStatus;
  dueDate?: string | null;
  doctorId?: number | null;
  sourceAppointmentId?: number | null;
  pendingAppointmentId?: number | null;
  // test fields
  requiresAdvanceScheduling?: boolean;
  recurrenceWindow?: string | null;
  approximateDateWindow?: string | null;
  // form_17 fields
  institution?: string | null;
  department?: string | null;
  healthFund?: string | null;
  codeNumber?: string | null;
  codeName?: string | null;
  // general_approval fields
  issuingBody?: string | null;
  purpose?: string | null;
}

export interface Task extends TaskInput {
  id: number;
  status: TaskStatus;
  doctorId: number | null;
  dueDate: string | null;
  sourceAppointmentId: number | null;
  pendingAppointmentId: number | null;
  requiresAdvanceScheduling: boolean;
  recurrenceWindow: string | null;
  approximateDateWindow: string | null;
  institution: string | null;
  department: string | null;
  healthFund: string | null;
  codeNumber: string | null;
  codeName: string | null;
  issuingBody: string | null;
  purpose: string | null;
  createdAt: string;
  updatedAt: string;
  /** The allow-listed username this task belongs to (issue #10) — see Appointment.ownerUsername for the full rationale; same null-means-no-reminder, immutable-after-creation contract. */
  ownerUsername: string | null;
}

export class TaskNotFoundError extends Error {
  constructor(id: number) {
    super(`Task ${id} not found`);
    this.name = "TaskNotFoundError";
  }
}

export class InvalidTaskInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTaskInputError";
  }
}

const VALID_TYPES = new Set<TaskType>(["test", "doctor_visit", "form_17", "general_approval"]);
const VALID_STATUSES = new Set<TaskStatus>(["open", "in-progress", "done"]);

export class Tasks {
  private readonly insertTask: Statement;
  private readonly getTask: Statement;
  private readonly listTasks: Statement;
  private readonly updateTask: Statement;
  private readonly updateStatusStmt: Statement;
  private readonly setPendingAppointmentStmt: Statement;

  constructor(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS Tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        dueDate TEXT,
        doctorId INTEGER,
        sourceAppointmentId INTEGER,
        pendingAppointmentId INTEGER,
        requiresAdvanceScheduling INTEGER NOT NULL DEFAULT 0,
        recurrenceWindow TEXT,
        approximateDateWindow TEXT,
        institution TEXT,
        department TEXT,
        healthFund TEXT,
        codeNumber TEXT,
        codeName TEXT,
        issuingBody TEXT,
        purpose TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // First column added to an already-shipped table (issue #10) — see
    // ensureColumn's own doc for why this needs a guard at all.
    ensureColumn(db, "Tasks", "ownerUsername", "TEXT");

    this.insertTask = db.prepare(`
      INSERT INTO Tasks (
        type, title, status, dueDate, doctorId, sourceAppointmentId, pendingAppointmentId,
        requiresAdvanceScheduling, recurrenceWindow, approximateDateWindow,
        institution, department, healthFund, codeNumber, codeName,
        issuingBody, purpose, ownerUsername, createdAt, updatedAt
      ) VALUES (
        $type, $title, $status, $dueDate, $doctorId, $sourceAppointmentId, $pendingAppointmentId,
        $requiresAdvanceScheduling, $recurrenceWindow, $approximateDateWindow,
        $institution, $department, $healthFund, $codeNumber, $codeName,
        $issuingBody, $purpose, $ownerUsername, datetime('now'), datetime('now')
      )
    `);

    this.getTask = db.prepare(`SELECT * FROM Tasks WHERE id = ?`);
    this.listTasks = db.prepare(
      `SELECT * FROM Tasks ORDER BY CASE WHEN dueDate IS NULL OR dueDate = '' THEN 0 ELSE 1 END, dueDate ASC, id ASC`
    );
    this.updateTask = db.prepare(`
      UPDATE Tasks SET
        type = $type,
        title = $title,
        status = $status,
        dueDate = $dueDate,
        doctorId = $doctorId,
        sourceAppointmentId = $sourceAppointmentId,
        pendingAppointmentId = $pendingAppointmentId,
        requiresAdvanceScheduling = $requiresAdvanceScheduling,
        recurrenceWindow = $recurrenceWindow,
        approximateDateWindow = $approximateDateWindow,
        institution = $institution,
        department = $department,
        healthFund = $healthFund,
        codeNumber = $codeNumber,
        codeName = $codeName,
        issuingBody = $issuingBody,
        purpose = $purpose,
        updatedAt = datetime('now')
      WHERE id = $id
    `);

    this.updateStatusStmt = db.prepare(`
      UPDATE Tasks SET status = $status, updatedAt = datetime('now') WHERE id = $id
    `);

    this.setPendingAppointmentStmt = db.prepare(`
      UPDATE Tasks SET pendingAppointmentId = $pendingAppointmentId, updatedAt = datetime('now') WHERE id = $id
    `);
  }

  /**
   * `ownerUsername` is a separate param, not part of TaskInput — see
   * Appointments.create()'s identical reasoning (issue #10).
   */
  create(input: TaskInput, ownerUsername: string | null = null): Task {
    this.validate(input);
    const result = this.insertTask.run({
      type: input.type,
      title: input.title.trim(),
      status: input.status ?? "open",
      dueDate: input.dueDate ?? null,
      doctorId: input.doctorId ?? null,
      sourceAppointmentId: input.sourceAppointmentId ?? null,
      pendingAppointmentId: input.pendingAppointmentId ?? null,
      requiresAdvanceScheduling: input.requiresAdvanceScheduling ? 1 : 0,
      recurrenceWindow: input.recurrenceWindow ?? null,
      approximateDateWindow: input.approximateDateWindow ?? null,
      institution: input.institution ?? null,
      department: input.department ?? null,
      healthFund: input.healthFund ?? null,
      codeNumber: input.codeNumber ?? null,
      codeName: input.codeName ?? null,
      issuingBody: input.issuingBody ?? null,
      purpose: input.purpose ?? null,
      ownerUsername,
    });
    return this.mapRow(this.getTask.get(result.lastInsertRowid));
  }

  get(id: number): Task | undefined {
    const row = this.getTask.get(id);
    return row ? this.mapRow(row) : undefined;
  }

  list(filter?: { doctorId?: number; status?: TaskStatus }): Task[] {
    let rows = this.listTasks.all();
    if (filter?.doctorId !== undefined) {
      rows = rows.filter((r: any) => r.doctorId === filter.doctorId);
    }
    if (filter?.status !== undefined) {
      rows = rows.filter((r: any) => r.status === filter.status);
    }
    return rows.map((r: any) => this.mapRow(r));
  }

  update(id: number, input: TaskInput): Task {
    this.getOrThrow(id);
    this.validate(input);
    this.updateTask.run({
      id,
      type: input.type,
      title: input.title.trim(),
      status: input.status ?? "open",
      dueDate: input.dueDate ?? null,
      doctorId: input.doctorId ?? null,
      sourceAppointmentId: input.sourceAppointmentId ?? null,
      pendingAppointmentId: input.pendingAppointmentId ?? null,
      requiresAdvanceScheduling: input.requiresAdvanceScheduling ? 1 : 0,
      recurrenceWindow: input.recurrenceWindow ?? null,
      approximateDateWindow: input.approximateDateWindow ?? null,
      institution: input.institution ?? null,
      department: input.department ?? null,
      healthFund: input.healthFund ?? null,
      codeNumber: input.codeNumber ?? null,
      codeName: input.codeName ?? null,
      issuingBody: input.issuingBody ?? null,
      purpose: input.purpose ?? null,
    });
    return this.getOrThrow(id);
  }

  setStatus(id: number, status: TaskStatus): Task {
    this.getOrThrow(id);
    if (!VALID_STATUSES.has(status)) {
      throw new InvalidTaskInputError(`Invalid status: ${status}`);
    }
    this.updateStatusStmt.run({ id, status });
    return this.getOrThrow(id);
  }

  setPendingAppointment(id: number, pendingAppointmentId: number | null): Task {
    this.getOrThrow(id);
    this.setPendingAppointmentStmt.run({ id, pendingAppointmentId });
    return this.getOrThrow(id);
  }

  resolveWithAppointment(id: number, appointment: { id: number; dateTime: string } | null): Task {
    const task = this.getOrThrow(id);
    if (!appointment) {
      this.setPendingAppointmentStmt.run({ id, pendingAppointmentId: null });
      return this.getOrThrow(id);
    }
    const apptDate = appointment.dateTime.slice(0, 10);
    const newStatus: TaskStatus =
      task.type === "doctor_visit" ? "done" : task.status === "open" ? "in-progress" : task.status;
    return this.update(id, {
      ...task,
      pendingAppointmentId: appointment.id,
      dueDate: apptDate,
      status: newStatus,
    });
  }

  private getOrThrow(id: number): Task {
    const task = this.get(id);
    if (!task) throw new TaskNotFoundError(id);
    return task;
  }

  private validate(input: TaskInput): void {
    if (!input.title?.trim()) {
      throw new InvalidTaskInputError("title is required");
    }
    if (!input.type || !VALID_TYPES.has(input.type)) {
      throw new InvalidTaskInputError(`Invalid task type: ${input.type}`);
    }
    if (input.status && !VALID_STATUSES.has(input.status)) {
      throw new InvalidTaskInputError(`Invalid task status: ${input.status}`);
    }
    if (input.type === "doctor_visit" && !input.doctorId) {
      throw new InvalidTaskInputError("doctorId is required for doctor_visit tasks");
    }
  }

  private mapRow(row: any): Task {
    return {
      ...row,
      requiresAdvanceScheduling: Boolean(row.requiresAdvanceScheduling),
    };
  }
}
