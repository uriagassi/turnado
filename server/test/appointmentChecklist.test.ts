import { describe, it, expect } from "vitest";
import { computeAppointmentChecklist, selectAppointmentTasks } from "../src/appointments/appointmentChecklist.js";
import type { Document } from "../src/documents/Documents.js";
import type { Task } from "../src/tasks/Tasks.js";

function doc(overrides: Partial<Document>): Document {
  return {
    id: 1,
    notebookId: 0,
    title: "Blood test results",
    type: "test result",
    documentDate: null,
    doctorId: null,
    notes: null,
    file: { fileName: "", uniqueFilename: "", mime: "", hash: "", size: 0 },
    appointmentIds: [],
    taskIds: [],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function task(overrides: Partial<Task>): Task {
  return {
    id: 1,
    type: "form_17",
    title: "Form 17 for Dr. Cohen",
    status: "open",
    dueDate: null,
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

describe("computeAppointmentChecklist", () => {
  it("counts every attached document as ready, and a done task as ready but an open one as not", () => {
    const documents = [doc({ id: 1 }), doc({ id: 2 }), doc({ id: 3 })];
    const tasks = [task({ id: 1, status: "done" }), task({ id: 2, status: "open" })];

    const checklist = computeAppointmentChecklist(documents, tasks);

    expect(checklist.readyCount).toBe(4);
    expect(checklist.totalCount).toBe(5);
  });

  it("reports 0 of 0 ready when nothing is attached or linked", () => {
    const checklist = computeAppointmentChecklist([], []);

    expect(checklist.readyCount).toBe(0);
    expect(checklist.totalCount).toBe(0);
  });
});

describe("selectAppointmentTasks", () => {
  it("includes a task spawned as a prerequisite for this appointment (sourceAppointmentId)", () => {
    const form17 = task({ id: 1, sourceAppointmentId: 42 });
    const unrelated = task({ id: 2, sourceAppointmentId: 99 });

    expect(selectAppointmentTasks([form17, unrelated], 42).map((t) => t.id)).toEqual([1]);
  });

  it("includes a task resolved onto this appointment (pendingAppointmentId)", () => {
    const followUp = task({ id: 1, pendingAppointmentId: 42 });
    const unrelated = task({ id: 2, pendingAppointmentId: 99 });

    expect(selectAppointmentTasks([followUp, unrelated], 42).map((t) => t.id)).toEqual([1]);
  });

  it("includes a task only once even when both fields point at this appointment", () => {
    const both = task({ id: 1, sourceAppointmentId: 42, pendingAppointmentId: 42 });

    expect(selectAppointmentTasks([both], 42).map((t) => t.id)).toEqual([1]);
  });
});
