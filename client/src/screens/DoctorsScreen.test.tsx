import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoctorsScreen } from "./DoctorsScreen";
import type { Doctor } from "../api";

function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 1,
    name: "Dr. Jane Smith",
    specialty: "Cardiology",
    notes: "Family physician",
    photoPath: null,
    ...overrides,
  };
}

// onSelectDoctor/onAddDoctor are required by the component but irrelevant to
// most of these tests — defaulting them here keeps each test's render call
// focused on what it's actually asserting.
function renderScreen(
  doctors: Doctor[],
  onSelectDoctor: (doctor: Doctor) => void = () => {},
  onAddDoctor: () => void = () => {},
  onBackHome: () => void = () => {},
) {
  return render(<DoctorsScreen doctors={doctors} onSelectDoctor={onSelectDoctor} onAddDoctor={onAddDoctor} onBackHome={onBackHome} />);
}

describe("DoctorsScreen", () => {
  it("renders each doctor's name", () => {
    renderScreen([doctor({ id: 1, name: "Dr. Jane Smith" }), doctor({ id: 2, name: "Dr. Amy Lee" })]);

    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Dr. Amy Lee")).toBeInTheDocument();
  });

  it("shows a colored-initials avatar instead of a blank placeholder when a doctor has no photo", () => {
    renderScreen([doctor({ name: "Dr. Jane Smith", photoPath: null })]);

    const avatar = screen.getByTestId("doctor-avatar");
    expect(avatar).toHaveTextContent("JS");
    expect(avatar.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows the doctor's photo instead of initials when photoPath is set", () => {
    // photoPath is the bare filename multer wrote under the server's
    // photosDir (see server/src/app.ts) — the client builds the /photos URL.
    renderScreen([doctor({ name: "Dr. Jane Smith", photoPath: "1-1700000000000.jpg" })]);

    const avatar = screen.getByTestId("doctor-avatar");
    const img = avatar.querySelector("img");
    expect(img).toHaveAttribute("src", "/photos/1-1700000000000.jpg");
    expect(img).toHaveAttribute("alt", "Dr. Jane Smith");
    expect(avatar).not.toHaveTextContent("JS");
  });

  it("shows an empty state when there are no doctors yet", () => {
    renderScreen([]);

    expect(screen.getByText("No doctors yet — add one to get started.")).toBeInTheDocument();
  });

  it("gives each initials avatar a distinct color instead of the same flat background", () => {
    renderScreen([doctor({ id: 1, name: "Dr. Jane Smith" }), doctor({ id: 2, name: "Dr. Amy Lee" })]);

    const [first, second] = screen.getAllByTestId("doctor-avatar").map((el) => el.style.backgroundColor);
    expect(first).not.toBe("");
    expect(second).not.toBe("");
    expect(first).not.toBe(second);
  });

  it("gives the same doctor the same avatar color every render", () => {
    const { unmount } = renderScreen([doctor({ id: 7, name: "Dr. Jane Smith" })]);
    const first = screen.getByTestId("doctor-avatar").style.backgroundColor;
    unmount();

    renderScreen([doctor({ id: 7, name: "Dr. Jane Smith" })]);

    expect(screen.getByTestId("doctor-avatar").style.backgroundColor).toBe(first);
  });

  it("calls onSelectDoctor with the doctor when a row's details affordance is activated", async () => {
    const user = userEvent.setup();
    const onSelectDoctor = vi.fn();
    const selected = doctor({ id: 42, name: "Dr. Jane Smith" });
    renderScreen([selected], onSelectDoctor);

    await user.click(screen.getByRole("button", { name: /Dr\. Jane Smith/ }));

    expect(onSelectDoctor).toHaveBeenCalledTimes(1);
    expect(onSelectDoctor).toHaveBeenCalledWith(selected);
  });

  it("calls onAddDoctor when the add-doctor control is activated", async () => {
    const user = userEvent.setup();
    const onAddDoctor = vi.fn();
    renderScreen([], () => {}, onAddDoctor);

    await user.click(screen.getByRole("button", { name: "Add doctor" }));

    expect(onAddDoctor).toHaveBeenCalledOnce();
  });

  it("calls onBackHome when the home control is activated", async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    renderScreen([], () => {}, () => {}, onBackHome);

    await user.click(screen.getByRole("button", { name: "Home" }));

    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
