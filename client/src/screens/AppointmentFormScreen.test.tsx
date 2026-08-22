import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentFormScreen } from "./AppointmentFormScreen";
import type { Doctor } from "../api";

const doctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", notes: "", photoPath: null },
  { id: 2, name: "Dr. Amy Lee", notes: "", photoPath: null },
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

  it("submits with doctorId null when no doctor is selected, e.g. an imaging-center slot", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Date & time"), { target: { value: "2026-09-01T10:00" } });
    await user.type(screen.getByLabelText("Notes"), "MRI scan");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ doctorId: null }), null);
  });

  it("blocks submission and shows an error when notes is left blank", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={onSubmit} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Date & time"), { target: { value: "2026-09-01T10:00" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Notes is required.")).toBeInTheDocument();
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

  it("calls onCancel when the cancel control is activated", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AppointmentFormScreen doctors={doctors} onSubmit={() => {}} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
