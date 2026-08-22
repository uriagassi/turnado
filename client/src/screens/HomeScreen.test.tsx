import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen } from "./HomeScreen";
import type { Doctor, HomeData } from "../api";

const emptyHome: HomeData = { nextAppointment: null, openItems: [], recentDocuments: [] };
const noopProps = {
  onRefresh: () => {},
  doctors: [] as Doctor[],
  onSelectDoctor: () => {},
  onAddAppointment: () => {},
};

describe("HomeScreen", () => {
  it("calls onRefresh when the manual refresh control is activated", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<HomeScreen home={emptyHome} {...noopProps} onRefresh={onRefresh} />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("renders recent documents and calls onSelectDocument when a document card is clicked", async () => {
    const user = userEvent.setup();
    const onSelectDocument = vi.fn();

    const home: HomeData = {
      nextAppointment: null,
      openItems: [],
      recentDocuments: [
        {
          id: 101,
          notebookId: 42,
          title: "Lab Blood Test",
          type: "test result",
          documentDate: "2026-08-10",
          doctorId: null,
          notes: null,
          file: {
            fileName: "blood.pdf",
            uniqueFilename: "unique_blood.pdf",
            mime: "application/pdf",
            hash: "h",
            size: 1024,
          },
          appointmentIds: [],
          taskIds: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
    };

    render(<HomeScreen home={home} {...noopProps} onSelectDocument={onSelectDocument} />);

    expect(screen.getByText("Recent documents")).toBeInTheDocument();
    expect(screen.getByText("Lab Blood Test")).toBeInTheDocument();

    await user.click(screen.getByText("Lab Blood Test"));
    expect(onSelectDocument).toHaveBeenCalledWith(home.recentDocuments[0]);
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
        missedReminder: null,
      },
      openItems: [],
      recentDocuments: [],
    };

    render(<HomeScreen home={home} {...noopProps} />);

    expect(screen.getByText("Annual checkup")).toBeInTheDocument();
  });

  it("shows a missed-reminder marker on the hero card with the exact reason available on tap, when nextAppointment has one (issue #10)", async () => {
    const user = userEvent.setup();
    const home: HomeData = {
      nextAppointment: {
        id: 1,
        doctorId: null,
        dateTime: "2026-09-01T10:00:00Z",
        location: undefined,
        notes: "Annual checkup",
        status: "planned",
        summary: null,
        missedReminder: "send failed",
      },
      openItems: [],
      recentDocuments: [],
    };

    render(<HomeScreen home={home} {...noopProps} />);

    expect(screen.queryByText("The reminder email failed to send.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reminder missed" }));

    expect(screen.getByText("The reminder email failed to send.")).toBeInTheDocument();
  });

  it("omits the hero card and shows an empty-state message when there's no upcoming appointment", () => {
    render(<HomeScreen home={emptyHome} {...noopProps} />);

    expect(screen.queryByText("Annual checkup")).not.toBeInTheDocument();
    expect(screen.getByText("No upcoming appointment.")).toBeInTheDocument();
  });

  it("shows an empty-state message for open items when there are none, instead of hiding the section", () => {
    render(<HomeScreen home={emptyHome} {...noopProps} />);

    expect(screen.getByText("Open items")).toBeInTheDocument();
    expect(screen.getByText("No open items.")).toBeInTheDocument();
  });

  it("shows an empty-state message for recent documents when there are none, instead of hiding the section", () => {
    render(<HomeScreen home={emptyHome} {...noopProps} />);

    expect(screen.getByText("Recent documents")).toBeInTheDocument();
    expect(screen.getByText("No documents yet.")).toBeInTheDocument();
  });

  it("puts the add-appointment control next to the Next appointment section even when there's no appointment yet", () => {
    render(<HomeScreen home={emptyHome} {...noopProps} />);

    expect(screen.getByText("Next appointment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add appointment" })).toBeInTheDocument();
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
        missedReminder: null,
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

    await user.click(screen.getByRole("button", { name: "+ Add appointment" }));

    expect(onAddAppointment).toHaveBeenCalledOnce();
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
        missedReminder: null,
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
          missedReminder: null,
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

  it("shows a missed-reminder marker on an open item, without triggering onSelectTask when the marker itself is tapped (issue #10)", async () => {
    const user = userEvent.setup();
    const onSelectTask = vi.fn();
    const home: HomeData = {
      nextAppointment: null,
      openItems: [
        {
          id: 102,
          type: "test",
          title: "Blood test (CBC)",
          status: "open",
          dueDate: "2026-09-01",
          doctorId: null,
          sourceAppointmentId: null,
          pendingAppointmentId: null,
          requiresAdvanceScheduling: false,
          recurrenceWindow: null,
          approximateDateWindow: null,
          institution: null,
          department: null,
          healthFund: null,
          codeNumber: null,
          codeName: null,
          issuingBody: null,
          purpose: null,
          createdAt: "2026-08-01",
          updatedAt: "2026-08-01",
          missedReminder: "send failed",
        },
      ],
      recentDocuments: [],
    };

    render(<HomeScreen home={home} {...noopProps} onSelectTask={onSelectTask} />);

    expect(screen.queryByText("The reminder email failed to send.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reminder missed" }));

    expect(screen.getByText("The reminder email failed to send.")).toBeInTheDocument();
    expect(onSelectTask).not.toHaveBeenCalled();
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
          missedReminder: null,
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
        missedReminder: null,
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
