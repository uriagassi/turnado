import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDetailScreen } from "./TaskDetailScreen";
import type { Doctor, Task } from "../api";

const doctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", specialty: "Cardiology", photoPath: null },
  { id: 2, name: "Dr. John Doe", specialty: "Neurology", photoPath: null },
];

describe("TaskDetailScreen", () => {
  it("renders task information, status badge, and kind-specific fields", () => {
    const task: Task = {
      id: 10,
      type: "form_17",
      title: "Get Form 17 for MRI",
      status: "in-progress",
      dueDate: "2026-09-01",
      doctorId: 2,
      sourceAppointmentId: null,
      pendingAppointmentId: null,
      requiresAdvanceScheduling: false,
      recurrenceWindow: null,
      approximateDateWindow: null,
      institution: "Assuta Hospital",
      department: "Radiology",
      healthFund: "Maccabi",
      codeNumber: "L0123",
      codeName: "Brain MRI",
      issuingBody: null,
      purpose: null,
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    };

    render(
      <TaskDetailScreen
        task={task}
        doctors={doctors}
        onEdit={() => {}}
        onStatusChange={() => {}}
      />
    );

    expect(screen.getByText("Get Form 17 for MRI")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Assuta Hospital")).toBeInTheDocument();
    expect(screen.getByText("Dr. John Doe (Neurology)")).toBeInTheDocument();
    expect(screen.getByText("L0123 — Brain MRI")).toBeInTheDocument();
  });

  it("calls onStatusChange with done when 'Mark as completed' is clicked", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    const task: Task = {
      id: 10,
      type: "test",
      title: "Blood test",
      status: "open",
      doctorId: null,
      dueDate: null,
      sourceAppointmentId: null,
      pendingAppointmentId: null,
      requiresAdvanceScheduling: false,
      recurrenceWindow: "1-2 weeks",
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

    render(
      <TaskDetailScreen
        task={task}
        doctors={doctors}
        onEdit={() => {}}
        onStatusChange={onStatusChange}
      />
    );

    const markDoneBtn = screen.getByRole("button", { name: /Mark as completed/i });
    await user.click(markDoneBtn);

    expect(onStatusChange).toHaveBeenCalledWith(task, "done");
  });

  it("calls onEdit when edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    const task: Task = {
      id: 10,
      type: "general_approval",
      title: "Permit",
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
      issuingBody: "MOH",
      purpose: "Treatment",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    };

    render(
      <TaskDetailScreen
        task={task}
        doctors={doctors}
        onEdit={onEdit}
        onStatusChange={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /Edit/i }));
    expect(onEdit).toHaveBeenCalledWith(task);
  });

  it("calls onResolveToAppointment when resolution button is clicked for doctor_visit", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();

    const task: Task = {
      id: 12,
      type: "doctor_visit",
      title: "Visit Dr. Smith",
      status: "open",
      doctorId: 1,
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

    render(
      <TaskDetailScreen
        task={task}
        doctors={doctors}
        onEdit={() => {}}
        onStatusChange={() => {}}
        onResolveToAppointment={onResolve}
      />
    );

    const resolveBtn = screen.getByRole("button", { name: /Set date & create appointment/i });
    await user.click(resolveBtn);

    expect(onResolve).toHaveBeenCalledWith(task);
  });

  it("renders linked appointment details when pendingAppointmentId is present", () => {
    const task: Task = {
      id: 15,
      type: "form_17",
      title: "Get Form 17",
      status: "in-progress",
      doctorId: 1,
      dueDate: null,
      sourceAppointmentId: null,
      pendingAppointmentId: 42,
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

    const appointments = [
      {
        id: 42,
        doctorId: 1,
        dateTime: "2026-09-10T10:00:00.000Z",
        location: "Assuta Hospital",
        notes: "Cardiology follow-up",
        status: "planned" as const,
        summary: null,
      },
    ];

    render(
      <TaskDetailScreen
        task={task}
        doctors={doctors}
        appointments={appointments}
        onEdit={() => {}}
        onStatusChange={() => {}}
      />
    );

    expect(screen.getByText(/Scheduled appointment/i)).toBeInTheDocument();
    expect(screen.getByText("Cardiology follow-up")).toBeInTheDocument();
    expect(screen.getByText(/Assuta Hospital/i)).toBeInTheDocument();
  });

  it("renders attached documents and allows clicking to view and attach", async () => {
    const user = userEvent.setup();
    const onAddDocument = vi.fn();
    const onSelectDocument = vi.fn();

    const task: Task = {
      id: 20,
      type: "test",
      title: "Blood test",
      status: "open",
      doctorId: 1,
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

    const docs = [
      {
        id: 101,
        notebookId: 0,
        title: "Blood count results",
        type: "test result" as const,
        documentDate: "2026-08-10",
        doctorId: 1,
        notes: null,
        file: { attachmentId: 1, fileName: "blood.pdf", uniqueFilename: "blood.pdf", mime: "application/pdf", size: 100, hash: "abc" },
        files: [{ attachmentId: 1, fileName: "blood.pdf", uniqueFilename: "blood.pdf", mime: "application/pdf", size: 100, hash: "abc" }],
        appointmentIds: [],
        taskIds: [20],
        createdAt: "2026-08-10",
        updatedAt: "2026-08-10",
      },
    ];

    render(
      <TaskDetailScreen
        task={task}
        doctors={doctors}
        documents={docs}
        onEdit={() => {}}
        onStatusChange={() => {}}
        onAddDocument={onAddDocument}
        onSelectDocument={onSelectDocument}
      />
    );

    expect(screen.getByText("Blood count results")).toBeInTheDocument();
    await user.click(screen.getByText("Blood count results"));
    expect(onSelectDocument).toHaveBeenCalledWith(docs[0]);

    const attachBtn = screen.getByRole("button", { name: /Attach document/i });
    await user.click(attachBtn);
    expect(onAddDocument).toHaveBeenCalledWith(task);
  });
});
