import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDetailScreen } from "./TaskDetailScreen";
import type { Doctor, Task } from "../api";

const doctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", specialty: "Cardiology", photoPath: null },
  { id: 2, name: "Dr. John Doe", specialty: "Neurology", photoPath: null },
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    type: "test",
    title: "A task",
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
    similarTaskIds: [],
    ...overrides,
  };
}

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
      missedReminder: null,
      similarTaskIds: [],
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

  it("shows a missed-reminder marker with the exact reason available on tap, when the task has one (issue #10)", async () => {
    const user = userEvent.setup();
    const task: Task = {
      id: 11,
      type: "test",
      title: "Blood test",
      status: "open",
      dueDate: "2026-09-01",
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
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
      missedReminder: "window closed before delivery",
      similarTaskIds: [],
    };

    render(<TaskDetailScreen task={task} doctors={doctors} onEdit={() => {}} onStatusChange={() => {}} />);

    expect(screen.queryByText("The reminder window closed before it could be sent.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reminder missed" }));

    expect(screen.getByText("The reminder window closed before it could be sent.")).toBeInTheDocument();
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
      missedReminder: null,
      similarTaskIds: [],
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
      missedReminder: null,
      similarTaskIds: [],
    };

    render(
      <TaskDetailScreen
        task={task}
        doctors={doctors}
        onEdit={onEdit}
        onStatusChange={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "✎ Edit" }));
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
      missedReminder: null,
      similarTaskIds: [],
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
      missedReminder: null,
      similarTaskIds: [],
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
        missedReminder: null,
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

  it("renders attached documents and allows clicking to view, and opens the edit form via the documents section's edit shortcut", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
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
      missedReminder: null,
      similarTaskIds: [],
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
        onEdit={onEdit}
        onStatusChange={() => {}}
        onSelectDocument={onSelectDocument}
      />
    );

    expect(screen.getByText("Blood count results")).toBeInTheDocument();
    await user.click(screen.getByText("Blood count results"));
    expect(onSelectDocument).toHaveBeenCalledWith(docs[0]);

    expect(screen.queryByRole("button", { name: /Attach document/i })).not.toBeInTheDocument();

    const editDocumentsBtn = screen.getByRole("button", { name: /Edit documents/i });
    await user.click(editDocumentsBtn);
    expect(onEdit).toHaveBeenCalledWith(task);
  });

  it("still offers the documents edit shortcut when the task has no documents yet", () => {
    const task: Task = {
      id: 21,
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
      missedReminder: null,
      similarTaskIds: [],
    };

    render(<TaskDetailScreen task={task} doctors={doctors} onEdit={() => {}} onStatusChange={() => {}} />);

    expect(screen.getByRole("button", { name: /Edit documents/i })).toBeInTheDocument();
  });

  describe("possibly-a-duplicate badge and candidate list (issue #12)", () => {
    it("shows the badge and lists every current candidate when the task has similarTaskIds", () => {
      const other = makeTask({ id: 2, title: "Other blood test", status: "in-progress" });
      const task = makeTask({ id: 1, title: "Blood test", similarTaskIds: [2] });

      render(
        <TaskDetailScreen task={task} doctors={doctors} similarTasks={[other]} onEdit={() => {}} onStatusChange={() => {}} />
      );

      expect(screen.getByText("Possibly a duplicate")).toBeInTheDocument();
      expect(screen.getByText("Possibly a duplicate of")).toBeInTheDocument();
      expect(screen.getByText("Other blood test")).toBeInTheDocument();
    });

    it("omits the badge and the candidate section when there are none", () => {
      const task = makeTask({ similarTaskIds: [] });

      render(<TaskDetailScreen task={task} doctors={doctors} onEdit={() => {}} onStatusChange={() => {}} />);

      expect(screen.queryByText("Possibly a duplicate")).not.toBeInTheDocument();
      expect(screen.queryByText("Possibly a duplicate of")).not.toBeInTheDocument();
    });

    it("navigates to a candidate's own detail screen when its row is clicked", async () => {
      const user = userEvent.setup();
      const onSelectTask = vi.fn();
      const other = makeTask({ id: 2, title: "Other blood test" });
      const task = makeTask({ id: 1, title: "Blood test", similarTaskIds: [2] });

      render(
        <TaskDetailScreen
          task={task}
          doctors={doctors}
          similarTasks={[other]}
          onEdit={() => {}}
          onStatusChange={() => {}}
          onSelectTask={onSelectTask}
        />
      );

      await user.click(screen.getByText("Other blood test"));

      expect(onSelectTask).toHaveBeenCalledWith(other);
    });
  });
});
