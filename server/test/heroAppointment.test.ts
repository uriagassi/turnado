import { describe, it, expect } from "vitest";
import { selectHeroAppointment, selectUpcomingAppointments } from "../src/appointments/heroAppointment.js";
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

describe("selectHeroAppointment", () => {
  it("picks the soonest planned appointment that's still in the future", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const soonest = appt({ id: 1, dateTime: "2026-09-01T10:00:00Z" });
    const later = appt({ id: 2, dateTime: "2026-09-15T10:00:00Z" });

    const hero = selectHeroAppointment([later, soonest], now);

    expect(hero?.id).toBe(1);
  });

  it("skips a soonest-by-date appointment that isn't planned", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const cancelledSoonest = appt({ id: 1, dateTime: "2026-09-01T10:00:00Z", status: "cancelled" });
    const plannedLater = appt({ id: 2, dateTime: "2026-09-15T10:00:00Z", status: "planned" });

    const hero = selectHeroAppointment([cancelledSoonest, plannedLater], now);

    expect(hero?.id).toBe(2);
  });

  it("ignores planned appointments already in the past", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const past = appt({ id: 1, dateTime: "2026-08-01T10:00:00Z" });

    const hero = selectHeroAppointment([past], now);

    expect(hero).toBeNull();
  });

  it("returns null when there are no appointments at all", () => {
    const hero = selectHeroAppointment([], new Date("2026-08-15T00:00:00Z"));

    expect(hero).toBeNull();
  });
});

describe("selectUpcomingAppointments", () => {
  it("returns planned future appointments, soonest first", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const later = appt({ id: 1, dateTime: "2026-09-15T10:00:00Z" });
    const soonest = appt({ id: 2, dateTime: "2026-09-01T10:00:00Z" });

    const upcoming = selectUpcomingAppointments([later, soonest], now);

    expect(upcoming.map((a) => a.id)).toEqual([2, 1]);
  });

  it("excludes appointments that aren't planned", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const cancelled = appt({ id: 1, dateTime: "2026-09-01T10:00:00Z", status: "cancelled" });

    expect(selectUpcomingAppointments([cancelled], now)).toEqual([]);
  });

  it("excludes appointments already in the past", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const past = appt({ id: 1, dateTime: "2026-08-01T10:00:00Z" });

    expect(selectUpcomingAppointments([past], now)).toEqual([]);
  });
});
