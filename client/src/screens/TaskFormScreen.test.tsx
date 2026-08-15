import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFormScreen } from "./TaskFormScreen";
import type { Doctor, Task } from "../api";

const doctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", specialty: "Cardiology", photoPath: null },
  { id: 2, name: "Dr. John Doe", specialty: "Neurology", photoPath: null },
];

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
      })
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
      })
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
      })
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
      })
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
});
