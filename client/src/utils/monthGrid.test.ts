import { describe, it, expect } from "vitest";
import { buildMonthGrid } from "./monthGrid";
import type { Appointment } from "../api";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: 1,
    doctorId: null,
    dateTime: "2026-09-01T10:00:00Z",
    location: undefined,
    notes: "",
    status: "planned",
    summary: null,
    missedReminder: null,
    ...overrides,
  };
}

describe("buildMonthGrid", () => {
  // September 2026 (month 8): Sept 1 is a Tuesday, Sept 30 a Wednesday — so
  // the grid pads with Aug 30-31 up front and Oct 1-3 at the end to fill
  // out full weeks, a fixed real-calendar case to pin the padding math to.
  it("pads the grid with leading/trailing days so every week is complete", () => {
    const grid = buildMonthGrid(2026, 8, []);

    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toMatchObject({ year: 2026, month: 7, day: 30, dateKey: "2026-08-30", inMonth: false });
    expect(grid[1]).toMatchObject({ year: 2026, month: 7, day: 31, dateKey: "2026-08-31", inMonth: false });
    expect(grid[2]).toMatchObject({ year: 2026, month: 8, day: 1, dateKey: "2026-09-01", inMonth: true });
    expect(grid[grid.length - 1]).toMatchObject({ year: 2026, month: 9, day: 3, dateKey: "2026-10-03", inMonth: false });
    expect(grid[grid.length - 4]).toMatchObject({ year: 2026, month: 8, day: 30, dateKey: "2026-09-30", inMonth: true });
  });

  it("places an appointment on its correct in-month day", () => {
    const appointment = appt({ dateTime: "2026-09-15T08:00:00Z" });
    const grid = buildMonthGrid(2026, 8, [appointment], "UTC");

    const cell = grid.find((c) => c.dateKey === "2026-09-15");
    expect(cell?.appointments).toEqual([appointment]);
    expect(cell?.inMonth).toBe(true);
  });

  it("places an appointment landing on a leading padding day from the previous month", () => {
    const appointment = appt({ dateTime: "2026-08-31T08:00:00Z" });
    const grid = buildMonthGrid(2026, 8, [appointment], "UTC");

    const cell = grid.find((c) => c.dateKey === "2026-08-31");
    expect(cell?.appointments).toEqual([appointment]);
    expect(cell?.inMonth).toBe(false);
  });

  it("places an appointment landing on a trailing padding day from the next month", () => {
    const appointment = appt({ dateTime: "2026-10-02T08:00:00Z" });
    const grid = buildMonthGrid(2026, 8, [appointment], "UTC");

    const cell = grid.find((c) => c.dateKey === "2026-10-02");
    expect(cell?.appointments).toEqual([appointment]);
    expect(cell?.inMonth).toBe(false);
  });

  it("wraps a December grid's trailing padding into January of the next year", () => {
    const appointment = appt({ dateTime: "2027-01-01T08:00:00Z" });
    const grid = buildMonthGrid(2026, 11, [appointment], "UTC");

    const cell = grid.find((c) => c.dateKey === "2027-01-01");
    expect(cell).toBeDefined();
    expect(cell?.inMonth).toBe(false);
    expect(cell?.appointments).toEqual([appointment]);
  });

  it("wraps a January grid's leading padding into December of the previous year", () => {
    const appointment = appt({ dateTime: "2026-12-31T08:00:00Z" });
    const grid = buildMonthGrid(2027, 0, [appointment], "UTC");

    const cell = grid.find((c) => c.dateKey === "2026-12-31");
    expect(cell).toBeDefined();
    expect(cell?.inMonth).toBe(false);
    expect(cell?.appointments).toEqual([appointment]);
  });

  it("keeps a day's appointments in chronological order regardless of input order", () => {
    const later = appt({ id: 1, dateTime: "2026-09-15T18:00:00Z" });
    const earlier = appt({ id: 2, dateTime: "2026-09-15T08:00:00Z" });
    const grid = buildMonthGrid(2026, 8, [later, earlier], "UTC");

    const cell = grid.find((c) => c.dateKey === "2026-09-15");
    expect(cell?.appointments).toEqual([earlier, later]);
  });

  it("leaves a day with no appointments empty", () => {
    const grid = buildMonthGrid(2026, 8, [], "UTC");

    const cell = grid.find((c) => c.dateKey === "2026-09-10");
    expect(cell?.appointments).toEqual([]);
  });
});
