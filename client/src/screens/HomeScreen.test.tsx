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

  it("renders open items in the feed with status badges and triggers onSelectTask", async () => {
    const user = userEvent.setup();
    const onSelectTask = vi.fn();
    const home: HomeData = {
      nextAppointment: null,
      openItems: [
        {
          id: 101,
          type: "form_17",
          title: "Get Form 17 for Neurology",
          status: "in-progress",
          dueDate: "2026-09-01",
          doctorId: null,
          sourceAppointmentId: null,
          pendingAppointmentId: null,
          requiresAdvanceScheduling: false,
          recurrenceWindow: null,
          approximateDateWindow: null,
          institution: "Assuta",
          department: "Neurology",
          healthFund: "Maccabi",
          codeNumber: null,
          codeName: null,
          issuingBody: null,
          purpose: null,
          createdAt: "2026-08-01",
          updatedAt: "2026-08-01",
        },
      ],
      recentDocuments: [],
    };

    render(<HomeScreen home={home} {...noopProps} onSelectTask={onSelectTask} />);

    expect(screen.getByText("Get Form 17 for Neurology")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();

    await user.click(screen.getByText("Get Form 17 for Neurology"));
    expect(onSelectTask).toHaveBeenCalledWith(home.openItems[0]);
  });

  it("displays pending-appointment tag on an open item linked to an appointment", () => {
    const home: HomeData = {
      nextAppointment: null,
      openItems: [
        {
          id: 102,
          type: "test",
          title: "Blood test (CBC)",
          status: "open",
          dueDate: null,
          doctorId: null,
          sourceAppointmentId: null,
          pendingAppointmentId: 55,
          requiresAdvanceScheduling: false,
          recurrenceWindow: null,
          approximateDateWindow: "Late August",
          institution: null,
          department: null,
          healthFund: null,
          codeNumber: null,
          codeName: null,
          issuingBody: null,
          purpose: null,
          createdAt: "2026-08-01",
          updatedAt: "2026-08-01",
        },
      ],
      recentDocuments: [],
    };

    const appointments = [
      {
        id: 55,
        doctorId: 7,
        dateTime: "2026-09-05T10:00:00Z",
        location: "Assuta",
        notes: "Neurologist visit",
        status: "planned" as const,
        summary: null,
      },
    ];
    const doctors: Doctor[] = [
      { id: 7, name: "Dr. Jane Smith", specialty: "Neurology", photoPath: null },
    ];

    render(
      <HomeScreen
        home={home}
        {...noopProps}
        appointments={appointments}
        doctors={doctors}
      />
    );

    expect(screen.getByText("Blood test (CBC)")).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Jane Smith|Neurologist visit/)).toBeInTheDocument();
  });
});
