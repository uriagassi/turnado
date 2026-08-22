import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentStatus, Doctor } from "../api";
import { AppointmentCard } from "../components/AppointmentCard";

export function AppointmentHistoryScreen({
  appointments,
  doctors,
  onEdit,
  onStatusChange,
  onSaveSummary,
  onSelect,
}: {
  appointments: Appointment[];
  doctors: Doctor[];
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
  onSaveSummary: (appointment: Appointment, summary: string) => void;
  /** Opens the appointment's own detail/checklist screen (issue #9). */
  onSelect?: (appointment: Appointment) => void;
}) {
  const { t } = useTranslation();

  return (
    <main className="screen appointment-history-screen">
      <h1>{t("appointmentHistory.title")}</h1>
      {appointments.length === 0 ? (
        <p className="empty-state">{t("appointmentHistory.empty")}</p>
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
      )}
    </main>
  );
}
