import { describe, it, expect, vi } from "vitest";
import { screenTitle, screenBack, type AppState, type Session } from "./App";
import type { Doctor, MedicalDocument, Task } from "./api";
import type { DocumentFilters } from "./screens/DocumentsScreen";

// screenTitle/screenBack are App.tsx's own navigation logic — the part of
// issue #27 the AC's own test line names directly ("the title bar reflects
// the current screen") but which App.tsx's usual "orchestration isn't
// tested" convention had left uncovered. Unit-testing these two pure(ish)
// functions directly, rather than mounting the whole App, keeps that
// convention intact for everything else in App.tsx while still covering
// the one piece the AC calls out.
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchDocuments: vi.fn(async () => [] as MedicalDocument[]),
    fetchTasks: vi.fn(async () => [] as Task[]),
  };
});

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
    id: 1,
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
    ...overrides,
  };
}

function medicalDocument(overrides: Partial<MedicalDocument> = {}): MedicalDocument {
  return {
    id: 1,
    notebookId: 1,
    title: "MRI Scan",
    type: "test result",
    documentDate: "2026-08-01",
    doctorId: null,
    notes: null,
    file: { fileName: "f.pdf", uniqueFilename: "u.pdf", mime: "application/pdf", hash: "h", size: 100 },
    appointmentIds: [],
    taskIds: [],
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    ...overrides,
  };
}

const emptyFilters: DocumentFilters = { query: "", type: "", doctorId: "", dateFrom: "", dateTo: "" };
const t = (key: string) => key; // identity translator — screenTitle only needs to see which key it picked

describe("screenTitle", () => {
  it("shows each top-level destination's own title", () => {
    const s = session();
    expect(screenTitle({ phase: "home", session: s }, t)).toBe("home.title");
    expect(screenTitle({ phase: "doctors", session: s, doctors: [] }, t)).toBe("doctors.title");
    expect(screenTitle({ phase: "documents", session: s, documents: [], filters: emptyFilters, allTasks: [] }, t)).toBe(
      "documentsScreen.title",
    );
    expect(screenTitle({ phase: "appointment-upcoming", session: s }, t)).toBe("upcomingAppointments.title");
    expect(screenTitle({ phase: "appointment-history", session: s }, t)).toBe("appointmentHistory.title");
  });

  it("shows the doctor's own name on doctor-detail, not a generic title", () => {
    const d = doctor({ name: "Dr. Dan Cohen" });
    const title = screenTitle({ phase: "doctor-detail", session: session(), doctors: [d], doctor: d }, t);

    expect(title).toBe("Dr. Dan Cohen");
  });

  it("shows the task's own title on task-detail", () => {
    const state: AppState = { phase: "task-detail", session: session(), task: task({ title: "Obtain Form 17" }), returnTo: "home" };

    expect(screenTitle(state, t)).toBe("Obtain Form 17");
  });

  it("shows the document's own title on document-detail", () => {
    const state: AppState = {
      phase: "document-detail",
      session: session(),
      document: medicalDocument({ title: "Blood panel" }),
      returnTo: "home",
    };

    expect(screenTitle(state, t)).toBe("Blood panel");
  });
});

describe("screenBack", () => {
  it("has no back control on any top-level screen", () => {
    const s = session();
    expect(screenBack({ phase: "home", session: s }, vi.fn())).toBeUndefined();
    expect(screenBack({ phase: "doctors", session: s, doctors: [] }, vi.fn())).toBeUndefined();
    expect(screenBack({ phase: "appointment-upcoming", session: s }, vi.fn())).toBeUndefined();
    expect(screenBack({ phase: "appointment-history", session: s }, vi.fn())).toBeUndefined();
  });

  it("has no back control on a form screen — Cancel is its own action, not back-navigation", () => {
    const state: AppState = { phase: "doctor-form", session: session(), doctors: [] };

    expect(screenBack(state, vi.fn())).toBeUndefined();
  });

  it("sends doctor-detail back to the doctors list (the static fallback for a freshly-created/edited doctor)", () => {
    const setState = vi.fn();
    const s = session();
    const d = doctor();
    const state: AppState = { phase: "doctor-detail", session: s, doctors: [d], doctor: d };

    screenBack(state, setState)?.();

    expect(setState).toHaveBeenCalledWith({ phase: "doctors", session: s, doctors: [d] });
  });

  it("sends task-detail back to the doctor it was opened from, when returnTo says so", () => {
    const setState = vi.fn();
    const s = session();
    const d = doctor();
    const state: AppState = { phase: "task-detail", session: s, task: task(), returnTo: "doctor-detail", doctor: d };

    screenBack(state, setState)?.();

    expect(setState).toHaveBeenCalledWith({ phase: "doctor-detail", session: s, doctors: s.doctors, doctor: d });
  });

  it("sends task-detail back to home when returnTo is home", () => {
    const setState = vi.fn();
    const s = session();
    const state: AppState = { phase: "task-detail", session: s, task: task(), returnTo: "home" };

    screenBack(state, setState)?.();

    expect(setState).toHaveBeenCalledWith({ phase: "home", session: s });
  });

  it("sends document-detail back to the doctor it was opened from, when returnTo says so", () => {
    const setState = vi.fn();
    const s = session();
    const d = doctor();
    const state: AppState = {
      phase: "document-detail",
      session: s,
      document: medicalDocument(),
      returnTo: "doctor-detail",
      doctor: d,
    };

    screenBack(state, setState)?.();

    expect(setState).toHaveBeenCalledWith({ phase: "doctor-detail", session: s, doctors: s.doctors, doctor: d });
  });

  it("sends document-detail back to home when returnTo is home", () => {
    const setState = vi.fn();
    const s = session();
    const state: AppState = { phase: "document-detail", session: s, document: medicalDocument(), returnTo: "home" };

    screenBack(state, setState)?.();

    expect(setState).toHaveBeenCalledWith({ phase: "home", session: s });
  });

  it("sends document-detail back to the documents list, refetched with its remembered filters, when returnTo is documents", async () => {
    const setState = vi.fn();
    const s = session();
    const filters: DocumentFilters = { ...emptyFilters, query: "blood" };
    const state: AppState = {
      phase: "document-detail",
      session: s,
      document: medicalDocument(),
      returnTo: "documents",
      documentsFilters: filters,
    };

    await screenBack(state, setState)?.();

    expect(setState).toHaveBeenCalledWith({ phase: "documents", session: s, documents: [], filters, allTasks: [] });
  });
});
