import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFormScreen } from "./TaskFormScreen";
import type { Doctor, MedicalDocument, Task } from "../api";

const doctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", specialty: "Cardiology", photoPath: null },
  { id: 2, name: "Dr. John Doe", specialty: "Neurology", photoPath: null },
];

const NO_DOCUMENT_CHANGES = { attachDocumentIds: [], detachDocumentIds: [], uploads: [] };

function existingTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    type: "test",
    title: "Existing task",
    status: "open",
    doctorId: 1,
    dueDate: "2026-09-01",
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

function doc(overrides: Partial<MedicalDocument> = {}): MedicalDocument {
  return {
    id: 1,
    notebookId: 0,
    title: "Referral letter",
    type: "referral",
    documentDate: null,
    doctorId: null,
    notes: null,
    file: { fileName: "referral.pdf", uniqueFilename: "u_referral.pdf", mime: "application/pdf", hash: "h", size: 10 },
    appointmentIds: [],
    taskIds: [],
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

describe("TaskFormScreen", () => {
  it("submits a test task with recurrence window and advance scheduling flag", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <TaskFormScreen
        doctors={doctors}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    // Default type is "test"
    await user.type(screen.getByLabelText(/Title \/ Description/), "Blood test (CBC)");
    await user.type(screen.getByLabelText(/Recurrence frequency/), "1-2 weeks");
    await user.click(screen.getByLabelText(/Requires advance scheduling/));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "test",
        title: "Blood test (CBC)",
        recurrenceWindow: "1-2 weeks",
        requiresAdvanceScheduling: true,
      }),
      NO_DOCUMENT_CHANGES
    );
  });

  it("requires doctor selection when type is doctor_visit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <TaskFormScreen
        doctors={doctors}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    await user.selectOptions(screen.getByLabelText("Type"), "doctor_visit");
    await user.type(screen.getByLabelText(/Title \/ Description/), "Schedule visit");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Doctor is required for this task type.")).toBeInTheDocument();

    // Now select a doctor
    await user.selectOptions(screen.getByLabelText("Doctor"), "1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "doctor_visit",
        title: "Schedule visit",
        doctorId: 1,
      }),
      NO_DOCUMENT_CHANGES
    );
  });

  it("submits a form_17 task with institution and code details", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <TaskFormScreen
        doctors={doctors}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    await user.selectOptions(screen.getByLabelText("Type"), "form_17");
    await user.type(screen.getByLabelText(/Title \/ Description/), "Get Form 17 for MRI");
    await user.type(screen.getByLabelText("Institution"), "Assuta Tel Aviv");
    await user.type(screen.getByLabelText("Department"), "Neurology");
    await user.type(screen.getByLabelText("Health fund"), "Maccabi");
    await user.type(screen.getByLabelText("Code number"), "L0123");
    await user.type(screen.getByLabelText("Code name"), "Brain MRI");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "form_17",
        title: "Get Form 17 for MRI",
        institution: "Assuta Tel Aviv",
        department: "Neurology",
        healthFund: "Maccabi",
        codeNumber: "L0123",
        codeName: "Brain MRI",
      }),
      NO_DOCUMENT_CHANGES
    );
  });

  it("submits a general_approval task with issuing body and purpose", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <TaskFormScreen
        doctors={doctors}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    await user.selectOptions(screen.getByLabelText("Type"), "general_approval");
    await user.type(screen.getByLabelText(/Title \/ Description/), "Travel permit");
    await user.type(screen.getByLabelText("Issuing body"), "Ministry of Health");
    await user.type(screen.getByLabelText("Purpose"), "Overseas treatment");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "general_approval",
        title: "Travel permit",
        issuingBody: "Ministry of Health",
        purpose: "Overseas treatment",
      }),
      NO_DOCUMENT_CHANGES
    );
  });

  it("pre-populates fields when editing an existing task", () => {
    const existingTask: Task = {
      id: 99,
      type: "form_17",
      title: "Existing Form 17",
      status: "in-progress",
      dueDate: "2026-09-10",
      doctorId: 2,
      sourceAppointmentId: null,
      pendingAppointmentId: null,
      requiresAdvanceScheduling: false,
      recurrenceWindow: null,
      approximateDateWindow: null,
      institution: "Sheba",
      department: "Cardiology",
      healthFund: "Clalit",
      codeNumber: "9988",
      codeName: "Echo",
      issuingBody: null,
      purpose: null,
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
      missedReminder: null,
      similarTaskIds: [],
    };

    render(
      <TaskFormScreen
        task={existingTask}
        doctors={doctors}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByDisplayValue("Existing Form 17")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sheba")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Clalit")).toBeInTheDocument();
  });

  it("calls onResolveToAppointment when the action is triggered for doctor_visit task", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();

    const task: Task = {
      id: 5,
      type: "doctor_visit",
      title: "Schedule visit with neurologist",
      status: "open",
      doctorId: 2,
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
      <TaskFormScreen
        task={task}
        doctors={doctors}
        onSubmit={() => {}}
        onCancel={() => {}}
        onResolveToAppointment={onResolve}
      />
    );

    const resolveBtn = screen.getByRole("button", {
      name: /Set date & create appointment/i,
    });
    await user.click(resolveBtn);

    expect(onResolve).toHaveBeenCalledWith(task);
  });

  describe("document attach/upload/detach", () => {
    it("attaches an existing document picked through the search picker", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const referral = doc({ id: 5, title: "Cardiology referral" });
      const bloodTest = doc({ id: 6, title: "Blood test results" });

      render(
        <TaskFormScreen
          doctors={doctors}
          allDocuments={[referral, bloodTest]}
          onSubmit={onSubmit}
          onCancel={() => {}}
        />
      );

      await user.type(screen.getByLabelText(/Title \/ Description/), "Blood test (CBC)");
      await user.click(screen.getByRole("button", { name: "Attach existing document" }));
      await user.click(screen.getByText("Cardiology referral"));

      expect(screen.getByText("Cardiology referral")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Blood test (CBC)" }),
        { attachDocumentIds: [5], detachDocumentIds: [], uploads: [] }
      );
    });

    it("lets a mistakenly-picked document be unselected before saving", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const referral = doc({ id: 5, title: "Cardiology referral" });

      render(
        <TaskFormScreen doctors={doctors} allDocuments={[referral]} onSubmit={onSubmit} onCancel={() => {}} />
      );

      await user.type(screen.getByLabelText(/Title \/ Description/), "Blood test");
      await user.click(screen.getByRole("button", { name: "Attach existing document" }));
      await user.click(screen.getByText("Cardiology referral"));
      const removeBtn = screen.getByRole("button", { name: /Remove Cardiology referral/i });

      // Undoing the pick drops it from the staged list (the remove control
      // disappears); it's fine that it reappears as a pickable search result
      // below, since the picker is still open — that's the same document,
      // simply no longer staged.
      await user.click(removeBtn);
      expect(screen.queryByRole("button", { name: /Remove Cardiology referral/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSubmit).toHaveBeenCalledWith(expect.anything(), NO_DOCUMENT_CHANGES);
    });

    it("stages a newly-selected upload with an auto-filled title and task-appropriate type, without uploading immediately", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<TaskFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

      await user.selectOptions(screen.getByLabelText("Type"), "doctor_visit");
      await user.selectOptions(screen.getByLabelText("Doctor"), "1");
      await user.type(screen.getByLabelText(/Title \/ Description/), "Visit cardiologist");

      const file = new File(["dummy"], "letter.pdf", { type: "application/pdf" });
      const fileInput = screen.getByLabelText(/Upload new document/i);
      await user.upload(fileInput, file);

      expect(screen.getByText("letter")).toBeInTheDocument();
      expect(screen.getByText("Referral")).toBeInTheDocument();
      expect(screen.getByText("Not yet uploaded")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Visit cardiologist" }),
        { attachDocumentIds: [], detachDocumentIds: [], uploads: [{ file, title: "letter", type: "referral" }] }
      );
    });

    it("shows already-attached documents when editing, and reports one removed as a detach on save", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const task: Task = {
        id: 30,
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
        similarTaskIds: [],
      };
      const attached = doc({ id: 9, title: "Old lab result", taskIds: [30] });

      render(
        <TaskFormScreen
          task={task}
          doctors={doctors}
          documents={[attached]}
          onSubmit={onSubmit}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText("Old lab result")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Remove Old lab result/i }));
      expect(screen.queryByText("Old lab result")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Blood test" }),
        { attachDocumentIds: [], detachDocumentIds: [9], uploads: [] }
      );
    });

    it("excludes already-staged existing documents from the picker's own results", async () => {
      const user = userEvent.setup();
      const attached = doc({ id: 9, title: "Old lab result" });
      const other = doc({ id: 10, title: "New lab result" });

      render(
        <TaskFormScreen doctors={doctors} documents={[attached]} allDocuments={[attached, other]} onSubmit={() => {}} onCancel={() => {}} />
      );

      await user.click(screen.getByRole("button", { name: "Attach existing document" }));

      expect(screen.queryByText("Old lab result", { selector: ".picker-result" })).not.toBeInTheDocument();
      expect(screen.getByText("New lab result")).toBeInTheDocument();
    });
  });

  describe("duplicate warning (issue #12)", () => {
    it("shows a dismissible, non-blocking warning once type and doctor match an existing open task", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const similar = existingTask({ id: 50, title: "Blood test (CBC)", type: "test", doctorId: 1 });

      render(
        <TaskFormScreen doctors={doctors} existingTasks={[similar]} onSubmit={onSubmit} onCancel={() => {}} />
      );

      expect(screen.queryByText(/looks similar to an existing open item/i)).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Doctor"), "1");

      expect(screen.getByText(/looks similar to an existing open item: Blood test \(CBC\)/i)).toBeInTheDocument();

      // Never blocks submission.
      await user.type(screen.getByLabelText(/Title \/ Description/), "New blood test");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).toHaveBeenCalled();
    });

    it("dismisses the warning without requiring any confirmation step", async () => {
      const user = userEvent.setup();
      const similar = existingTask({ id: 50, title: "Blood test (CBC)", type: "test", doctorId: 1 });

      render(
        <TaskFormScreen doctors={doctors} existingTasks={[similar]} onSubmit={() => {}} onCancel={() => {}} />
      );

      await user.selectOptions(screen.getByLabelText("Doctor"), "1");
      expect(screen.getByText(/looks similar to an existing open item/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Dismiss" }));

      expect(screen.queryByText(/looks similar to an existing open item/i)).not.toBeInTheDocument();
    });

    it("never warns when no doctor is linked, even if type otherwise matches (NULL-doctor exclusion)", async () => {
      const user = userEvent.setup();
      const similar = existingTask({ id: 50, title: "Blood test (CBC)", type: "test", doctorId: null });

      render(
        <TaskFormScreen doctors={doctors} existingTasks={[similar]} onSubmit={() => {}} onCancel={() => {}} />
      );

      await user.type(screen.getByLabelText(/Title \/ Description/), "New blood test");

      expect(screen.queryByText(/looks similar to an existing open item/i)).not.toBeInTheDocument();
    });

    it("never warns against a done task (open/in-progress-only candidate pool)", async () => {
      const user = userEvent.setup();
      const done = existingTask({ id: 50, title: "Blood test (CBC)", type: "test", doctorId: 1, status: "done" });

      render(
        <TaskFormScreen doctors={doctors} existingTasks={[done]} onSubmit={() => {}} onCancel={() => {}} />
      );

      await user.selectOptions(screen.getByLabelText("Doctor"), "1");

      expect(screen.queryByText(/looks similar to an existing open item/i)).not.toBeInTheDocument();
    });

    it("never warns against the task being edited itself", async () => {
      const editing = existingTask({ id: 50, type: "test", doctorId: 1 });

      render(
        <TaskFormScreen
          task={editing}
          doctors={doctors}
          existingTasks={[editing]}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.queryByText(/looks similar to an existing open item/i)).not.toBeInTheDocument();
    });
  });
});
