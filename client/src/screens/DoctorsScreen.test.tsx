import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DoctorsScreen } from "./DoctorsScreen";
import type { Doctor } from "../api";

function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 1,
    name: "Dr. Jane Smith",
    specialty: "Cardiology",
    photoPath: null,
    ...overrides,
  };
}

describe("DoctorsScreen", () => {
  it("renders each doctor's name", () => {
    render(<DoctorsScreen doctors={[doctor({ id: 1, name: "Dr. Jane Smith" }), doctor({ id: 2, name: "Dr. Amy Lee" })]} />);

    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Dr. Amy Lee")).toBeInTheDocument();
  });

  it("shows a colored-initials avatar instead of a blank placeholder when a doctor has no photo", () => {
    render(<DoctorsScreen doctors={[doctor({ name: "Dr. Jane Smith", photoPath: null })]} />);

    const avatar = screen.getByTestId("doctor-avatar");
    expect(avatar).toHaveTextContent("JS");
    expect(avatar.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows the doctor's photo instead of initials when photoPath is set", () => {
    // photoPath is the bare filename multer wrote under the server's
    // photosDir (see server/src/app.ts) — the client builds the /photos URL.
    render(<DoctorsScreen doctors={[doctor({ name: "Dr. Jane Smith", photoPath: "1-1700000000000.jpg" })]} />);

    const avatar = screen.getByTestId("doctor-avatar");
    const img = avatar.querySelector("img");
    expect(img).toHaveAttribute("src", "/photos/1-1700000000000.jpg");
    expect(img).toHaveAttribute("alt", "Dr. Jane Smith");
    expect(avatar).not.toHaveTextContent("JS");
  });

  it("shows an empty state when there are no doctors yet", () => {
    render(<DoctorsScreen doctors={[]} />);

    expect(screen.getByText("No doctors yet — add one to get started.")).toBeInTheDocument();
  });
});
