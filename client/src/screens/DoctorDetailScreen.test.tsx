import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoctorDetailScreen } from "./DoctorDetailScreen";
import type { Doctor } from "../api";

function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 1,
    name: "Dr. Jane Smith",
    specialty: "Cardiology",
    clinic: "Riverside Clinic",
    phone: "555-1234",
    address: "12 Elm St",
    email: "jane.smith@example.com",
    notes: "Prefers morning appointments",
    photoPath: null,
    ...overrides,
  };
}

describe("DoctorDetailScreen", () => {
  it("renders the doctor's fields", () => {
    render(<DoctorDetailScreen doctor={doctor()} onBack={() => {}} onEdit={() => {}} />);

    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
    expect(screen.getByText("Riverside Clinic")).toBeInTheDocument();
    expect(screen.getByText("555-1234")).toBeInTheDocument();
    expect(screen.getByText("12 Elm St")).toBeInTheDocument();
    expect(screen.getByText("jane.smith@example.com")).toBeInTheDocument();
    expect(screen.getByText("Prefers morning appointments")).toBeInTheDocument();
  });

  it("omits the notes paragraph entirely when the doctor has no notes", () => {
    const { container } = render(<DoctorDetailScreen doctor={doctor({ notes: undefined })} onBack={() => {}} onEdit={() => {}} />);

    expect(container.querySelector(".doctor-notes")).not.toBeInTheDocument();
  });

  it("shows empty placeholder sections for appointments, open items, and documents", () => {
    render(<DoctorDetailScreen doctor={doctor()} onBack={() => {}} onEdit={() => {}} />);

    expect(screen.getByText("No upcoming appointment.")).toBeInTheDocument();
    expect(screen.getByText("No open items.")).toBeInTheDocument();
    expect(screen.getByText("No documents.")).toBeInTheDocument();
  });

  it("shows the doctor's upcoming appointment instead of the empty placeholder when there is one", () => {
    const nextAppointment = {
      id: 1,
      doctorId: 1,
      dateTime: "2026-09-01T10:00:00Z",
      location: undefined,
      notes: "Annual checkup",
      status: "planned" as const,
      summary: null,
    };

    render(<DoctorDetailScreen doctor={doctor()} appointments={[nextAppointment]} onBack={() => {}} onEdit={() => {}} />);

    expect(screen.getByText("Annual checkup")).toBeInTheDocument();
    expect(screen.queryByText("No upcoming appointment.")).not.toBeInTheDocument();
  });

  it("shows every upcoming appointment as its own card, not just the soonest", () => {
    const soonest = {
      id: 1,
      doctorId: 1,
      dateTime: "2026-09-01T10:00:00Z",
      location: undefined,
      notes: "Annual checkup",
      status: "planned" as const,
      summary: null,
    };
    const later = {
      id: 2,
      doctorId: 1,
      dateTime: "2026-10-15T09:00:00Z",
      location: undefined,
      notes: "Follow-up",
      status: "planned" as const,
      summary: null,
    };

    render(<DoctorDetailScreen doctor={doctor()} appointments={[soonest, later]} onBack={() => {}} onEdit={() => {}} />);

    expect(screen.getByText("Annual checkup")).toBeInTheDocument();
    expect(screen.getByText("Follow-up")).toBeInTheDocument();
  });

  it("shows the doctor's avatar, same as the list view", () => {
    render(<DoctorDetailScreen doctor={doctor({ name: "Dr. Jane Smith", photoPath: null })} onBack={() => {}} onEdit={() => {}} />);

    expect(screen.getByTestId("doctor-avatar")).toHaveTextContent("JS");
  });

  it("shows the doctor's photo instead of initials in the avatar when photoPath is set", () => {
    render(<DoctorDetailScreen doctor={doctor({ name: "Dr. Jane Smith", photoPath: "1-170000.jpg" })} onBack={() => {}} onEdit={() => {}} />);

    expect(screen.getByTestId("doctor-avatar").querySelector("img")).toHaveAttribute("src", "/photos/1-170000.jpg");
  });

  it("calls onBack when the back-to-doctor-list control is activated", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<DoctorDetailScreen doctor={doctor()} onBack={onBack} onEdit={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Back to doctor list" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("calls onEdit when the edit control is activated", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<DoctorDetailScreen doctor={doctor()} onBack={() => {}} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
