import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavBar } from "./NavBar";

describe("NavBar", () => {
  it("shows the current screen's title", () => {
    render(<NavBar title="Doctors" onNavigate={vi.fn()} />);

    expect(screen.getByText("Doctors")).toBeInTheDocument();
  });

  it("hides the destination menu until the hamburger control is activated, then lists every top-level destination", async () => {
    const user = userEvent.setup();
    render(<NavBar title="Home" onNavigate={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Doctors" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Doctors" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upcoming appointments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appointment history" })).toBeInTheDocument();
  });

  it("navigates to the selected destination when a menu item is activated", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<NavBar title="Home" onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "Upcoming appointments" }));

    expect(onNavigate).toHaveBeenCalledWith("appointment-upcoming");
  });

  it("closes the drawer once a destination is selected", async () => {
    const user = userEvent.setup();
    render(<NavBar title="Home" onNavigate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "Upcoming appointments" }));

    expect(screen.queryByRole("button", { name: "Doctors" })).not.toBeInTheDocument();
  });

  it("closes the drawer when the hamburger control is activated again", async () => {
    const user = userEvent.setup();
    render(<NavBar title="Home" onNavigate={vi.fn()} />);

    const menuButton = screen.getByRole("button", { name: "Menu" });
    await user.click(menuButton);
    expect(screen.getByRole("button", { name: "Doctors" })).toBeInTheDocument();

    await user.click(menuButton);

    expect(screen.queryByRole("button", { name: "Doctors" })).not.toBeInTheDocument();
  });

  it("closes the drawer when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<NavBar title="Home" onNavigate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Doctors" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Doctors" })).not.toBeInTheDocument();
  });

  it("has no back control on a top-level screen (no onBack given)", () => {
    render(<NavBar title="Home" onNavigate={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("shows a back control that calls onBack when activated, on a drill-in screen", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<NavBar title="Dr. Jane Smith" onNavigate={vi.fn()} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows the app name at the top of the drawer menu", async () => {
    const user = userEvent.setup();
    render(<NavBar title="Home" onNavigate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.getByText("Turnado")).toBeInTheDocument();
  });
});
