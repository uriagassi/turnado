import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentCalendar } from "./AppointmentCalendar";
import type { Appointment, Doctor } from "../api";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: 1,
    doctorId: null,
    dateTime: "2026-09-15T10:00:00Z",
    location: undefined,
    notes: "Annual checkup",
    status: "planned",
    summary: null,
    missedReminder: null,
    ...overrides,
  };
}

const doctors: Doctor[] = [{ id: 1, name: "Dr. Jane Smith", notes: "", photoPath: null }];

function noop() {}

// A fixed "now" so the default month is deterministic regardless of when
// the suite runs, rather than depending on the real wall-clock date.
const NOW = new Date(2026, 8, 21);

describe("AppointmentCalendar", () => {
  it("defaults to the current month", () => {
    render(
      <AppointmentCalendar appointments={[]} doctors={doctors} onEdit={noop} onStatusChange={noop} onSaveSummary={noop} now={NOW} />,
    );

    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-day-2026-09-21")).toBeInTheDocument();
  });

  it("marks today's cell and no other", () => {
    render(
      <AppointmentCalendar appointments={[]} doctors={doctors} onEdit={noop} onStatusChange={noop} onSaveSummary={noop} now={NOW} />,
    );

    expect(screen.getByTestId("calendar-day-2026-09-21")).toHaveClass("today");
    expect(screen.getByTestId("calendar-day-2026-09-20")).not.toHaveClass("today");
    expect(screen.getByTestId("calendar-day-2026-09-22")).not.toHaveClass("today");
  });

  it("keeps marking today's cell after navigating away and back to its month", async () => {
    const user = userEvent.setup();
    render(
      <AppointmentCalendar appointments={[]} doctors={doctors} onEdit={noop} onStatusChange={noop} onSaveSummary={noop} now={NOW} />,
    );

    await user.click(screen.getByRole("button", { name: "Next month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));

    expect(screen.getByTestId("calendar-day-2026-09-21")).toHaveClass("today");
  });

  it("shows a marker on a day with an appointment and not on one without", () => {
    const appointment = appt({ dateTime: "2026-09-15T10:00:00Z" });
    render(
      <AppointmentCalendar
        appointments={[appointment]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        now={NOW}
      />,
    );

    const dayWithAppointment = screen.getByTestId("calendar-day-2026-09-15");
    expect(dayWithAppointment.querySelector(".calendar-day-marker")).not.toBeNull();

    const dayWithout = screen.getByTestId("calendar-day-2026-09-16");
    expect(dayWithout.querySelector(".calendar-day-marker")).toBeNull();
  });

  it("surfaces a day's appointments when it's selected, reusing the appointment-row presentation", async () => {
    const user = userEvent.setup();
    const appointment = appt({ dateTime: "2026-09-15T10:00:00Z", notes: "Blood test" });
    render(
      <AppointmentCalendar
        appointments={[appointment]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        now={NOW}
      />,
    );

    expect(screen.queryByText("Blood test")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("calendar-day-2026-09-15"));

    expect(screen.getByText("Blood test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows an empty message for a selected day with no appointments", async () => {
    const user = userEvent.setup();
    render(
      <AppointmentCalendar appointments={[]} doctors={doctors} onEdit={noop} onStatusChange={noop} onSaveSummary={noop} now={NOW} />,
    );

    await user.click(screen.getByTestId("calendar-day-2026-09-10"));

    expect(screen.getByText("No appointments on this day.")).toBeInTheDocument();
  });

  it("navigates to the next and previous month, keeping appointments tied to their own date", async () => {
    const user = userEvent.setup();
    const septemberAppt = appt({ id: 1, dateTime: "2026-09-15T10:00:00Z", notes: "September visit" });
    const octoberAppt = appt({ id: 2, dateTime: "2026-10-05T10:00:00Z", notes: "October visit" });
    render(
      <AppointmentCalendar
        appointments={[septemberAppt, octoberAppt]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        now={NOW}
      />,
    );

    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-day-2026-10-05")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next month" }));

    expect(screen.getByText("October 2026")).toBeInTheDocument();
    await user.click(screen.getByTestId("calendar-day-2026-10-05"));
    expect(screen.getByText("October visit")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));

    expect(screen.getByText("August 2026")).toBeInTheDocument();
  });

  it("calls onSelect with the appointment when a selected day's Details button is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const appointment = appt({ dateTime: "2026-09-15T10:00:00Z" });
    render(
      <AppointmentCalendar
        appointments={[appointment]}
        doctors={doctors}
        onEdit={noop}
        onStatusChange={noop}
        onSaveSummary={noop}
        onSelect={onSelect}
        now={NOW}
      />,
    );

    await user.click(screen.getByTestId("calendar-day-2026-09-15"));
    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(onSelect).toHaveBeenCalledWith(appointment);
  });
});
