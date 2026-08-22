import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentHistoryScreen } from "./AppointmentHistoryScreen";
import type { Appointment, Doctor } from "../api";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: 1,
    doctorId: null,
    dateTime: "2026-07-01T10:00:00Z",
    location: undefined,
    notes: "Annual checkup",
    status: "done",
    summary: null,
    missedReminder: null,
    ...overrides,
  };
}

const doctors: Doctor[] = [{ id: 1, name: "Dr. Jane Smith", notes: "", photoPath: null }];

function noop() {}

describe("AppointmentHistoryScreen", () => {
  it("renders each past appointment's notes", () => {
    const appointments = [appt({ id: 1, notes: "Annual checkup" }), appt({ id: 2, notes: "MRI scan" })];

    render(
      <AppointmentHistoryScreen appointments={appointments} doctors={doctors} onEdit={noop} onStatusChange={noop} onSaveSummary={noop} />,
    );

    expect(screen.getByText("Annual checkup")).toBeInTheDocument();
    expect(screen.getByText("MRI scan")).toBeInTheDocument();
  });

  it("shows an empty state when there are no past appointments", () => {
    render(<AppointmentHistoryScreen appointments={[]} doctors={doctors} onEdit={noop} onStatusChange={noop} onSaveSummary={noop} />);

    expect(screen.getByText("No past appointments yet.")).toBeInTheDocument();
  });

  it("shows a card's doctor name (not a link — see AppointmentCard)", () => {
    render(
      <AppointmentHistoryScreen
        appointments={[appt({ doctorId: 1 })]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
      />,
    );

    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
  });

  it("omits the doctor name for an appointment with no doctor attached", () => {
    render(
      <AppointmentHistoryScreen
        appointments={[appt({ doctorId: null })]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
      />,
    );

    expect(screen.queryByText("Dr. Jane Smith")).not.toBeInTheDocument();
  });

  it("calls onEdit with the appointment when its edit control is activated", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const appointment = appt({ id: 7 });
    render(
      <AppointmentHistoryScreen appointments={[appointment]} doctors={doctors} onEdit={onEdit} onStatusChange={noop} onSaveSummary={noop} />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith(appointment);
  });

  it("calls onStatusChange when a card's status control changes", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    const appointment = appt({ id: 3, status: "planned" });
    render(
      <AppointmentHistoryScreen
        appointments={[appointment]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={onStatusChange}
        onSaveSummary={noop}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Status"), "done");

    expect(onStatusChange).toHaveBeenCalledWith(appointment, "done");
  });

  it("shows a post-visit summary field only once the appointment is marked done", () => {
    const { rerender } = render(
      <AppointmentHistoryScreen
        appointments={[appt({ status: "planned" })]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
      />,
    );
    expect(screen.queryByLabelText("Post-visit summary")).not.toBeInTheDocument();

    rerender(
      <AppointmentHistoryScreen
        appointments={[appt({ status: "done" })]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
      />,
    );
    expect(screen.getByLabelText("Post-visit summary")).toBeInTheDocument();
  });

  it("saves the typed post-visit summary", async () => {
    const user = userEvent.setup();
    const onSaveSummary = vi.fn();
    const appointment = appt({ id: 9, status: "done", summary: null });
    render(
      <AppointmentHistoryScreen
        appointments={[appointment]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={onSaveSummary}
      />,
    );

    await user.type(screen.getByLabelText("Post-visit summary"), "Bloodwork normal");
    await user.click(screen.getByRole("button", { name: "Save summary" }));

    expect(onSaveSummary).toHaveBeenCalledWith(appointment, "Bloodwork normal");
  });

  it("disables the save-summary control until the summary text actually changes", () => {
    render(
      <AppointmentHistoryScreen
        appointments={[appt({ status: "done", summary: "Already recorded" })]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "Save summary" })).toBeDisabled();
  });

  it("calls onSelect with the appointment when its Details button is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const appointment = appt({ notes: "Annual checkup" });

    render(
      <AppointmentHistoryScreen
        appointments={[appointment]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(onSelect).toHaveBeenCalledWith(appointment);
  });
});
