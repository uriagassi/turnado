import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentFormScreen } from "./AppointmentFormScreen";
import type { Appointment, Doctor } from "../api";

const doctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", address: "1 Main St", notes: "", photoPath: null },
  { id: 2, name: "Dr. Amy Lee", address: "2 Oak Ave", notes: "", photoPath: null },
];

describe("AppointmentFormScreen", () => {
  it("renders labeled inputs for every appointment field", () => {
    render(<AppointmentFormScreen doctors={[]} onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Doctor")).toBeInTheDocument();
    const dateTimeInput = screen.getByLabelText("Date & time");
    expect(dateTimeInput).toBeInTheDocument();
    expect(dateTimeInput).toHaveAttribute("type", "datetime-local");
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("submits the filled-in fields, including the selected doctor, as an AppointmentInput", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Amy Lee");
    fireEvent.change(screen.getByLabelText("Date & time"), { target: { value: "2026-09-01T10:00" } });
    await user.clear(screen.getByLabelText("Location"));
    await user.type(screen.getByLabelText("Location"), "Clinic B");
    await user.type(screen.getByLabelText("Notes"), "Annual checkup");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      {
        doctorId: 2,
        dateTime: "2026-09-01T10:00",
        location: "Clinic B",
        notes: "Annual checkup",
      },
      null,
    );
  });

  it("submits the selected invitation file alongside the fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);
    const invitation = new File(["fake-pdf-bytes"], "invitation.pdf", { type: "application/pdf" });

    fireEvent.change(screen.getByLabelText("Date & time"), { target: { value: "2026-09-01T10:00" } });
    await user.type(screen.getByLabelText("Notes"), "Annual checkup");
    await user.upload(screen.getByLabelText("Invitation letter"), invitation);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][1]).toBe(invitation);
  });

  it("fills the location from the selected doctor's address", async () => {
    const user = userEvent.setup();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={() => {}} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Amy Lee");

    expect(screen.getByLabelText("Location")).toHaveValue("2 Oak Ave");
  });

  it("updates the auto-filled location when a different doctor is picked", async () => {
    const user = userEvent.setup();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={() => {}} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Jane Smith");
    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Amy Lee");

    expect(screen.getByLabelText("Location")).toHaveValue("2 Oak Ave");
  });

  it("leaves a hand-edited location alone when the doctor is changed afterwards", async () => {
    const user = userEvent.setup();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={() => {}} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Location"), "Custom room 4");
    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Amy Lee");

    expect(screen.getByLabelText("Location")).toHaveValue("Custom room 4");
  });

  it("fills the location from the doctor's address on mount when resolving a task into a new appointment (issue #50 follow-up)", () => {
    const resolvedFromTask = { doctorId: 2, dateTime: "", location: "", notes: "See specialist" } as Appointment;

    render(<AppointmentFormScreen appointment={resolvedFromTask} doctors={doctors} onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Location")).toHaveValue("2 Oak Ave");
  });

  it("still updates the location if a different doctor is picked after resolving a task", async () => {
    const user = userEvent.setup();
    const resolvedFromTask = { doctorId: 2, dateTime: "", location: "", notes: "See specialist" } as Appointment;

    render(<AppointmentFormScreen appointment={resolvedFromTask} doctors={doctors} onSubmit={() => {}} onCancel={() => {}} />);
    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Jane Smith");

    expect(screen.getByLabelText("Location")).toHaveValue("1 Main St");
  });

  it("does not overwrite an existing appointment's location just from re-picking the doctor", async () => {
    const user = userEvent.setup();
    const appointment = {
      id: 1,
      doctorId: 1,
      dateTime: "2026-09-01T10:00",
      location: "Clinic B",
      notes: "Annual checkup",
      status: "planned" as const,
      summary: null,
      missedReminder: null,
    };
    render(<AppointmentFormScreen appointment={appointment} doctors={doctors} onSubmit={() => {}} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Doctor"), "Dr. Amy Lee");

    expect(screen.getByLabelText("Location")).toHaveValue("Clinic B");
  });

  it("submits with doctorId null when no doctor is selected, e.g. an imaging-center slot", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Date & time"), { target: { value: "2026-09-01T10:00" } });
    await user.type(screen.getByLabelText("Notes"), "MRI scan");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ doctorId: null }), null);
  });

  it("submits successfully when notes is left blank (issue #51: notes is optional)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Date & time"), { target: { value: "2026-09-01T10:00" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ notes: "" }), null);
  });

  it("blocks submission and shows an error when the date & time is left blank", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Notes"), "Annual checkup");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Date & time is required.")).toBeInTheDocument();
  });

  it("pre-fills the fields from an existing appointment when editing", () => {
    const appointment = {
      id: 1,
      doctorId: 2,
      dateTime: "2026-09-01T10:00",
      location: "Clinic B",
      notes: "Annual checkup",
      status: "planned" as const,
      summary: null,
      missedReminder: null,
    };

    render(<AppointmentFormScreen appointment={appointment} doctors={doctors} onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Doctor")).toHaveValue("2");
    expect(screen.getByLabelText("Date & time")).toHaveValue("2026-09-01T10:00");
    expect(screen.getByLabelText("Location")).toHaveValue("Clinic B");
    expect(screen.getByLabelText("Notes")).toHaveValue("Annual checkup");
  });

  it("ignores a second Save click fired while the first submit is still in flight (issue #49)", async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (resolveSubmit = resolve)));
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Date & time"), { target: { value: "2026-09-01T10:00" } });
    await user.type(screen.getByLabelText("Notes"), "Annual checkup");

    const saveButton = screen.getByRole("button", { name: "Save" });
    await user.click(saveButton);
    await user.click(saveButton); // fires while the first submit's promise is still pending

    expect(onSubmit).toHaveBeenCalledOnce();
    resolveSubmit();
    await waitFor(() => expect(saveButton).not.toBeDisabled());
  });

  it("calls onCancel when the cancel control is activated", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={() => {}} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
