import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen } from "./HomeScreen";
import type { HomeData } from "../api";

const emptyHome: HomeData = { nextAppointment: null, openItems: [], recentDocuments: [] };

describe("HomeScreen", () => {
  it("calls onOpenDoctors when the doctors entry point is activated", async () => {
    const user = userEvent.setup();
    const onOpenDoctors = vi.fn();
    render(<HomeScreen home={emptyHome} onOpenDoctors={onOpenDoctors} />);

    await user.click(screen.getByRole("button", { name: "Doctors" }));

    expect(onOpenDoctors).toHaveBeenCalledOnce();
  });
});
