import { describe, it, expect } from "vitest";
import { selectPastAppointments } from "../src/appointments/appointmentHistory.js";
import type { Appointment } from "../src/appointments/Appointments.js";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: 1,
    doctorId: null,
    dateTime: "2026-09-01T10:00:00Z",
    location: undefined,
    notes: "notes",
    status: "planned",
    summary: null,
    ownerUsername: null,
    ...overrides,
  };
}

describe("selectPastAppointments", () => {
  it("returns appointments whose dateTime has already passed, most recent first", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const older = appt({ id: 1, dateTime: "2026-07-01T10:00:00Z" });
    const newer = appt({ id: 2, dateTime: "2026-08-01T10:00:00Z" });
    const future = appt({ id: 3, dateTime: "2026-09-01T10:00:00Z" });

    const past = selectPastAppointments([older, future, newer], now);

    expect(past.map((a) => a.id)).toEqual([2, 1]);
  });

  it("returns an empty list when nothing is in the past", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const future = appt({ dateTime: "2026-09-01T10:00:00Z" });

    expect(selectPastAppointments([future], now)).toEqual([]);
  });
});
