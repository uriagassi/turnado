import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentStatus, Doctor } from "../api";
import { AppointmentCard } from "../components/AppointmentCard";

export function UpcomingAppointmentsScreen({
  appointments,
  doctors,
  onSelectDoctor,
  onEdit,
  onStatusChange,
  onSaveSummary,
  onBack,
}: {
  appointments: Appointment[];
  doctors: Doctor[];
  /** Follows an appointment card's doctor-name link into that doctor's detail view (see issue #4 AC). */
  onSelectDoctor: (doctor: Doctor) => void;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
  onSaveSummary: (appointment: Appointment, summary: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  return (
    <main className="screen upcoming-appointments-screen">
      <h1>{t("upcomingAppointments.title")}</h1>
      {appointments.length === 0 ? (
        <p className="empty-state">{t("upcomingAppointments.empty")}</p>
      ) : (
        <ul className="appointment-list">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              doctor={appointment.doctorId ? doctors.find((d) => d.id === appointment.doctorId) : undefined}
              onSelectDoctor={onSelectDoctor}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onSaveSummary={onSaveSummary}
            />
          ))}
        </ul>
      )}
      <button type="button" className="back-to-home" onClick={onBack}>
        {t("upcomingAppointments.back")}
      </button>
    </main>
  );
}
