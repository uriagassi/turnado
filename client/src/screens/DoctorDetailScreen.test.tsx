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
    render(<DoctorDetailScreen doctor={doctor()} onBack={() => {}} />);

    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
    expect(screen.getByText("Riverside Clinic")).toBeInTheDocument();
    expect(screen.getByText("555-1234")).toBeInTheDocument();
    expect(screen.getByText("12 Elm St")).toBeInTheDocument();
    expect(screen.getByText("jane.smith@example.com")).toBeInTheDocument();
    expect(screen.getByText("Prefers morning appointments")).toBeInTheDocument();
  });

  it("shows empty placeholder sections for appointments, open items, and documents", () => {
    render(<DoctorDetailScreen doctor={doctor()} onBack={() => {}} />);

    expect(screen.getByText("No upcoming appointment.")).toBeInTheDocument();
    expect(screen.getByText("No open items.")).toBeInTheDocument();
    expect(screen.getByText("No documents.")).toBeInTheDocument();
  });

  it("shows the doctor's avatar, same as the list view", () => {
    render(<DoctorDetailScreen doctor={doctor({ name: "Dr. Jane Smith", photoPath: null })} onBack={() => {}} />);

    expect(screen.getByTestId("doctor-avatar")).toHaveTextContent("JS");
  });

  it("shows the doctor's photo instead of initials in the avatar when photoPath is set", () => {
    render(<DoctorDetailScreen doctor={doctor({ name: "Dr. Jane Smith", photoPath: "1-170000.jpg" })} onBack={() => {}} />);

    expect(screen.getByTestId("doctor-avatar").querySelector("img")).toHaveAttribute("src", "/photos/1-170000.jpg");
  });

  it("calls onBack when the back-to-doctor-list control is activated", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<DoctorDetailScreen doctor={doctor()} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "Back to doctor list" }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
