import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyTaskFormSave, type Session } from "./App";
import type { Doctor, HomeData, MedicalDocument, Task } from "./api";
import type { TaskDocumentChanges } from "./screens/TaskFormScreen";
import * as api from "./api";

// applyTaskFormSave is the task-form submit flow's own orchestration —
// pulled out of the render switch specifically so the "stay on the same
// form to retry on partial failure" behavior (added after a code review
// found the earlier version navigated away regardless of failure) has a
// direct regression test, rather than only being provable by mounting the
// whole App. See App.navigation.test.ts's own note on why screenTitle/
// screenBack get this same treatment while the rest of App.tsx doesn't.
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    attachTaskDocument: vi.fn(),
    detachTaskDocument: vi.fn(),
    uploadDocument: vi.fn(),
    fetchHome: vi.fn(),
    fetchDocuments: vi.fn(),
  };
});

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

function session(overrides: Partial<Session> = {}): Session {
  return {
    user: { userId: "1", userName: "uri", locale: "en" },
    home: { nextAppointment: null, openItems: [], recentDocuments: [] },
    doctors: [],
    appointments: [],
    ...overrides,
  };
}

function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return { id: 1, name: "Dr. Jane Smith", notes: "", photoPath: null, ...overrides };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 5,
    type: "test",
    title: "Blood test",
    status: "open",
    doctorId: null,
    dueDate: null,
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
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    missedReminder: null,
    ...overrides,
  };
}

function doc(overrides: Partial<MedicalDocument> = {}): MedicalDocument {
  return {
    id: 9,
    notebookId: 1,
    title: "Cardiology referral",
    type: "referral",
    documentDate: null,
    doctorId: null,
    notes: null,
    file: { fileName: "f.pdf", uniqueFilename: "u.pdf", mime: "application/pdf", hash: "h", size: 10 },
    appointmentIds: [],
    taskIds: [5],
    createdAt: "2026-08-10",
    updatedAt: "2026-08-10",
    ...overrides,
  };
}

const noChanges: TaskDocumentChanges = { attachDocumentIds: [], detachDocumentIds: [], uploads: [] };

const home: HomeData = { nextAppointment: null, openItems: [], recentDocuments: [] };

describe("applyTaskFormSave", () => {
  beforeEach(() => {
    vi.mocked(api.fetchHome).mockResolvedValue(home);
    vi.mocked(api.fetchDocuments).mockResolvedValue([]);
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("navigates to home on a clean save with no document changes", async () => {
    const s = session();
    const saved = task();

    const next = await applyTaskFormSave(s, saved, noChanges, "home", undefined, t);

    expect(next).toEqual({ phase: "home", session: { ...s, home, taskDocuments: { [saved.id]: [] } } });
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("navigates to task-detail on a clean save when returnTo is task-detail", async () => {
    const s = session();
    const saved = task();
    const d = doctor();

    const next = await applyTaskFormSave(s, saved, noChanges, "task-detail", d, t);

    expect(next).toEqual({
      phase: "task-detail",
      session: { ...s, home, taskDocuments: { [saved.id]: [] } },
      task: saved,
      returnTo: "doctor-detail",
      doctor: d,
    });
  });

  it("attaches, detaches, and uploads exactly what was staged when every call succeeds", async () => {
    const saved = task();
    const changes: TaskDocumentChanges = {
      attachDocumentIds: [1, 2],
      detachDocumentIds: [3],
      uploads: [{ file: new File(["x"], "letter.pdf"), title: "letter", type: "referral" }],
    };
    vi.mocked(api.attachTaskDocument).mockResolvedValue(doc());
    vi.mocked(api.detachTaskDocument).mockResolvedValue(doc());
    vi.mocked(api.uploadDocument).mockResolvedValue(doc());

    await applyTaskFormSave(session(), saved, changes, "home", undefined, t);

    expect(api.attachTaskDocument).toHaveBeenCalledWith(saved.id, 1);
    expect(api.attachTaskDocument).toHaveBeenCalledWith(saved.id, 2);
    expect(api.detachTaskDocument).toHaveBeenCalledWith(saved.id, 3);
    expect(api.uploadDocument).toHaveBeenCalledOnce();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("stays on the task form, in edit mode, when a document change fails — instead of navigating away regardless of failure", async () => {
    const s = session();
    const saved = task({ id: 5 });
    const changes: TaskDocumentChanges = { attachDocumentIds: [1], detachDocumentIds: [], uploads: [] };
    vi.mocked(api.attachTaskDocument).mockRejectedValue(new Error("simulated failure"));
    const taskDocsAfterFailure = [doc({ id: 9 })];
    const freshAllDocuments = [doc({ id: 9 }), doc({ id: 10, title: "Blood test - March" })];
    vi.mocked(api.fetchDocuments).mockImplementation(async (filter) =>
      filter?.taskId === saved.id ? taskDocsAfterFailure : freshAllDocuments,
    );

    const next = await applyTaskFormSave(s, saved, changes, "task-detail", doctor(), t);

    // Stays on task-form (never reaches task-detail/home) even though returnTo was "task-detail".
    expect(next.phase).toBe("task-form");
    if (next.phase !== "task-form") throw new Error("unreachable");
    expect(next.task).toEqual(saved);
    expect(next.returnTo).toBe("task-detail");
    expect(next.focusDocuments).toBe(true);
    // Reflects what actually persisted (the failed attach never linked), not stale staged state.
    expect(next.documents).toEqual(taskDocsAfterFailure);
    expect(next.allDocuments).toEqual(freshAllDocuments);
  });

  it("surfaces the failure count to the user", async () => {
    const changes: TaskDocumentChanges = { attachDocumentIds: [1], detachDocumentIds: [2], uploads: [] };
    vi.mocked(api.attachTaskDocument).mockRejectedValue(new Error("fail 1"));
    vi.mocked(api.detachTaskDocument).mockRejectedValue(new Error("fail 2"));

    await applyTaskFormSave(session(), task(), changes, "home", undefined, t);

    expect(window.alert).toHaveBeenCalledWith('taskForm.documents.saveError {"count":2}');
  });

  it("keeps the task and whatever succeeded rather than rolling anything back on partial failure", async () => {
    const saved = task();
    const changes: TaskDocumentChanges = { attachDocumentIds: [1, 2], detachDocumentIds: [], uploads: [] };
    vi.mocked(api.attachTaskDocument).mockImplementation(async (_taskId, documentId) =>
      documentId === 1 ? Promise.reject(new Error("fail")) : doc({ id: documentId }),
    );

    const next = await applyTaskFormSave(session(), saved, changes, "home", undefined, t);

    expect(api.attachTaskDocument).toHaveBeenCalledWith(saved.id, 1);
    expect(api.attachTaskDocument).toHaveBeenCalledWith(saved.id, 2);
    expect(next.phase).toBe("task-form");
    expect(window.alert).toHaveBeenCalledWith('taskForm.documents.saveError {"count":1}');
  });
});
