import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpcomingAppointmentsScreen } from "./UpcomingAppointmentsScreen";
import type { Appointment, Doctor } from "../api";

function appt(overrides: Partial<Appointment>): Appointment {
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

const doctors: Doctor[] = [{ id: 1, name: "Dr. Jane Smith", notes: "", photoPath: null }];

function noop() {}

describe("UpcomingAppointmentsScreen", () => {
  it("renders each upcoming appointment's notes", () => {
    const appointments = [appt({ id: 1, notes: "Annual checkup" }), appt({ id: 2, notes: "MRI scan" })];

    render(
      <UpcomingAppointmentsScreen
        appointments={appointments}
        doctors={doctors}
        onSelectDoctor={noop}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onBack={noop}
      />,
    );

    expect(screen.getByText("Annual checkup")).toBeInTheDocument();
    expect(screen.getByText("MRI scan")).toBeInTheDocument();
  });

  it("shows an empty state when there are no upcoming appointments", () => {
    render(
      <UpcomingAppointmentsScreen
        appointments={[]}
        doctors={doctors}
        onSelectDoctor={noop}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onBack={noop}
      />,
    );

    expect(screen.getByText("No upcoming appointments.")).toBeInTheDocument();
  });

  it("calls onBack when the back control is activated", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <UpcomingAppointmentsScreen
        appointments={[]}
        doctors={doctors}
        onSelectDoctor={noop}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("links a card's doctor name into that doctor's detail view (issue #4 AC)", async () => {
    const user = userEvent.setup();
    const onSelectDoctor = vi.fn();
    render(
      <UpcomingAppointmentsScreen
        appointments={[appt({ doctorId: 1 })]}
        doctors={doctors}
        onSelectDoctor={onSelectDoctor}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onBack={noop}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dr. Jane Smith" }));

    expect(onSelectDoctor).toHaveBeenCalledWith(doctors[0]);
  });

  it("omits the doctor link for an appointment with no doctor attached", () => {
    render(
      <UpcomingAppointmentsScreen
        appointments={[appt({ doctorId: null })]}
        doctors={doctors}
        onSelectDoctor={noop}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onBack={noop}
      />,
    );

    expect(screen.queryByRole("button", { name: "Dr. Jane Smith" })).not.toBeInTheDocument();
  });

  it("calls onEdit with the appointment when its edit control is activated", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const appointment = appt({ id: 7 });
    render(
      <UpcomingAppointmentsScreen
        appointments={[appointment]}
        doctors={doctors}
        onSelectDoctor={noop}
        onEdit={onEdit}
        onStatusChange={noop}
        onSaveSummary={noop}
        onBack={noop}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith(appointment);
  });

  it("calls onStatusChange when a card's status control changes, e.g. cancelling an upcoming appointment", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    const appointment = appt({ id: 3 });
    render(
      <UpcomingAppointmentsScreen
        appointments={[appointment]}
        doctors={doctors}
        onSelectDoctor={noop}
        onEdit={noop}
        onStatusChange={onStatusChange}
        onSaveSummary={noop}
        onBack={noop}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Status"), "cancelled");

    expect(onStatusChange).toHaveBeenCalledWith(appointment, "cancelled");
  });

  it("has no post-visit summary field for a still-planned appointment", () => {
    render(
      <UpcomingAppointmentsScreen
        appointments={[appt({ status: "planned" })]}
        doctors={doctors}
        onSelectDoctor={noop}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onBack={noop}
      />,
    );

    expect(screen.queryByLabelText("Post-visit summary")).not.toBeInTheDocument();
  });
});
