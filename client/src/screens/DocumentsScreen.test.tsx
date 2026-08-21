import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentsScreen, type DocumentFilters } from "./DocumentsScreen";
import type { Appointment, Doctor, MedicalDocument, Task } from "../api";

function doc(overrides: Partial<MedicalDocument> = {}): MedicalDocument {
  return {
    id: 1,
    notebookId: 42,
    title: "Blood Test Results",
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

function emptyFilters(): DocumentFilters {
  return { query: "", type: "", doctorId: "", dateFrom: "", dateTo: "" };
}

function renderScreen(
  documents: MedicalDocument[],
  options: {
    doctors?: Doctor[];
    appointments?: Appointment[];
    openItems?: Task[];
    filters?: DocumentFilters;
    onFiltersChange?: (filters: DocumentFilters) => void;
    onSelectDocument?: (document: MedicalDocument) => void;
    onBack?: () => void;
  } = {},
) {
  const {
    doctors = [],
    appointments = [],
    openItems = [],
    filters = emptyFilters(),
    onFiltersChange = () => {},
    onSelectDocument = () => {},
    onBack = () => {},
  } = options;
  return render(
    <DocumentsScreen
      documents={documents}
      doctors={doctors}
      appointments={appointments}
      openItems={openItems}
      filters={filters}
      onFiltersChange={onFiltersChange}
      onSelectDocument={onSelectDocument}
      onBack={onBack}
    />,
  );
}

describe("DocumentsScreen", () => {
  it("keeps the filter controls tucked away until the toggle is activated", async () => {
    const user = userEvent.setup();
    renderScreen([doc()]);

    expect(screen.queryByLabelText("Search by title")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByLabelText("Search by title")).toBeInTheDocument();
  });

  it("applies a title search as the field changes, with no separate apply step", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderScreen([doc()], { onFiltersChange });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Search by title"), "x");

    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters(), query: "x" });
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  it("applies a document-type filter as soon as it's picked", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderScreen([doc()], { onFiltersChange });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Document type"), "referral");

    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters(), type: "referral" });
  });

  it("applies a doctor filter as soon as it's picked", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const drJane: Doctor = { id: 7, name: "Dr. Jane Smith", photoPath: null };
    renderScreen([doc()], { onFiltersChange, doctors: [drJane] });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Doctor"), "7");

    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters(), doctorId: 7 });
  });

  it("applies date-range bounds as soon as either date is entered", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const { rerender } = renderScreen([doc()], { onFiltersChange });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-01" } });

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...emptyFilters(), dateFrom: "2026-08-01" });

    // Controlled component: simulate the parent re-rendering with the
    // filters onFiltersChange just handed it, then apply the second edit.
    const afterFrom = onFiltersChange.mock.calls[0][0] as DocumentFilters;
    rerender(
      <DocumentsScreen
        documents={[doc()]}
        doctors={[]}
        filters={afterFrom}
        onFiltersChange={onFiltersChange}
        onSelectDocument={() => {}}
        onBack={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-08-31" } });

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...emptyFilters(), dateFrom: "2026-08-01", dateTo: "2026-08-31" });
  });

  it("shows no filter chips when nothing is active", () => {
    renderScreen([doc()]);
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("shows active filters as removable chips", () => {
    renderScreen([doc()], { filters: { ...emptyFilters(), query: "blood", type: "referral" } });
    expect(screen.getByText("blood")).toBeInTheDocument();
    expect(screen.getByText("Referral")).toBeInTheDocument();
  });

  it("removing one chip clears only that filter, leaving the rest intact", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderScreen([doc()], {
      onFiltersChange,
      filters: { ...emptyFilters(), query: "blood", type: "referral" },
    });

    await user.click(screen.getByRole("button", { name: "Remove query filter" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters(), type: "referral" });
  });

  it("clear-all resets every filter at once", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderScreen([doc()], {
      onFiltersChange,
      filters: { ...emptyFilters(), query: "blood", type: "referral" },
    });

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onFiltersChange).toHaveBeenCalledWith(emptyFilters());
  });

  it("groups results under type headings, in declaration order, listing all documents within a group", () => {
    // Input order: referral, test result, referral — declaration order puts
    // "Test result" before "Referral" (see DOCUMENT_TYPES in api.ts).
    renderScreen([
      doc({ id: 1, title: "Referral A", type: "referral" }),
      doc({ id: 2, title: "Test A", type: "test result" }),
      doc({ id: 3, title: "Referral B", type: "referral" }),
    ]);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Test result", "Referral"]);

    const titles = screen.getAllByText(/^(Referral|Test) [AB]$/).map((el) => el.textContent);
    expect(titles).toEqual(["Test A", "Referral A", "Referral B"]);
  });

  it("shows a linked-items badge only when a document is linked to more than one appointment/task", () => {
    renderScreen([
      doc({ id: 1, title: "Multi Linked", appointmentIds: [10, 11] }),
      doc({ id: 2, title: "Single Linked", appointmentIds: [10] }),
      doc({ id: 3, title: "Not Linked" }),
    ]);

    expect(screen.getByText("Linked to 2 items")).toBeInTheDocument();
    expect(screen.queryByText(/Linked to 1 item/)).not.toBeInTheDocument();
    expect(screen.queryAllByText(/Linked to/).length).toBe(1);
  });

  it("expands a linked-items badge in-card to show the full linked-item detail on tap", async () => {
    const user = userEvent.setup();
    const appt: Appointment = {
      id: 10,
      doctorId: null,
      dateTime: "2026-08-20T10:00:00Z",
      location: undefined,
      notes: "Cardio checkup",
      status: "planned",
      summary: null,
    };
    const task: Task = {
      id: 20,
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
    };
    renderScreen([doc({ id: 1, title: "Multi Linked", appointmentIds: [10], taskIds: [20] })], {
      appointments: [appt],
      openItems: [task],
    });

    expect(screen.queryByText("Cardio checkup")).not.toBeInTheDocument();

    await user.click(screen.getByText("Linked to 2 items"));

    expect(screen.getByText("Cardio checkup")).toBeInTheDocument();
    expect(screen.getByText("Blood test")).toBeInTheDocument();
  });
});
