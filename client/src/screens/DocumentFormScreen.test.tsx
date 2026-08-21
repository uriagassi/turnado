import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentFormScreen } from "./DocumentFormScreen";
import type { Doctor, Appointment, Task } from "../api";

const mockDoctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", notes: "", photoPath: null },
  { id: 2, name: "Dr. Amy Lee", notes: "", photoPath: null },
];

const mockAppointments: Appointment[] = [
  { id: 10, doctorId: 1, dateTime: "2026-08-20T10:00:00Z", notes: "Checkup", status: "planned", summary: null },
];

const mockTasks: Task[] = [
  {
    id: 100,
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
    createdAt: "",
    updatedAt: "",
  },
];

describe("DocumentFormScreen", () => {
  it("renders all form fields with labels", () => {
    render(
      <DocumentFormScreen
        doctors={mockDoctors}
        appointments={mockAppointments}
        openItems={mockTasks}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/file/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/doctor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it("blocks submission and shows errors when required fields are empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <DocumentFormScreen
        doctors={mockDoctors}
        appointments={mockAppointments}
        openItems={mockTasks}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Please select a file to upload.")).toBeInTheDocument();
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
  });

  it("submits formData with selected file and fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <DocumentFormScreen
        doctors={mockDoctors}
        appointments={mockAppointments}
        openItems={mockTasks}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    const fakeFile = new File(["dummy"], "test.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText(/file/i);
    await user.upload(fileInput, fakeFile);

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Blood Test Lab");
    await user.selectOptions(screen.getByLabelText(/type/i), "test result");
    await user.type(screen.getByLabelText(/date/i), "2026-08-10");
    await user.selectOptions(screen.getByLabelText(/doctor/i), "1");
    await user.type(screen.getByLabelText(/notes/i), "All clear");

    await user.selectOptions(screen.getByLabelText(/appointment/i), "10");
    await user.selectOptions(screen.getByLabelText(/open item/i), "100");
    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const submittedFormData = onSubmit.mock.calls[0][0] as FormData;
    expect(submittedFormData.get("title")).toBe("Blood Test Lab");
    expect(submittedFormData.get("type")).toBe("test result");
    expect(submittedFormData.get("documentDate")).toBe("2026-08-10");
    expect(submittedFormData.get("doctorId")).toBe("1");
    expect(submittedFormData.get("appointmentIds")).toBe("[10]");
    expect(submittedFormData.get("taskIds")).toBe("[100]");
    expect(submittedFormData.get("notes")).toBe("All clear");
    expect(submittedFormData.get("file")).toBe(fakeFile);
  });

  it("defaults document type to 'other' when no task is linked", () => {
    render(
      <DocumentFormScreen
        doctors={mockDoctors}
        appointments={mockAppointments}
        openItems={mockTasks}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const typeSelect = screen.getByLabelText(/type/i) as HTMLSelectElement;
    expect(typeSelect.value).toBe("other");
  });

  it("sets document type based on initialTaskId and updates on task dropdown selection", async () => {
    const user = userEvent.setup();
    const tasksWithForm17: Task[] = [
      ...mockTasks,
      {
        id: 200,
        type: "form_17",
        title: "Get Form 17",
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
        createdAt: "",
        updatedAt: "",
      },
    ];

    const { rerender } = render(
      <DocumentFormScreen
        doctors={mockDoctors}
        appointments={mockAppointments}
        openItems={tasksWithForm17}
        initialTaskId={200}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    let typeSelect = screen.getByLabelText(/type/i) as HTMLSelectElement;
    expect(typeSelect.value).toBe("Form 17");

    // Switching task in dropdown switches document type to test result
    await user.selectOptions(screen.getByLabelText(/open item/i), "100");
    expect(typeSelect.value).toBe("test result");
  });
});
