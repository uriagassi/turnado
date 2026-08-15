import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen } from "./HomeScreen";
import type { Doctor, HomeData } from "../api";

const emptyHome: HomeData = { nextAppointment: null, openItems: [], recentDocuments: [] };
const noopProps = {
  onOpenDoctors: () => {},
  onRefresh: () => {},
  doctors: [] as Doctor[],
  onSelectDoctor: () => {},
  onAddAppointment: () => {},
  onViewUpcoming: () => {},
  onViewHistory: () => {},
};

describe("HomeScreen", () => {
  it("calls onOpenDoctors when the doctors entry point is activated", async () => {
    const user = userEvent.setup();
    const onOpenDoctors = vi.fn();
    render(<HomeScreen home={emptyHome} {...noopProps} onOpenDoctors={onOpenDoctors} />);

    await user.click(screen.getByRole("button", { name: "Doctors" }));

    expect(onOpenDoctors).toHaveBeenCalledOnce();
  });

  it("calls onRefresh when the manual refresh control is activated", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<HomeScreen home={emptyHome} {...noopProps} onRefresh={onRefresh} />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows a hero card for the next upcoming appointment when there is one", () => {
    const home: HomeData = {
      nextAppointment: {
        id: 1,
        doctorId: null,
        dateTime: "2026-09-01T10:00:00Z",
        location: undefined,
        notes: "Annual checkup",
        status: "planned",
        summary: null,
      },
      openItems: [],
      recentDocuments: [],
    };

    render(<HomeScreen home={home} {...noopProps} />);

    expect(screen.getByText("Annual checkup")).toBeInTheDocument();
  });

  it("omits the hero card and shows the empty state when there's no upcoming appointment", () => {
    render(<HomeScreen home={emptyHome} {...noopProps} />);

    expect(screen.queryByText("Annual checkup")).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it("shows the appointment's doctor as a link that opens that doctor's detail view", async () => {
    const user = userEvent.setup();
    const onSelectDoctor = vi.fn();
    const janeSmith: Doctor = { id: 7, name: "Dr. Jane Smith", notes: "", photoPath: null };
    const home: HomeData = {
      nextAppointment: {
        id: 1,
        doctorId: 7,
        dateTime: "2026-09-01T10:00:00Z",
        location: undefined,
        notes: "Annual checkup",
        status: "planned",
        summary: null,
      },
      openItems: [],
      recentDocuments: [],
    };

    render(<HomeScreen home={home} {...noopProps} doctors={[janeSmith]} onSelectDoctor={onSelectDoctor} />);
    await user.click(screen.getByRole("button", { name: "Dr. Jane Smith" }));

    expect(onSelectDoctor).toHaveBeenCalledWith(janeSmith);
  });

  it("calls onAddAppointment when the add-appointment control is activated", async () => {
    const user = userEvent.setup();
    const onAddAppointment = vi.fn();
    render(<HomeScreen home={emptyHome} {...noopProps} onAddAppointment={onAddAppointment} />);

    await user.click(screen.getByRole("button", { name: "Add appointment" }));

    expect(onAddAppointment).toHaveBeenCalledOnce();
  });

  it("calls onViewUpcoming when the upcoming-appointments control is activated", async () => {
    const user = userEvent.setup();
    const onViewUpcoming = vi.fn();
    render(<HomeScreen home={emptyHome} {...noopProps} onViewUpcoming={onViewUpcoming} />);

    await user.click(screen.getByRole("button", { name: "Upcoming appointments" }));

    expect(onViewUpcoming).toHaveBeenCalledOnce();
  });

  it("calls onViewHistory when the history control is activated", async () => {
    const user = userEvent.setup();
    const onViewHistory = vi.fn();
    render(<HomeScreen home={emptyHome} {...noopProps} onViewHistory={onViewHistory} />);

    await user.click(screen.getByRole("button", { name: "Appointment history" }));

    expect(onViewHistory).toHaveBeenCalledOnce();
  });

  it("omits the doctor link when the appointment has no doctor attached", () => {
    const home: HomeData = {
      nextAppointment: {
        id: 1,
        doctorId: null,
        dateTime: "2026-09-01T10:00:00Z",
        location: undefined,
        notes: "MRI scan",
        status: "planned",
        summary: null,
      },
      openItems: [],
      recentDocuments: [],
    };

    render(<HomeScreen home={home} {...noopProps} />);

    expect(screen.queryByRole("button", { name: /Dr\./ })).not.toBeInTheDocument();
  });
});
