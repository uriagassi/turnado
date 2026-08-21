import { useTranslation } from "react-i18next";
import type { Appointment, Doctor } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";

export function DoctorsScreen({
  doctors,
  nextAppointments,
  onSelectDoctor,
  onAddDoctor,
}: {
  doctors: Doctor[];
  /** Each doctor's soonest upcoming appointment, keyed by doctor id — same computation as DoctorDetailScreen's `nextAppointment` (App.tsx's nextAppointmentForDoctor), just for every row on this screen instead of one. Matches the prototype's directory-row "התור הבא: …" preview (06-doctor-view.html). */
  nextAppointments: Map<number, Appointment | undefined>;
  onSelectDoctor: (doctor: Doctor) => void;
  onAddDoctor: () => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();

  return (
    <main className="screen doctors-screen">
      <h1>{t("doctors.title")}</h1>
      <button type="button" className="add-doctor" onClick={onAddDoctor}>
        {t("doctors.add")}
      </button>
      {doctors.length === 0 ? (
        <p className="empty-state">{t("doctors.empty")}</p>
      ) : (
        <ul className="doctor-list">
          {doctors.map((doctor) => {
            const nextAppointment = nextAppointments.get(doctor.id);
            return (
              <li key={doctor.id}>
                {/* The whole row is the "details" affordance (AC: "list cards
                    with a clear details affordance") — a button rather than a
                    link since there's no URL routing in this app (see App.tsx).
                    Specialty line + tap-hint pill match the winning doctor-card
                    prototype (06-doctor-view.html) — its round-2 feedback
                    flagged "not obvious a doctor row is tappable" against a
                    bare row, which the hint pill is there to fix. */}
                <button type="button" className="doctor-row" onClick={() => onSelectDoctor(doctor)}>
                  <DoctorAvatar doctor={doctor} />
                  <span className="doctor-row-info">
                    <span className="doctor-name">{doctor.name}</span>
                    {doctor.specialty && <span className="doctor-row-specialty">{doctor.specialty}</span>}
                    {nextAppointment && (
                      <span className="doctor-row-next">
                        {t("doctors.nextAppointment", { date: formatRelative(nextAppointment.dateTime) })}
                      </span>
                    )}
                  </span>
                  <span className="doctor-row-hint" aria-hidden="true">
                    {t("doctors.viewDetails")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
