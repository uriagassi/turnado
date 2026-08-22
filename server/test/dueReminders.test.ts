import { describe, it, expect } from "vitest";
import { selectDueReminders } from "../src/reminders/dueReminders.js";
import type { Appointment } from "../src/appointments/Appointments.js";
import type { Task } from "../src/tasks/Tasks.js";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: 1,
    doctorId: null,
    dateTime: "2026-08-23T10:00:00Z",
    location: undefined,
    notes: "notes",
    status: "planned",
    summary: null,
    ...overrides,
  };
}

function task(overrides: Partial<Task>): Task {
  return {
    id: 1,
    type: "form_17",
    title: "Form 17 for Dr. Cohen",
    status: "open",
    dueDate: "2026-08-23",
    doctorId: null,
    sourceAppointmentId: null,
    pendingAppointmentId: null,
    requiresAdvanceScheduling: false,
    recurrenceWindow: null,
    approximateDateWindow: null,
    institution: null,
    department: null,
    healthFund: null,
    codeNumber: null,
    codeName: null,
    issuingBody: null,
    purpose: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("selectDueReminders", () => {
  it("includes a planned appointment whose date is exactly one day ahead", () => {
    const now = new Date("2026-08-22T09:00:00Z");
    const tomorrow = appt({ id: 1, dateTime: "2026-08-23T10:00:00Z" });

    const due = selectDueReminders([tomorrow], [], now, "UTC");

    expect(due).toEqual([{ itemType: "appointment", itemId: 1, targetDate: "2026-08-23" }]);
  });

  it("excludes a planned appointment that isn't exactly one day out", () => {
    const now = new Date("2026-08-22T09:00:00Z");
    const today = appt({ id: 1, dateTime: "2026-08-22T10:00:00Z" });
    const twoDaysOut = appt({ id: 2, dateTime: "2026-08-24T10:00:00Z" });

    expect(selectDueReminders([today, twoDaysOut], [], now, "UTC")).toEqual([]);
  });

  it("excludes a one-day-out appointment that isn't planned", () => {
    const now = new Date("2026-08-22T09:00:00Z");
    const cancelled = appt({ id: 1, dateTime: "2026-08-23T10:00:00Z", status: "cancelled" });

    expect(selectDueReminders([cancelled], [], now, "UTC")).toEqual([]);
  });

  it("includes an open task whose due date is exactly one day ahead", () => {
    const now = new Date("2026-08-22T09:00:00Z");
    const dueTomorrow = task({ id: 5, status: "open", dueDate: "2026-08-23" });

    const due = selectDueReminders([], [dueTomorrow], now, "UTC");

    expect(due).toEqual([{ itemType: "task", itemId: 5, targetDate: "2026-08-23" }]);
  });

  it("never includes a task with no due date, regardless of status", () => {
    const now = new Date("2026-08-22T09:00:00Z");
    const flexible = task({ id: 5, status: "open", dueDate: null });

    expect(selectDueReminders([], [flexible], now, "UTC")).toEqual([]);
  });

  it("includes an in-progress task due tomorrow but excludes a done one", () => {
    const now = new Date("2026-08-22T09:00:00Z");
    const inProgress = task({ id: 5, status: "in-progress", dueDate: "2026-08-23" });
    const done = task({ id: 6, status: "done", dueDate: "2026-08-23" });

    const due = selectDueReminders([], [inProgress, done], now, "UTC");

    expect(due).toEqual([{ itemType: "task", itemId: 5, targetDate: "2026-08-23" }]);
  });

  it("computes today/tomorrow in the given timezone, not UTC", () => {
    // 2026-08-22T22:00:00Z is already 2026-08-23 01:00 in Asia/Jerusalem
    // (UTC+3 in August) — so "tomorrow" there is 2026-08-24, not the
    // UTC-calendar 2026-08-23 that naive toISOString() date math would give.
    const now = new Date("2026-08-22T22:00:00Z");
    // 2026-08-24T20:00:00Z is 2026-08-24 23:00 in Asia/Jerusalem: that
    // zone's calendar date is still 2026-08-24, one day past IL's "today".
    const dueTomorrowInIsrael = appt({ id: 1, dateTime: "2026-08-24T20:00:00Z" });
    const dueTomorrowTask = task({ id: 7, status: "open", dueDate: "2026-08-24" });

    const due = selectDueReminders([dueTomorrowInIsrael], [dueTomorrowTask], now, "Asia/Jerusalem");

    expect(due).toEqual([
      { itemType: "appointment", itemId: 1, targetDate: "2026-08-24" },
      { itemType: "task", itemId: 7, targetDate: "2026-08-24" },
    ]);
  });
});
