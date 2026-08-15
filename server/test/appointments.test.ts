import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createDb } from "../src/db.js";
import { Appointments, AppointmentNotFoundError, InvalidAppointmentInputError } from "../src/appointments/Appointments.js";

/**
 * `expect(fn).toThrow(SomeClass)` passes vacuously (matches *any* thrown
 * error) if `SomeClass` isn't actually the constructor it looks like —
 * this captures the real thrown value so `toBeInstanceOf` checks it for real.
 */
function catchError(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe("Appointments", () => {
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

  function tmpAppointments() {
    return new Appointments(tmpDb());
  }

  describe("create", () => {
    it("creates an appointment with no doctor attached, defaulting to planned status", () => {
      const appointments = tmpAppointments();

      const created = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      expect(created.id).toEqual(expect.any(Number));
      expect(created.doctorId).toBeNull();
      expect(created.status).toBe("planned");
      expect(created.notes).toBe("Annual checkup");
      expect(created.dateTime).toBe("2026-09-01T10:00:00Z");
    });
  });

  describe("list", () => {
    it("returns every created appointment", () => {
      const appointments = tmpAppointments();
      const checkup = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });
      const imaging = appointments.create({ notes: "MRI scan", dateTime: "2026-09-15T14:30:00Z" });

      const all = appointments.list();

      expect(all).toHaveLength(2);
      expect(all.map((a) => a.id).sort()).toEqual([checkup.id, imaging.id].sort());
    });

    it("returns an empty list when no appointments exist yet", () => {
      const appointments = tmpAppointments();

      expect(appointments.list()).toEqual([]);
    });
  });

  describe("update", () => {
    it("overwrites the appointment's fields and keeps its id", () => {
      const appointments = tmpAppointments();
      const created = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const updated = appointments.update(created.id, {
        notes: "Annual checkup, rescheduled",
        dateTime: "2026-09-08T10:00:00Z",
        location: "Clinic B",
      });

      expect(updated).toMatchObject({
        id: created.id,
        notes: "Annual checkup, rescheduled",
        dateTime: "2026-09-08T10:00:00Z",
        location: "Clinic B",
      });
      expect(appointments.list()).toHaveLength(1);
    });

    it("throws AppointmentNotFoundError for an id that doesn't exist, instead of crashing", () => {
      const appointments = tmpAppointments();

      const thrown = catchError(() => appointments.update(999, { notes: "n/a", dateTime: "2026-09-01T10:00:00Z" }));

      expect(thrown).toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe("validation", () => {
    it("create rejects a missing notes field", () => {
      const appointments = tmpAppointments();

      const thrown = catchError(() => appointments.create({ notes: "", dateTime: "2026-09-01T10:00:00Z" }));

      expect(thrown).toBeInstanceOf(InvalidAppointmentInputError);
    });

    it("update rejects a missing notes field the same way", () => {
      const appointments = tmpAppointments();
      const created = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const thrown = catchError(() => appointments.update(created.id, { notes: "", dateTime: "2026-09-01T10:00:00Z" }));

      expect(thrown).toBeInstanceOf(InvalidAppointmentInputError);
    });

    it("create rejects a missing dateTime field", () => {
      const appointments = tmpAppointments();

      const thrown = catchError(() => appointments.create({ notes: "Annual checkup", dateTime: "" }));

      expect(thrown).toBeInstanceOf(InvalidAppointmentInputError);
    });

    it("update rejects a missing dateTime field the same way", () => {
      const appointments = tmpAppointments();
      const created = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const thrown = catchError(() => appointments.update(created.id, { notes: "Annual checkup", dateTime: "" }));

      expect(thrown).toBeInstanceOf(InvalidAppointmentInputError);
    });
  });

  describe("setStatus", () => {
    it("updates the appointment's status to done", () => {
      const appointments = tmpAppointments();
      const created = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const updated = appointments.setStatus(created.id, "done");

      expect(updated.status).toBe("done");
    });

    it("keeps postponed distinct from cancelled instead of conflating them", () => {
      const appointments = tmpAppointments();
      const created = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });

      const postponed = appointments.setStatus(created.id, "postponed");

      expect(postponed.status).toBe("postponed");
      expect(postponed.status).not.toBe("cancelled");
    });

    it("throws AppointmentNotFoundError for an id that doesn't exist, instead of crashing", () => {
      const appointments = tmpAppointments();

      const thrown = catchError(() => appointments.setStatus(999, "done"));

      expect(thrown).toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe("setSummary", () => {
    it("sets the appointment's post-visit summary and returns the updated appointment", () => {
      const appointments = tmpAppointments();
      const created = appointments.create({ notes: "Annual checkup", dateTime: "2026-09-01T10:00:00Z" });
      expect(created.summary).toBeNull();

      const updated = appointments.setSummary(created.id, "Bloodwork normal, follow up in 6 months");

      expect(updated.summary).toBe("Bloodwork normal, follow up in 6 months");
    });

    it("throws AppointmentNotFoundError for an id that doesn't exist, instead of crashing", () => {
      const appointments = tmpAppointments();

      const thrown = catchError(() => appointments.setSummary(999, "n/a"));

      expect(thrown).toBeInstanceOf(AppointmentNotFoundError);
    });
  });
});
