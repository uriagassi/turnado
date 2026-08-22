import { describe, it, expect } from "vitest";
import { buildReminderEmail } from "../src/reminders/reminderEmail.js";
import type { Appointment } from "../src/appointments/Appointments.js";
import type { Task } from "../src/tasks/Tasks.js";

const TZ = "Asia/Jerusalem";

function appt(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    doctorId: 7,
    dateTime: "2026-08-23T10:00:00Z",
    location: "Clinic A, 2nd floor",
    notes: "Bring insurance card",
    status: "planned",
    summary: null,
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 3,
    type: "form_17",
    title: "Form 17 for MRI",
    status: "open",
    dueDate: "2026-08-23",
    doctorId: 7,
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

describe("buildReminderEmail", () => {
  it("builds an appointment reminder with doctor, date/time, location and notes (en)", () => {
    const { subject, body } = buildReminderEmail(
      { itemType: "appointment", appointment: appt(), doctorName: "Dr. Cohen" },
      "en",
      TZ,
    );

    expect(subject).toBe("Reminder: appointment tomorrow");
    expect(body).toBe(
      [
        "You have an appointment tomorrow:",
        "",
        "Doctor: Dr. Cohen",
        "Date & time: Aug 23, 2026, 1:00 PM",
        "Location: Clinic A, 2nd floor",
        "Notes: Bring insurance card",
      ].join("\n"),
    );
  });

  it("omits the location line when the appointment has none", () => {
    const { body } = buildReminderEmail(
      { itemType: "appointment", appointment: appt({ location: null as unknown as string }), doctorName: "Dr. Cohen" },
      "en",
      TZ,
    );

    expect(body).not.toContain("Location");
    expect(body).not.toContain("null");
  });

  it("falls back to 'No doctor' when the appointment has none", () => {
    const { body } = buildReminderEmail(
      { itemType: "appointment", appointment: appt(), doctorName: null },
      "en",
      TZ,
    );

    expect(body).toContain("Doctor: No doctor");
  });

  it("renders in Hebrew when locale is 'he'", () => {
    const { subject, body } = buildReminderEmail(
      { itemType: "appointment", appointment: appt(), doctorName: "ד\"ר כהן" },
      "he",
      TZ,
    );

    expect(subject).toBe("תזכורת: תור מחר");
    expect(body).toBe(
      [
        "יש לכם תור מחר:",
        "",
        'רופא: ד"ר כהן',
        "תאריך ושעה: 23 באוג׳ 2026, 13:00",
        "מיקום: Clinic A, 2nd floor",
        "הערות: Bring insurance card",
      ].join("\n"),
    );
  });

  it("builds a task reminder with type, description, due date and doctor (en)", () => {
    const { subject, body } = buildReminderEmail(
      { itemType: "task", task: task(), doctorName: "Dr. Cohen" },
      "en",
      TZ,
    );

    expect(subject).toBe("Reminder: Form 17 for MRI due tomorrow");
    expect(body).toBe(
      [
        "This is due tomorrow:",
        "",
        "Type: Form 17",
        "Description: Form 17 for MRI",
        "Due date: Aug 23, 2026",
        "Doctor: Dr. Cohen",
      ].join("\n"),
    );
  });

  it("falls back to 'No doctor' when the task has none", () => {
    const { body } = buildReminderEmail(
      { itemType: "task", task: task({ doctorId: null }), doctorName: null },
      "en",
      TZ,
    );

    expect(body).toContain("Doctor: No doctor");
  });

  it("throws rather than silently defaulting when a task has no due date", () => {
    expect(() =>
      buildReminderEmail(
        { itemType: "task", task: task({ dueDate: null }), doctorName: null },
        "en",
        TZ,
      ),
    ).toThrow(/due date/i);
  });
});
