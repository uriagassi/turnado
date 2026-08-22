import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentCard } from "./AppointmentCard";
import type { Appointment, Doctor } from "../api";

const doctor: Doctor = { id: 1, name: "Dr. Jane Smith", specialty: "Cardiology", photoPath: null };

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

describe("AppointmentCard", () => {
  it("calls onSelect with the appointment when the Details button is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const appt = appointment();

    render(
      <AppointmentCard
        appointment={appt}
        onEdit={() => {}}
        onStatusChange={() => {}}
        onSaveSummary={() => {}}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(onSelect).toHaveBeenCalledWith(appt);
  });

  it("shows the doctor's name as plain text, not a link — the checklist screen is where you go from an appointment to its doctor now, not this list", () => {
    render(
      <AppointmentCard
        appointment={appointment()}
        doctor={doctor}
        onEdit={() => {}}
        onStatusChange={() => {}}
        onSaveSummary={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dr. Jane Smith" })).not.toBeInTheDocument();
  });
});
