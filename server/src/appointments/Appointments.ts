import type { Database, Statement } from "better-sqlite3";
import { ensureColumn } from "../db.js";

export type AppointmentStatus = "planned" | "done" | "cancelled" | "postponed";

export interface AppointmentInput {
  doctorId?: number | null;
  dateTime: string;
  location?: string;
  notes: string;
}

export interface Appointment extends AppointmentInput {
  id: number;
  doctorId: number | null;
  status: AppointmentStatus;
  /** Free-text post-visit summary — null until one's been added via setSummary, deliberately separate from AppointmentInput since it only makes sense once the appointment's happened. */
  summary: string | null;
  /**
   * The allow-listed username this appointment belongs to (issue #10:
   * reminders go to the item's owner, not every allow-listed user) — set
   * once at creation from the authenticated caller, not part of
   * AppointmentInput since the client never chooses it directly. Null for
   * appointments created before this field existed, or via any path that
   * doesn't pass an owner; ReminderService treats a null owner as "no
   * reminder due" rather than guessing a recipient. Immutable after
   * creation: update() never touches this column.
   */
  ownerUsername: string | null;
}

export class AppointmentNotFoundError extends Error {
  constructor(id: number) {
    super(`Appointment ${id} not found`);
    this.name = "AppointmentNotFoundError";
  }
}

export class InvalidAppointmentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAppointmentInputError";
  }
}

/**
 * The household's appointment log. Owns the `Appointments` table outright,
 * in the same physical DB file as the sibling document-archive app's own
 * tables (see Doctors.ts for the equivalent reasoning).
 *
 * doctorId is a plain nullable column, not a `REFERENCES Doctors(id)` FK:
 * SQLite requires a referenced table to exist even just to prepare a
 * statement against the child, which would force this class to depend on
 * Doctors' table existing — an unwanted coupling for a doctor-less
 * appointment (see the AC: an appointment can be created with no doctor).
 */
export class Appointments {
  private readonly insertAppointment: Statement;
  private readonly getAppointment: Statement;
  private readonly listAppointments: Statement;
  private readonly updateAppointment: Statement;
  private readonly updateStatusStmt: Statement;
  private readonly updateSummaryStmt: Statement;

  constructor(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS Appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctorId INTEGER,
        dateTime TEXT NOT NULL,
        location TEXT,
        notes TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned',
        summary TEXT
      )
    `);
    // First column added to an already-shipped table (issue #10) — see
    // ensureColumn's own doc for why this needs a guard at all.
    ensureColumn(db, "Appointments", "ownerUsername", "TEXT");

    this.insertAppointment = db.prepare(
      `INSERT INTO Appointments (doctorId, dateTime, location, notes, ownerUsername)
       VALUES ($doctorId, $dateTime, $location, $notes, $ownerUsername)`,
    );
    this.getAppointment = db.prepare(`SELECT * FROM Appointments WHERE id = ?`);
    this.listAppointments = db.prepare(`SELECT * FROM Appointments ORDER BY dateTime`);
    this.updateAppointment = db.prepare(
      `UPDATE Appointments
       SET doctorId = $doctorId, dateTime = $dateTime, location = $location, notes = $notes
       WHERE id = $id`,
    );
    this.updateStatusStmt = db.prepare(`UPDATE Appointments SET status = $status WHERE id = $id`);
    this.updateSummaryStmt = db.prepare(`UPDATE Appointments SET summary = $summary WHERE id = $id`);
  }

  /**
   * `ownerUsername` is a separate param, not part of AppointmentInput —
   * it's resolved server-side from the authenticated caller (issue #10),
   * never something the client body should be trusted to set directly.
   */
  create(input: AppointmentInput, ownerUsername: string | null = null): Appointment {
    this.validate(input);
    const result = this.insertAppointment.run({
      doctorId: input.doctorId ?? null,
      dateTime: input.dateTime,
      location: input.location ?? null,
      notes: input.notes,
      ownerUsername,
    });
    return this.getAppointment.get(result.lastInsertRowid) as Appointment;
  }

  get(id: number): Appointment | undefined {
    return this.getAppointment.get(id) as Appointment | undefined;
  }

  list(): Appointment[] {
    return this.listAppointments.all() as Appointment[];
  }

  update(id: number, input: AppointmentInput): Appointment {
    this.getOrThrow(id);
    this.validate(input);
    this.updateAppointment.run({
      id,
      doctorId: input.doctorId ?? null,
      dateTime: input.dateTime,
      location: input.location ?? null,
      notes: input.notes,
    });
    return this.getAppointment.get(id) as Appointment;
  }

  setStatus(id: number, status: AppointmentStatus): Appointment {
    this.getOrThrow(id);
    this.updateStatusStmt.run({ id, status });
    return this.getAppointment.get(id) as Appointment;
  }

  setSummary(id: number, summary: string): Appointment {
    this.getOrThrow(id);
    this.updateSummaryStmt.run({ id, summary });
    return this.getAppointment.get(id) as Appointment;
  }

  private getOrThrow(id: number): Appointment {
    const existing = this.getAppointment.get(id) as Appointment | undefined;
    if (!existing) throw new AppointmentNotFoundError(id);
    return existing;
  }

  private validate(input: AppointmentInput): void {
    if (!input.notes?.trim()) throw new InvalidAppointmentInputError("notes is required");
    if (!input.dateTime?.trim()) throw new InvalidAppointmentInputError("dateTime is required");
  }
}
