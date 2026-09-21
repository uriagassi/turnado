import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentStatus, Doctor } from "../api";
import { AppointmentCard } from "../components/AppointmentCard";
import { AppointmentCalendar } from "../components/AppointmentCalendar";

type ViewMode = "list" | "calendar";

export function UpcomingAppointmentsScreen({
  appointments,
  doctors,
  onEdit,
  onStatusChange,
  onSaveSummary,
  onSelect,
  now,
}: {
  appointments: Appointment[];
  doctors: Doctor[];
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
  onSaveSummary: (appointment: Appointment, summary: string) => void;
  /** Opens the appointment's own detail/checklist screen (issue #9). */
  onSelect?: (appointment: Appointment) => void;
  /** Only ever overridden in tests, so the calendar's default month is deterministic — see AppointmentCalendar. */
  now?: Date;
}) {
  const { t } = useTranslation();
  // List remains the default view (issue #22 AC) — calendar is opt-in per visit, not remembered across screens.
  const [view, setView] = useState<ViewMode>("list");

  return (
    <main className="screen upcoming-appointments-screen">
      <h1>{t("upcomingAppointments.title")}</h1>

      <div className="view-toggle" role="group" aria-label={t("upcomingAppointments.view.label")}>
        <button
          type="button"
          className={`btn-small ${view === "list" ? "btn-primary" : "btn-secondary"}`}
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          {t("upcomingAppointments.view.list")}
        </button>
        <button
          type="button"
          className={`btn-small ${view === "calendar" ? "btn-primary" : "btn-secondary"}`}
          aria-pressed={view === "calendar"}
          onClick={() => setView("calendar")}
        >
          {t("upcomingAppointments.view.calendar")}
        </button>
      </div>

      {view === "list" ? (
        appointments.length === 0 ? (
          <p className="empty-state">{t("upcomingAppointments.empty")}</p>
        ) : (
          <ul className="appointment-list">
            {appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                doctor={appointment.doctorId ? doctors.find((d) => d.id === appointment.doctorId) : undefined}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onSaveSummary={onSaveSummary}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )
      ) : (
        <AppointmentCalendar
          appointments={appointments}
          doctors={doctors}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          onSaveSummary={onSaveSummary}
          onSelect={onSelect}
          now={now}
        />
      )}
    </main>
  );
}
