import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentDetailScreen } from "./AppointmentDetailScreen";
import type { Appointment, Doctor, MedicalDocument, Task } from "../api";

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    doctorId: null,
    dateTime: "2026-09-01T10:00:00Z",
    location: undefined,
    notes: "Annual checkup",
    status: "planned",
    summary: null,
    ...overrides,
  };
}

function doc(overrides: Partial<MedicalDocument> = {}): MedicalDocument {
  return {
    id: 1,
    notebookId: 42,
    title: "Blood test results",
    type: "test result",
    documentDate: null,
    doctorId: null,
    notes: null,
    file: { fileName: "blood.pdf", uniqueFilename: "u_blood.pdf", mime: "application/pdf", hash: "h", size: 10 },
    appointmentIds: [1],
    taskIds: [],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    type: "form_17",
    title: "Form 17 for Dr. Cohen",
    status: "open",
    dueDate: null,
    doctorId: null,
    sourceAppointmentId: 1,
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

describe("AppointmentDetailScreen", () => {
  it("shows a combined readiness indicator spanning attached documents and open items", () => {
    const documents = [doc({ id: 1 }), doc({ id: 2 }), doc({ id: 3 })];
    const openItems = [task({ id: 1, status: "done" }), task({ id: 2, status: "open" })];

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={documents}
        openItems={openItems}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
      />,
    );

    expect(screen.getByText("4 of 5 ready")).toBeInTheDocument();
  });

  it("shows attached documents and pending open items in two separate sections, never merged into one list", () => {
    const documents = [doc({ id: 1, title: "Blood test results" })];
    const openItems = [task({ id: 1, title: "Form 17 for Dr. Cohen" })];

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={documents}
        openItems={openItems}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
      />,
    );

    const documentsSection = screen.getByTestId("appointment-documents-section");
    const openItemsSection = screen.getByTestId("appointment-openitems-section");

    expect(documentsSection).toHaveTextContent("Blood test results");
    expect(documentsSection).not.toHaveTextContent("Form 17 for Dr. Cohen");
    expect(openItemsSection).toHaveTextContent("Form 17 for Dr. Cohen");
    expect(openItemsSection).not.toHaveTextContent("Blood test results");
  });

  it("calls onSelectDocument when an attached document is clicked", async () => {
    const user = userEvent.setup();
    const onSelectDocument = vi.fn();
    const document = doc({ id: 7, title: "Blood test results" });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[document]}
        openItems={[]}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
        onSelectDocument={onSelectDocument}
      />,
    );

    await user.click(screen.getByText("Blood test results"));

    expect(onSelectDocument).toHaveBeenCalledWith(document);
  });

  it("calls onSelectTask when a pending open item is clicked", async () => {
    const user = userEvent.setup();
    const onSelectTask = vi.fn();
    const openItem = task({ id: 8, title: "Form 17 for Dr. Cohen" });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[]}
        openItems={[openItem]}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
        onSelectTask={onSelectTask}
      />,
    );

    await user.click(screen.getByText("Form 17 for Dr. Cohen"));

    expect(onSelectTask).toHaveBeenCalledWith(openItem);
  });

  it("attaches an existing document found through the searchable picker", async () => {
    const user = userEvent.setup();
    const onAttachDocument = vi.fn();
    const bloodTest = doc({ id: 5, title: "Blood test results", appointmentIds: [] });
    const referral = doc({ id: 6, title: "Cardiology referral", appointmentIds: [] });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[]}
        openItems={[]}
        allDocuments={[bloodTest, referral]}
        onEdit={() => {}}
        onAttachDocument={onAttachDocument}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Attach existing document" }));
    await user.type(screen.getByLabelText("Search documents"), "blood");

    expect(screen.getByText("Blood test results")).toBeInTheDocument();
    expect(screen.queryByText("Cardiology referral")).not.toBeInTheDocument();

    await user.click(screen.getByText("Blood test results"));

    expect(onAttachDocument).toHaveBeenCalledWith(bloodTest);
  });

  it("excludes documents already attached to this appointment from the picker's results", async () => {
    const user = userEvent.setup();
    const attached = doc({ id: 5, title: "Blood test results", appointmentIds: [1] });
    const other = doc({ id: 6, title: "Cardiology referral", appointmentIds: [] });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[attached]}
        openItems={[]}
        allDocuments={[attached, other]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Attach existing document" }));

    expect(screen.queryByText("Blood test results", { selector: ".picker-result" })).not.toBeInTheDocument();
    expect(screen.getByText("Cardiology referral")).toBeInTheDocument();
  });

  it("shows the appointment's doctor and location, and calls onEdit when the edit control is activated", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const doctor: Doctor = { id: 1, name: "Dr. Jane Smith", specialty: "Cardiology", photoPath: null };

    render(
      <AppointmentDetailScreen
        appointment={appointment({ doctorId: 1, location: "Riverside Clinic" })}
        doctor={doctor}
        documents={[]}
        openItems={[]}
        allDocuments={[]}
        onEdit={onEdit}
        onAttachDocument={() => {}}
      />,
    );

    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Riverside Clinic")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("follows the doctor's name into their own detail view — the natural place for that link now that appointment lists no longer offer it", async () => {
    const user = userEvent.setup();
    const onSelectDoctor = vi.fn();
    const doctor: Doctor = { id: 1, name: "Dr. Jane Smith", specialty: "Cardiology", photoPath: null };

    render(
      <AppointmentDetailScreen
        appointment={appointment({ doctorId: 1 })}
        doctor={doctor}
        documents={[]}
        openItems={[]}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
        onSelectDoctor={onSelectDoctor}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dr. Jane Smith" }));

    expect(onSelectDoctor).toHaveBeenCalledWith(doctor);
  });

  it("makes checklist rows keyboard-activatable, same as the rest of the app's clickable rows", async () => {
    const user = userEvent.setup();
    const onSelectDocument = vi.fn();
    const document = doc({ id: 7, title: "Blood test results" });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[document]}
        openItems={[]}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
        onSelectDocument={onSelectDocument}
      />,
    );

    screen.getByText("Blood test results").focus();
    await user.keyboard("{Enter}");

    expect(onSelectDocument).toHaveBeenCalledWith(document);
  });

  it("shows an open item's checkbox unchecked when open and checked when done", () => {
    const openItems = [
      task({ id: 1, title: "Obtain Form 17", status: "open" }),
      task({ id: 2, title: "Bring blood test results", status: "done" }),
    ];

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[]}
        openItems={openItems}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Obtain Form 17" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Bring blood test results" })).toBeChecked();
  });

  it("checking an open item's checkbox marks it done", async () => {
    const user = userEvent.setup();
    const onTaskStatusChange = vi.fn();
    const openItem = task({ id: 1, title: "Obtain Form 17", status: "open" });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[]}
        openItems={[openItem]}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
        onTaskStatusChange={onTaskStatusChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Obtain Form 17" }));

    expect(onTaskStatusChange).toHaveBeenCalledWith(openItem, "done");
  });

  it("unchecking a done item's checkbox reopens it, same as TaskDetailScreen's own reopen action", async () => {
    const user = userEvent.setup();
    const onTaskStatusChange = vi.fn();
    const openItem = task({ id: 1, title: "Obtain Form 17", status: "done" });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[]}
        openItems={[openItem]}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
        onTaskStatusChange={onTaskStatusChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Obtain Form 17" }));

    expect(onTaskStatusChange).toHaveBeenCalledWith(openItem, "open");
  });

  it("shows a done open item's title with strikethrough styling, an open one without", () => {
    const openItems = [
      task({ id: 1, title: "Obtain Form 17", status: "open" }),
      task({ id: 2, title: "Bring blood test results", status: "done" }),
    ];

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[]}
        openItems={openItems}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
      />,
    );

    expect(screen.getByText("Obtain Form 17")).not.toHaveClass("done");
    expect(screen.getByText("Bring blood test results")).toHaveClass("done");
  });

  it("checking the checkbox doesn't also navigate to the task's own detail screen", async () => {
    const user = userEvent.setup();
    const onSelectTask = vi.fn();
    const openItem = task({ id: 1, title: "Obtain Form 17", status: "open" });

    render(
      <AppointmentDetailScreen
        appointment={appointment()}
        documents={[]}
        openItems={[openItem]}
        allDocuments={[]}
        onEdit={() => {}}
        onAttachDocument={() => {}}
        onSelectTask={onSelectTask}
        onTaskStatusChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Obtain Form 17" }));

    expect(onSelectTask).not.toHaveBeenCalled();
  });
});
